CREATE TYPE "AffiliateAccountStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'INACTIVE');

CREATE TABLE "affiliate_accounts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "displayName" TEXT,
  "profileUrl" TEXT NOT NULL,
  "externalAccountId" TEXT,
  "status" "AffiliateAccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewerNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "affiliate_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "affiliate_videos"
  ADD COLUMN "affiliateAccountId" TEXT,
  ADD COLUMN "normalizedUrl" TEXT,
  ADD COLUMN "hook" TEXT,
  ADD COLUMN "productExternalId" TEXT,
  ADD COLUMN "campaignName" TEXT,
  ADD COLUMN "evidenceUrl" TEXT,
  ADD COLUMN "insightsEvidenceUrl" TEXT,
  ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "studentNote" TEXT,
  ADD COLUMN "disclosureAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownershipDeclared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "affiliate_videos" SET "normalizedUrl" = LOWER(REGEXP_REPLACE("videoUrl", '[?#].*$', '')) WHERE "normalizedUrl" IS NULL;

CREATE TABLE "affiliate_content_versions" (
  "id" TEXT NOT NULL,
  "affiliateVideoId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "studentNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_content_versions_pkey" PRIMARY KEY ("id")
);

INSERT INTO "affiliate_content_versions" ("id", "affiliateVideoId", "versionNumber", "snapshotData", "studentNote", "createdAt")
SELECT CONCAT('migrated_', "id"), "id", 1,
  JSONB_BUILD_OBJECT(
    'platform', "platform", 'videoUrl', "videoUrl", 'externalId', "externalId",
    'publishedAt', "publishedAt", 'caption', "caption", 'productName', "productName",
    'productUrl', "productUrl", 'screenshot', "screenshot"
  ), NULL, "createdAt"
FROM "affiliate_videos";

ALTER TABLE "affiliate_metric_snapshots"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "schoolId" TEXT,
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "affiliateAccountId" TEXT,
  ADD COLUMN "importJobId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "platform" TEXT,
  ADD COLUMN "likes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "comments" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "shares" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refunds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "averageOrderValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionRate" DECIMAL(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN "periodStart" TIMESTAMP(3),
  ADD COLUMN "periodEnd" TIMESTAMP(3),
  ADD COLUMN "sourceReference" TEXT,
  ADD COLUMN "evidenceUrl" TEXT,
  ADD COLUMN "rawValues" JSONB,
  ADD COLUMN "dataQualityFlags" JSONB,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationNotes" TEXT,
  ADD COLUMN "supersedesId" TEXT;

UPDATE "affiliate_metric_snapshots" AS metric
SET "studentId" = video."studentId",
    "platform" = video."platform",
    "schoolId" = student."schoolId",
    "organizationId" = school."organizationId",
    "affiliateAccountId" = video."affiliateAccountId",
    "verifiedAt" = CASE WHEN metric."verification" = 'VERIFIED' THEN metric."createdAt" ELSE NULL END
FROM "affiliate_videos" AS video
JOIN "students" AS student ON student."id" = video."studentId"
JOIN "schools" AS school ON school."id" = student."schoolId"
WHERE metric."affiliateVideoId" = video."id";

ALTER TABLE "affiliate_metric_snapshots"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "schoolId" SET NOT NULL,
  ALTER COLUMN "studentId" SET NOT NULL,
  ALTER COLUMN "platform" SET NOT NULL,
  ALTER COLUMN "ctr" TYPE DECIMAL(7,2),
  ALTER COLUMN "conversionRate" TYPE DECIMAL(7,2);

UPDATE "affiliate_metric_snapshots"
SET "averageOrderValue" = CASE WHEN "orders" > 0 THEN ROUND("gmv" / "orders", 2) ELSE 0 END,
    "commissionRate" = CASE WHEN "gmv" > 0 THEN ROUND("commission" / "gmv" * 100, 2) ELSE 0 END;

