-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('NISN', 'NIK');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PLATFORM', 'GUARDIAN', 'PUBLICATION', 'ANALYTICS');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION', 'RESTRICTION', 'EXPORT', 'CONSENT_WITHDRAWAL');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "identity_documents_studentId_key";

-- AlterTable
ALTER TABLE "identity_documents" ADD COLUMN     "cleanStorageKey" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "quarantineStorageKey" TEXT,
ADD COLUMN     "scanCompletedAt" TIMESTAMP(3),
ADD COLUMN     "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "uploadedById" TEXT,
ALTER COLUMN "nikEncrypted" DROP NOT NULL,
ALTER COLUMN "nisn" DROP NOT NULL,
ALTER COLUMN "documentStorageKey" DROP NOT NULL;

-- CreateTable
CREATE TABLE "student_identifiers" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "blindIndex" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_reviews" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "decision" "VerificationStatus" NOT NULL,
    "reasonCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "studentId" TEXT,
    "subjectUserId" TEXT,
    "grantedById" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "method" TEXT NOT NULL,
    "evidence" JSONB,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "studentId" TEXT,
    "requesterId" TEXT NOT NULL,
    "handledById" TEXT,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "details" TEXT,
    "resolution" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_identifiers_studentId_status_idx" ON "student_identifiers"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_identifiers_studentId_type_key" ON "student_identifiers"("studentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "student_identifiers_type_blindIndex_key" ON "student_identifiers"("type", "blindIndex");

-- CreateIndex
CREATE INDEX "identity_reviews_documentId_createdAt_idx" ON "identity_reviews"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "identity_reviews_reviewerId_idx" ON "identity_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "consent_documents_organizationId_type_effectiveAt_idx" ON "consent_documents"("organizationId", "type", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "consent_documents_organizationId_type_version_key" ON "consent_documents"("organizationId", "type", "version");

-- CreateIndex
CREATE INDEX "consents_organizationId_type_status_idx" ON "consents"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "consents_studentId_type_status_idx" ON "consents"("studentId", "type", "status");

-- CreateIndex
CREATE INDEX "consents_subjectUserId_type_status_idx" ON "consents"("subjectUserId", "type", "status");

-- CreateIndex
CREATE INDEX "data_subject_requests_organizationId_status_createdAt_idx" ON "data_subject_requests"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "data_subject_requests_requesterId_status_idx" ON "data_subject_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "identity_documents_scanStatus_documentStatus_idx" ON "identity_documents"("scanStatus", "documentStatus");

-- AddForeignKey
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_identifiers" ADD CONSTRAINT "student_identifiers_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_reviews" ADD CONSTRAINT "identity_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "identity_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_reviews" ADD CONSTRAINT "identity_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_documents" ADD CONSTRAINT "consent_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "consent_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
