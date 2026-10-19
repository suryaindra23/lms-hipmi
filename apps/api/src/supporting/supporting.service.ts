import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, NotificationChannel, HelpdeskPriority, HelpdeskStatus } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { validateUploadMetadata } from '../common/utils/file-security.utils';
import { ObjectStorageService } from '../infrastructure/object-storage.service';
import { QueueService } from '../infrastructure/queue.service';
import {
  AddHelpdeskMessageDto,
  CompleteHelpdeskAttachmentDto,
  AnalyticsEventDto,
  AwardAchievementDto,
  CertificatePublicationDto,
  CreateAchievementDto,
  CreateAnnouncementDto,
  CreateCertificateTemplateDto,
  CreateCmsContentDto,
  CreateHelpdeskTicketDto,
  CreatePortfolioItemDto,
  IssueCertificateDto,
  HelpdeskAttachmentUploadDto,
  PortfolioPublicationDto,
  RevokeCertificateDto,
  SyncDraftDto,
  UpdateHelpdeskTicketDto,
  UpdateNotificationPreferenceDto,
} from './dto/supporting.dto';
import { makeTicketNumber, nextDeliveryTime, notificationCategoryEnabled, redactSupportText, sanitizeNotificationText } from './supporting.utils';

export type SupportingContext = {
  userId: string;
  organizationId: string;
  schoolId?: string;
  studentId?: string;
  parentId?: string;
  teacherId?: string;
  roles: string[];
};

type NotificationInput = {
  organizationId: string;
  schoolId?: string;
  userId: string;
  eventType: string;
  title: string;
  body: string;
  actionUrl?: string;
  idempotencyKey: string;
};

