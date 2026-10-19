import { Worker } from 'bullmq';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from 'crypto';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { deriveAffiliateMetrics, detectAffiliateDataFlags, normalizePublicUrl, roundMetric } from './affiliate/affiliate.utils';
import { selectEffectiveGrant } from './access/access-policy';
import { toSafeCsv } from './monitoring/monitoring.utils';
import { inspectFileBuffer } from './common/utils/file-security.utils';
import { createConnection } from 'net';
import { absoluteActionUrl, escapeEmailHtml, sendTransactionalEmail } from './common/services/email.service';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

async function scanWithClamAv(bytes: Buffer) {
  const host = process.env.CLAMAV_HOST;
  if (!host) {
    if (process.env.MALWARE_SCANNER_REQUIRED === 'true') throw new Error('MALWARE_SCANNER_UNAVAILABLE');
    return;
  }
  const port = Number(process.env.CLAMAV_PORT || 3310);
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timeout = setTimeout(() => socket.destroy(new Error('MALWARE_SCANNER_TIMEOUT')), 15_000);
    let response = '';
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length));
        const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length);
        socket.write(length); socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => { response += chunk.toString('utf8'); });
    socket.on('error', reject);
    socket.on('close', () => {
      clearTimeout(timeout);
      if (/FOUND/.test(response)) reject(new Error('MALWARE_DETECTED'));
      else if (/OK/.test(response)) resolve();
      else reject(new Error('MALWARE_SCANNER_INVALID_RESPONSE'));
    });
  });
}

const prisma = new PrismaClient();

async function hasWorkerEntitlement(context: { organizationId: string; schoolId: string | null; userId: string | null }, key: string) {
  if (!context.userId) return false;
  const now = new Date();
  const [activeUser, freePlan, grants] = await Promise.all([
    prisma.user.count({ where: { id: context.userId, organizationId: context.organizationId, status: 'ACTIVE' } }),
    prisma.accessPlan.findUnique({
      where: { code: 'FREE' },
      include: { entitlements: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, include: { entitlementDefinition: true } } },
    }),
    prisma.accessGrant.findMany({
      where: {
        organizationId: context.organizationId,
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        startsAt: { lte: now },
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        OR: [
          { targetType: 'ORGANIZATION' },
          ...(context.schoolId ? [{ targetType: 'SCHOOL' as const, schoolId: context.schoolId }] : []),
          { targetType: 'USER', userId: context.userId },
        ],
      },
      include: { accessPlan: { include: { entitlements: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, include: { entitlementDefinition: true } } } } },
    }),
  ]);
  if (!activeUser || !freePlan) return false;
  const selected = selectEffectiveGrant(grants.map((grant) => ({
    id: grant.id,
    planCode: grant.accessPlan.code,
    planRank: grant.accessPlan.rank,
    moduleLimit: grant.accessPlan.moduleLimit,
    scope: grant.targetType,
    startsAt: grant.startsAt,
    endsAt: grant.endsAt,
    status: grant.status,
    source: grant.source,
  })), now);
  const plan = selected ? grants.find((grant) => grant.id === selected.id)!.accessPlan : freePlan;
  const entitlement = plan.entitlements.find((item) => item.entitlementDefinition.key === key);
  const value = entitlement?.valueJson ?? entitlement?.enabled ?? false;
  return typeof value === 'boolean' ? value : typeof value === 'number' ? value > 0 : Boolean(value && typeof value === 'object' && 'enabled' in value && (value as any).enabled);
}

async function hasWorkerPermission(context: { organizationId: string; schoolId: string | null; userId: string | null }, resource: string, action: string) {
  if (!context.userId) return false;
  return (await prisma.userRole.count({
    where: {
      userId: context.userId,
      OR: [{ schoolId: null }, ...(context.schoolId ? [{ schoolId: context.schoolId }] : [])],
      role: {
        isActive: true,
        OR: [
          { slug: 'super-admin' },
          { rolePermissions: { some: { permission: { resource, action, OR: [{ organizationId: null }, { organizationId: context.organizationId }] } } } },
        ],
      },
    },
  })) > 0;
}

async function hasWorkerBroadReportingRole(context: { organizationId: string; schoolId: string | null; userId: string | null }) {
  if (!context.userId) return false;
  return (await prisma.userRole.count({
    where: {
      userId: context.userId,
      OR: [{ schoolId: null }, ...(context.schoolId ? [{ schoolId: context.schoolId }] : [])],
      role: {
        isActive: true,
        slug: { in: ['super-admin', 'program-manager', 'school-admin', 'principal'] },
        OR: [{ organizationId: null }, { organizationId: context.organizationId }],
      },
    },
  })) > 0;
}
const sensitiveKey = scryptSync(process.env.ENCRYPTION_KEY || 'a-very-secret-key-32-chars-long!!', 'salt', 32);
const blindIndexKey = process.env.BLIND_INDEX_KEY || process.env.ENCRYPTION_KEY || 'a-very-secret-key-32-chars-long!!';

function encryptSensitive(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sensitiveKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function decryptSensitive(value: string) {
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length < 29) throw new Error('INVALID_ENCRYPTED_IDENTIFIER');
  const decipher = createDecipheriv('aes-256-gcm', sensitiveKey, buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return decipher.update(buffer.subarray(28), undefined, 'utf8') + decipher.final('utf8');
}

function identifierBlindIndex(value: string, type: string) {
  return createHmac('sha256', blindIndexKey).update(`${type}:${value.replace(/\s+/g, '').toUpperCase()}`).digest('hex');
}

const storagePrefix = process.env.OBJECT_STORAGE_PREFIX || 'sunrise';
const storageClient = new S3Client({
  region: process.env.OBJECT_STORAGE_REGION || 'us-east-1',
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT || 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY || 'sunrise-local',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY || 'sunrise-local-secret',
  },
});

function escapePdfText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildCertificatePdf(input: { title: string; studentName: string; schoolName: string; verificationCode: string; issuedAt: Date }) {
  const lines = [
    { text: 'SUNRISE ACADEMY', size: 16, y: 710 },
    { text: 'SERTIFIKAT', size: 30, y: 640 },
    { text: input.title, size: 18, y: 585 },
    { text: 'Diberikan kepada', size: 12, y: 530 },
    { text: input.studentName, size: 24, y: 485 },
    { text: input.schoolName, size: 14, y: 445 },
    { text: `Diterbitkan ${input.issuedAt.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}`, size: 11, y: 365 },
    { text: `Kode verifikasi: ${input.verificationCode}`, size: 10, y: 335 },
    { text: 'Verifikasi keaslian sertifikat melalui portal Sunrise Academy.', size: 9, y: 305 },
  ];
  const stream = [
    '0.98 0.97 0.92 rg 0 0 842 595 re f',
    '0.94 0.45 0.12 RG 5 w 24 24 794 547 re S',
    ...lines.map(({ text, size, y }) => `BT /F1 ${size} Tf 70 ${y - 210} Td (${escapePdfText(text)}) Tj ET`),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'ascii');
}

function externalNotificationAllowed(eventType: string, preference: {
  assignmentUpdates: boolean; reviewUpdates: boolean; announcements: boolean;
  earlyWarnings: boolean; helpdeskUpdates: boolean;
}) {
  if (eventType === 'ANNOUNCEMENT') return preference.announcements;
  if (eventType.startsWith('HELPDESK_')) return preference.helpdeskUpdates;
  if (eventType.includes('WARNING') || eventType.includes('DEADLINE') || eventType.includes('INCOMPLETE')) return preference.earlyWarnings;
  if (/(REVIEW|REVISION|APPROVED|REJECTED|GRADE|VERIFICATION)/.test(eventType)) return preference.reviewUpdates;
  if (/(ASSIGNMENT|SUBMISSION|DRAFT|STORE)/.test(eventType)) return preference.assignmentUpdates;
  return true;
}