CREATE TABLE "affiliate_fraud_flags" (
  "id" TEXT NOT NULL,
  "affiliateVideoId" TEXT NOT NULL,
  "metricSnapshotId" TEXT,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB,
  "confidence" DECIMAL(5,2),
  "status" "FraudResolutionStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedById" TEXT,
  "resolutionNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_fraud_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "affiliate_metric_verifications" (
  "id" TEXT NOT NULL,
  "metricSnapshotId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "decision" "VerificationStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_metric_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "affiliate_accounts_studentId_platform_username_key" ON "affiliate_accounts"("studentId", "platform", "username");
CREATE INDEX "affiliate_accounts_schoolId_status_idx" ON "affiliate_accounts"("schoolId", "status");
CREATE INDEX "affiliate_accounts_studentId_platform_idx" ON "affiliate_accounts"("studentId", "platform");
CREATE UNIQUE INDEX "affiliate_videos_normalizedUrl_key" ON "affiliate_videos"("normalizedUrl");
CREATE INDEX "affiliate_videos_affiliateAccountId_idx" ON "affiliate_videos"("affiliateAccountId");
CREATE UNIQUE INDEX "affiliate_content_versions_affiliateVideoId_versionNumber_key" ON "affiliate_content_versions"("affiliateVideoId", "versionNumber");
CREATE INDEX "affiliate_content_versions_affiliateVideoId_createdAt_idx" ON "affiliate_content_versions"("affiliateVideoId", "createdAt");
CREATE INDEX "affiliate_metric_snapshots_schoolId_verification_snapshotDate_idx" ON "affiliate_metric_snapshots"("schoolId", "verification", "snapshotDate");
CREATE INDEX "affiliate_metric_snapshots_studentId_snapshotDate_idx" ON "affiliate_metric_snapshots"("studentId", "snapshotDate");
CREATE INDEX "affiliate_metric_snapshots_importJobId_idx" ON "affiliate_metric_snapshots"("importJobId");
CREATE INDEX "affiliate_fraud_flags_affiliateVideoId_status_idx" ON "affiliate_fraud_flags"("affiliateVideoId", "status");
CREATE INDEX "affiliate_fraud_flags_metricSnapshotId_status_idx" ON "affiliate_fraud_flags"("metricSnapshotId", "status");
CREATE INDEX "affiliate_fraud_flags_type_status_idx" ON "affiliate_fraud_flags"("type", "status");
CREATE INDEX "affiliate_metric_verifications_metricSnapshotId_createdAt_idx" ON "affiliate_metric_verifications"("metricSnapshotId", "createdAt");
CREATE INDEX "affiliate_metric_verifications_reviewerId_createdAt_idx" ON "affiliate_metric_verifications"("reviewerId", "createdAt");

ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_videos" ADD CONSTRAINT "affiliate_videos_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "affiliate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_content_versions" ADD CONSTRAINT "affiliate_content_versions_affiliateVideoId_fkey" FOREIGN KEY ("affiliateVideoId") REFERENCES "affiliate_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "affiliate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_snapshots" ADD CONSTRAINT "affiliate_metric_snapshots_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "affiliate_metric_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_fraud_flags" ADD CONSTRAINT "affiliate_fraud_flags_affiliateVideoId_fkey" FOREIGN KEY ("affiliateVideoId") REFERENCES "affiliate_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_fraud_flags" ADD CONSTRAINT "affiliate_fraud_flags_metricSnapshotId_fkey" FOREIGN KEY ("metricSnapshotId") REFERENCES "affiliate_metric_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_fraud_flags" ADD CONSTRAINT "affiliate_fraud_flags_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_verifications" ADD CONSTRAINT "affiliate_metric_verifications_metricSnapshotId_fkey" FOREIGN KEY ("metricSnapshotId") REFERENCES "affiliate_metric_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_metric_verifications" ADD CONSTRAINT "affiliate_metric_verifications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "organizationId", "resource", "action", "description", "isSystem", "createdAt", "updatedAt")
SELECT CONCAT('perm_aff_verify_', SUBSTRING(MD5(org."id") FOR 16)), org."id", 'affiliate', 'verify', 'Verifikasi akun, metrik, dan flag affiliate', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" org
ON CONFLICT ("organizationId", "resource", "action") DO NOTHING;

INSERT INTO "permissions" ("id", "organizationId", "resource", "action", "description", "isSystem", "createdAt", "updatedAt")
SELECT CONCAT('perm_aff_import_', SUBSTRING(MD5(org."id") FOR 16)), org."id", 'affiliate', 'import', 'Impor metrik affiliate secara asinkron', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" org
ON CONFLICT ("organizationId", "resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT CONCAT('rp_aff_', SUBSTRING(MD5(role."id" || permission."id") FOR 18)), role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" role
JOIN "permissions" permission ON permission."organizationId" = role."organizationId" AND permission."resource" = 'affiliate'
WHERE role."slug" IN ('super-admin', 'school-admin', 'teacher', 'reviewer') AND permission."action" IN ('verify', 'import')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
