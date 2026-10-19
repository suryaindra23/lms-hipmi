-- Assignments must belong to a module so package limits can be enforced on
-- every assignment and submission path.
ALTER TABLE "assignments" ADD COLUMN "moduleId" TEXT;

-- Preserve legacy courses by creating one private fallback module only where
-- an assignment exists but no module has ever been configured.
INSERT INTO "course_modules" (
  "id", "courseId", "title", "description", "position", "isPublished",
  "createdAt", "updatedAt"
)
SELECT
  'phase4-' || md5(c."id"), c."id", 'Materi Utama',
  'Modul kompatibilitas untuk tugas yang dibuat sebelum assignment berbasis modul.',
  1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "courses" c
WHERE EXISTS (SELECT 1 FROM "assignments" a WHERE a."courseId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "course_modules" cm WHERE cm."courseId" = c."id");

UPDATE "assignments" a
SET "moduleId" = (
  SELECT cm."id"
  FROM "course_modules" cm
  WHERE cm."courseId" = a."courseId"
  ORDER BY cm."isPublished" DESC, cm."position" ASC, cm."createdAt" ASC
  LIMIT 1
);

ALTER TABLE "assignments" ALTER COLUMN "moduleId" SET NOT NULL;
CREATE INDEX "assignments_moduleId_idx" ON "assignments"("moduleId");
ALTER TABLE "assignments"
  ADD CONSTRAINT "assignments_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "assignment_versions" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "changedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_versions_assignmentId_version_key"
  ON "assignment_versions"("assignmentId", "version");
CREATE INDEX "assignment_versions_assignmentId_createdAt_idx"
  ON "assignment_versions"("assignmentId", "createdAt");
ALTER TABLE "assignment_versions"
  ADD CONSTRAINT "assignment_versions_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Capture the current legacy state as immutable version 1.
INSERT INTO "assignment_versions" (
  "id", "assignmentId", "version", "snapshotData", "createdAt"
)
SELECT
  'phase4v-' || md5(a."id"), a."id", a."version",
  jsonb_build_object(
    'courseId', a."courseId",
    'moduleId', a."moduleId",
    'teacherId', a."teacherId",
    'title', a."title",
    'description', a."description",
    'type', a."type",
    'startDate', a."startDate",
    'endDate', a."endDate",
    'maxScore', a."maxScore",
    'rubricId', a."rubricId",
    'checklistTemplateId', a."checklistTemplateId",
    'isActive', a."isActive",
    'publishedAt', a."publishedAt"
  ),
  a."createdAt"
FROM "assignments" a
ON CONFLICT ("assignmentId", "version") DO NOTHING;
