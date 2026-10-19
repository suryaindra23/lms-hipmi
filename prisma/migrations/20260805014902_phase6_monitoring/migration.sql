-- CreateEnum
CREATE TYPE "EarlyWarningSeverity" AS ENUM ('INFO', 'ATTENTION', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EarlyWarningStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('STUDENT_PROGRESS', 'ASSIGNMENT_SUBMISSIONS', 'STUDENT_STORES', 'AFFILIATE_PERFORMANCE', 'EARLY_WARNINGS');

-- CreateEnum
CREATE TYPE "PublicStatisticStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "early_warning_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "thresholds" JSONB NOT NULL,
    "severity" "EarlyWarningSeverity" NOT NULL DEFAULT 'ATTENTION',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_warning_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_warnings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "studentId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "severity" "EarlyWarningSeverity" NOT NULL,
    "status" "EarlyWarningStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "actionNote" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_warning_actions" (
    "id" TEXT NOT NULL,
    "earlyWarningId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "EarlyWarningStatus" NOT NULL,
    "toStatus" "EarlyWarningStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "early_warning_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "requestedById" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "filters" JSONB NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "storageKey" TEXT,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_statistics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "cohortSize" INTEGER NOT NULL,
    "minimumCohort" INTEGER NOT NULL DEFAULT 10,
    "metrics" JSONB NOT NULL,
    "status" "PublicStatisticStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "early_warning_rules_organizationId_schoolId_isEnabled_idx" ON "early_warning_rules"("organizationId", "schoolId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "early_warning_rules_organizationId_schoolId_code_key" ON "early_warning_rules"("organizationId", "schoolId", "code");

-- CreateIndex
CREATE INDEX "early_warnings_organizationId_schoolId_status_severity_idx" ON "early_warnings"("organizationId", "schoolId", "status", "severity");

-- CreateIndex
CREATE INDEX "early_warnings_studentId_status_idx" ON "early_warnings"("studentId", "status");

-- CreateIndex
CREATE INDEX "early_warnings_classId_status_idx" ON "early_warnings"("classId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "early_warnings_ruleId_studentId_resourceType_resourceId_key" ON "early_warnings"("ruleId", "studentId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "early_warning_actions_earlyWarningId_createdAt_idx" ON "early_warning_actions"("earlyWarningId", "createdAt");

-- CreateIndex
CREATE INDEX "early_warning_actions_actorId_createdAt_idx" ON "early_warning_actions"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_organizationId_schoolId_status_createdAt_idx" ON "export_jobs"("organizationId", "schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_requestedById_createdAt_idx" ON "export_jobs"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "public_statistics_organizationId_schoolId_status_periodEnd_idx" ON "public_statistics"("organizationId", "schoolId", "status", "periodEnd");

-- CreateIndex
CREATE INDEX "public_statistics_status_publishedAt_idx" ON "public_statistics"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "early_warning_rules" ADD CONSTRAINT "early_warning_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_rules" ADD CONSTRAINT "early_warning_rules_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_rules" ADD CONSTRAINT "early_warning_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "early_warning_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warnings" ADD CONSTRAINT "early_warnings_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_actions" ADD CONSTRAINT "early_warning_actions_earlyWarningId_fkey" FOREIGN KEY ("earlyWarningId") REFERENCES "early_warnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "early_warning_actions" ADD CONSTRAINT "early_warning_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_statistics" ADD CONSTRAINT "public_statistics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_statistics" ADD CONSTRAINT "public_statistics_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_statistics" ADD CONSTRAINT "public_statistics_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_statistics" ADD CONSTRAINT "public_statistics_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
