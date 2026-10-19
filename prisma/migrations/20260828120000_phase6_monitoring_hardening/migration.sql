CREATE TABLE "export_download_events" (
    "id" TEXT NOT NULL,
    "exportJobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_download_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "export_download_events_exportJobId_createdAt_idx" ON "export_download_events"("exportJobId", "createdAt");
CREATE INDEX "export_download_events_actorId_createdAt_idx" ON "export_download_events"("actorId", "createdAt");

ALTER TABLE "export_download_events"
  ADD CONSTRAINT "export_download_events_exportJobId_fkey"
  FOREIGN KEY ("exportJobId") REFERENCES "export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_download_events"
  ADD CONSTRAINT "export_download_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_download_events"
  ADD CONSTRAINT "export_download_events_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "export_download_events"
  ADD CONSTRAINT "export_download_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
