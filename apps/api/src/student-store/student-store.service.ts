import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FraudResolutionStatus, Prisma, StoreFileKind, StorePlatform, StoreSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infrastructure/object-storage.service';
import { QueueService } from '../infrastructure/queue.service';
import { normalizePublicStoreUrl } from './store-url.util';
import { validateUploadMetadata } from '../common/utils/file-security.utils';
import { AccessContext, AccessService } from '../access/access.service';

export type StoreDraftInput = {
  assignmentId: string;
  rowVersion?: number;
  platform: StorePlatform;
  storeName: string;
  storeUsername?: string;
  storeExternalId?: string;
  storeUrl: string;
  category?: string;
  description?: string;
  createdDate?: string;
  productCount: number;
  products?: Array<Record<string, unknown>>;
  studentNotes?: string;
  obstacles?: string;
  declarationAccepted: boolean;
  checklist: Array<{ itemId: string; completed: boolean; value?: string; comment?: string }>;
};

@Injectable()
export class StudentStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly queues: QueueService,
    private readonly access: AccessService,
  ) {}

  async listTemplates(context: any) {
    await this.requireStoreEntitlement(context);
    return this.prisma.storeChecklistTemplate.findMany({ where: { schoolId: context.schoolId, isActive: true }, include: { items: { orderBy: { position: 'asc' } } }, orderBy: { name: 'asc' } });
  }

  async createTemplate(context: any, data: { name: string; platform?: StorePlatform; minimumProducts: number; items: Array<{ code: string; label: string; description?: string; evidenceType?: string; weight: number; isRequired: boolean; position: number }> }) {
    await this.requireStoreEntitlement(context);
    const totalWeight = data.items.reduce((sum, item) => sum + item.weight, 0);
    if (!data.items.length || totalWeight !== 100) throw new BadRequestException('Checklist wajib memiliki item dengan total bobot tepat 100%');
    return this.prisma.storeChecklistTemplate.create({
      data: {
        organizationId: context.organizationId,
        schoolId: context.schoolId,
        createdById: context.userId,
        name: data.name.trim(),
        platform: data.platform,
        minimumProducts: data.minimumProducts,
        items: { create: data.items.map((item, index) => ({ ...item, code: item.code.trim().toUpperCase(), label: item.label.trim(), description: item.description?.trim() || null, evidenceType: item.evidenceType?.trim() || null, position: item.position || index + 1 })) },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
  }

  async listAssignments(context: any) {
    await this.access.assertEntitlement(context, 'student_store.submit', 'Student Store tidak termasuk dalam paket aktif');
    const moduleIds = await this.access.getAccessiblePublishedModuleIds(context);
    return this.prisma.assignment.findMany({
      where: {
        type: 'STORE', isActive: true, moduleId: { in: [...moduleIds] }, publishedAt: { not: null, lte: new Date() },
        course: { schoolId: context.schoolId, enrollments: { some: { studentId: context.studentId, status: 'ACTIVE' } } },
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
        rubric: { include: { criteria: { orderBy: { position: 'asc' } } } },
        checklistTemplate: { include: { items: { orderBy: { position: 'asc' } } } },
        storeSubmissions: { where: { studentId: context.studentId }, select: { id: true, status: true, rowVersion: true, currentVersion: true, score: true, feedback: true, updatedAt: true } },
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async saveDraft(context: any, data: StoreDraftInput) {
    const assignment = await this.assignmentForStudent(data.assignmentId, context);
    if (!assignment.checklistTemplateId) throw new BadRequestException('Checklist tugas belum dikonfigurasi');
    if (!['DRAFT', 'REVISION_REQUIRED'].includes((await this.currentStatus(data.assignmentId, context.studentId)) || 'DRAFT')) {
      throw new BadRequestException('Submission tidak dapat diubah pada status saat ini');
    }
    const normalizedStoreUrl = normalizePublicStoreUrl(data.storeUrl, data.platform);
    const validItems = await this.prisma.storeChecklistItem.findMany({ where: { templateId: assignment.checklistTemplateId }, select: { id: true } });
    const validItemIds = new Set(validItems.map((item) => item.id));
    if (data.checklist.some((item) => !validItemIds.has(item.itemId))) throw new BadRequestException('Checklist memuat item di luar template tugas');

    return this.prisma.$transaction(async (tx) => {
      const existingSubmission = await tx.studentStoreSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId: data.assignmentId, studentId: context.studentId } } });
      if (existingSubmission && data.rowVersion != null && existingSubmission.rowVersion !== data.rowVersion) {
        throw new ConflictException('Draf telah berubah di perangkat lain. Muat ulang sebelum menyimpan.');
      }
      let store = existingSubmission?.studentStoreId ? await tx.studentStore.findUnique({ where: { id: existingSubmission.studentStoreId } }) : null;
      const storeData = {
        platform: data.platform,
        storeName: data.storeName.trim(),
        storeUsername: data.storeUsername?.trim() || null,
        storeExternalId: data.storeExternalId?.trim() || null,
        storeUrl: data.storeUrl.trim(),
        normalizedStoreUrl,
        category: data.category?.trim() || null,
        description: data.description?.trim() || null,
        createdDate: data.createdDate ? new Date(data.createdDate) : null,
        productCount: data.productCount,
      };
      store = store
        ? await tx.studentStore.update({ where: { id: store.id }, data: storeData })
        : await tx.studentStore.create({ data: { ...storeData, organizationId: context.organizationId, schoolId: context.schoolId, studentId: context.studentId } });
      const submission = existingSubmission
        ? await tx.studentStoreSubmission.update({ where: { id: existingSubmission.id }, data: { studentStoreId: store.id, draftData: this.toDraftData(data), rowVersion: { increment: 1 } } })
        : await tx.studentStoreSubmission.create({ data: { organizationId: context.organizationId, schoolId: context.schoolId, assignmentId: data.assignmentId, studentId: context.studentId, studentStoreId: store.id, draftData: this.toDraftData(data) } });
      for (const response of data.checklist) {
        await tx.storeChecklistResponse.upsert({
          where: { storeSubmissionId_itemId: { storeSubmissionId: submission.id, itemId: response.itemId } },
          update: { completed: response.completed, value: response.value?.trim() || null, comment: response.comment?.trim() || null },
          create: { storeSubmissionId: submission.id, itemId: response.itemId, completed: response.completed, value: response.value?.trim() || null, comment: response.comment?.trim() || null },
        });
      }
      await this.updateDuplicateFlags(tx, submission.id, store.id, context.schoolId, context.studentId, data.platform, normalizedStoreUrl, data.storeExternalId);
      return { id: submission.id, status: submission.status, rowVersion: submission.rowVersion, storeId: store.id, savedAt: new Date() };
    });
  }

  async getSubmission(id: string, context: any) {
    const submission = await this.prisma.studentStoreSubmission.findFirst({
      where: {
        id,
        schoolId: context.schoolId,
        ...(context.studentId ? { studentId: context.studentId } : {}),
        ...(context.teacherId ? { assignment: { teacherId: context.teacherId } } : {}),
      },
      include: {
        assignment: { include: { course: true, checklistTemplate: { include: { items: { orderBy: { position: 'asc' } } } }, rubric: { include: { criteria: { orderBy: { position: 'asc' } } } } } },
        student: { select: { id: true, fullName: true, studentNumber: true } },
        studentStore: true,
        checklistResponses: true,
        files: { select: { id: true, kind: true, originalFileName: true, mimeType: true, sizeBytes: true, scanStatus: true, caption: true, position: true } },
        versions: { orderBy: { versionNumber: 'desc' } },
        reviews: { ...(context.studentId ? { where: { isPublished: true } } : {}), orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { fullName: true } }, scores: true } },
        fraudFlags: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!submission) throw new NotFoundException('Submission toko tidak ditemukan dalam scope pengguna');
    if (context.studentId) {
      await this.access.assertAssignmentAccess(context, submission.assignmentId, 'READ', 'STORE');
      return { ...submission, fraudFlags: [] };
    }
    await this.requireStoreEntitlement(context);
    return submission;
  }

  async reviewQueue(context: any) {
    await this.requireStoreEntitlement(context);
    return this.prisma.studentStoreSubmission.findMany({
      where: { schoolId: context.schoolId, assignment: { teacherId: context.teacherId }, status: { in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } },
      select: {
        id: true, status: true, submittedAt: true, currentVersion: true,
        assignment: { select: { id: true, title: true, endDate: true } },
        student: { select: { id: true, fullName: true, studentNumber: true, class: { select: { name: true } } } },
        studentStore: { select: { platform: true, storeName: true, normalizedStoreUrl: true } },
        _count: { select: { fraudFlags: true, files: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async prepareFileUpload(id: string, context: any, data: { fileName: string; mimeType: string; sizeBytes: number; kind: string }) {
    const submission = await this.requireEditableSubmission(id, context.studentId, context.schoolId);
    await this.access.assertAssignmentAccess(context, submission.assignmentId, 'SUBMIT', 'STORE');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
    const { extension } = validateUploadMetadata(data.fileName, data.mimeType, data.sizeBytes, allowed, 20 * 1024 * 1024);
    const key = this.storage.createStorageKey(`${context.organizationId}/${context.schoolId}/${context.studentId}/store/${id}`, extension);
    return { storageKey: key, uploadUrl: await this.storage.createUploadUrl('quarantine', key, data.mimeType, 300), expiresIn: 300 };
  }

  async registerFile(id: string, context: any, data: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number; kind: StoreFileKind; caption?: string; position?: number }) {
    const submission = await this.requireEditableSubmission(id, context.studentId, context.schoolId);
    await this.access.assertAssignmentAccess(context, submission.assignmentId, 'SUBMIT', 'STORE');
    const prefix = `${context.organizationId}/${context.schoolId}/${context.studentId}/store/${id}/`;
    if (!data.storageKey.startsWith(prefix)) throw new ForbiddenException('Storage key file berada di luar scope submission');
    validateUploadMetadata(data.fileName, data.mimeType, data.sizeBytes, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'], 20 * 1024 * 1024);
    const object = await this.storage.assertObjectExists('quarantine', data.storageKey).catch(() => { throw new BadRequestException('File belum tersedia dalam karantina'); });
    if (object.sizeBytes !== data.sizeBytes || object.contentType !== data.mimeType) throw new BadRequestException('Metadata file tidak sesuai dengan objek yang diunggah');
    const file = await this.prisma.studentStoreFile.create({
      data: { storeSubmissionId: id, kind: data.kind, storageKey: data.storageKey, quarantineKey: data.storageKey, originalFileName: data.fileName.slice(0, 255), mimeType: data.mimeType, sizeBytes: data.sizeBytes, caption: data.caption?.trim() || null, position: data.position || 0 },
    });
    await this.queues.add('store-file-scan', 'scan-store-file', { organizationId: context.organizationId, schoolId: context.schoolId, requestedBy: context.userId, payload: { fileId: file.id } });
    return { id: file.id, scanStatus: file.scanStatus };
  }

  async accessFile(fileId: string, context: any) {
    const file = await this.prisma.studentStoreFile.findFirst({
      where: { id: fileId, scanStatus: 'CLEAN', submission: { schoolId: context.schoolId, ...(context.studentId ? { studentId: context.studentId } : {}), ...(context.teacherId ? { assignment: { teacherId: context.teacherId } } : {}) } },
      select: { storageKey: true, submission: { select: { assignmentId: true } } },
    });
    if (!file) throw new NotFoundException('File bersih tidak ditemukan');
    if (context.studentId) await this.access.assertAssignmentAccess(context, file.submission.assignmentId, 'READ', 'STORE');
    else await this.requireStoreEntitlement(context);
    return { url: await this.storage.createDownloadUrl('submissions', file.storageKey, 120), expiresIn: 120 };
  }

  async deleteFile(fileId: string, context: any) {
    const file = await this.prisma.studentStoreFile.findFirst({
      where: { id: fileId, submission: { studentId: context.studentId, schoolId: context.schoolId, status: { in: ['DRAFT', 'REVISION_REQUIRED'] } } },
      include: { submission: { select: { studentStoreId: true, assignmentId: true } } },
    });
    if (!file) throw new ForbiddenException('File hanya dapat dihapus saat submission dapat diedit');
    await this.access.assertAssignmentAccess(context, file.submission.assignmentId, 'SUBMIT', 'STORE');
    await this.storage.deleteObject(file.quarantineKey ? 'quarantine' : 'submissions', file.quarantineKey || file.storageKey);
    await this.prisma.$transaction(async (tx) => {
      await tx.studentStoreFile.delete({ where: { id: file.id } });
      if (!file.submission.studentStoreId) return;
      const store = await tx.studentStore.findUnique({ where: { id: file.submission.studentStoreId }, select: { logoStorageKey: true, bannerStorageKey: true } });
      if (file.kind === 'LOGO' && store?.logoStorageKey === file.storageKey) await tx.studentStore.update({ where: { id: file.submission.studentStoreId }, data: { logoStorageKey: null } });
      if (file.kind === 'BANNER' && store?.bannerStorageKey === file.storageKey) await tx.studentStore.update({ where: { id: file.submission.studentStoreId }, data: { bannerStorageKey: null } });
    });
    return { deleted: true };
  }

  async submit(id: string, context: any, declarationAccepted: boolean) {
    const submission = await this.getSubmission(id, { ...context, teacherId: undefined });
    await this.access.assertAssignmentAccess(context, submission.assignmentId, 'SUBMIT', 'STORE');
    if (!['DRAFT', 'REVISION_REQUIRED'].includes(submission.status)) throw new BadRequestException('Submission tidak dapat dikirim pada status ini');
    if (!declarationAccepted) throw new BadRequestException('Deklarasi keamanan dan kepemilikan wajib diterima');
    if (!submission.studentStore) throw new BadRequestException('Informasi toko belum lengkap');
    const requiredItems = submission.assignment.checklistTemplate?.items.filter((item) => item.isRequired) || [];
    const completedIds = new Set(submission.checklistResponses.filter((response) => response.completed).map((response) => response.itemId));
    if (requiredItems.some((item) => !completedIds.has(item.id))) throw new BadRequestException('Checklist wajib belum lengkap');
    if (submission.studentStore.productCount < (submission.assignment.checklistTemplate?.minimumProducts || 1)) throw new BadRequestException('Jumlah produk belum memenuhi minimum');
    if (!submission.files.some((file) => file.scanStatus === 'CLEAN')) throw new BadRequestException('Minimal satu bukti yang lolos pemindaian wajib tersedia');
    if (submission.files.some((file) => file.scanStatus !== 'CLEAN')) throw new BadRequestException('Tunggu seluruh file selesai dipindai');
    const snapshot = {
      store: submission.studentStore,
      checklist: submission.checklistResponses,
      files: submission.files.map((file) => ({ id: file.id, kind: file.kind, fileName: file.originalFileName })),
      draft: submission.draftData,
    } as Prisma.InputJsonValue;
    return this.prisma.$transaction(async (tx) => {
      const nextVersion = submission.currentVersion + 1;
      const draft = submission.draftData as { studentNotes?: string; obstacles?: string } | null;
      await tx.studentStoreSubmissionVersion.create({ data: { storeSubmissionId: id, versionNumber: nextVersion, storeSnapshotData: snapshot, studentNotes: draft?.studentNotes?.trim() || null, obstacles: draft?.obstacles?.trim() || null, declarationAccepted } });
      return tx.studentStoreSubmission.update({ where: { id }, data: { currentVersion: nextVersion, rowVersion: { increment: 1 }, status: submission.status === 'REVISION_REQUIRED' ? 'RESUBMITTED' : 'SUBMITTED', submittedAt: new Date() } });
    });
  }

  async review(id: string, context: any, data: { decision: StoreSubmissionStatus; feedback?: string; publishGrade: boolean; scores?: Array<{ criterionId: string; score: number; comment?: string }> }) {
    await this.requireStoreEntitlement(context);
    const submission = await this.getSubmission(id, { ...context, studentId: undefined });
    if (!['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(submission.status)) throw new BadRequestException('Submission tidak berada dalam antrean review');
    if (!['APPROVED', 'REJECTED', 'REVISION_REQUIRED'].includes(data.decision)) throw new BadRequestException('Keputusan review tidak valid');
    if (data.decision !== 'APPROVED' && !data.feedback?.trim()) throw new BadRequestException('Feedback wajib untuk penolakan atau revisi');
    const criteria = submission.assignment.rubric?.criteria || [];
    if (criteria.length && data.scores?.length !== criteria.length) throw new BadRequestException('Semua kriteria rubrik wajib dinilai');
    const map = new Map(criteria.map((criterion) => [criterion.id, criterion]));
    if (data.scores && new Set(data.scores.map((score) => score.criterionId)).size !== data.scores.length) throw new BadRequestException('Kriteria rubrik tidak boleh dinilai lebih dari sekali');
    const totalScore = criteria.length && data.scores ? Math.round(data.scores.reduce((total, score) => {
      const criterion = map.get(score.criterionId);
      if (!criterion || score.score > criterion.maxScore) throw new BadRequestException('Nilai rubrik tidak valid');
      return total + (score.score / criterion.maxScore) * criterion.weight * submission.assignment.maxScore / 100;
    }, 0)) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.storeReview.create({ data: { storeSubmissionId: id, reviewerId: context.teacherId, rubricId: submission.assignment.rubricId, decision: data.decision, totalScore, feedback: data.feedback?.trim() || null, isPublished: data.publishGrade, ...(data.scores?.length ? { scores: { create: data.scores.map((score) => ({ criterionId: score.criterionId, score: score.score, comment: score.comment })) } } : {}) } });
      await tx.studentStoreSubmission.update({ where: { id }, data: { status: data.publishGrade ? data.decision : 'UNDER_REVIEW', reviewedAt: new Date(), score: data.publishGrade ? totalScore : null, feedback: data.publishGrade ? data.feedback : null, lockedAt: data.publishGrade && data.decision === 'APPROVED' ? new Date() : null } });
      if (data.publishGrade && data.decision === 'APPROVED' && submission.studentStoreId) await tx.studentStore.update({ where: { id: submission.studentStoreId }, data: { activationStatus: 'ACTIVE' } });
      return review;
    });
  }

  async resolveFraudFlag(id: string, context: any, data: { status: FraudResolutionStatus; notes: string }) {
    await this.requireStoreEntitlement(context);
    if (data.status === 'OPEN') throw new BadRequestException('Pilih hasil pemeriksaan flag');
    const flag = await this.prisma.storeFraudFlag.findFirst({
      where: { id, submission: { schoolId: context.schoolId, assignment: { teacherId: context.teacherId } } },
      select: { id: true },
    });
    if (!flag) throw new NotFoundException('Flag tidak ditemukan dalam antrean guru');
    return this.prisma.storeFraudFlag.update({
      where: { id },
      data: { status: data.status, resolutionNotes: data.notes.trim(), resolvedById: context.userId, resolvedAt: new Date() },
    });
  }

  private assignmentForStudent(id: string, context: AccessContext) {
    return this.access.assertAssignmentAccess(context, id, 'SUBMIT', 'STORE');
  }

  private async currentStatus(assignmentId: string, studentId: string) {
    const submission = await this.prisma.studentStoreSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId } }, select: { status: true } });
    return submission?.status;
  }

  private async requireEditableSubmission(id: string, studentId: string, schoolId: string) {
    const submission = await this.prisma.studentStoreSubmission.findFirst({ where: { id, studentId, schoolId, status: { in: ['DRAFT', 'REVISION_REQUIRED'] } }, select: { id: true, assignmentId: true } });
    if (!submission) throw new ForbiddenException('Submission tidak dapat diedit oleh siswa ini');
    return submission;
  }

  private async updateDuplicateFlags(tx: Prisma.TransactionClient, submissionId: string, storeId: string, schoolId: string, studentId: string, platform: StorePlatform, normalizedUrl: string, externalId?: string) {
    const duplicateUrl = await tx.studentStore.findFirst({ where: { id: { not: storeId }, schoolId, studentId: { not: studentId }, platform, normalizedStoreUrl: normalizedUrl }, select: { id: true, studentId: true } });
    const duplicateExternal = externalId ? await tx.studentStore.findFirst({ where: { id: { not: storeId }, schoolId, studentId: { not: studentId }, platform, storeExternalId: externalId }, select: { id: true, studentId: true } }) : null;
    const flags = [
      ...(duplicateUrl ? [{ type: 'DUPLICATE_URL' as const, reason: 'URL toko juga digunakan oleh siswa lain', evidence: { matchedStoreId: duplicateUrl.id } }] : []),
      ...(duplicateExternal ? [{ type: 'DUPLICATE_EXTERNAL_ID' as const, reason: 'ID toko juga digunakan oleh siswa lain', evidence: { matchedStoreId: duplicateExternal.id } }] : []),
    ];
    for (const flag of flags) {
      const exists = await tx.storeFraudFlag.count({ where: { storeSubmissionId: submissionId, type: flag.type, status: 'OPEN' } });
      if (!exists) await tx.storeFraudFlag.create({ data: { storeSubmissionId: submissionId, type: flag.type, reason: flag.reason, evidence: flag.evidence, confidence: 0.85 } });
    }
  }

  private toDraftData(data: StoreDraftInput): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify({
      products: data.products || [],
      studentNotes: data.studentNotes || '',
      obstacles: data.obstacles || '',
      declarationAccepted: data.declarationAccepted,
    })) as Prisma.InputJsonValue;
  }

  private requireStoreEntitlement(context: AccessContext) {
    return this.access.assertEntitlement(context, 'student_store.submit', 'Student Store tidak termasuk dalam paket aktif');
  }
}
