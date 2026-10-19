UPDATE "plan_entitlements" pe
SET
  "enabled" = true,
  "valueJson" = 'true'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "access_plans" p, "entitlement_definitions" d
WHERE pe."accessPlanId" = p."id"
  AND pe."entitlementDefinitionId" = d."id"
  -- Paket berbayar mewarisi seluruh kemampuan paket Gratis.
  AND p."code" IN ('FREE', 'MEDIUM', 'ADVANCED')
  AND d."key" IN (
    'assessment.overview.read',
    'assignments.standard.read',
    'assignments.standard.submit',
    'student_store.submit',
    'affiliate.content.submit',
    'affiliate.metrics.manage'
  )
  AND pe."effectiveFrom" <= CURRENT_TIMESTAMP
  AND (pe."effectiveTo" IS NULL OR pe."effectiveTo" > CURRENT_TIMESTAMP);