const systemWorker = new Worker(
  'system',
  async (job) => {
    if (job.name !== 'healthcheck') throw new Error(`Unsupported system job: ${job.name}`);
    return {
      ok: true,
      organizationId: job.data?.organizationId,
      schoolId: job.data?.schoolId,
      processedAt: new Date().toISOString(),
    };
  },
  {
    connection: redisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 4),
  },
);

const studentImportWorker = new Worker(
  'student-import',
  async (job) => {
    const importJobId = job.data?.payload?.importJobId;
    if (!importJobId) throw new Error('Import job ID is missing');
    const importJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!importJob || importJob.status !== 'QUEUED') return { skipped: true };

    await prisma.importJob.update({ where: { id: importJobId }, data: { status: 'PROCESSING', startedAt: new Date() } });
    let imported = 0;
    let failed = 0;
    try {
      const studentRole = await prisma.role.findFirst({
        where: { organizationId: importJob.organizationId, slug: 'student', isActive: true },
      });
      if (!studentRole) throw new Error('Student role is not configured');

      while (true) {
        const rows = await prisma.importRow.findMany({
          where: { importJobId, status: 'PENDING' },
          orderBy: { rowNumber: 'asc' },
          take: 200,
        });
        if (rows.length === 0) break;

        for (const row of rows) {
          const payload = row.payload as Record<string, any>;
          try {
            const email = String(payload.email || '').trim().toLowerCase();
            const studentNumber = String(payload.studentNumber || '').trim();
            const fullName = String(payload.fullName || '').trim();
            const nisn = payload.nisnEncrypted
              ? decryptSensitive(String(payload.nisnEncrypted)).trim()
              : undefined;
            if (!email || !studentNumber || !fullName) throw new Error('REQUIRED_FIELDS_MISSING');

            const [duplicate, duplicateNisn] = await Promise.all([
              prisma.student.findFirst({
                where: { OR: [{ schoolId: importJob.schoolId, studentNumber }, { user: { email } }] },
                select: { id: true },
              }),
              nisn
                ? prisma.studentIdentifier.findUnique({
                    where: { type_blindIndex: { type: 'NISN', blindIndex: identifierBlindIndex(nisn, 'NISN') } },
                    select: { id: true },
                  })
                : Promise.resolve(null),
            ]);
            if (duplicate || duplicateNisn) throw new Error('DUPLICATE_STUDENT');

            const targetClass = payload.classCode
              ? await prisma.class.findFirst({
                  where: { schoolId: importJob.schoolId, code: String(payload.classCode), isActive: true },
                })
              : null;
            if (payload.classCode && !targetClass) throw new Error('CLASS_NOT_FOUND');

            const invitationToken = randomBytes(32).toString('base64url');
            const unusablePassword = await bcrypt.hash(randomBytes(32).toString('hex'), Number(process.env.PASSWORD_BCRYPT_COST || 12));
            const names = fullName.split(/\s+/);
            await prisma.$transaction(async (tx) => {
              const user = await tx.user.create({
                data: {
                  organizationId: importJob.organizationId,
                  email,
                  passwordHash: unusablePassword,
                  firstName: names[0],
                  lastName: names.slice(1).join(' ') || '-',
                  status: 'PENDING_ACTIVATION',
                },
              });
              const student = await tx.student.create({
                data: {
                  userId: user.id,
                  schoolId: importJob.schoolId,
                  classId: targetClass?.id,
                  studentNumber,
                  fullName,
                  status: 'DRAFT',
                },
              });
              if (nisn) {
                await tx.studentIdentifier.create({
                  data: {
                    studentId: student.id,
                    type: 'NISN',
                    valueEncrypted: String(payload.nisnEncrypted),
                    blindIndex: identifierBlindIndex(nisn, 'NISN'),
                    last4: String(payload.nisnLast4 || nisn.slice(-4)),
                  },
                });
              }
              await tx.userRole.create({ data: { userId: user.id, roleId: studentRole.id, schoolId: importJob.schoolId } });
              await tx.invitation.create({
                data: {
                  organizationId: importJob.organizationId,
                  schoolId: importJob.schoolId,
                  roleId: studentRole.id,
                  userId: user.id,
                  invitedById: importJob.createdById,
                  email,
                  firstName: names[0],
                  lastName: names.slice(1).join(' ') || '-',
                  tokenHash: createHash('sha256').update(invitationToken).digest('hex'),
                  profileData: { studentNumber, fullName, classId: targetClass?.id ?? null },
                  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                },
              });
              if (targetClass) {
                await tx.classEnrollment.create({
                  data: {
                    studentId: student.id,
                    classId: targetClass.id,
                    schoolId: importJob.schoolId,
                    effectiveFrom: new Date(),
                  },
                });
              }
              await tx.importRow.update({
                where: { id: row.id },
                data: {
                  status: 'IMPORTED',
                  errors: Prisma.JsonNull,
                  payload: {
                    email,
                    studentNumber,
                    fullName,
                    ...(payload.classCode ? { classCode: String(payload.classCode) } : {}),
                    ...(nisn ? { nisnLast4: String(payload.nisnLast4 || nisn.slice(-4)) } : {}),
                  },
                },
              });
            });
            imported += 1;
          } catch (error) {
            failed += 1;
            const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'ROW_IMPORT_FAILED';
            await prisma.importRow.update({ where: { id: row.id }, data: { status: 'FAILED', errors: { codes: [code] } } });
          }
        }

        const processedRows = imported + failed;
        await prisma.importJob.update({
          where: { id: importJobId },
          data: { processedRows, validRows: imported, failedRows: failed },
        });
        await job.updateProgress(Math.round((processedRows / importJob.totalRows) * 100));
      }

      const status = failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status, processedRows: imported + failed, validRows: imported, failedRows: failed, completedAt: new Date() },
      });
      return { imported, failed };
    } catch (error) {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: 'FAILED', failureReason: 'IMPORT_PROCESSING_FAILED', completedAt: new Date() },
      });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.IMPORT_WORKER_CONCURRENCY || 2) },
);

