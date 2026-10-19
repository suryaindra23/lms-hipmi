-- CreateEnum
CREATE TYPE "CourseEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LessonProgressState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StorePlatform" AS ENUM ('SHOPEE', 'TIKTOK', 'TOKOPEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentStoreStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StoreSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "StoreFileKind" AS ENUM ('LOGO', 'BANNER', 'PRODUCT', 'EVIDENCE', 'SCREEN_RECORDING', 'OTHER');

-- CreateEnum
CREATE TYPE "StoreFraudType" AS ENUM ('DUPLICATE_URL', 'DUPLICATE_EXTERNAL_ID', 'DUPLICATE_FILE', 'PLATFORM_MISMATCH', 'SUSPICIOUS_METADATA', 'OWNERSHIP_MISMATCH', 'OTHER');

-- CreateEnum
CREATE TYPE "FraudResolutionStatus" AS ENUM ('OPEN', 'DISMISSED', 'CONFIRMED', 'RESOLVED');

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "checklistTemplateId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "programId" TEXT;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "lessonId" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "rubric_criteria" ADD COLUMN     "levels" JSONB,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "submission_versions" ADD COLUMN     "snapshotData" JSONB;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "gradePublishedAt" TIMESTAMP(3),
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "position" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "CourseEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "state" "LessonProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "lastPosition" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_reviews" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rubricId" TEXT,
    "status" "SubmissionStatus" NOT NULL,
    "totalScore" INTEGER,
    "feedback" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_scores" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "review_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_checklist_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "StorePlatform",
    "minimumProducts" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_checklist_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "evidenceType" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,

    CONSTRAINT "store_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "platform" "StorePlatform" NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeUsername" TEXT,
    "storeExternalId" TEXT,
    "storeUrl" TEXT NOT NULL,
    "normalizedStoreUrl" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "logoStorageKey" TEXT,
    "bannerStorageKey" TEXT,
    "createdDate" TIMESTAMP(3),
    "activationStatus" "StudentStoreStatus" NOT NULL DEFAULT 'DRAFT',
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_store_submissions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentStoreId" TEXT,
    "status" "StoreSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "score" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_store_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_store_submission_versions" (
    "id" TEXT NOT NULL,
    "storeSubmissionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storeSnapshotData" JSONB NOT NULL,
    "studentNotes" TEXT,
    "obstacles" TEXT,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_store_submission_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_store_files" (
    "id" TEXT NOT NULL,
    "storeSubmissionId" TEXT NOT NULL,
    "kind" "StoreFileKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "quarantineKey" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_store_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_checklist_responses" (
    "id" TEXT NOT NULL,
    "storeSubmissionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "value" TEXT,
    "comment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_checklist_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_reviews" (
    "id" TEXT NOT NULL,
    "storeSubmissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rubricId" TEXT,
    "decision" "StoreSubmissionStatus" NOT NULL,
    "totalScore" INTEGER,
    "feedback" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_review_scores" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "store_review_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_fraud_flags" (
    "id" TEXT NOT NULL,
    "storeSubmissionId" TEXT NOT NULL,
    "type" "StoreFraudType" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "confidence" DECIMAL(5,2),
    "status" "FraudResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_fraud_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programs_organizationId_schoolId_isActive_idx" ON "programs"("organizationId", "schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "programs_schoolId_code_key" ON "programs"("schoolId", "code");

-- CreateIndex
CREATE INDEX "course_modules_courseId_isPublished_idx" ON "course_modules"("courseId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_courseId_position_key" ON "course_modules"("courseId", "position");

-- CreateIndex
CREATE INDEX "lessons_moduleId_isPublished_idx" ON "lessons"("moduleId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_moduleId_position_key" ON "lessons"("moduleId", "position");

-- CreateIndex
CREATE INDEX "course_enrollments_schoolId_status_idx" ON "course_enrollments"("schoolId", "status");

-- CreateIndex
CREATE INDEX "course_enrollments_studentId_status_idx" ON "course_enrollments"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_courseId_studentId_key" ON "course_enrollments"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "lesson_progress_studentId_state_idx" ON "lesson_progress"("studentId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_lessonId_studentId_key" ON "lesson_progress"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "submission_reviews_submissionId_createdAt_idx" ON "submission_reviews"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "submission_reviews_reviewerId_idx" ON "submission_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "review_scores_reviewId_criterionId_key" ON "review_scores"("reviewId", "criterionId");

-- CreateIndex
CREATE INDEX "store_checklist_templates_organizationId_schoolId_isActive_idx" ON "store_checklist_templates"("organizationId", "schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "store_checklist_templates_schoolId_name_key" ON "store_checklist_templates"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "store_checklist_items_templateId_code_key" ON "store_checklist_items"("templateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "store_checklist_items_templateId_position_key" ON "store_checklist_items"("templateId", "position");

-- CreateIndex
CREATE INDEX "student_stores_organizationId_platform_normalizedStoreUrl_idx" ON "student_stores"("organizationId", "platform", "normalizedStoreUrl");

-- CreateIndex
CREATE INDEX "student_stores_schoolId_activationStatus_idx" ON "student_stores"("schoolId", "activationStatus");

-- CreateIndex
CREATE INDEX "student_stores_studentId_idx" ON "student_stores"("studentId");

-- CreateIndex
CREATE INDEX "student_store_submissions_schoolId_status_submittedAt_idx" ON "student_store_submissions"("schoolId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "student_store_submissions_studentId_status_idx" ON "student_store_submissions"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_store_submissions_assignmentId_studentId_key" ON "student_store_submissions"("assignmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_store_submission_versions_storeSubmissionId_version_key" ON "student_store_submission_versions"("storeSubmissionId", "versionNumber");

-- CreateIndex
CREATE INDEX "student_store_files_storeSubmissionId_kind_idx" ON "student_store_files"("storeSubmissionId", "kind");

-- CreateIndex
CREATE INDEX "student_store_files_sha256_idx" ON "student_store_files"("sha256");

-- CreateIndex
CREATE INDEX "student_store_files_scanStatus_idx" ON "student_store_files"("scanStatus");

-- CreateIndex
CREATE UNIQUE INDEX "store_checklist_responses_storeSubmissionId_itemId_key" ON "store_checklist_responses"("storeSubmissionId", "itemId");

-- CreateIndex
CREATE INDEX "store_reviews_storeSubmissionId_createdAt_idx" ON "store_reviews"("storeSubmissionId", "createdAt");

-- CreateIndex
CREATE INDEX "store_reviews_reviewerId_idx" ON "store_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "store_review_scores_reviewId_criterionId_key" ON "store_review_scores"("reviewId", "criterionId");

-- CreateIndex
CREATE INDEX "store_fraud_flags_storeSubmissionId_status_idx" ON "store_fraud_flags"("storeSubmissionId", "status");

-- CreateIndex
CREATE INDEX "store_fraud_flags_type_status_idx" ON "store_fraud_flags"("type", "status");

-- CreateIndex
CREATE INDEX "assignments_checklistTemplateId_idx" ON "assignments"("checklistTemplateId");

-- CreateIndex
CREATE INDEX "courses_programId_idx" ON "courses"("programId");

-- CreateIndex
CREATE INDEX "materials_lessonId_idx" ON "materials"("lessonId");

-- CreateIndex
CREATE INDEX "submission_versions_submissionId_version_idx" ON "submission_versions"("submissionId", "version");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "store_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubrics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "submission_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_templates" ADD CONSTRAINT "store_checklist_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_templates" ADD CONSTRAINT "store_checklist_templates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_templates" ADD CONSTRAINT "store_checklist_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_items" ADD CONSTRAINT "store_checklist_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "store_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_stores" ADD CONSTRAINT "student_stores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_stores" ADD CONSTRAINT "student_stores_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_stores" ADD CONSTRAINT "student_stores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_submissions" ADD CONSTRAINT "student_store_submissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_submissions" ADD CONSTRAINT "student_store_submissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_submissions" ADD CONSTRAINT "student_store_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_submissions" ADD CONSTRAINT "student_store_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_submissions" ADD CONSTRAINT "student_store_submissions_studentStoreId_fkey" FOREIGN KEY ("studentStoreId") REFERENCES "student_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_submission_versions" ADD CONSTRAINT "student_store_submission_versions_storeSubmissionId_fkey" FOREIGN KEY ("storeSubmissionId") REFERENCES "student_store_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_store_files" ADD CONSTRAINT "student_store_files_storeSubmissionId_fkey" FOREIGN KEY ("storeSubmissionId") REFERENCES "student_store_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_responses" ADD CONSTRAINT "store_checklist_responses_storeSubmissionId_fkey" FOREIGN KEY ("storeSubmissionId") REFERENCES "student_store_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_responses" ADD CONSTRAINT "store_checklist_responses_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "store_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_reviews" ADD CONSTRAINT "store_reviews_storeSubmissionId_fkey" FOREIGN KEY ("storeSubmissionId") REFERENCES "student_store_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_reviews" ADD CONSTRAINT "store_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_reviews" ADD CONSTRAINT "store_reviews_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubrics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_review_scores" ADD CONSTRAINT "store_review_scores_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "store_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_review_scores" ADD CONSTRAINT "store_review_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_fraud_flags" ADD CONSTRAINT "store_fraud_flags_storeSubmissionId_fkey" FOREIGN KEY ("storeSubmissionId") REFERENCES "student_store_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
