import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentType, DocumentStatus, IdentifierType, Prisma, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { ObjectStorageService } from '../infrastructure/object-storage.service';
import { QueueService } from '../infrastructure/queue.service';
import { validateUploadMetadata } from '../common/utils/file-security.utils';

type IdentityContext = { userId: string; studentId: string; organizationId: string; schoolId: string };

@Injectable()
export class IdentityDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly storage: ObjectStorageService,
    private readonly queues: QueueService,
  ) {}

  async getStatus(studentId: string) {
    const [document, identifiers] = await Promise.all([
      this.prisma.identityDocument.findFirst({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, documentType: true, documentStatus: true, verificationStatus: true,
          verificationNotes: true, scanStatus: true, createdAt: true, verifiedAt: true,
        },
      }),
      this.prisma.studentIdentifier.findMany({
        where: { studentId },
        select: { type: true, last4: true, status: true },
      }),
    ]);
    return { document, identifiers: identifiers.map((item) => ({ ...item, masked: `******${item.last4}` })) };
  }

  async createUploadUrl(context: IdentityContext, data: { fileName: string; mimeType: string; sizeBytes: number }) {
    await this.assertStudentContext(context);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const { extension } = validateUploadMetadata(data.fileName, data.mimeType, data.sizeBytes, allowedMimeTypes, 8 * 1024 * 1024);
    const prefix = `${context.organizationId}/${context.schoolId}/${context.studentId}`;
    const storageKey = this.storage.createStorageKey(prefix, extension);
    const uploadUrl = await this.storage.createUploadUrl('quarantine', storageKey, data.mimeType, 300);
    return { storageKey, uploadUrl, expiresIn: 300 };
  }

  async submit(context: IdentityContext, data: {
    nik: string;
    nisn?: string;
    type: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    consent: boolean;
  }) {
    if (!/^\d{16}$/.test(data.nik)) throw new BadRequestException('NIK harus tepat 16 digit');
    if (data.nisn && !/^\d{10}$/.test(data.nisn)) throw new BadRequestException('NISN harus tepat 10 digit');
    if (!data.consent) throw new BadRequestException('Persetujuan pemrosesan identitas wajib diberikan');
    const student = await this.assertStudentContext(context);
    const existingDocument = await this.prisma.identityDocument.count({
      where: {
        studentId: context.studentId,
        OR: [
          { documentStatus: 'PENDING_VERIFICATION', scanStatus: { in: ['PENDING', 'CLEAN'] } },
          { documentStatus: 'VALID' },
        ],
      },
    });
    if (existingDocument) throw new ConflictException('Masih ada dokumen identitas aktif atau menunggu verifikasi');
    if (this.requiresGuardianConsent(student.birthDate)) {
      const now = new Date();
      const guardianConsent = await this.prisma.consent.count({
        where: {
          organizationId: context.organizationId,
          studentId: context.studentId,
          type: 'GUARDIAN',
          status: 'ACTIVE',
          effectiveAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });
      if (!guardianConsent) {
        throw new ForbiddenException('Persetujuan wali aktif diperlukan untuk siswa di bawah 18 tahun');
      }
    }
    const expectedPrefix = `${context.organizationId}/${context.schoolId}/${context.studentId}/`;
    if (!data.storageKey.startsWith(expectedPrefix)) throw new ForbiddenException('Storage key tidak berada dalam scope pengguna');
    const object = await this.storage.assertObjectExists('quarantine', data.storageKey).catch(() => {
      throw new BadRequestException('File belum berhasil diunggah atau sudah kedaluwarsa');
    });
    validateUploadMetadata(data.fileName, data.mimeType, data.sizeBytes, ['image/jpeg', 'image/png', 'application/pdf'], 8 * 1024 * 1024);
    if (object.sizeBytes !== data.sizeBytes || object.contentType !== data.mimeType) {
      throw new BadRequestException('Metadata file tidak sesuai dengan objek yang diunggah');
    }

    const consentDocument = await this.ensureIdentityConsentDocument(context.organizationId);
    const identifiers = [
      { type: IdentifierType.NIK, value: data.nik },
      ...(data.nisn ? [{ type: IdentifierType.NISN, value: data.nisn }] : []),
    ];

    let documentId: string;
    try {
      documentId = await this.prisma.$transaction(async (tx) => {
        for (const identifier of identifiers) {
          await tx.studentIdentifier.upsert({
            where: { studentId_type: { studentId: context.studentId, type: identifier.type } },
            update: {
              valueEncrypted: this.encryption.encrypt(identifier.value),
              blindIndex: this.encryption.blindIndex(identifier.value, identifier.type),
              last4: identifier.value.slice(-4),
              status: 'NEEDS_REVIEW',
            },
            create: {
              studentId: context.studentId,
              type: identifier.type,
              valueEncrypted: this.encryption.encrypt(identifier.value),
              blindIndex: this.encryption.blindIndex(identifier.value, identifier.type),
              last4: identifier.value.slice(-4),
              status: 'NEEDS_REVIEW',
            },
          });
        }
        await tx.consent.updateMany({
          where: { studentId: context.studentId, type: 'IDENTITY', status: 'ACTIVE' },
          data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawalReason: 'Digantikan versi persetujuan terbaru' },
        });
        const consent = await tx.consent.create({
          data: {
            organizationId: context.organizationId,
            schoolId: context.schoolId,
            studentId: context.studentId,
            subjectUserId: context.userId,
            grantedById: context.userId,
            documentId: consentDocument.id,
            type: 'IDENTITY',
            method: 'AUTHENTICATED_CHECKBOX',
            evidence: { purpose: 'IDENTITY_VERIFICATION' },
          },
        });
        const document = await tx.identityDocument.create({
          data: {
            studentId: context.studentId,
            uploadedById: context.userId,
            documentType: data.type,
            quarantineStorageKey: data.storageKey,
            originalFileName: data.fileName.slice(0, 255),
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            scanStatus: 'PENDING',
            documentStatus: 'PENDING_VERIFICATION',
            verificationStatus: 'NEEDS_REVIEW',
            consentId: consent.id,
          },
        });
        return document.id;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('NIK atau NISN sudah terdaftar pada siswa lain');
      }
      throw error;
    }

    await this.queues.add('identity-scan', 'scan-document', {
      organizationId: context.organizationId,
      schoolId: context.schoolId,
      requestedBy: context.userId,
      payload: { documentId },
    });
    return { id: documentId, message: 'Dokumen masuk karantina dan sedang dipindai' };
  }

  async findAllPending(organizationId: string, schoolId?: string) {
    const documents = await this.prisma.identityDocument.findMany({
      where: {
        documentStatus: 'PENDING_VERIFICATION',
        scanStatus: 'CLEAN',
        student: { schoolId, school: { organizationId } },
      },
      select: {
        id: true, documentType: true, documentStatus: true, verificationStatus: true,
        scanStatus: true, createdAt: true,
        student: {
          select: {
            fullName: true, studentNumber: true,
            school: { select: { name: true } },
            identifiers: { select: { type: true, last4: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return documents.map((document) => ({
      ...document,
      student: {
        ...document.student,
        identifiers: document.student.identifiers.map((item) => ({ ...item, masked: `******${item.last4}` })),
      },
    }));
  }

  async createDownloadUrl(id: string, organizationId: string, schoolId?: string) {
    const document = await this.prisma.identityDocument.findFirst({
      where: { id, scanStatus: 'CLEAN', documentStatus: 'PENDING_VERIFICATION', student: { schoolId, school: { organizationId } } },
      select: { cleanStorageKey: true },
    });
    if (!document?.cleanStorageKey) throw new NotFoundException('Dokumen bersih tidak ditemukan');
    return { url: await this.storage.createDownloadUrl('identity-private', document.cleanStorageKey, 90), expiresIn: 90 };
  }

  async updateStatus(id: string, status: DocumentStatus, reasonCode: string | undefined, notes: string | undefined, verifiedBy: string, organizationId: string, schoolId?: string) {
    if (!['VALID', 'REJECTED', 'NEEDS_CORRECTION'].includes(status)) throw new BadRequestException('Keputusan verifikasi tidak valid');
    if (status !== 'VALID' && (!reasonCode || !notes?.trim())) throw new BadRequestException('Kode alasan dan catatan wajib untuk penolakan/perbaikan');
    const document = await this.prisma.identityDocument.findFirst({
      where: { id, scanStatus: 'CLEAN', documentStatus: 'PENDING_VERIFICATION', student: { schoolId, school: { organizationId } } },
      select: { id: true, studentId: true },
    });
    if (!document) throw new NotFoundException('Dokumen identitas tidak ditemukan');
    const verificationStatus: VerificationStatus = status === 'VALID' ? 'VERIFIED' : status === 'REJECTED' ? 'REJECTED' : 'NEEDS_REVIEW';
    return this.prisma.$transaction(async (tx) => {
      await tx.identityReview.create({
        data: { documentId: id, reviewerId: verifiedBy, decision: verificationStatus, reasonCode, notes },
      });
      await tx.studentIdentifier.updateMany({
        where: { studentId: document.studentId },
        data: { status: verificationStatus, verifiedAt: status === 'VALID' ? new Date() : null },
      });
      return tx.identityDocument.update({
        where: { id },
        data: {
          documentStatus: status,
          verificationStatus,
          verificationNotes: notes,
          verifiedBy,
          verifiedAt: new Date(),
        },
        select: { id: true, documentStatus: true, verificationStatus: true, verifiedAt: true },
      });
    });
  }

  private ensureIdentityConsentDocument(organizationId: string) {
    return this.prisma.consentDocument.upsert({
      where: { organizationId_type_version: { organizationId, type: ConsentType.IDENTITY, version: '2026-08-27-identity-v1' } },
      update: {},
      create: {
        organizationId,
        type: 'IDENTITY',
        version: '2026-08-27-identity-v1',
        title: 'Persetujuan pemrosesan identitas',
        content: 'Data identitas digunakan terbatas untuk verifikasi kepesertaan dan dilindungi sesuai kebijakan privasi platform.',
        effectiveAt: new Date('2026-08-27T00:00:00.000Z'),
      },
    });
  }

  private async assertStudentContext(context: IdentityContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: context.studentId,
        userId: context.userId,
        schoolId: context.schoolId,
        school: { organizationId: context.organizationId, isActive: true },
      },
      select: { id: true, birthDate: true },
    });
    if (!student) throw new ForbiddenException('Konteks siswa tidak valid');
    return student;
  }

  private requiresGuardianConsent(birthDate: Date | null) {
    if (!birthDate) return true;
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - 18);
    return birthDate > threshold;
  }
}