const affiliateMetricImportWorker = new Worker(
  'affiliate-metric-import',
  async (job) => {
    const importJobId = job.data?.payload?.importJobId;
    if (!importJobId) throw new Error('Affiliate metric import job ID is missing');
    const importJob = await prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!importJob || importJob.type !== 'AFFILIATE_METRICS' || importJob.status !== 'QUEUED') return { skipped: true };
    if (!(await hasWorkerEntitlement({ organizationId: importJob.organizationId, schoolId: importJob.schoolId, userId: importJob.createdById }, 'affiliate.metrics.manage'))) {
      await prisma.importJob.update({ where: { id: importJobId }, data: { status: 'FAILED', failureReason: 'ENTITLEMENT_NOT_ACTIVE', completedAt: new Date() } });
      return { skipped: true, reason: 'ENTITLEMENT_NOT_ACTIVE' };
    }
    await prisma.importJob.update({ where: { id: importJobId }, data: { status: 'PROCESSING', startedAt: new Date() } });
    let imported = 0;
    let failed = 0;
    try {
      const rows = await prisma.importRow.findMany({ where: { importJobId, status: 'PENDING' }, orderBy: { rowNumber: 'asc' } });
      for (const row of rows) {
        const payload = row.payload as Record<string, any>;
        try {
          const video = await prisma.affiliateVideo.findFirst({
            where: { id: String(payload.videoId || ''), student: { schoolId: importJob.schoolId } },
            include: { student: { include: { school: { select: { organizationId: true } } } } },
          });
          if (!video || video.student.school.organizationId !== importJob.organizationId) throw new Error('VIDEO_NOT_FOUND');
          const integerFields = ['views', 'likes', 'comments', 'shares', 'clicks', 'orders', 'unitsSold', 'refunds'];
          const values: Record<string, number> = {};
          for (const field of integerFields) {
            const value = Number(payload[field] || 0);
            if (!Number.isInteger(value) || value < 0) throw new Error('INVALID_METRIC_VALUE');
            values[field] = value;
          }
          const gmv = Number(payload.gmv || 0);
          const commission = Number(payload.commission || 0);
          if (!Number.isFinite(gmv) || !Number.isFinite(commission) || gmv < 0 || commission < 0) throw new Error('INVALID_MONEY_VALUE');
          const snapshotDate = new Date(String(payload.snapshotDate || ''));
          if (Number.isNaN(snapshotDate.getTime())) throw new Error('INVALID_SNAPSHOT_DATE');
          if (snapshotDate < video.publishedAt || snapshotDate > new Date()) throw new Error('INVALID_SNAPSHOT_DATE');
          const periodStart = payload.periodStart ? new Date(String(payload.periodStart)) : null;
          const periodEnd = payload.periodEnd ? new Date(String(payload.periodEnd)) : null;
          if ((periodStart && Number.isNaN(periodStart.getTime())) || (periodEnd && Number.isNaN(periodEnd.getTime())) || (periodStart && periodEnd && periodStart > periodEnd) || (periodEnd && periodEnd > snapshotDate)) throw new Error('INVALID_METRIC_PERIOD');
          const supersedesId = payload.supersedesId ? String(payload.supersedesId) : null;
          if (supersedesId) {
            const superseded = await prisma.affiliateMetricSnapshot.findFirst({
              where: { id: supersedesId, affiliateVideoId: video.id, schoolId: importJob.schoolId, corrections: { none: {} } },
              select: { id: true },
            });
            if (!superseded) throw new Error('INVALID_SUPERSEDED_SNAPSHOT');
          }
          const [previous, duplicateTimestamp] = await Promise.all([
            prisma.affiliateMetricSnapshot.findFirst({ where: { affiliateVideoId: video.id, snapshotDate: { lt: snapshotDate }, corrections: { none: {} } }, orderBy: { snapshotDate: 'desc' } }),
            prisma.affiliateMetricSnapshot.count({ where: { affiliateVideoId: video.id, snapshotDate } }),
          ]);
          const metricInput = { views: values.views, clicks: values.clicks, orders: values.orders, unitsSold: values.unitsSold, refunds: values.refunds, gmv, commission };
          const derived = deriveAffiliateMetrics(metricInput);
          const evidenceUrl = payload.evidenceUrl ? normalizePublicUrl(String(payload.evidenceUrl), 'URL bukti metrik') : undefined;
          const flags = detectAffiliateDataFlags(
            { ...metricInput, snapshotDate, evidenceUrl },
            previous ? { views: previous.views, clicks: previous.clicks, orders: previous.orders, gmv: Number(previous.gmv), commission: Number(previous.commission), snapshotDate: previous.snapshotDate } : undefined,
            duplicateTimestamp > 0 && !supersedesId,
          );
          await prisma.$transaction(async (tx) => {
            const metric = await tx.affiliateMetricSnapshot.create({
              data: {
                organizationId: importJob.organizationId,
                schoolId: importJob.schoolId,
                studentId: video.studentId,
                affiliateVideoId: video.id,
                affiliateAccountId: video.affiliateAccountId,
                importJobId,
                createdById: importJob.createdById,
                platform: video.platform,
                views: values.views,
                likes: values.likes,
                comments: values.comments,
                shares: values.shares,
                clicks: values.clicks,
                orders: values.orders,
                unitsSold: values.unitsSold,
                refunds: values.refunds,
                gmv: new Prisma.Decimal(gmv),
                commission: new Prisma.Decimal(commission),
                ctr: new Prisma.Decimal(roundMetric(derived.ctr)),
                conversionRate: new Prisma.Decimal(roundMetric(derived.conversionRate)),
                averageOrderValue: new Prisma.Decimal(roundMetric(derived.averageOrderValue)),
                commissionRate: new Prisma.Decimal(roundMetric(derived.commissionRate)),
                currency: String(payload.currency || 'IDR').toUpperCase().slice(0, 8),
                snapshotDate,
                periodStart,
                periodEnd,
                source: 'IMPORT',
                sourceReference: importJob.sourceName,
                evidenceUrl,
                supersedesId,
                rawValues: payload as Prisma.InputJsonValue,
                dataQualityFlags: flags,
                verification: flags.length ? 'NEEDS_REVIEW' : 'UNVERIFIED',
              },
            });
            if (flags.length) {
              await tx.affiliateFraudFlag.createMany({
                data: flags.map((type) => ({ affiliateVideoId: video.id, metricSnapshotId: metric.id, type, reason: 'Data impor memerlukan pemeriksaan manusia.', evidence: { importJobId, rowNumber: row.rowNumber }, confidence: 0.8 })),
              });
            }
            await tx.importRow.update({ where: { id: row.id }, data: { status: 'IMPORTED', errors: undefined } });
          });
          imported += 1;
        } catch (error) {
          failed += 1;
          const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'ROW_IMPORT_FAILED';
          await prisma.importRow.update({ where: { id: row.id }, data: { status: 'FAILED', errors: { codes: [code] } } });
        }
        const processedRows = imported + failed;
        await prisma.importJob.update({ where: { id: importJobId }, data: { processedRows, validRows: imported, failedRows: failed } });
        await job.updateProgress(Math.round((processedRows / importJob.totalRows) * 100));
      }
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', processedRows: imported + failed, validRows: imported, failedRows: failed, completedAt: new Date() },
      });
      return { imported, failed };
    } catch (error) {
      await prisma.importJob.update({ where: { id: importJobId }, data: { status: 'FAILED', failureReason: 'AFFILIATE_IMPORT_FAILED', completedAt: new Date() } });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.AFFILIATE_IMPORT_CONCURRENCY || 2) },
);

