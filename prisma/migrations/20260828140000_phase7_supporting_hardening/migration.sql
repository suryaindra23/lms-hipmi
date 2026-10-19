ALTER TABLE "helpdesk_messages"
  ADD COLUMN "quarantineStorageKey" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "scanStatus" "FileScanStatus",
  ADD COLUMN "scanCompletedAt" TIMESTAMP(3);

CREATE INDEX "helpdesk_messages_scanStatus_createdAt_idx"
  ON "helpdesk_messages"("scanStatus", "createdAt");

INSERT INTO "entitlement_definitions" (
  "id", "key", "valueType", "description", "isActive", "createdAt", "updatedAt"
) VALUES (
  'phase7-support-advanced', 'support.advanced.use', 'BOOLEAN',
  'Menggunakan sertifikat, pencapaian, dan portofolio', true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
  "valueType" = EXCLUDED."valueType",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "plan_entitlements" (
  "id", "accessPlanId", "entitlementDefinitionId", "enabled", "valueJson",
  "effectiveFrom", "createdAt", "updatedAt"
)
SELECT
  'phase7-' || md5(p."id" || d."id"), p."id", d."id",
  p."code" = 'ADVANCED', to_jsonb(p."code" = 'ADVANCED'),
  TIMESTAMP '2026-01-01 00:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "access_plans" p
CROSS JOIN "entitlement_definitions" d
WHERE d."key" = 'support.advanced.use'
ON CONFLICT ("accessPlanId", "entitlementDefinitionId", "effectiveFrom")
DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "valueJson" = EXCLUDED."valueJson",
  "updatedAt" = CURRENT_TIMESTAMP;
