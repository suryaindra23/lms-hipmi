ALTER TABLE "materials"
ADD COLUMN "previewSlideCount" INTEGER;

ALTER TABLE "materials"
ADD CONSTRAINT "materials_preview_slide_count_check"
CHECK ("previewSlideCount" IS NULL OR "previewSlideCount" BETWEEN 1 AND 500);
