-- Backfill active course enrollments for existing students so legacy learning
-- data remains visible after enrollment-aware reads are enabled.
INSERT INTO "course_enrollments" (
  "id", "courseId", "studentId", "schoolId", "status", "enrolledAt", "createdAt", "updatedAt"
)
SELECT
  md5(c."id" || ':' || s."id"),
  c."id",
  s."id",
  s."schoolId",
  'ACTIVE'::"CourseEnrollmentStatus",
  now(),
  now(),
  now()
FROM "courses" c
JOIN "students" s ON s."schoolId" = c."schoolId"
WHERE c."isActive" = true
ON CONFLICT ("courseId", "studentId") DO NOTHING;

-- Align aggregate version pointer with existing immutable submission versions.
UPDATE "submissions" s
SET "currentVersion" = versions."maxVersion"
FROM (
  SELECT "submissionId", MAX("version") AS "maxVersion"
  FROM "submission_versions"
  GROUP BY "submissionId"
) versions
WHERE s."id" = versions."submissionId";

-- A logical version number may only occur once per submission.
CREATE UNIQUE INDEX "submission_versions_submissionId_version_key"
ON "submission_versions"("submissionId", "version");