@Injectable()
export class SupportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: ObjectStorageService,
    private readonly access: AccessService,
  ) {}

  private isAcademicStaff(context: SupportingContext) {
    return context.roles.some((role) => ['super-admin', 'program-manager', 'school-admin', 'principal', 'teacher', 'support'].includes(role));
  }

  private isHelpdeskStaff(context: SupportingContext) {
    return context.roles.some((role) => ['super-admin', 'program-manager', 'school-admin', 'principal', 'support'].includes(role));
  }

  private advancedContext(context: SupportingContext) {
    return { userId: context.userId, organizationId: context.organizationId, schoolId: context.schoolId, studentId: context.studentId };
  }

  private assertAdvanced(context: SupportingContext) {
    return this.access.assertEntitlement(this.advancedContext(context), 'support.advanced.use', 'Sertifikat, pencapaian, dan portofolio hanya tersedia pada paket Advanced');
  }

  async createNotification(input: NotificationInput) {
    const preference = await this.prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
    const notification = await this.prisma.notification.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: {
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        userId: input.userId,
        eventType: input.eventType,
        title: sanitizeNotificationText(input.title, 160),
        body: sanitizeNotificationText(input.body),
        actionUrl: input.actionUrl?.startsWith('/') ? input.actionUrl : undefined,
        idempotencyKey: input.idempotencyKey,
        deliveries: { create: { channel: 'IN_APP', status: 'SENT', provider: 'INTERNAL', sentAt: new Date() } },
      },
    });
    const channels: NotificationChannel[] = [];
    const externalAllowed = notificationCategoryEnabled(input.eventType, preference);
    if (externalAllowed && preference?.emailEnabled) channels.push('EMAIL');
    if (externalAllowed && preference?.whatsappEnabled) channels.push('WHATSAPP');
    if (externalAllowed && preference?.smsEnabled) channels.push('SMS');
    for (const channel of channels) {
      const scheduledAt = nextDeliveryTime(new Date(), preference?.quietHoursStart, preference?.quietHoursEnd, preference?.timezone, preference?.digestFrequency);
      const delivery = await this.prisma.notificationDelivery.upsert({
        where: { notificationId_channel: { notificationId: notification.id, channel } },
        update: {},
        create: { notificationId: notification.id, channel, scheduledAt },
      });
      await this.queue.add('notification-delivery', 'deliver', {
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        requestedBy: input.userId,
        payload: { deliveryId: delivery.id },
      }, { jobId: delivery.id, delay: Math.max(0, scheduledAt.getTime() - Date.now()), attempts: 5, backoff: { type: 'exponential', delay: 2_000 } });
    }
    return notification;
  }

  listNotifications(context: SupportingContext) {
    return this.prisma.notification.findMany({
      where: { userId: context.userId, archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { deliveries: { select: { channel: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotification(context: SupportingContext, id: string, archived = false) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId: context.userId } });
    if (!notification) throw new NotFoundException('Notifikasi tidak ditemukan');
    return this.prisma.notification.update({ where: { id }, data: archived ? { archivedAt: new Date() } : { readAt: new Date() } });
  }

  async markAllNotificationsRead(context: SupportingContext) {
    const result = await this.prisma.notification.updateMany({ where: { userId: context.userId, readAt: null, archivedAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  }

  getNotificationPreference(context: SupportingContext) {
    return this.prisma.notificationPreference.upsert({ where: { userId: context.userId }, update: {}, create: { userId: context.userId } });
  }

  updateNotificationPreference(context: SupportingContext, dto: UpdateNotificationPreferenceDto) {
    if (dto.quietHoursStart && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dto.quietHoursStart)) throw new BadRequestException('Format awal quiet hours harus HH:mm');
    if (dto.quietHoursEnd && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dto.quietHoursEnd)) throw new BadRequestException('Format akhir quiet hours harus HH:mm');
    return this.prisma.notificationPreference.upsert({
      where: { userId: context.userId },
      create: { userId: context.userId, ...dto, inAppEnabled: true },
      update: { ...dto, inAppEnabled: true },
    });
  }

  async listAnnouncements(context: SupportingContext) {
    const rows = await this.prisma.announcement.findMany({
      where: {
        organizationId: context.organizationId,
        status: 'PUBLISHED',
        OR: [{ schoolId: null }, ...(context.schoolId ? [{ schoolId: context.schoolId }] : [])],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      include: { author: { select: { firstName: true, lastName: true } }, school: { select: { name: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 30,
    });
    const audiences = new Set(['ALL']);
    if (context.roles.includes('student')) audiences.add('STUDENTS');
    if (context.roles.includes('teacher')) audiences.add('TEACHERS');
    if (context.roles.includes('parent')) audiences.add('PARENTS');
    if (this.isAcademicStaff(context)) audiences.add('STAFF');
    return rows.filter((row) => audiences.has(row.audience));
  }

  listManagedAnnouncements(context: SupportingContext) {
    return this.prisma.announcement.findMany({
      where: { organizationId: context.organizationId, ...(context.schoolId ? { OR: [{ schoolId: null }, { schoolId: context.schoolId }] } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createAnnouncement(context: SupportingContext, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: {
        organizationId: context.organizationId,
        schoolId: context.schoolId,
        authorId: context.userId,
        title: sanitizeNotificationText(dto.title, 160),
        body: redactSupportText(dto.body),
        audience: dto.audience || 'ALL',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: dto.publishNow ? 'PUBLISHED' : 'DRAFT',
        publishedAt: dto.publishNow ? new Date() : null,
      },
    });
    if (dto.publishNow) await this.distributeAnnouncement(announcement.id, context);
    return announcement;
  }

  async publishAnnouncement(context: SupportingContext, id: string) {
    const announcement = await this.prisma.announcement.findFirst({ where: { id, organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}) } });
    if (!announcement) throw new NotFoundException('Pengumuman tidak ditemukan');
    if (announcement.status === 'PUBLISHED') return announcement;
    const published = await this.prisma.announcement.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await this.distributeAnnouncement(id, context);
    return published;
  }

  private async distributeAnnouncement(id: string, context: SupportingContext) {
    const announcement = await this.prisma.announcement.findUniqueOrThrow({ where: { id } });
    const roleMap: Record<string, string[]> = { STUDENTS: ['student'], TEACHERS: ['teacher'], PARENTS: ['parent'], STAFF: ['teacher', 'school-admin', 'principal', 'program-manager', 'super-admin'] };
    const roles = roleMap[announcement.audience];
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: context.organizationId,
        status: 'ACTIVE',
        ...(roles ? { userRoles: { some: { role: { slug: { in: roles } }, ...(announcement.schoolId ? { schoolId: announcement.schoolId } : {}) } } } : announcement.schoolId ? { userRoles: { some: { schoolId: announcement.schoolId } } } : {}),
      },
      select: { id: true },
    });
    await Promise.all(users.map((user) => this.createNotification({
      organizationId: context.organizationId,
      schoolId: announcement.schoolId || undefined,
      userId: user.id,
      eventType: 'ANNOUNCEMENT',
      title: announcement.title,
      body: announcement.body,
      actionUrl: '/dashboard/dukungan',
      idempotencyKey: `announcement:${id}:${user.id}:v1`,
    })));
    return { recipients: users.length };
  }

  async listCertificateTemplates(context: SupportingContext) {
    await this.assertAdvanced(context);
    return this.prisma.certificateTemplate.findMany({ where: { organizationId: context.organizationId, isActive: true, ...(context.schoolId ? { OR: [{ schoolId: null }, { schoolId: context.schoolId }] } : {}) }, orderBy: { name: 'asc' } });
  }

  async createCertificateTemplate(context: SupportingContext, dto: CreateCertificateTemplateDto) {
    await this.assertAdvanced(context);
    return this.prisma.certificateTemplate.create({ data: { organizationId: context.organizationId, schoolId: context.schoolId, createdById: context.userId, name: dto.name.trim(), titleTemplate: dto.titleTemplate.trim(), description: dto.description?.trim(), eligibilityRule: dto.eligibilityRule as Prisma.InputJsonValue } });
  }

  async listCertificates(context: SupportingContext) {
    await this.assertAdvanced(context);
    const studentIds = await this.studentIds(context);
    return this.prisma.certificate.findMany({ where: { organizationId: context.organizationId, studentId: { in: studentIds } }, include: { student: { select: { fullName: true, studentNumber: true } }, template: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async issueCertificate(context: SupportingContext, dto: IssueCertificateDto) {
    await this.assertAdvanced(context);
    if (!context.schoolId) throw new BadRequestException('Pilih sekolah untuk menerbitkan sertifikat');
    const [student, template] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: dto.studentId, schoolId: context.schoolId }, include: { user: { select: { id: true } } } }),
      this.prisma.certificateTemplate.findFirst({ where: { id: dto.templateId, organizationId: context.organizationId, isActive: true, OR: [{ schoolId: null }, { schoolId: context.schoolId }] } }),
    ]);
    if (!student || !template) throw new NotFoundException('Siswa atau template sertifikat tidak ditemukan');
    const rule = template.eligibilityRule as Record<string, unknown>;
    const [approvedSubmissions, progress, approvedStores] = await Promise.all([
      this.prisma.submission.count({ where: { studentId: student.id, status: 'APPROVED' } }),
      this.prisma.lessonProgress.aggregate({ where: { studentId: student.id }, _avg: { progressPercent: true } }),
      this.prisma.studentStoreSubmission.count({ where: { studentId: student.id, status: 'APPROVED' } }),
    ]);
    if (approvedSubmissions < Number(rule.minApprovedSubmissions || 0) || Number(progress._avg?.progressPercent || 0) < Number(rule.minLearningProgress || 0) || approvedStores < Number(rule.minApprovedStores || 0)) {
      throw new BadRequestException('Siswa belum memenuhi aturan kelayakan sertifikat');
    }
    const certificate = await this.prisma.certificate.upsert({
      where: { studentId_templateId: { studentId: student.id, templateId: template.id } },
      update: {},
      create: {
        organizationId: context.organizationId,
        schoolId: context.schoolId,
        studentId: student.id,
        templateId: template.id,
        issuedById: context.userId,
        verificationCode: `CERT-${randomBytes(6).toString('hex').toUpperCase()}`,
        title: template.titleTemplate.split('{{studentName}}').join(student.fullName),
        description: template.description,
        metadata: { approvedSubmissions, averageProgress: Number(progress._avg?.progressPercent || 0), approvedStores },
      },
    });
    if (certificate.status === 'QUEUED') {
      await this.queue.add('certificate-generation', 'generate', { organizationId: context.organizationId, schoolId: context.schoolId, requestedBy: context.userId, payload: { certificateId: certificate.id } }, { jobId: certificate.id, attempts: 3 });
    }
    return certificate;
  }

  async setCertificatePublication(context: SupportingContext, id: string, dto: CertificatePublicationDto) {
    await this.assertAdvanced(context);
    if (!context.studentId) throw new ForbiddenException('Publikasi hanya dapat diatur oleh siswa pemilik');
    const certificate = await this.prisma.certificate.findFirst({ where: { id, studentId: context.studentId, status: 'ISSUED' } });
    if (!certificate) throw new NotFoundException('Sertifikat tidak ditemukan');
    if (!dto.publicVisible) return this.prisma.certificate.update({ where: { id }, data: { publicVisible: false, publicationConsentId: null } });
    const consent = await this.activePublicationConsent(context.studentId);
    if (!consent) throw new BadRequestException('Persetujuan publikasi aktif diperlukan');
    return this.prisma.certificate.update({ where: { id }, data: { publicVisible: true, publicationConsentId: consent.id } });
  }

  async revokeCertificate(context: SupportingContext, id: string, dto: RevokeCertificateDto) {
    await this.assertAdvanced(context);
    const certificate = await this.prisma.certificate.findFirst({ where: { id, organizationId: context.organizationId, ...(context.schoolId ? { schoolId: context.schoolId } : {}) } });
    if (!certificate) throw new NotFoundException('Sertifikat tidak ditemukan');
    return this.prisma.certificate.update({ where: { id }, data: { status: 'REVOKED', revokedById: context.userId, revokedAt: new Date(), revokeReason: redactSupportText(dto.reason), publicVisible: false } });
  }

  async certificateDownload(context: SupportingContext, id: string) {
    await this.assertAdvanced(context);
    const studentIds = await this.studentIds(context);
    const certificate = await this.prisma.certificate.findFirst({ where: { id, studentId: { in: studentIds }, status: 'ISSUED', pdfStorageKey: { not: null } } });
    if (!certificate?.pdfStorageKey) throw new NotFoundException('File sertifikat belum tersedia');
    return { url: await this.storage.createDownloadUrl('exports', certificate.pdfStorageKey, 120), expiresInSeconds: 120 };
  }

  async getPublicCertificate(code: string) {
    const certificate = await this.prisma.certificate.findUnique({ where: { verificationCode: code }, include: { student: { select: { fullName: true } }, school: { select: { name: true, city: true } }, template: { select: { name: true } }, publicationConsent: true } });
    if (!certificate) return { valid: false, status: 'NOT_FOUND' };
    const consentActive = certificate.publicationConsent?.status === 'ACTIVE' && (!certificate.publicationConsent.expiresAt || certificate.publicationConsent.expiresAt > new Date());
    return {
      valid: certificate.status === 'ISSUED',
      status: certificate.status,
      verificationCode: certificate.verificationCode,
      title: certificate.publicVisible && consentActive ? certificate.title : certificate.template.name,
      school: certificate.school.name,
      issuedAt: certificate.issuedAt,
      ...(certificate.publicVisible && consentActive ? { studentName: certificate.student.fullName, city: certificate.school.city } : {}),
    };
  }

  async listAchievements(context: SupportingContext) {
    await this.assertAdvanced(context);
    const studentIds = await this.studentIds(context);
    return this.prisma.studentAchievement.findMany({ where: { studentId: { in: studentIds } }, include: { achievement: true, student: { select: { fullName: true, studentNumber: true } } }, orderBy: { awardedAt: 'desc' } });
  }

  async listAchievementDefinitions(context: SupportingContext) {
    await this.assertAdvanced(context);
    return this.prisma.achievement.findMany({
      where: { organizationId: context.organizationId, isActive: true, ...(context.schoolId ? { OR: [{ schoolId: null }, { schoolId: context.schoolId }] } : {}) },
      orderBy: { title: 'asc' },
    });
  }

  async createAchievement(context: SupportingContext, dto: CreateAchievementDto) {
    await this.assertAdvanced(context);
    return this.prisma.achievement.create({ data: { organizationId: context.organizationId, schoolId: context.schoolId, createdById: context.userId, code: dto.code.toUpperCase().replace(/[^A-Z0-9_-]/g, ''), title: dto.title.trim(), description: dto.description.trim(), icon: dto.icon || 'AWARD', criteria: dto.criteria as Prisma.InputJsonValue } });
  }

  async awardAchievement(context: SupportingContext, achievementId: string, dto: AwardAchievementDto) {
    await this.assertAdvanced(context);
    if (!context.schoolId) throw new BadRequestException('Pilih sekolah');
    const [achievement, student] = await Promise.all([
      this.prisma.achievement.findFirst({ where: { id: achievementId, organizationId: context.organizationId, isActive: true, OR: [{ schoolId: null }, { schoolId: context.schoolId }] } }),
      this.prisma.student.findFirst({ where: { id: dto.studentId, schoolId: context.schoolId } }),
    ]);
    if (!achievement || !student) throw new NotFoundException('Pencapaian atau siswa tidak ditemukan');
    const award = await this.prisma.studentAchievement.upsert({ where: { studentId_achievementId: { studentId: student.id, achievementId } }, update: {}, create: { studentId: student.id, achievementId, awardedById: context.userId, evidence: dto.evidence as Prisma.InputJsonValue | undefined } });
    await this.createNotification({ organizationId: context.organizationId, schoolId: context.schoolId, userId: student.userId, eventType: 'ACHIEVEMENT_AWARDED', title: `Pencapaian baru: ${achievement.title}`, body: achievement.description, actionUrl: '/dashboard/dukungan', idempotencyKey: `achievement:${award.id}` });
    return award;
  }

  async listPortfolio(context: SupportingContext) {
    await this.assertAdvanced(context);
    const studentIds = await this.studentIds(context);
    return this.prisma.portfolioItem.findMany({ where: { studentId: { in: studentIds } }, include: { student: { select: { fullName: true, studentNumber: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createPortfolioItem(context: SupportingContext, dto: CreatePortfolioItemDto) {
    await this.assertAdvanced(context);
    const studentId = context.studentId || (this.isAcademicStaff(context) ? dto.studentId : undefined);
    if (!studentId) throw new BadRequestException('Siswa portofolio tidak tersedia');
    const student = await this.prisma.student.findFirst({ where: { id: studentId, school: { organizationId: context.organizationId }, ...(context.schoolId ? { schoolId: context.schoolId } : {}) } });
    if (!student) throw new ForbiddenException('Siswa berada di luar ruang lingkup');
    let defaultTitle = dto.title || '';
    if (dto.sourceType === 'STORE') {
      const source = await this.prisma.studentStoreSubmission.findFirst({ where: { id: dto.sourceId, studentId, status: 'APPROVED' }, include: { studentStore: { select: { storeName: true } } } });
      if (!source) throw new BadRequestException('Hanya karya toko yang disetujui dapat masuk portofolio');
      defaultTitle ||= source.studentStore?.storeName || 'Karya Student Store';
    } else if (dto.sourceType === 'AFFILIATE') {
      const source = await this.prisma.affiliateVideo.findFirst({ where: { id: dto.sourceId, studentId, submission: { status: 'APPROVED' } } });
      if (!source) throw new BadRequestException('Hanya konten affiliate yang disetujui dapat masuk portofolio');
      defaultTitle ||= source.productName || 'Konten Affiliate';
    } else if (dto.sourceType === 'ASSIGNMENT') {
      const source = await this.prisma.submission.findFirst({ where: { id: dto.sourceId, studentId, status: 'APPROVED' }, include: { assignment: { select: { title: true } } } });
      if (!source) throw new BadRequestException('Hanya tugas yang disetujui dapat masuk portofolio');
      defaultTitle ||= source.assignment.title;
    } else throw new BadRequestException('Jenis sumber portofolio tidak didukung');
    return this.prisma.portfolioItem.upsert({
      where: { studentId_sourceType_sourceId: { studentId, sourceType: dto.sourceType, sourceId: dto.sourceId } },
      update: { title: defaultTitle, description: dto.description },
      create: { organizationId: context.organizationId, schoolId: student.schoolId, studentId, createdById: context.userId, sourceType: dto.sourceType, sourceId: dto.sourceId, title: defaultTitle, description: dto.description },
    });
  }

  async setPortfolioPublication(context: SupportingContext, id: string, dto: PortfolioPublicationDto) {
    await this.assertAdvanced(context);
    if (!context.studentId) throw new ForbiddenException('Publikasi hanya dapat diatur oleh siswa pemilik');
    const item = await this.prisma.portfolioItem.findFirst({ where: { id, studentId: context.studentId } });
    if (!item) throw new NotFoundException('Item portofolio tidak ditemukan');
    if (!dto.publicVisible) return this.prisma.portfolioItem.update({ where: { id }, data: { status: 'PRIVATE', publicationConsentId: null, publishedAt: null } });
    const consent = await this.activePublicationConsent(context.studentId);
    if (!consent) throw new BadRequestException('Persetujuan publikasi aktif diperlukan');
    return this.prisma.portfolioItem.update({ where: { id }, data: { status: 'PUBLISHED', publicationConsentId: consent.id, publicSlug: item.publicSlug || `karya-${randomUUID()}`, publishedAt: new Date() } });
  }

  async getPublicPortfolio(slug: string) {
    const item = await this.prisma.portfolioItem.findFirst({ where: { publicSlug: slug, status: 'PUBLISHED' }, include: { student: { select: { fullName: true } }, school: { select: { name: true, city: true } }, publicationConsent: true } });
    const consentActive = item?.publicationConsent?.status === 'ACTIVE' && (!item.publicationConsent.expiresAt || item.publicationConsent.expiresAt > new Date());
    if (!item || !consentActive) throw new NotFoundException('Portofolio publik tidak ditemukan');
    return { title: item.title, description: item.description, sourceType: item.sourceType, studentName: item.student.fullName, school: item.school.name, city: item.school.city, publishedAt: item.publishedAt };
  }

  async listHelpdeskTickets(context: SupportingContext) {
    return this.prisma.helpdeskTicket.findMany({
      where: { organizationId: context.organizationId, ...(this.isHelpdeskStaff(context) ? context.schoolId ? { OR: [{ schoolId: context.schoolId }, { schoolId: null }] } : {} : { requesterId: context.userId }) },
      include: { requester: { select: { firstName: true, lastName: true } }, assignedTo: { select: { firstName: true, lastName: true } }, _count: { select: { messages: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async createHelpdeskTicket(context: SupportingContext, dto: CreateHelpdeskTicketDto) {
    const suffix = randomBytes(4).toString('hex');
    const ticket = await this.prisma.helpdeskTicket.create({ data: { organizationId: context.organizationId, schoolId: context.schoolId, requesterId: context.userId, ticketNumber: makeTicketNumber(new Date(), suffix), category: dto.category.trim(), priority: (dto.priority || 'NORMAL') as HelpdeskPriority, subject: redactSupportText(dto.subject), description: redactSupportText(dto.description), slaDueAt: new Date(Date.now() + (dto.priority === 'URGENT' ? 4 : dto.priority === 'HIGH' ? 12 : 48) * 3600000) } });
    const responders = await this.prisma.user.findMany({
      where: { organizationId: context.organizationId, status: 'ACTIVE', userRoles: { some: { role: { slug: { in: ['support', 'school-admin', 'super-admin'] } }, ...(context.schoolId ? { OR: [{ schoolId: context.schoolId }, { schoolId: null }] } : {}) } } },
      select: { id: true },
      take: 50,
    });
    await Promise.all(responders.map(({ id }) => this.createNotification({ organizationId: context.organizationId, schoolId: context.schoolId, userId: id, eventType: 'HELPDESK_CREATED', title: `Tiket baru ${ticket.ticketNumber}`, body: ticket.subject, actionUrl: '/dashboard/dukungan', idempotencyKey: `helpdesk-created:${ticket.id}:${id}` })));
    return ticket;
  }

  async getHelpdeskTicket(context: SupportingContext, id: string) {
    const ticket = await this.prisma.helpdeskTicket.findFirst({ where: { id, organizationId: context.organizationId, ...(this.isHelpdeskStaff(context) ? context.schoolId ? { OR: [{ schoolId: context.schoolId }, { schoolId: null }] } : {} : { requesterId: context.userId }) }, include: { requester: { select: { firstName: true, lastName: true } }, assignedTo: { select: { firstName: true, lastName: true } }, messages: { where: this.isHelpdeskStaff(context) ? {} : { isInternal: false }, include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } } });
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan');
    return ticket;
  }

  async addHelpdeskMessage(context: SupportingContext, id: string, dto: AddHelpdeskMessageDto) {
    const ticket = await this.getHelpdeskTicket(context, id);
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) throw new ConflictException('Tiket sudah ditutup');
    if (dto.isInternal && !this.isHelpdeskStaff(context)) throw new ForbiddenException('Catatan internal hanya untuk petugas');
    const message = await this.prisma.helpdeskMessage.create({ data: { ticketId: id, authorId: context.userId, body: redactSupportText(dto.body), isInternal: Boolean(dto.isInternal) } });
    const targetUserId = context.userId === ticket.requesterId ? ticket.assignedToId : ticket.requesterId;
    if (targetUserId) await this.createNotification({ organizationId: context.organizationId, schoolId: ticket.schoolId || undefined, userId: targetUserId, eventType: 'HELPDESK_UPDATE', title: `Pembaruan tiket ${ticket.ticketNumber}`, body: 'Ada balasan baru pada tiket bantuan Anda.', actionUrl: '/dashboard/dukungan', idempotencyKey: `helpdesk-message:${message.id}:${targetUserId}` });
    return message;
  }

  async updateHelpdeskTicket(context: SupportingContext, id: string, dto: UpdateHelpdeskTicketDto) {
    const ticket = await this.getHelpdeskTicket(context, id);
    if (!ticket) throw new NotFoundException('Tiket tidak ditemukan');
    if (!this.isHelpdeskStaff(context)) {
      if (ticket.requesterId !== context.userId || dto.satisfaction == null || Object.keys(dto).some((key) => key !== 'satisfaction')) throw new ForbiddenException('Anda tidak dapat mengubah penanganan tiket');
      if (!['RESOLVED', 'CLOSED'].includes(ticket.status) || ticket.satisfaction != null) throw new ConflictException('Penilaian hanya dapat diberikan satu kali setelah tiket selesai');
    }
    if (['RESOLVED', 'CLOSED'].includes(ticket.status) && this.isHelpdeskStaff(context) && dto.status && dto.status !== ticket.status) throw new ConflictException('Status akhir tiket tidak dapat dibuka kembali');
    if (dto.status === 'RESOLVED' && !(dto.resolution?.trim() || ticket.resolution)) throw new BadRequestException('Ringkasan penyelesaian wajib diisi');
    if (dto.assignedToId && this.isHelpdeskStaff(context)) {
      const support = await this.prisma.user.count({ where: { id: dto.assignedToId, organizationId: context.organizationId, status: 'ACTIVE', userRoles: { some: { role: { slug: { in: ['support', 'school-admin', 'principal', 'program-manager', 'super-admin'] } }, ...(ticket.schoolId ? { OR: [{ schoolId: ticket.schoolId }, { schoolId: null }] } : {}) } } } });
      if (!support) throw new BadRequestException('Petugas tidak tersedia');
    }
    return this.prisma.helpdeskTicket.update({ where: { id }, data: { status: dto.status as HelpdeskStatus | undefined, priority: dto.priority as HelpdeskPriority | undefined, assignedToId: dto.assignedToId, resolution: dto.resolution ? redactSupportText(dto.resolution) : undefined, satisfaction: dto.satisfaction, ...(dto.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}) } });
  }

  async createHelpdeskAttachmentUpload(context: SupportingContext, id: string, dto: HelpdeskAttachmentUploadDto) {
    const ticket = await this.getHelpdeskTicket(context, id);
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) throw new ConflictException('Tiket sudah ditutup');
    const validated = validateUploadMetadata(dto.fileName, dto.mimeType, dto.sizeBytes, ['application/pdf', 'image/jpeg', 'image/png'], 8 * 1024 * 1024);
    const key = this.storage.createStorageKey(`${context.organizationId}/${ticket.schoolId || 'organization'}/helpdesk/${ticket.id}`, validated.extension);
    return { storageKey: key, uploadUrl: await this.storage.createUploadUrl('quarantine', key, dto.mimeType, 300), expiresIn: 300 };
  }

  async completeHelpdeskAttachment(context: SupportingContext, id: string, dto: CompleteHelpdeskAttachmentDto) {
    const ticket = await this.getHelpdeskTicket(context, id);
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) throw new ConflictException('Tiket sudah ditutup');
    if (dto.isInternal && !this.isHelpdeskStaff(context)) throw new ForbiddenException('Lampiran internal hanya untuk petugas');
    const validated = validateUploadMetadata(dto.fileName, dto.mimeType, dto.sizeBytes, ['application/pdf', 'image/jpeg', 'image/png'], 8 * 1024 * 1024);
    const prefix = `${context.organizationId}/${ticket.schoolId || 'organization'}/helpdesk/${ticket.id}/`;
    if (!dto.storageKey.startsWith(prefix) || dto.storageKey.includes('..')) throw new ForbiddenException('Lokasi lampiran tidak valid');
    const object = await this.storage.assertObjectExists('quarantine', dto.storageKey);
    if (object.sizeBytes !== dto.sizeBytes || object.contentType !== dto.mimeType) throw new BadRequestException('Metadata lampiran tidak sesuai dengan file yang diunggah');
    const message = await this.prisma.helpdeskMessage.create({ data: { ticketId: ticket.id, authorId: context.userId, body: redactSupportText(dto.body || 'Lampiran dikirim'), isInternal: Boolean(dto.isInternal), quarantineStorageKey: dto.storageKey, fileName: validated.normalizedFileName, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes, scanStatus: 'PENDING' } });
    await this.queue.add('helpdesk-attachment-scan', 'scan', { organizationId: context.organizationId, schoolId: ticket.schoolId || undefined, requestedBy: context.userId, payload: { messageId: message.id } }, { jobId: message.id, attempts: 3, backoff: { type: 'exponential', delay: 2_000 } });
    return message;
  }

  async helpdeskAttachmentDownload(context: SupportingContext, messageId: string) {
    const message = await this.prisma.helpdeskMessage.findUnique({ where: { id: messageId }, select: { ticketId: true, storageKey: true, scanStatus: true, isInternal: true } });
    if (!message) throw new NotFoundException('Lampiran tidak ditemukan');
    await this.getHelpdeskTicket(context, message.ticketId);
    if (message.isInternal && !this.isHelpdeskStaff(context)) throw new ForbiddenException('Lampiran internal hanya untuk petugas');
    if (message.scanStatus !== 'CLEAN' || !message.storageKey) throw new ConflictException('Lampiran masih diperiksa atau tidak aman');
    return { url: await this.storage.createDownloadUrl('submissions', message.storageKey, 120), expiresInSeconds: 120 };
  }

  listCms(context: SupportingContext) {
    return this.prisma.cmsContent.findMany({ where: { OR: [{ organizationId: null }, { organizationId: context.organizationId }] }, orderBy: [{ type: 'asc' }, { position: 'asc' }] });
  }

  createCms(context: SupportingContext, dto: CreateCmsContentDto) {
    const slug = dto.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    return this.prisma.cmsContent.create({ data: { organizationId: context.organizationId, slug, type: dto.type, title: dto.title.trim(), excerpt: dto.excerpt?.trim(), body: dto.body as Prisma.InputJsonValue, imageUrl: dto.imageUrl, position: dto.position || 0, authorId: context.userId } });
  }

  async publishCms(context: SupportingContext, id: string) {
    const content = await this.prisma.cmsContent.findFirst({ where: { id, OR: [{ organizationId: null }, { organizationId: context.organizationId }] } });
    if (!content) throw new NotFoundException('Konten tidak ditemukan');
    return this.prisma.cmsContent.update({ where: { id }, data: { status: 'PUBLISHED', reviewedById: context.userId, publishedAt: new Date() } });
  }

  getPublicCms(type?: string) {
    return this.prisma.cmsContent.findMany({ where: { status: 'PUBLISHED', ...(type ? { type } : {}) }, select: { slug: true, type: true, title: true, excerpt: true, body: true, imageUrl: true, publishedAt: true }, orderBy: [{ type: 'asc' }, { position: 'asc' }] });
  }

  async recordAnalytics(dto: AnalyticsEventDto, context?: Partial<SupportingContext>) {
    if (!dto.consentGranted) return { accepted: false, reason: 'CONSENT_REQUIRED' };
    const safeProperties: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(dto.properties || {})) {
      if (!/^[a-zA-Z0-9_.-]{1,50}$/.test(key)) continue;
      if (['string', 'number', 'boolean'].includes(typeof value) || value === null) safeProperties[key] = typeof value === 'string' ? sanitizeNotificationText(value, 200) : value as number | boolean | null;
    }
    await this.prisma.analyticsEvent.create({ data: { organizationId: context?.organizationId, schoolId: context?.schoolId, userId: context?.userId, anonymousId: dto.anonymousId?.slice(0, 100), eventName: dto.eventName, properties: safeProperties as Prisma.InputJsonValue, consentVerified: true } });
    return { accepted: true };
  }

  async getSyncDraft(context: SupportingContext, key: string) {
    return this.prisma.syncDraft.findUnique({ where: { userId_draftKey: { userId: context.userId, draftKey: key } } });
  }

  async syncDraft(context: SupportingContext, key: string, dto: SyncDraftDto) {
    const existing = await this.prisma.syncDraft.findUnique({ where: { userId_draftKey: { userId: context.userId, draftKey: key } } });
    if (existing && dto.version != null && dto.version !== existing.version) throw new ConflictException({ message: 'Draf berubah di perangkat lain', code: 'DRAFT_VERSION_CONFLICT', serverVersion: existing.version, serverDraft: existing.content });
    return this.prisma.syncDraft.upsert({ where: { userId_draftKey: { userId: context.userId, draftKey: key } }, update: { content: dto.content as Prisma.InputJsonValue, version: { increment: 1 }, lastSyncedAt: new Date() }, create: { organizationId: context.organizationId, schoolId: context.schoolId, userId: context.userId, draftKey: key, content: dto.content as Prisma.InputJsonValue } });
  }

  async deleteSyncDraft(context: SupportingContext, key: string) {
    await this.prisma.syncDraft.deleteMany({ where: { userId: context.userId, draftKey: key } });
    return { deleted: true };
  }

  private async activePublicationConsent(studentId: string) {
    return this.prisma.consent.findFirst({ where: { studentId, type: 'PUBLICATION', status: 'ACTIVE', effectiveAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { grantedAt: 'desc' } });
  }

  private async studentIds(context: SupportingContext) {
    if (context.studentId) return [context.studentId];
    if (context.parentId) {
      const links = await this.prisma.studentParent.findMany({ where: { parentId: context.parentId, verificationStatus: 'VERIFIED', revokedAt: null, effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }], student: { school: { organizationId: context.organizationId } } }, select: { studentId: true } });
      return links.map((link) => link.studentId);
    }
    if (context.teacherId) {
      const assignments = await this.prisma.teacherAssignment.findMany({ where: { teacherId: context.teacherId, isActive: true, class: { school: { organizationId: context.organizationId }, ...(context.schoolId ? { schoolId: context.schoolId } : {}) } }, select: { classId: true } });
      const students = await this.prisma.classEnrollment.findMany({ where: { classId: { in: assignments.map((item) => item.classId) }, status: 'ACTIVE' }, select: { studentId: true }, distinct: ['studentId'] });
      return students.map((student) => student.studentId);
    }
    const students = await this.prisma.student.findMany({ where: { school: { organizationId: context.organizationId }, ...(context.schoolId ? { schoolId: context.schoolId } : {}) }, select: { id: true } });
    return students.map((student) => student.id);
  }
}
