import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AffiliateMetricSnapshot, Prisma, VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../infrastructure/queue.service';
import { AFFILIATE_PROVIDER_CAPABILITIES } from './affiliate-provider';
import { AccessService } from '../access/access.service';
import {
  AFFILIATE_PLATFORMS,
  AffiliatePlatform,
  deriveAffiliateMetrics,
  detectAffiliateDataFlags,
  extractAffiliateExternalId,
  extractAffiliateUsername,
  normalizeAffiliateUrl,
  normalizePublicUrl,
  roundMetric,
} from './affiliate.utils';

export class CreateAffiliateAccountDto {
  @IsIn(AFFILIATE_PLATFORMS) platform: AffiliatePlatform;
  @IsString() @MinLength(1) @MaxLength(100) username: string;
  @IsOptional() @IsString() @MaxLength(160) displayName?: string;
  @IsUrl({ require_protocol: true }) profileUrl: string;
  @IsOptional() @IsString() @MaxLength(200) externalAccountId?: string;
}

export class ReviewAffiliateAccountDto {
  @IsIn(['VERIFIED', 'REJECTED']) status: 'VERIFIED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class SaveAffiliateContentDto {
  @IsString() assignmentId: string;
  @IsString() affiliateAccountId: string;
  @IsIn(AFFILIATE_PLATFORMS) platform: AffiliatePlatform;
  @IsUrl({ require_protocol: true }) videoUrl: string;
  @IsOptional() @IsString() @MaxLength(200) externalId?: string;
  @IsDateString() publishedAt: string;
  @IsOptional() @IsString() @MaxLength(2200) caption?: string;
  @IsOptional() @IsString() @MaxLength(500) hook?: string;
  @IsString() @MinLength(1) @MaxLength(300) productName: string;
  @IsOptional() @IsString() @MaxLength(200) productExternalId?: string;
  @IsUrl({ require_protocol: true }) productUrl: string;
  @IsOptional() @IsString() @MaxLength(300) campaignName?: string;
  @IsUrl({ require_protocol: true }) evidenceUrl: string;
  @IsOptional() @IsUrl({ require_protocol: true }) insightsEvidenceUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) studentNote?: string;
  @IsBoolean() @Equals(true) disclosureAccepted: boolean;
  @IsBoolean() @Equals(true) ownershipDeclared: boolean;
}

export class CreateSnapshotDto {
  @IsInt() @Min(0) views: number;
  @IsOptional() @IsInt() @Min(0) likes?: number;
  @IsOptional() @IsInt() @Min(0) comments?: number;
  @IsOptional() @IsInt() @Min(0) shares?: number;
  @IsInt() @Min(0) clicks: number;
  @IsInt() @Min(0) orders: number;
  @IsInt() @Min(0) unitsSold: number;
  @IsOptional() @IsInt() @Min(0) refunds?: number;
  @IsNumber() @Min(0) gmv: number;
  @IsNumber() @Min(0) commission: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsDateString() snapshotDate: string;
  @IsOptional() @IsDateString() periodStart?: string;
  @IsOptional() @IsDateString() periodEnd?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) evidenceUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) sourceReference?: string;
  @IsOptional() @IsString() @MaxLength(64) supersedesId?: string;
}

export class VerifyMetricDto {
  @IsIn(['VERIFIED', 'REJECTED', 'NEEDS_REVIEW']) decision: VerificationStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ResolveAffiliateFlagDto {
  @IsIn(['DISMISSED', 'CONFIRMED', 'RESOLVED']) status: 'DISMISSED' | 'CONFIRMED' | 'RESOLVED';
  @IsString() @MinLength(3) @MaxLength(2000) notes: string;
}

export class AffiliateMetricImportRowDto extends CreateSnapshotDto {
  @IsString() videoId: string;
}

export class CreateAffiliateMetricImportDto {
  @IsString() @MinLength(1) @MaxLength(255) sourceName: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10_000) @ValidateNested({ each: true }) @Type(() => AffiliateMetricImportRowDto)
  rows: AffiliateMetricImportRowDto[];
}

