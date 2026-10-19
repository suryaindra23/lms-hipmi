CREATE TABLE "ai_assessments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "insufficientEvidence" BOOLEAN NOT NULL DEFAULT false,
    "requiresTeacherReview" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_assessment_scores" (
    "id" TEXT NOT NULL,
    "aiAssessmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ai_assessment_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_assessments_submissionId_createdAt_idx" ON "ai_assessments"("submissionId", "createdAt");
CREATE INDEX "ai_assessments_rubricId_idx" ON "ai_assessments"("rubricId");
CREATE INDEX "ai_assessment_scores_criterionId_idx" ON "ai_assessment_scores"("criterionId");
CREATE UNIQUE INDEX "ai_assessment_scores_aiAssessmentId_criterionId_key" ON "ai_assessment_scores"("aiAssessmentId", "criterionId");

ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_assessment_scores" ADD CONSTRAINT "ai_assessment_scores_aiAssessmentId_fkey" FOREIGN KEY ("aiAssessmentId") REFERENCES "ai_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_assessment_scores" ADD CONSTRAINT "ai_assessment_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
