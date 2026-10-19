-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "picName" TEXT NOT NULL,
    "picTitle" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "estimatedStudents" INTEGER NOT NULL,
    "programOfInterest" TEXT NOT NULL,
    "message" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");