@Injectable()
export class AffiliateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly access: AccessService,
  ) {}

  async getProviders(actor: any) {
    await this.assertContentAccess(actor);
    return AFFILIATE_PROVIDER_CAPABILITIES.map((provider) => ({
      platform: provider.platform,
      supportsOAuth: provider.supportsOAuth,
      supportsMetricSync: provider.supportsMetricSync,
      inputMode: provider.supportsMetricSync ? 'OFFICIAL_API' : 'MANUAL_OR_IMPORT',
    }));
  }

  async createAccount(dto: CreateAffiliateAccountDto, actor: any) {
    await this.assertContentAccess(actor);
    const { organizationId, schoolId, studentId } = this.requireStudentActor(actor);
    const profileUrl = normalizeAffiliateUrl(dto.profileUrl, dto.platform);
    try {
      return await this.prisma.affiliateAccount.create({
        data: {
          organizationId,
          schoolId,
          studentId,
          platform: dto.platform,
          username: dto.username.trim().replace(/^@/, ''),
          displayName: dto.displayName?.trim() || null,
          profileUrl,
          externalAccountId: dto.externalAccountId?.trim() || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Akun affiliate ini sudah terdaftar');
      }
      throw error;
    }
  }

  async listAccounts(actor: any, requestedStudentId?: string) {
    await this.assertContentAccess(actor);
    const schoolId = this.requireSchool(actor);
    const studentId = actor.roles?.includes('student') ? actor.studentId : requestedStudentId;
    return this.prisma.affiliateAccount.findMany({
      where: { schoolId, ...(studentId ? { studentId } : {}) },
      include: { student: { select: { id: true, fullName: true, studentNumber: true } }, _count: { select: { videos: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewAccount(id: string, dto: ReviewAffiliateAccountDto, actor: any) {
    await this.assertContentAccess(actor);
    const account = await this.prisma.affiliateAccount.findFirst({ where: { id, schoolId: this.requireSchool(actor) } });
    if (!account) throw new NotFoundException('Akun affiliate tidak ditemukan');
    if (account.status !== 'PENDING_VERIFICATION') throw new BadRequestException('Akun affiliate sudah memiliki keputusan final');
    if (dto.status === 'REJECTED' && !dto.notes?.trim()) throw new BadRequestException('Catatan wajib untuk penolakan');
    return this.prisma.$transaction(async (tx) => {
      await tx.affiliateAccountReview.create({
        data: { accountId: id, reviewerId: actor.userId, decision: dto.status, notes: dto.notes?.trim() || null },
      });
      return tx.affiliateAccount.update({
        where: { id },
        data: { status: dto.status, reviewerNotes: dto.notes?.trim() || null, reviewedById: actor.userId, reviewedAt: new Date() },
      });
    });
  }

  async saveContent(dto: SaveAffiliateContentDto, actor: any) {
    await this.assertContentAccess(actor);
    const { schoolId, studentId } = this.requireStudentActor(actor);
    const [assignment, account] = await Promise.all([
      this.access.assertAssignmentAccess(actor, dto.assignmentId, 'SUBMIT', 'AFFILIATE'),
      this.prisma.affiliateAccount.findFirst({ where: { id: dto.affiliateAccountId, studentId, schoolId, platform: dto.platform } }),
    ]);
    if (!account) throw new BadRequestException('Akun affiliate tidak sesuai dengan siswa atau platform');

    const publishedAt = new Date(dto.publishedAt);
    if (publishedAt < assignment.startDate || publishedAt > assignment.endDate) {
      throw new BadRequestException('Tanggal publikasi harus berada dalam periode tugas');
    }
    const normalizedUrl = normalizeAffiliateUrl(dto.videoUrl, dto.platform);
    const productUrl = normalizePublicUrl(dto.productUrl, 'URL produk');
    const evidenceUrl = normalizePublicUrl(dto.evidenceUrl, 'URL bukti publikasi');
    const insightsEvidenceUrl = dto.insightsEvidenceUrl ? normalizePublicUrl(dto.insightsEvidenceUrl, 'URL bukti insight') : null;
    const externalId = dto.externalId?.trim() || extractAffiliateExternalId(normalizedUrl, dto.platform) || null;
    const existingSubmission = await this.prisma.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
      include: { affiliateVideos: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (existingSubmission && !['DRAFT', 'REVISION_REQUIRED'].includes(existingSubmission.status)) {
      throw new BadRequestException('Konten tidak dapat diubah pada status saat ini');
    }
    const existingVideo = existingSubmission?.affiliateVideos[0];
    const duplicate = await this.prisma.affiliateVideo.findFirst({
      where: {
        OR: [{ normalizedUrl }, ...(externalId ? [{ externalId }] : [])],
        ...(existingVideo ? { id: { not: existingVideo.id } } : {}),
        student: { schoolId },
      },
      select: { id: true, studentId: true },
    });
    const contentUsername = extractAffiliateUsername(normalizedUrl, dto.platform);
    const ownershipMismatch = Boolean(contentUsername && contentUsername !== account.username.replace(/^@/, '').toLowerCase());

    const snapshot = {
      affiliateAccountId: account.id,
      platform: dto.platform,
      videoUrl: normalizedUrl,
      externalId,
      publishedAt: publishedAt.toISOString(),
      caption: dto.caption?.trim() || null,
      hook: dto.hook?.trim() || null,
      productName: dto.productName.trim(),
      productExternalId: dto.productExternalId?.trim() || null,
      productUrl,
      campaignName: dto.campaignName?.trim() || null,
      evidenceUrl,
      insightsEvidenceUrl,
      disclosureAccepted: dto.disclosureAccepted,
      ownershipDeclared: dto.ownershipDeclared,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      let submission = existingSubmission;
      if (!submission) {
        submission = await tx.submission.create({
          data: {
            assignmentId: assignment.id,
            studentId,
            status: 'DRAFT',
            versions: { create: { version: 1, notes: dto.studentNote, videoUrl: normalizedUrl, snapshotData: snapshot } },
          },
          include: { affiliateVideos: true },
        });
      } else {
        const latest = await tx.submissionVersion.aggregate({ where: { submissionId: submission.id }, _max: { version: true } });
        const submissionVersion = (latest._max.version || 0) + 1;
        await tx.submissionVersion.create({
          data: { submissionId: submission.id, version: submissionVersion, notes: dto.studentNote, videoUrl: normalizedUrl, snapshotData: snapshot },
        });
        await tx.submission.update({ where: { id: submission.id }, data: { currentVersion: submissionVersion } });
      }

      if (!existingVideo) {
        return tx.affiliateVideo.create({
          data: {
            submissionId: submission.id,
            studentId,
            affiliateAccountId: account.id,
            platform: dto.platform,
            videoUrl: normalizedUrl,
            normalizedUrl,
            externalId,
            publishedAt,
            caption: dto.caption?.trim() || null,
            hook: dto.hook?.trim() || null,
            productName: dto.productName.trim(),
            productExternalId: dto.productExternalId?.trim() || null,
            productUrl,
            campaignName: dto.campaignName?.trim() || null,
            evidenceUrl,
            insightsEvidenceUrl,
            studentNote: dto.studentNote?.trim() || null,
            disclosureAccepted: true,
            ownershipDeclared: true,
            versions: { create: { versionNumber: 1, snapshotData: snapshot, studentNote: dto.studentNote } },
          },
          include: { submission: true, versions: true },
        });
      }
      const nextVersion = existingVideo.currentVersion + 1;
      await tx.affiliateContentVersion.create({
        data: { affiliateVideoId: existingVideo.id, versionNumber: nextVersion, snapshotData: snapshot, studentNote: dto.studentNote },
      });
      return tx.affiliateVideo.update({
        where: { id: existingVideo.id },
        data: {
          affiliateAccountId: account.id,
          platform: dto.platform,
          videoUrl: normalizedUrl,
          normalizedUrl,
          externalId,
          publishedAt,
          caption: dto.caption?.trim() || null,
          hook: dto.hook?.trim() || null,
          productName: dto.productName.trim(),
          productExternalId: dto.productExternalId?.trim() || null,
          productUrl,
          campaignName: dto.campaignName?.trim() || null,
          evidenceUrl,
          insightsEvidenceUrl,
          studentNote: dto.studentNote?.trim() || null,
          disclosureAccepted: true,
          ownershipDeclared: true,
          verification: 'UNVERIFIED',
          currentVersion: nextVersion,
        },
        include: { submission: true, versions: { orderBy: { versionNumber: 'desc' } } },
      });
    });
    const signals = [
      ...(duplicate ? [{ type: 'DUPLICATE_CONTENT', reason: 'URL atau ID konten juga ditemukan pada pengumpulan lain di sekolah ini.', evidence: { matchingVideoId: duplicate.id, sameStudent: duplicate.studentId === studentId } }] : []),
      ...(ownershipMismatch ? [{ type: 'ACCOUNT_OWNERSHIP_MISMATCH', reason: 'Nama akun pada URL konten berbeda dari akun affiliate yang dipilih.', evidence: { urlUsername: contentUsername, accountUsername: account.username } }] : []),
    ];
    if (signals.length) {
      const existingTypes = await this.prisma.affiliateFraudFlag.findMany({
        where: { affiliateVideoId: result.id, status: 'OPEN', type: { in: signals.map((signal) => signal.type) } },
        select: { type: true },
      });
      const known = new Set(existingTypes.map((flag) => flag.type));
      const pending = signals.filter((signal) => !known.has(signal.type));
      if (pending.length) await this.prisma.affiliateFraudFlag.createMany({
        data: pending.map((signal) => ({ affiliateVideoId: result.id, ...signal, confidence: new Prisma.Decimal(0.8) })),
      });
    }
    return result;
  }

  async getWorkspace(actor: any) {
    const { schoolId, studentId } = this.requireStudentActor(actor);
    await this.access.assertEntitlement(actor, 'affiliate.content.submit', 'Affiliate tidak termasuk dalam paket aktif');
    const moduleIds = await this.access.getAccessiblePublishedModuleIds(actor);
    const [accounts, assignments, performance] = await Promise.all([
      this.listAccounts(actor, studentId),
      this.prisma.assignment.findMany({
        where: { type: 'AFFILIATE', isActive: true, moduleId: { in: [...moduleIds] }, publishedAt: { not: null, lte: new Date() }, course: { schoolId, enrollments: { some: { studentId, status: 'ACTIVE' } } } },
        include: {
          course: { select: { name: true, code: true } },
          rubric: { include: { criteria: { orderBy: { position: 'asc' } } } },
          submissions: {
            where: { studentId },
            include: { affiliateVideos: { include: { metricSnapshots: { orderBy: { snapshotDate: 'desc' }, take: 10 }, versions: { orderBy: { versionNumber: 'desc' } } } }, reviews: { where: { isPublished: true }, orderBy: { createdAt: 'desc' } } },
          },
        },
        orderBy: { endDate: 'asc' },
      }),
      this.getStudentPerformance(studentId, schoolId, actor),
    ]);
    return { accounts, assignments, performance, providers: await this.getProviders(actor) };
  }

  async createSnapshot(videoId: string, dto: CreateSnapshotDto, actor: any, source = 'MANUAL', importJobId?: string): Promise<AffiliateMetricSnapshot> {
    const schoolId = this.requireSchool(actor);
    await this.assertMetricAccess(actor);
    const video = await this.prisma.affiliateVideo.findFirst({
      where: { id: videoId, student: { schoolId }, ...(actor.roles?.includes('student') ? { studentId: actor.studentId } : {}) },
      include: { student: { include: { school: { select: { organizationId: true } } } } },
    });
    if (!video) throw new NotFoundException('Konten affiliate tidak ditemukan');

    const snapshotDate = new Date(dto.snapshotDate);
    if (snapshotDate < video.publishedAt) throw new BadRequestException('Tanggal snapshot tidak boleh sebelum konten dipublikasikan');
    if (snapshotDate > new Date()) throw new BadRequestException('Tanggal snapshot tidak boleh berada di masa depan');
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : null;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : null;
    if (periodStart && periodEnd && periodStart > periodEnd) throw new BadRequestException('Awal periode harus sebelum akhir periode');
    if (periodEnd && periodEnd > snapshotDate) throw new BadRequestException('Akhir periode tidak boleh setelah tanggal snapshot');
    const evidenceUrl = dto.evidenceUrl ? normalizePublicUrl(dto.evidenceUrl, 'URL bukti metrik') : undefined;
    if (dto.supersedesId) {
      const superseded = await this.prisma.affiliateMetricSnapshot.findFirst({
        where: { id: dto.supersedesId, affiliateVideoId: video.id, schoolId, corrections: { none: {} } },
        select: { id: true },
      });
      if (!superseded) throw new BadRequestException('Snapshot yang dikoreksi tidak valid atau sudah memiliki koreksi');
    }
    const [previous, duplicateTimestamp] = await Promise.all([
      this.prisma.affiliateMetricSnapshot.findFirst({ where: { affiliateVideoId: videoId, snapshotDate: { lt: snapshotDate }, corrections: { none: {} } }, orderBy: { snapshotDate: 'desc' } }),
      this.prisma.affiliateMetricSnapshot.count({ where: { affiliateVideoId: videoId, snapshotDate } }),
    ]);
    const derived = deriveAffiliateMetrics(dto);
    const flags = detectAffiliateDataFlags(
      { ...dto, snapshotDate, evidenceUrl },
      previous ? { views: previous.views, clicks: previous.clicks, orders: previous.orders, gmv: Number(previous.gmv), commission: Number(previous.commission), snapshotDate: previous.snapshotDate } : undefined,
      duplicateTimestamp > 0 && !dto.supersedesId,
    );
    const rawValues = {
      views: dto.views,
      likes: dto.likes || 0,
      comments: dto.comments || 0,
      shares: dto.shares || 0,
      clicks: dto.clicks,
      orders: dto.orders,
      unitsSold: dto.unitsSold,
      refunds: dto.refunds || 0,
      gmv: dto.gmv,
      commission: dto.commission,
    };

    return this.prisma.$transaction(async (tx) => {
      const metric = await tx.affiliateMetricSnapshot.create({
        data: {
          organizationId: video.student.school.organizationId,
          schoolId,
          studentId: video.studentId,
          affiliateVideoId: video.id,
          affiliateAccountId: video.affiliateAccountId,
          importJobId,
          createdById: actor.userId,
          platform: video.platform,
          ...rawValues,
          ctr: new Prisma.Decimal(roundMetric(derived.ctr)),
          conversionRate: new Prisma.Decimal(roundMetric(derived.conversionRate)),
          averageOrderValue: new Prisma.Decimal(roundMetric(derived.averageOrderValue)),
          commissionRate: new Prisma.Decimal(roundMetric(derived.commissionRate)),
          gmv: new Prisma.Decimal(dto.gmv),
          commission: new Prisma.Decimal(dto.commission),
          currency: (dto.currency || 'IDR').toUpperCase(),
          snapshotDate,
          periodStart,
          periodEnd,
          source,
          sourceReference: dto.sourceReference?.trim() || null,
          evidenceUrl,
          supersedesId: dto.supersedesId || null,
          rawValues: rawValues as Prisma.InputJsonValue,
          dataQualityFlags: flags,
          verification: flags.length ? 'NEEDS_REVIEW' : 'UNVERIFIED',
        },
      });
      if (flags.length) {
        await tx.affiliateFraudFlag.createMany({
          data: flags.map((type) => ({
            affiliateVideoId: video.id,
            metricSnapshotId: metric.id,
            type,
            reason: this.flagReason(type),
            evidence: { snapshotDate: snapshotDate.toISOString(), source },
            confidence: new Prisma.Decimal(type === 'EVIDENCE_MISSING' ? 1 : 0.8),
          })),
        });
      }
      return metric;
    });
  }

  async getStudentPerformance(studentId: string, schoolId: string, actor?: any) {
    if (actor) await this.assertMetricAccess(actor);
    if (!studentId) throw new ForbiddenException('Profil siswa diperlukan');
    const studentExists = await this.prisma.student.count({ where: { id: studentId, schoolId } });
    if (!studentExists) throw new NotFoundException('Siswa tidak ditemukan');
    const videos = await this.prisma.affiliateVideo.findMany({
      where: { studentId, student: { schoolId } },
      include: {
        submission: { select: { id: true, status: true, score: true, feedback: true, assignment: { select: { title: true } } } },
        account: { select: { id: true, username: true, platform: true, status: true } },
        metricSnapshots: {
          select: {
            id: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            clicks: true,
            ctr: true,
            orders: true,
            unitsSold: true,
            refunds: true,
            gmv: true,
            conversionRate: true,
            averageOrderValue: true,
            commission: true,
            commissionRate: true,
            currency: true,
            snapshotDate: true,
            periodStart: true,
            periodEnd: true,
            source: true,
            evidenceUrl: true,
            verification: true,
            supersedesId: true,
            createdAt: true,
            corrections: { select: { id: true } },
          },
          orderBy: { snapshotDate: 'desc' },
          take: 30,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    let totalViews = 0;
    let totalClicks = 0;
    let totalOrders = 0;
    let totalGmv = 0;
    let totalCommission = 0;
    for (const video of videos) {
      const latest = video.metricSnapshots.find((snapshot) => snapshot.verification === 'VERIFIED' && snapshot.corrections.length === 0);
      if (!latest) continue;
      totalViews += latest.views;
      totalClicks += latest.clicks;
      totalOrders += latest.orders;
      totalGmv += Number(latest.gmv);
      totalCommission += Number(latest.commission);
    }
    const derived = deriveAffiliateMetrics({ views: totalViews, clicks: totalClicks, orders: totalOrders, gmv: totalGmv, commission: totalCommission });
    return {
      totalVideos: videos.length,
      totalViews,
      totalClicks,
      totalOrders,
      totalGmv,
      totalCommission,
      ctr: roundMetric(derived.ctr),
      conversionRate: roundMetric(derived.conversionRate),
      averageOrderValue: roundMetric(derived.averageOrderValue),
      commissionRate: roundMetric(derived.commissionRate),
      videos,
    };
  }

  async getVerificationQueue(actor: any) {
    await this.assertMetricAccess(actor);
    const schoolId = this.requireSchool(actor);
    const [accounts, metrics, flags] = await Promise.all([
      this.prisma.affiliateAccount.findMany({
        where: { schoolId, status: 'PENDING_VERIFICATION' },
        include: { student: { select: { fullName: true, studentNumber: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.affiliateMetricSnapshot.findMany({
        where: { schoolId, verification: { in: ['UNVERIFIED', 'NEEDS_REVIEW'] } },
        include: {
          student: { select: { fullName: true, studentNumber: true } },
          affiliateVideo: { select: { id: true, videoUrl: true, productName: true, campaignName: true } },
          fraudFlags: { where: { status: 'OPEN' } },
        },
        orderBy: { snapshotDate: 'asc' },
        take: 300,
      }),
      this.prisma.affiliateFraudFlag.findMany({
        where: { status: 'OPEN', affiliateVideo: { student: { schoolId } } },
        include: { affiliateVideo: { select: { videoUrl: true, student: { select: { fullName: true, studentNumber: true } } } }, metricSnapshot: true },
        orderBy: { createdAt: 'asc' },
        take: 300,
      }),
    ]);
    return { accounts, metrics, flags };
  }

  async verifyMetric(id: string, dto: VerifyMetricDto, actor: any) {
    await this.assertMetricAccess(actor);
    const metric = await this.prisma.affiliateMetricSnapshot.findFirst({ where: { id, schoolId: this.requireSchool(actor) } });
    if (!metric) throw new NotFoundException('Snapshot metrik tidak ditemukan');
    if (!['UNVERIFIED', 'NEEDS_REVIEW'].includes(metric.verification)) throw new BadRequestException('Snapshot metrik sudah memiliki keputusan final');
    if (dto.decision !== 'VERIFIED' && !dto.notes?.trim()) throw new BadRequestException('Catatan wajib untuk hasil selain terverifikasi');
    if (dto.decision === 'VERIFIED') {
      const openFlags = await this.prisma.affiliateFraudFlag.count({ where: { metricSnapshotId: id, status: 'OPEN' } });
      if (openFlags > 0) throw new BadRequestException('Selesaikan seluruh flag terbuka sebelum memverifikasi snapshot');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.affiliateMetricVerification.create({
        data: { metricSnapshotId: id, reviewerId: actor.userId, decision: dto.decision, notes: dto.notes?.trim() || null },
      });
      return tx.affiliateMetricSnapshot.update({
        where: { id },
        data: { verification: dto.decision, verifiedById: actor.userId, verifiedAt: new Date(), verificationNotes: dto.notes?.trim() || null },
      });
    });
  }

  async resolveFlag(id: string, dto: ResolveAffiliateFlagDto, actor: any) {
    await this.assertMetricAccess(actor);
    const flag = await this.prisma.affiliateFraudFlag.findFirst({ where: { id, affiliateVideo: { student: { schoolId: this.requireSchool(actor) } } } });
    if (!flag) throw new NotFoundException('Flag kualitas data tidak ditemukan');
    if (flag.status !== 'OPEN') throw new BadRequestException('Flag sudah diselesaikan');
    return this.prisma.affiliateFraudFlag.update({
      where: { id },
      data: { status: dto.status, resolutionNotes: dto.notes.trim(), resolvedById: actor.userId, resolvedAt: new Date() },
    });
  }

  async createMetricImport(dto: CreateAffiliateMetricImportDto, actor: any) {
    await this.assertMetricAccess(actor);
    const schoolId = this.requireSchool(actor);
    if (!actor.organizationId) throw new BadRequestException('Konteks organisasi diperlukan');
    if (!dto.sourceName.trim()) throw new BadRequestException('Nama sumber impor wajib diisi');
    const job = await this.prisma.importJob.create({
      data: {
        organizationId: actor.organizationId,
        schoolId,
        createdById: actor.userId,
        type: 'AFFILIATE_METRICS',
        sourceName: dto.sourceName.trim(),
        totalRows: dto.rows.length,
        rows: { create: dto.rows.map((row, index) => ({ rowNumber: index + 2, payload: row as unknown as Prisma.InputJsonValue })) },
      },
    });
    await this.queue.add(
      'affiliate-metric-import',
      'process',
      { organizationId: actor.organizationId, schoolId, requestedBy: actor.userId, payload: { importJobId: job.id } },
      { jobId: job.id },
    );
    return { id: job.id, status: job.status, totalRows: job.totalRows, sourceName: job.sourceName, createdAt: job.createdAt };
  }

  async listMetricImports(actor: any) {
    await this.assertMetricAccess(actor);
    return this.prisma.importJob.findMany({
      where: { schoolId: this.requireSchool(actor), organizationId: actor.organizationId, type: 'AFFILIATE_METRICS' },
      include: { rows: { where: { status: 'FAILED' }, select: { rowNumber: true, errors: true }, take: 100 } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getExportData(actor: any) {
    await Promise.all([
      this.assertMetricAccess(actor),
      this.access.assertEntitlement(actor, 'reports.export', 'Ekspor laporan tidak termasuk dalam paket aktif'),
    ]);
    const schoolId = this.requireSchool(actor);
    const students = await this.prisma.student.findMany({ where: { schoolId }, select: { id: true, studentNumber: true, fullName: true, class: { select: { name: true } } } });
    const exportData = [];
    for (const student of students) {
      const performance = await this.getStudentPerformance(student.id, schoolId);
      exportData.push({
        studentNumber: student.studentNumber,
        fullName: student.fullName,
        className: student.class?.name || 'N/A',
        totalVideos: performance.totalVideos,
        views: performance.totalViews,
        clicks: performance.totalClicks,
        orders: performance.totalOrders,
        gmv: performance.totalGmv,
        commission: performance.totalCommission,
        ctr: `${performance.ctr.toFixed(2)}%`,
        conversionRate: `${performance.conversionRate.toFixed(2)}%`,
      });
    }
    return exportData;
  }

  private requireSchool(actor: any): string {
    if (!actor.schoolId) throw new ForbiddenException('Pilih konteks sekolah terlebih dahulu');
    return actor.schoolId;
  }

  private assertContentAccess(actor: any) {
    return this.access.assertEntitlement(actor, 'affiliate.content.submit', 'Affiliate tidak termasuk dalam paket aktif');
  }

  private assertMetricAccess(actor: any) {
    return this.access.assertEntitlement(actor, 'affiliate.metrics.manage', 'Metrik affiliate tidak termasuk dalam paket aktif');
  }

  private requireStudentActor(actor: any): { organizationId: string; schoolId: string; studentId: string } {
    if (!actor.organizationId || !actor.schoolId || !actor.studentId) throw new ForbiddenException('Profil siswa dan konteks sekolah diperlukan');
    return { organizationId: actor.organizationId, schoolId: actor.schoolId, studentId: actor.studentId };
  }

  private flagReason(type: string) {
    const reasons: Record<string, string> = {
      CLICK_EXCEEDS_VIEWS: 'Jumlah klik melebihi jumlah tayangan.',
      ORDERS_EXCEED_CLICKS: 'Jumlah pesanan melebihi jumlah klik.',
      REFUNDS_EXCEED_ORDERS: 'Jumlah refund melebihi jumlah pesanan.',
      UNITS_BELOW_ORDERS: 'Jumlah unit terjual lebih kecil daripada jumlah pesanan.',
      GMV_WITHOUT_ORDERS: 'GMV tercatat tanpa pesanan.',
      COMMISSION_WITHOUT_GMV: 'Komisi tercatat tanpa GMV.',
      SUSPICIOUS_COMMISSION_RATE: 'Rasio komisi melebihi batas pemeriksaan awal.',
      EVIDENCE_MISSING: 'Bukti insight belum disertakan.',
      DUPLICATE_TIMESTAMP: 'Ada snapshot lain dengan waktu pengambilan yang sama.',
      LIFETIME_METRIC_DECREASE: 'Metrik kumulatif menurun dibanding snapshot sebelumnya.',
      EXTREME_CHANGE: 'Perubahan tayangan sangat besar dibanding snapshot sebelumnya.',
    };
    return reasons[type] || 'Data perlu pemeriksaan manusia.';
  }
}