const identityScanWorker = new Worker(
  'identity-scan',
  async (job) => {
    const documentId = job.data?.payload?.documentId;
    if (!documentId) throw new Error('Identity document ID is missing');
    const document = await prisma.identityDocument.findUnique({ where: { id: documentId } });
    if (!document?.quarantineStorageKey) return { skipped: true };
    const quarantineBucket = `${storagePrefix}-quarantine`;
    const privateBucket = `${storagePrefix}-identity-private`;
    try {
      const object = await storageClient.send(new GetObjectCommand({ Bucket: quarantineBucket, Key: document.quarantineStorageKey }));
      if (!object.Body) throw new Error('EMPTY_FILE');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      const inspection = inspectFileBuffer(bytes, document.mimeType || '', 8 * 1024 * 1024);
      if (!inspection.clean) {
        await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: document.quarantineStorageKey }));
        await prisma.identityDocument.update({
          where: { id: documentId },
          data: { scanStatus: 'INFECTED', scanCompletedAt: new Date(), documentStatus: 'REJECTED', verificationStatus: 'REJECTED', verificationNotes: inspection.reason || 'FILE_SECURITY_REJECTED', quarantineStorageKey: null },
        });
        return { clean: false, reason: inspection.reason };
      }
      try {
        await scanWithClamAv(bytes);
      } catch (error) {
        if (error instanceof Error && error.message === 'MALWARE_DETECTED') {
          await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: document.quarantineStorageKey }));
          await prisma.identityDocument.update({ where: { id: documentId }, data: { scanStatus: 'INFECTED', scanCompletedAt: new Date(), documentStatus: 'REJECTED', verificationStatus: 'REJECTED', verificationNotes: 'MALWARE_DETECTED', quarantineStorageKey: null } });
          return { clean: false, reason: 'MALWARE_DETECTED' };
        }
        throw error;
      }
      const cleanStorageKey = document.quarantineStorageKey;
      let cleanBytes = bytes;
      if (document.mimeType === 'image/jpeg') {
        cleanBytes = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      } else if (document.mimeType === 'image/png') {
        cleanBytes = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().png({ compressionLevel: 9 }).toBuffer();
      }
      if (document.mimeType === 'image/jpeg' || document.mimeType === 'image/png') {
        const sanitizedInspection = inspectFileBuffer(cleanBytes, document.mimeType, 8 * 1024 * 1024);
        if (!sanitizedInspection.clean) throw new Error('IMAGE_SANITIZATION_FAILED');
        await storageClient.send(new PutObjectCommand({
          Bucket: privateBucket,
          Key: cleanStorageKey,
          Body: cleanBytes,
          ContentType: document.mimeType,
          ContentDisposition: 'attachment',
        }));
      } else {
        const copySource = `${encodeURIComponent(quarantineBucket)}/${cleanStorageKey.split('/').map(encodeURIComponent).join('/')}`;
        await storageClient.send(new CopyObjectCommand({ Bucket: privateBucket, Key: cleanStorageKey, CopySource: copySource }));
      }
      await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: document.quarantineStorageKey }));
      await prisma.identityDocument.update({
        where: { id: documentId },
        data: {
          scanStatus: 'CLEAN',
          scanCompletedAt: new Date(),
          sha256: createHash('sha256').update(cleanBytes).digest('hex'),
          cleanStorageKey,
          documentStorageKey: cleanStorageKey,
          quarantineStorageKey: null,
        },
      });
      return { clean: true };
    } catch (error) {
      await prisma.identityDocument.update({
        where: { id: documentId },
        data: { scanStatus: 'FAILED', scanCompletedAt: new Date(), verificationNotes: 'FILE_SCAN_FAILED' },
      });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.IDENTITY_SCAN_CONCURRENCY || 2) },
);

const storeFileScanWorker = new Worker(
  'store-file-scan',
  async (job) => {
    const fileId = job.data?.payload?.fileId;
    if (!fileId) throw new Error('Store file ID is missing');
    const file = await prisma.studentStoreFile.findUnique({ where: { id: fileId }, include: { submission: { select: { schoolId: true } } } });
    if (!file?.quarantineKey) return { skipped: true };
    const quarantineBucket = `${storagePrefix}-quarantine`;
    const privateBucket = `${storagePrefix}-submissions`;
    try {
      const object = await storageClient.send(new GetObjectCommand({ Bucket: quarantineBucket, Key: file.quarantineKey }));
      if (!object.Body) throw new Error('EMPTY_FILE');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      const inspection = inspectFileBuffer(bytes, file.mimeType, 20 * 1024 * 1024);
      if (!inspection.clean) {
        await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: file.quarantineKey }));
        await prisma.studentStoreFile.update({ where: { id: fileId }, data: { scanStatus: 'INFECTED', quarantineKey: null } });
        return { clean: false, reason: inspection.reason };
      }
      try {
        await scanWithClamAv(bytes);
      } catch (error) {
        if (error instanceof Error && error.message === 'MALWARE_DETECTED') {
          await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: file.quarantineKey }));
          await prisma.studentStoreFile.update({ where: { id: fileId }, data: { scanStatus: 'INFECTED', quarantineKey: null } });
          return { clean: false, reason: 'MALWARE_DETECTED' };
        }
        throw error;
      }

      let cleanBytes = bytes;
      if (file.mimeType === 'image/jpeg') cleanBytes = await sharp(bytes).rotate().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      if (file.mimeType === 'image/png') cleanBytes = await sharp(bytes).rotate().png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
      if (file.mimeType === 'image/webp') cleanBytes = await sharp(bytes).rotate().webp({ quality: 82 }).toBuffer();
      const sha256 = createHash('sha256').update(cleanBytes).digest('hex');
      const duplicate = await prisma.studentStoreFile.findFirst({
        where: { id: { not: fileId }, storeSubmissionId: { not: file.storeSubmissionId }, sha256, scanStatus: 'CLEAN', submission: { schoolId: file.submission.schoolId } },
        select: { id: true, storeSubmissionId: true },
      });
      if (duplicate) {
        const exists = await prisma.storeFraudFlag.count({
          where: { storeSubmissionId: file.storeSubmissionId, type: 'DUPLICATE_FILE', status: 'OPEN', evidence: { path: ['matchedFileId'], equals: duplicate.id } },
        });
        if (!exists) {
          await prisma.storeFraudFlag.create({
            data: {
              storeSubmissionId: file.storeSubmissionId,
              type: 'DUPLICATE_FILE',
              reason: 'Bukti file identik dengan submission siswa lain dan memerlukan pemeriksaan manusia',
              evidence: { matchedFileId: duplicate.id, matchedSubmissionId: duplicate.storeSubmissionId },
              confidence: 0.9,
            },
          });
        }
      }

      await storageClient.send(new PutObjectCommand({ Bucket: privateBucket, Key: file.storageKey, Body: cleanBytes, ContentType: file.mimeType }));
      await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: file.quarantineKey }));
      await prisma.$transaction(async (tx) => {
        const updated = await tx.studentStoreFile.update({ where: { id: fileId }, data: { scanStatus: 'CLEAN', sha256, quarantineKey: null, sizeBytes: cleanBytes.length }, include: { submission: { select: { studentStoreId: true } } } });
        if (updated.submission.studentStoreId && updated.kind === 'LOGO') await tx.studentStore.update({ where: { id: updated.submission.studentStoreId }, data: { logoStorageKey: updated.storageKey } });
        if (updated.submission.studentStoreId && updated.kind === 'BANNER') await tx.studentStore.update({ where: { id: updated.submission.studentStoreId }, data: { bannerStorageKey: updated.storageKey } });
      });
      return { clean: true, duplicate: Boolean(duplicate) };
    } catch (error) {
      await prisma.studentStoreFile.update({ where: { id: fileId }, data: { scanStatus: 'FAILED' } });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.STORE_SCAN_CONCURRENCY || 2) },
);

