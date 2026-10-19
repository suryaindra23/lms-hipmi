import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentType, DataSubjectRequestStatus, DataSubjectRequestType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async listSubjects(actor: any) {
    const now = new Date();
    if (actor.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: actor.studentId, school: { organizationId: actor.organizationId } },
        select: { id: true, fullName: true, studentNumber: true },
      });
      return student ? [student] : [];
    }
    if (!actor.parentId) return [];
    const links = await this.prisma.studentParent.findMany({
      where: {
        parentId: actor.parentId,
        verificationStatus: 'VERIFIED',
        revokedAt: null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        student: { school: { organizationId: actor.organizationId } },
      },
      select: { student: { select: { id: true, fullName: true, studentNumber: true } } },
    });
    return links.map((link) => link.student);
  }

  async listDocuments(organizationId: string) {
    const defaults: Array<{ type: ConsentType; title: string; content: string }> = [
      { type: 'PLATFORM', title: 'Penggunaan platform', content: 'Persetujuan pemrosesan data yang diperlukan untuk menyediakan akun dan layanan pembelajaran.' },
      { type: 'GUARDIAN', title: 'Persetujuan orang tua/wali', content: 'Persetujuan wali terverifikasi untuk pemrosesan data siswa sesuai tujuan program.' },
      { type: 'PUBLICATION', title: 'Publikasi karya', content: 'Pilihan sukarela untuk publikasi karya atau materi siswa yang telah disetujui.' },
      { type: 'ANALYTICS', title: 'Analytics opsional', content: 'Pilihan penggunaan data analytics non-sensitif untuk peningkatan layanan.' },
      { type: 'IDENTITY', title: 'Pemrosesan identitas', content: 'Persetujuan terbatas untuk memproses identifier dan dokumen privat dalam alur verifikasi identitas.' },
    ];
    await Promise.all(defaults.map((item) => {
      const version = item.type === 'IDENTITY' ? '2026-08-27-identity-v1' : '2026-08-04';
      return this.prisma.consentDocument.upsert({
        where: { organizationId_type_version: { organizationId, type: item.type, version } },
        update: {},
        create: {
          organizationId,
          type: item.type,
          version,
          title: item.title,
          content: item.content,
          effectiveAt: item.type === 'IDENTITY' ? new Date('2026-08-27T00:00:00.000Z') : new Date('2026-08-04T00:00:00.000Z'),
        },
      });
    }));
    return this.prisma.consentDocument.findMany({
      where: { organizationId, effectiveAt: { lte: new Date() }, retiredAt: null },
      select: { id: true, type: true, version: true, title: true, content: true, effectiveAt: true },
      orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }],
    });
  }

  async listMyConsents(actor: any) {
    const now = new Date();
    const accessScopes: Prisma.ConsentWhereInput[] = [
      { grantedById: actor.userId },
      { subjectUserId: actor.userId },
    ];
    if (actor.parentId) {
      accessScopes.push({
        student: {
          studentParents: {
            some: {
              parentId: actor.parentId,
              verificationStatus: 'VERIFIED',
              revokedAt: null,
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
          },
        },
      });
    }
    const consents = await this.prisma.consent.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: accessScopes,
      },
      select: {
        id: true, type: true, status: true, method: true, grantedAt: true, effectiveAt: true,
        expiresAt: true, withdrawnAt: true, withdrawalReason: true,
        grantedById: true, subjectUserId: true, studentId: true,
        document: { select: { title: true, version: true } },
        student: { select: { id: true, fullName: true, studentNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return consents.map(({ grantedById, subjectUserId, studentId, ...consent }) => ({
      ...consent,
      mayWithdraw: grantedById === actor.userId || subjectUserId === actor.userId || studentId === actor.studentId,
    }));
  }

  async grant(actor: any, data: { documentId: string; type: ConsentType; studentId?: string; method: string }) {
    if (data.type === 'IDENTITY') {
      throw new BadRequestException('Persetujuan identitas hanya dicatat melalui alur pengajuan identitas');
    }
    if (data.method !== 'AUTHENTICATED_CHECKBOX') {
      throw new BadRequestException('Metode persetujuan tidak didukung pada alur mandiri');
    }
    const now = new Date();
    const document = await this.prisma.consentDocument.findFirst({
      where: { id: data.documentId, organizationId: actor.organizationId, type: data.type, effectiveAt: { lte: now }, retiredAt: null },
    });
    if (!document) throw new NotFoundException('Dokumen persetujuan aktif tidak ditemukan');
    const subject = await this.resolveSubject(actor, data.studentId || actor.studentId);
    const studentId = subject.studentId;
    const subjectUserId = subject.subjectUserId;
    if (data.type === 'GUARDIAN' && (!actor.parentId || !data.studentId)) {
      throw new ForbiddenException('Persetujuan wali hanya dapat diberikan orang tua/wali dengan relasi terverifikasi');
    }
    if (data.type === 'PUBLICATION' && studentId) {
      const adultThreshold = new Date();
      adultThreshold.setFullYear(adultThreshold.getFullYear() - 18);
      if ((!subject.birthDate || subject.birthDate > adultThreshold) && !actor.parentId) {
        throw new ForbiddenException('Publikasi karya siswa di bawah 18 tahun memerlukan persetujuan wali terverifikasi');
      }
    }
    if (!studentId && !subjectUserId) throw new BadRequestException('Subjek persetujuan tidak ditemukan');
    await this.prisma.consent.updateMany({
      where: { organizationId: actor.organizationId, studentId, subjectUserId, type: data.type, status: 'ACTIVE' },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawalReason: 'Digantikan versi terbaru' },
    });
    return this.prisma.consent.create({
      data: {
        organizationId: actor.organizationId,
        schoolId: subject.schoolId,
        studentId,
        subjectUserId,
        grantedById: actor.userId,
        documentId: document.id,
        type: data.type,
        method: 'AUTHENTICATED_CHECKBOX',
        evidence: { authenticated: true },
      },
      select: { id: true, type: true, status: true, grantedAt: true },
    });
  }

  async withdraw(actor: any, id: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Alasan penarikan wajib diisi');
    const consent = await this.prisma.consent.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        status: 'ACTIVE',
        OR: [
          { grantedById: actor.userId },
          { subjectUserId: actor.userId },
          ...(actor.studentId ? [{ studentId: actor.studentId }] : []),
        ],
      },
    });
    if (!consent) throw new NotFoundException('Persetujuan aktif tidak ditemukan');
    return this.prisma.$transaction(async (tx) => {
      const withdrawn = await tx.consent.update({
        where: { id },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawalReason: reason.trim() },
        select: { id: true, status: true, withdrawnAt: true },
      });
      await tx.dataSubjectRequest.create({
        data: {
          organizationId: actor.organizationId,
          schoolId: consent.schoolId,
          studentId: consent.studentId,
          requesterId: actor.userId,
          type: 'CONSENT_WITHDRAWAL',
          details: `Withdrawal recorded for consent ${consent.id}`,
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return withdrawn;
    });
  }

  async createRequest(actor: any, data: { type: DataSubjectRequestType; studentId?: string; details?: string }) {
    const subject = await this.resolveSubject(actor, data.studentId || actor.studentId);
    const openRequest = await this.prisma.dataSubjectRequest.count({
      where: {
        organizationId: actor.organizationId,
        requesterId: actor.userId,
        studentId: subject.studentId,
        type: data.type,
        status: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED'] },
      },
    });
    if (openRequest) throw new ConflictException('Permintaan sejenis masih dalam proses');
    return this.prisma.dataSubjectRequest.create({
      data: {
        organizationId: actor.organizationId,
        schoolId: subject.schoolId,
        studentId: subject.studentId,
        requesterId: actor.userId,
        type: data.type,
        details: data.details,
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, type: true, status: true, dueAt: true, createdAt: true },
    });
  }

  listMyRequests(actor: any) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { organizationId: actor.organizationId, requesterId: actor.userId },
      select: { id: true, type: true, status: true, details: true, resolution: true, dueAt: true, completedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listRequests(actor: any) {
    this.assertPrivacyAdmin(actor);
    return this.prisma.dataSubjectRequest.findMany({
      where: { organizationId: actor.organizationId, ...(actor.schoolId ? { schoolId: actor.schoolId } : {}) },
      select: {
        id: true, type: true, status: true, details: true, dueAt: true, createdAt: true,
        requester: { select: { id: true, email: true, firstName: true, lastName: true } },
        student: { select: { id: true, fullName: true, studentNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async updateRequest(actor: any, id: string, data: { status: DataSubjectRequestStatus; resolution?: string }) {
    this.assertPrivacyAdmin(actor);
    const request = await this.prisma.dataSubjectRequest.findFirst({
      where: { id, organizationId: actor.organizationId, ...(actor.schoolId ? { schoolId: actor.schoolId } : {}) },
    });
    if (!request) throw new NotFoundException('Permintaan hak data tidak ditemukan');
    const allowedTransitions: Record<DataSubjectRequestStatus, DataSubjectRequestStatus[]> = {
      SUBMITTED: ['IN_REVIEW', 'CANCELLED'],
      IN_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['COMPLETED', 'CANCELLED'],
      REJECTED: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowedTransitions[request.status].includes(data.status)) {
      throw new BadRequestException(`Transisi status ${request.status} ke ${data.status} tidak valid`);
    }
    if (['REJECTED', 'COMPLETED'].includes(data.status) && !data.resolution?.trim()) {
      throw new BadRequestException('Resolusi wajib diisi untuk status akhir');
    }
    return this.prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        status: data.status,
        resolution: data.resolution,
        handledById: actor.userId,
        completedAt: ['REJECTED', 'COMPLETED', 'CANCELLED'].includes(data.status) ? new Date() : null,
      },
      select: { id: true, status: true, resolution: true, completedAt: true },
    });
  }

  private assertPrivacyAdmin(actor: any) {
    if (!actor.roles?.some((role: string) => ['super-admin', 'school-admin'].includes(role))) {
      throw new ForbiddenException('Akses pengelolaan privasi hanya untuk administrator');
    }
  }

  private async resolveSubject(actor: any, requestedStudentId?: string) {
    if (!requestedStudentId) {
      return { studentId: undefined, subjectUserId: actor.userId, schoolId: actor.schoolId, birthDate: null as Date | null };
    }
    const student = await this.prisma.student.findFirst({
      where: { id: requestedStudentId, school: { organizationId: actor.organizationId } },
      select: { id: true, userId: true, schoolId: true, birthDate: true },
    });
    if (!student) throw new NotFoundException('Subjek siswa tidak ditemukan');
    if (actor.studentId !== student.id) {
      if (!actor.parentId) throw new ForbiddenException('Relasi wali terverifikasi diperlukan');
      const now = new Date();
      const relation = await this.prisma.studentParent.count({
        where: {
          studentId: student.id,
          parentId: actor.parentId,
          verificationStatus: 'VERIFIED',
          revokedAt: null,
          effectiveFrom: { lte: now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
      });
      if (!relation) throw new ForbiddenException('Relasi wali tidak aktif atau belum terverifikasi');
    }
    return { studentId: student.id, subjectUserId: student.userId, schoolId: student.schoolId, birthDate: student.birthDate };
  }
}