const reportExportWorker = new Worker(
  'report-export',
  async (job) => {
    const exportJobId = job.data?.payload?.exportJobId;
    if (!exportJobId) throw new Error('Export job ID is missing');
    const exportJob = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
    if (!exportJob || exportJob.status !== 'QUEUED') return { skipped: true };
    const workerContext = { organizationId: exportJob.organizationId, schoolId: exportJob.schoolId, userId: exportJob.requestedById };
    if (!(await hasWorkerEntitlement(workerContext, 'reports.export')) || !(await hasWorkerPermission(workerContext, 'reports', 'export'))) {
      await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'FAILED', failureReason: 'ENTITLEMENT_NOT_ACTIVE', completedAt: new Date() } });
      return { skipped: true, reason: 'ENTITLEMENT_NOT_ACTIVE' };
    }
    const privilegedReportTypes = new Set(['USER_ENROLLMENTS', 'IDENTITY_VERIFICATION', 'CONSENT_STATUS', 'TEACHER_WORKLOAD', 'IMPORT_HISTORY', 'AUDIT_SUMMARY']);
    if (privilegedReportTypes.has(exportJob.reportType) && !(await hasWorkerBroadReportingRole(workerContext))) {
      await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'FAILED', failureReason: 'ROLE_SCOPE_NOT_ACTIVE', completedAt: new Date() } });
      return { skipped: true, reason: 'ROLE_SCOPE_NOT_ACTIVE' };
    }
    await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'PROCESSING', startedAt: new Date() } });
    try {
      const filters = exportJob.filters as Record<string, any>;
      const studentIds = Array.isArray(filters.studentIds) ? filters.studentIds.filter((id): id is string => typeof id === 'string') : [];
      const periodDays = Number(filters.periodDays || 30);
      const periodStart = new Date(Date.now() - Math.max(7, Math.min(periodDays, 365)) * 86400000);
      let rows: Array<Record<string, unknown>> = [];

      if (exportJob.reportType === 'USER_ENROLLMENTS') {
        const students = await prisma.student.findMany({
          where: { id: { in: studentIds }, school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } },
          include: {
            school: { select: { name: true } },
            classEnrollments: { where: { status: 'ACTIVE' }, select: { effectiveFrom: true, class: { select: { name: true } } } },
            courseEnrollments: { select: { status: true, enrolledAt: true, completedAt: true, course: { select: { code: true, name: true } } } },
          },
          orderBy: { fullName: 'asc' },
        });
        rows = students.flatMap<Record<string, unknown>>((student) => student.courseEnrollments.length ? student.courseEnrollments.map((enrollment) => ({
          'Nomor Siswa': student.studentNumber,
          'Nama Siswa': student.fullName,
          Sekolah: student.school.name,
          Kelas: student.classEnrollments[0]?.class.name || 'Belum ada kelas',
          'Kode Course': enrollment.course.code,
          Course: enrollment.course.name,
          'Status Enrollment': enrollment.status,
          'Tanggal Enrollment': enrollment.enrolledAt,
          'Tanggal Selesai': enrollment.completedAt || '',
        })) : [{
          'Nomor Siswa': student.studentNumber,
          'Nama Siswa': student.fullName,
          Sekolah: student.school.name,
          Kelas: student.classEnrollments[0]?.class.name || 'Belum ada kelas',
          'Kode Course': '', Course: '', 'Status Enrollment': 'BELUM_TERDAFTAR', 'Tanggal Enrollment': '', 'Tanggal Selesai': '',
        }]);
      }

      if (exportJob.reportType === 'LEARNING_ACTIVITY') {
        const progress = await prisma.lessonProgress.findMany({
          where: {
            studentId: { in: studentIds },
            updatedAt: { gte: periodStart },
            student: { school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } },
          },
          include: {
            student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } },
            lesson: { select: { title: true, module: { select: { title: true, course: { select: { code: true, name: true } } } } } },
          },
          orderBy: { updatedAt: 'desc' },
        });
        rows = progress.map((item) => ({
          'Nomor Siswa': item.student.studentNumber,
          'Nama Siswa': item.student.fullName,
          Kelas: item.student.class?.name || 'Belum ada kelas',
          'Kode Course': item.lesson.module.course.code,
          Course: item.lesson.module.course.name,
          Modul: item.lesson.module.title,
          Materi: item.lesson.title,
          Status: item.state,
          'Progress (%)': item.progressPercent,
          'Mulai Pada': item.startedAt || '',
          'Selesai Pada': item.completedAt || '',
          'Diperbarui': item.updatedAt,
        }));
      }

      if (exportJob.reportType === 'STUDENT_PROGRESS') {
        const students = await prisma.student.findMany({
          where: { id: { in: studentIds }, school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } },
          include: {
            class: { select: { name: true } },
            user: { select: { lastLoginAt: true } },
            lessonProgress: { select: { progressPercent: true, state: true } },
            submissions: { where: { gradePublishedAt: { not: null } }, select: { score: true, status: true } },
          },
          orderBy: { fullName: 'asc' },
        });
        rows = students.map((student) => ({
          'Nomor Siswa': student.studentNumber,
          'Nama Siswa': student.fullName,
          Kelas: student.class?.name || 'Belum ada kelas',
          Status: student.status,
          'Login Terakhir': student.user.lastLoginAt,
          'Progress Rata-rata (%)': student.lessonProgress.length ? Math.round(student.lessonProgress.reduce((sum, item) => sum + item.progressPercent, 0) / student.lessonProgress.length) : 0,
          'Materi Selesai': student.lessonProgress.filter((item) => item.state === 'COMPLETED').length,
          'Submission Disetujui': student.submissions.filter((item) => item.status === 'APPROVED').length,
          'Nilai Rata-rata Terpublikasi': student.submissions.filter((item) => item.score !== null).length
            ? Math.round(student.submissions.reduce((sum, item) => sum + (item.score || 0), 0) / student.submissions.filter((item) => item.score !== null).length)
            : '',
        }));
      }

      if (exportJob.reportType === 'ASSIGNMENT_SUBMISSIONS') {
        const submissions = await prisma.submission.findMany({
          where: { studentId: { in: studentIds }, student: { school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } }, updatedAt: { gte: periodStart } },
          include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } }, assignment: { select: { title: true, type: true, endDate: true } } },
          orderBy: { updatedAt: 'desc' },
        });
        rows = submissions.map((submission) => ({
          'Nomor Siswa': submission.student.studentNumber,
          'Nama Siswa': submission.student.fullName,
          Kelas: submission.student.class?.name || 'Belum ada kelas',
          Tugas: submission.assignment.title,
          'Jenis Tugas': submission.assignment.type,
          Tenggat: submission.assignment.endDate,
          Status: submission.status,
          'Waktu Pengumpulan': submission.submittedAt,
          'Nilai Terpublikasi': submission.gradePublishedAt ? submission.score : '',
          'Diperbarui': submission.updatedAt,
        }));
      }

      if (exportJob.reportType === 'GRADES_RUBRICS') {
        const submissions = await prisma.submission.findMany({
          where: {
            studentId: { in: studentIds },
            gradePublishedAt: { not: null, gte: periodStart },
            student: { school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } },
          },
          include: {
            student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } },
            assignment: { select: { title: true, maxScore: true, rubric: { select: { name: true } } } },
            reviews: { where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 1, include: { scores: { include: { criterion: { select: { name: true, maxScore: true } } } } } },
          },
          orderBy: { gradePublishedAt: 'desc' },
        });
        rows = submissions.map((submission) => {
          const review = submission.reviews[0];
          return {
            'Nomor Siswa': submission.student.studentNumber,
            'Nama Siswa': submission.student.fullName,
            Kelas: submission.student.class?.name || 'Belum ada kelas',
            Tugas: submission.assignment.title,
            Rubrik: submission.assignment.rubric?.name || '',
            Nilai: submission.score ?? '',
            'Nilai Maksimum': submission.assignment.maxScore,
            'Nilai (%)': submission.score === null ? '' : Math.round(submission.score / Math.max(submission.assignment.maxScore, 1) * 1000) / 10,
            'Kriteria Dinilai': review?.scores.map((score) => `${score.criterion.name}: ${score.score}/${score.criterion.maxScore}`).join('; ') || '',
            'Dipublikasikan': submission.gradePublishedAt,
          };
        });
      }

      if (exportJob.reportType === 'STUDENT_STORES') {
        const stores = await prisma.studentStoreSubmission.findMany({
          where: { studentId: { in: studentIds }, organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}), updatedAt: { gte: periodStart } },
          include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } }, studentStore: { select: { platform: true, storeName: true, storeUrl: true, productCount: true } }, assignment: { select: { title: true } } },
          orderBy: { updatedAt: 'desc' },
        });
        rows = stores.map((store) => ({
          'Nomor Siswa': store.student.studentNumber,
          'Nama Siswa': store.student.fullName,
          Kelas: store.student.class?.name || 'Belum ada kelas',
          Tugas: store.assignment.title,
          Platform: store.studentStore?.platform || '',
          'Nama Toko': store.studentStore?.storeName || '',
          'URL Toko': store.studentStore?.storeUrl || '',
          'Jumlah Produk': store.studentStore?.productCount || 0,
          Status: store.status,
          'Nilai Terpublikasi': store.status === 'APPROVED' ? store.score : '',
          'Diperbarui': store.updatedAt,
        }));
      }

      if (exportJob.reportType === 'STORE_REVIEW_REVISIONS') {
        const reviews = await prisma.storeReview.findMany({
          where: {
            createdAt: { gte: periodStart },
            submission: { studentId: { in: studentIds }, organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}) },
          },
          include: {
            submission: { include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } }, assignment: { select: { title: true } } } },
            reviewer: { select: { fullName: true } },
            rubric: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        rows = reviews.map((review) => ({
          'Nomor Siswa': review.submission.student.studentNumber,
          'Nama Siswa': review.submission.student.fullName,
          Kelas: review.submission.student.class?.name || 'Belum ada kelas',
          Tugas: review.submission.assignment.title,
          Reviewer: review.reviewer.fullName,
          Keputusan: review.decision,
          Rubrik: review.rubric?.name || '',
          'Nilai Terpublikasi': review.isPublished ? review.totalScore ?? '' : '',
          'Feedback Terpublikasi': review.isPublished ? review.feedback || '' : '',
          'Waktu Review': review.createdAt,
        }));
      }

      if (exportJob.reportType === 'AFFILIATE_CONTENT') {
        const videos = await prisma.affiliateVideo.findMany({
          where: {
            studentId: { in: studentIds },
            publishedAt: { gte: periodStart },
            student: { school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } },
          },
          include: {
            student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } },
            submission: { select: { status: true, assignment: { select: { title: true } } } },
          },
          orderBy: { publishedAt: 'desc' },
        });
        rows = videos.map((video) => ({
          'Nomor Siswa': video.student.studentNumber,
          'Nama Siswa': video.student.fullName,
          Kelas: video.student.class?.name || 'Belum ada kelas',
          Tugas: video.submission.assignment.title,
          Platform: video.platform,
          'URL Konten': video.videoUrl,
          Produk: video.productName || '',
          Campaign: video.campaignName || '',
          'Tanggal Publikasi': video.publishedAt,
          'Status Submission': video.submission.status,
          Verifikasi: video.verification,
          Versi: video.currentVersion,
        }));
      }

      if (exportJob.reportType === 'AFFILIATE_PERFORMANCE') {
        const snapshots = await prisma.affiliateMetricSnapshot.findMany({
          where: { studentId: { in: studentIds }, organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}), snapshotDate: { gte: periodStart } },
          include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } }, affiliateVideo: { select: { productName: true, caption: true, platform: true, videoUrl: true } } },
          orderBy: { snapshotDate: 'desc' },
        });
        rows = snapshots.map((snapshot) => ({
          'Nomor Siswa': snapshot.student.studentNumber,
          'Nama Siswa': snapshot.student.fullName,
          Kelas: snapshot.student.class?.name || 'Belum ada kelas',
          Konten: snapshot.affiliateVideo.productName || snapshot.affiliateVideo.caption || 'Konten affiliate',
          Platform: snapshot.affiliateVideo.platform,
          'URL Konten': snapshot.affiliateVideo.videoUrl,
          'Tanggal Snapshot': snapshot.snapshotDate,
          Views: snapshot.views,
          Clicks: snapshot.clicks,
          Orders: snapshot.orders,
          GMV: Number(snapshot.gmv),
          Komisi: Number(snapshot.commission),
          Verifikasi: snapshot.verification,
          Sumber: snapshot.source,
        }));
      }

      if (exportJob.reportType === 'EARLY_WARNINGS') {
        const warnings = await prisma.earlyWarning.findMany({
          where: { studentId: { in: studentIds }, organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}), triggeredAt: { gte: periodStart } },
          include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } }, rule: { select: { name: true } } },
          orderBy: { triggeredAt: 'desc' },
        });
        rows = warnings.map((warning) => ({
          'Nomor Siswa': warning.student.studentNumber,
          'Nama Siswa': warning.student.fullName,
          Kelas: warning.student.class?.name || 'Belum ada kelas',
          Rule: warning.rule.name,
          Severity: warning.severity,
          Status: warning.status,
          Pesan: warning.message,
          'Dipicu Pada': warning.triggeredAt,
          'Catatan Tindakan': warning.actionNote || '',
          Resolusi: warning.resolution || '',
        }));
      }

      if (exportJob.reportType === 'IDENTITY_VERIFICATION') {
        const documents = await prisma.identityDocument.findMany({
          where: {
            studentId: { in: studentIds },
            updatedAt: { gte: periodStart },
            student: { school: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { id: exportJob.schoolId } : {}) } },
          },
          include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } } },
          orderBy: { updatedAt: 'desc' },
        });
        rows = documents.map((document) => ({
          'Nomor Siswa': document.student.studentNumber,
          'Nama Siswa': document.student.fullName,
          Kelas: document.student.class?.name || 'Belum ada kelas',
          'Jenis Dokumen': document.documentType,
          'Status Dokumen': document.documentStatus,
          'Status Verifikasi': document.verificationStatus,
          'Status Pemindaian': document.scanStatus,
          'Diverifikasi Pada': document.verifiedAt || '',
          'Diperbarui': document.updatedAt,
        }));
      }

      if (exportJob.reportType === 'CONSENT_STATUS') {
        const consents = await prisma.consent.findMany({
          where: {
            organizationId: exportJob.organizationId,
            ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}),
            updatedAt: { gte: periodStart },
          },
          include: { student: { select: { studentNumber: true, fullName: true, class: { select: { name: true } } } }, document: { select: { version: true, title: true } } },
          orderBy: { updatedAt: 'desc' },
        });
        rows = consents.map((consent) => ({
          'Nomor Siswa': consent.student?.studentNumber || '',
          'Nama Siswa': consent.student?.fullName || '',
          Kelas: consent.student?.class?.name || '',
          Consent: consent.type,
          Dokumen: consent.document.title,
          Versi: consent.document.version,
          Status: consent.status,
          Metode: consent.method,
          'Berlaku Mulai': consent.effectiveAt,
          'Kedaluwarsa': consent.expiresAt || '',
          'Ditarik Pada': consent.withdrawnAt || '',
        }));
      }

      if (exportJob.reportType === 'TEACHER_WORKLOAD') {
        const teachers = await prisma.teacher.findMany({
          where: { school: { organizationId: exportJob.organizationId }, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}), isActive: true },
          include: {
            school: { select: { name: true } },
            teacherAssignments: { where: { isActive: true }, select: { classId: true, courseId: true } },
            assignments: {
              where: { course: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}) } },
              select: {
                id: true,
                submissions: { where: { status: { in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } }, select: { id: true } },
                storeSubmissions: { where: { status: { in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } }, select: { id: true } },
              },
            },
          },
          orderBy: { fullName: 'asc' },
        });
        rows = teachers.map((teacher) => ({
          Guru: teacher.fullName,
          Sekolah: teacher.school.name,
          'Kelas Aktif': new Set(teacher.teacherAssignments.map((assignment) => assignment.classId)).size,
          'Course Aktif': new Set(teacher.teacherAssignments.map((assignment) => assignment.courseId).filter(Boolean)).size,
          'Tugas Dikelola': teacher.assignments.length,
          'Antrean Review Tugas': teacher.assignments.reduce((total, assignment) => total + assignment.submissions.length, 0),
          'Antrean Review Store': teacher.assignments.reduce((total, assignment) => total + assignment.storeSubmissions.length, 0),
        }));
      }

      if (exportJob.reportType === 'IMPORT_HISTORY') {
        const imports = await prisma.importJob.findMany({
          where: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}), createdAt: { gte: periodStart } },
          include: { school: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        });
        rows = imports.map((item) => ({
          Sekolah: item.school.name,
          Jenis: item.type,
          Sumber: item.sourceName,
          Status: item.status,
          'Total Baris': item.totalRows,
          Valid: item.validRows,
          Gagal: item.failedRows,
          Diproses: item.processedRows,
          Pembuat: `${item.createdBy.firstName} ${item.createdBy.lastName}`.trim(),
          'Dibuat Pada': item.createdAt,
          'Selesai Pada': item.completedAt || '',
          'Alasan Gagal': item.failureReason || '',
        }));
      }

      if (exportJob.reportType === 'AUDIT_SUMMARY') {
        const logs = await prisma.auditLog.findMany({
          where: { organizationId: exportJob.organizationId, ...(exportJob.schoolId ? { schoolId: exportJob.schoolId } : {}), createdAt: { gte: periodStart } },
          include: { actor: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50_000,
        });
        rows = logs.map((log) => ({
          Waktu: log.createdAt,
          Aktor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}`.trim() : 'SYSTEM',
          Aksi: log.action,
          Resource: log.resource,
          'Resource ID': log.resourceId || '',
          'Correlation ID': log.correlationId || '',
        }));
      }

      const csv = toSafeCsv(rows);
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `${exportJob.reportType.toLowerCase().replace(/_/g, '-')}-${date}.csv`;
      const storageKey = `${exportJob.organizationId}/${exportJob.id}/${randomBytes(16).toString('hex')}.csv`;
      await storageClient.send(new PutObjectCommand({ Bucket: `${storagePrefix}-exports`, Key: storageKey, Body: Buffer.from(csv, 'utf8'), ContentType: 'text/csv; charset=utf-8' }));
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.exportJob.update({
        where: { id: exportJobId },
        data: { status: 'COMPLETED', storageKey, fileName, rowCount: rows.length, completedAt: new Date(), expiresAt },
      });
      return { rows: rows.length, fileName, expiresAt };
    } catch (error) {
      await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'FAILED', failureReason: 'REPORT_EXPORT_FAILED', completedAt: new Date() } });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.REPORT_EXPORT_CONCURRENCY || 2) },
);

const helpdeskAttachmentScanWorker = new Worker(
  'helpdesk-attachment-scan',
  async (job) => {
    const messageId = job.data?.payload?.messageId;
    if (!messageId) throw new Error('Helpdesk message ID is missing');
    const message = await prisma.helpdeskMessage.findUnique({ where: { id: messageId }, include: { ticket: { select: { organizationId: true, schoolId: true } } } });
    if (!message?.quarantineStorageKey || message.scanStatus !== 'PENDING' || !message.mimeType) return { skipped: true };
    const quarantineBucket = `${storagePrefix}-quarantine`;
    const privateBucket = `${storagePrefix}-submissions`;
    try {
      const object = await storageClient.send(new GetObjectCommand({ Bucket: quarantineBucket, Key: message.quarantineStorageKey }));
      if (!object.Body) throw new Error('EMPTY_FILE');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      const inspection = inspectFileBuffer(bytes, message.mimeType, 8 * 1024 * 1024);
      if (!inspection.clean) {
        await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: message.quarantineStorageKey }));
        await prisma.helpdeskMessage.update({ where: { id: message.id }, data: { scanStatus: 'INFECTED', scanCompletedAt: new Date(), quarantineStorageKey: null } });
        return { clean: false, reason: inspection.reason };
      }
      await scanWithClamAv(bytes);
      let cleanBytes = bytes;
      if (message.mimeType === 'image/jpeg') cleanBytes = await sharp(bytes).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      if (message.mimeType === 'image/png') cleanBytes = await sharp(bytes).rotate().png({ compressionLevel: 9 }).toBuffer();
      const storageKey = message.quarantineStorageKey;
      await storageClient.send(new PutObjectCommand({ Bucket: privateBucket, Key: storageKey, Body: cleanBytes, ContentType: message.mimeType, ContentDisposition: 'attachment' }));
      await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: message.quarantineStorageKey }));
      await prisma.helpdeskMessage.update({ where: { id: message.id }, data: { storageKey, quarantineStorageKey: null, scanStatus: 'CLEAN', scanCompletedAt: new Date(), sha256: createHash('sha256').update(cleanBytes).digest('hex') } });
      return { clean: true };
    } catch (error) {
      const infected = error instanceof Error && error.message === 'MALWARE_DETECTED';
      if (infected) await storageClient.send(new DeleteObjectCommand({ Bucket: quarantineBucket, Key: message.quarantineStorageKey })).catch(() => undefined);
      await prisma.helpdeskMessage.update({ where: { id: message.id }, data: { scanStatus: infected ? 'INFECTED' : 'FAILED', scanCompletedAt: new Date(), ...(infected ? { quarantineStorageKey: null } : {}) } });
      if (infected) return { clean: false, reason: 'MALWARE_DETECTED' };
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.HELPDESK_SCAN_CONCURRENCY || 2) },
);

const notificationDeliveryWorker = new Worker(
  'notification-delivery',
  async (job) => {
    const deliveryId = job.data?.payload?.deliveryId;
    if (!deliveryId) throw new Error('Notification delivery ID is missing');
    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: { notification: { include: { user: { select: { email: true, status: true, notificationPreference: true } } } } },
    });
    if (!delivery || ['SENT', 'SKIPPED'].includes(delivery.status)) return { skipped: true };
    const preference = delivery.notification.user.notificationPreference;
    const enabledByUser = delivery.channel === 'IN_APP' || Boolean(preference && {
      EMAIL: preference.emailEnabled,
      WHATSAPP: preference.whatsappEnabled,
      SMS: preference.smsEnabled,
    }[delivery.channel] && externalNotificationAllowed(delivery.notification.eventType, preference));
    if (delivery.notification.user.status !== 'ACTIVE' || !enabledByUser) {
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SKIPPED', provider: 'PREFERENCE', failureReason: delivery.notification.user.status !== 'ACTIVE' ? 'USER_INACTIVE' : 'PREFERENCE_DISABLED' } });
      return { skipped: true, reason: delivery.notification.user.status !== 'ACTIVE' ? 'USER_INACTIVE' : 'PREFERENCE_DISABLED' };
    }

    const providerEnabled = {
      EMAIL: process.env.EMAIL_PROVIDER_ENABLED === 'true',
      WHATSAPP: process.env.WHATSAPP_PROVIDER_ENABLED === 'true',
      SMS: process.env.SMS_PROVIDER_ENABLED === 'true',
      IN_APP: true,
    }[delivery.channel];
    if (!providerEnabled) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SKIPPED', provider: 'NOT_CONFIGURED', failureReason: 'PROVIDER_NOT_CONFIGURED' },
      });
      return { skipped: true, reason: 'PROVIDER_NOT_CONFIGURED' };
    }
    if (delivery.channel === 'IN_APP') {
      await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', provider: 'INTERNAL', sentAt: new Date() } });
      return { sent: true };
    }

    if (delivery.channel === 'EMAIL') {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'RETRYING', provider: 'SMTP', attemptCount: { increment: 1 }, lastAttemptAt: new Date(), failureReason: null },
      });
      const actionUrl = delivery.notification.actionUrl ? absoluteActionUrl(delivery.notification.actionUrl) : null;
      const title = escapeEmailHtml(delivery.notification.title);
      const body = escapeEmailHtml(delivery.notification.body).replace(/\n/g, '<br>');
      const result = await sendTransactionalEmail({
        to: delivery.notification.user.email,
        subject: `Sunrise Academy · ${delivery.notification.title}`,
        text: `${delivery.notification.title}\n\n${delivery.notification.body}${actionUrl ? `\n\nBuka: ${actionUrl}` : ''}`,
        html: `<!doctype html><html lang="id"><body style="margin:0;background:#fffaf2;color:#0f172a;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="border-top:5px solid #f97316;background:#fff;padding:30px;border-radius:14px"><p style="margin:0 0 8px;color:#ea580c;font-size:12px;font-weight:700;letter-spacing:.12em">SUNRISE ACADEMY</p><h1 style="margin:0 0 16px;font-size:24px">${title}</h1><p style="margin:0;line-height:1.7;color:#475569">${body}</p>${actionUrl ? `<a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;margin-top:24px;background:#0f172a;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">Buka di Sunrise Academy</a>` : ''}</div></div></body></html>`,
      });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', provider: result.provider, providerMessageId: result.messageId.slice(0, 240), sentAt: new Date(), failureReason: null },
      });
      return { sent: true, provider: result.provider };
    }

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'RETRYING',
        provider: delivery.channel,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        failureReason: 'PROVIDER_ADAPTER_NOT_IMPLEMENTED',
      },
    });
    throw new Error('PROVIDER_ADAPTER_NOT_IMPLEMENTED');
  },
  { connection: redisConnection(), concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 4) },
);

notificationDeliveryWorker.on('failed', async (job, error) => {
  const deliveryId = job?.data?.payload?.deliveryId;
  if (!deliveryId) return;
  const maxAttempts = Number(job.opts.attempts || 1);
  if (job.attemptsMade >= maxAttempts) {
    await prisma.notificationDelivery.updateMany({
      where: { id: deliveryId, status: { notIn: ['SENT', 'SKIPPED'] } },
      data: { status: 'DEAD_LETTER', failureReason: error.message.slice(0, 180), lastAttemptAt: new Date() },
    });
  }
});

const certificateGenerationWorker = new Worker(
  'certificate-generation',
  async (job) => {
    const certificateId = job.data?.payload?.certificateId;
    if (!certificateId) throw new Error('Certificate ID is missing');
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        student: { include: { user: { select: { id: true } } } },
        school: { select: { name: true } },
      },
    });
    if (!certificate || certificate.status !== 'QUEUED') return { skipped: true };
    const workerContext = { organizationId: certificate.organizationId, schoolId: certificate.schoolId, userId: job.data?.requestedBy || certificate.issuedById };
    if (!(await hasWorkerEntitlement(workerContext, 'support.advanced.use')) || !(await hasWorkerPermission(workerContext, 'certificates', 'manage'))) {
      await prisma.certificate.update({ where: { id: certificate.id }, data: { status: 'FAILED', failureReason: 'ACCESS_REVOKED_BEFORE_PROCESSING' } });
      return { skipped: true, reason: 'ACCESS_REVOKED_BEFORE_PROCESSING' };
    }
    try {
      const issuedAt = new Date();
      const pdf = buildCertificatePdf({
        title: certificate.title,
        studentName: certificate.student.fullName,
        schoolName: certificate.school.name,
        verificationCode: certificate.verificationCode,
        issuedAt,
      });
      const storageKey = `${certificate.organizationId}/certificates/${certificate.id}/${certificate.verificationCode}.pdf`;
      await storageClient.send(new PutObjectCommand({
        Bucket: `${storagePrefix}-exports`,
        Key: storageKey,
        Body: pdf,
        ContentType: 'application/pdf',
        ContentDisposition: `attachment; filename="${certificate.verificationCode}.pdf"`,
      }));
      await prisma.$transaction([
        prisma.certificate.update({
          where: { id: certificate.id },
          data: { status: 'ISSUED', pdfStorageKey: storageKey, issuedAt, failureReason: null },
        }),
        prisma.notification.upsert({
          where: { idempotencyKey: `certificate-issued:${certificate.id}` },
          update: {},
          create: {
            organizationId: certificate.organizationId,
            schoolId: certificate.schoolId,
            userId: certificate.student.user.id,
            eventType: 'CERTIFICATE_ISSUED',
            title: 'Sertifikat baru telah terbit',
            body: `Sertifikat ${certificate.title} sudah tersedia untuk diunduh.`,
            actionUrl: '/dashboard/dukungan',
            idempotencyKey: `certificate-issued:${certificate.id}`,
            deliveries: { create: { channel: 'IN_APP', status: 'SENT', provider: 'INTERNAL', sentAt: issuedAt } },
          },
        }),
      ]);
      return { issued: true, storageKey };
    } catch (error) {
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: 'FAILED', failureReason: error instanceof Error ? error.message.slice(0, 180) : 'CERTIFICATE_GENERATION_FAILED' },
      });
      throw error;
    }
  },
  { connection: redisConnection(), concurrency: Number(process.env.CERTIFICATE_WORKER_CONCURRENCY || 2) },
);

for (const worker of [systemWorker, studentImportWorker, affiliateMetricImportWorker, identityScanWorker, storeFileScanWorker, reportExportWorker, helpdeskAttachmentScanWorker, notificationDeliveryWorker, certificateGenerationWorker]) {
  worker.on('completed', (job) => console.log(`Worker completed ${job.name} (${job.id})`));
  worker.on('failed', (job, error) => console.error(`Worker failed ${job?.name || 'unknown'} (${job?.id || '-'})`, error.message));
  worker.on('error', (error) => console.error('Worker connection error', error.message));
}

async function shutdown() {
  await Promise.all([systemWorker.close(), studentImportWorker.close(), affiliateMetricImportWorker.close(), identityScanWorker.close(), storeFileScanWorker.close(), reportExportWorker.close(), helpdeskAttachmentScanWorker.close(), notificationDeliveryWorker.close(), certificateGenerationWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('Sunrise Academy background worker is ready');
