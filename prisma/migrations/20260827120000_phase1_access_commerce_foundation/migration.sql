-- Access-plan and commerce foundation introduced by the revised master prompt.
CREATE TYPE "AccessPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "EntitlementValueType" AS ENUM ('BOOLEAN', 'INTEGER', 'STRING', 'JSON');
CREATE TYPE "AccessGrantStatus" AS ENUM ('ACTIVE', 'SCHEDULED', 'EXPIRED', 'SUSPENDED', 'REVOKED');
CREATE TYPE "AccessGrantSource" AS ENUM ('PURCHASE', 'MANUAL', 'PARTNERSHIP', 'SCHOLARSHIP', 'PILOT', 'INSTITUTIONAL_INVOICE', 'MIGRATION');
CREATE TYPE "AccessGrantTargetType" AS ENUM ('ORGANIZATION', 'SCHOOL', 'PROGRAM', 'CLASS', 'USER');
CREATE TYPE "AccessGrantEventType" AS ENUM ('CREATED', 'SCHEDULED', 'ACTIVATED', 'UPGRADED', 'DOWNGRADED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'CORRECTED');
CREATE TYPE "OfferAudience" AS ENUM ('INDIVIDUAL', 'GUARDIAN', 'SCHOOL', 'PARTNER');
CREATE TYPE "BillingModel" AS ENUM ('FREE', 'ONE_TIME', 'TERM_LICENSE', 'SUBSCRIPTION');
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK', 'FAILED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'SETTLED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'CHARGEBACK');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID', 'REFUNDED');
CREATE TYPE "BeneficiaryType" AS ENUM ('USER', 'SCHOOL', 'PROGRAM', 'CLASS');
CREATE TYPE "BeneficiaryVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "access_plans" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "moduleLimit" INTEGER NOT NULL,
  "status" "AccessPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_plans_module_limit_check" CHECK ("moduleLimit" BETWEEN 0 AND 12)
);

CREATE TABLE "entitlement_definitions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "valueType" "EntitlementValueType" NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entitlement_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_entitlements" (
  "id" TEXT NOT NULL,
  "accessPlanId" TEXT NOT NULL,
  "entitlementDefinitionId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "valueJson" JSONB,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plan_entitlements_period_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "module_plan_access" (
  "moduleId" TEXT NOT NULL,
  "minimumPlanId" TEXT NOT NULL,
  "overrideReason" TEXT,
  "configuredBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "module_plan_access_pkey" PRIMARY KEY ("moduleId")
);

CREATE TABLE "plan_offers" (
  "id" TEXT NOT NULL,
  "accessPlanId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "audience" "OfferAudience" NOT NULL,
  "billingModel" "BillingModel" NOT NULL,
  "accessDurationDays" INTEGER,
  "seatMin" INTEGER,
  "seatMax" INTEGER,
  "salesStartAt" TIMESTAMP(3),
  "salesEndAt" TIMESTAMP(3),
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "termsVersion" TEXT,
  "refundPolicyVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plan_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plan_offers_sales_period_check" CHECK ("salesEndAt" IS NULL OR "salesStartAt" IS NULL OR "salesEndAt" > "salesStartAt"),
  CONSTRAINT "plan_offers_seat_range_check" CHECK ("seatMin" IS NULL OR "seatMax" IS NULL OR "seatMax" >= "seatMin")
);

CREATE TABLE "offer_prices" (
  "id" TEXT NOT NULL,
  "planOfferId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "amount" DECIMAL(18,2) NOT NULL,
  "compareAtAmount" DECIMAL(18,2),
  "taxMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
  "taxRate" DECIMAL(7,4),
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offer_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offer_prices_amount_check" CHECK ("amount" >= 0 AND ("compareAtAmount" IS NULL OR "compareAtAmount" >= "amount")),
  CONSTRAINT "offer_prices_period_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "organizationId" TEXT,
  "purchaserUserId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "subtotalAmount" DECIMAL(18,2) NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "paymentExpiresAt" TIMESTAMP(3),
  "termsVersion" TEXT,
  "refundPolicyVersion" TEXT,
  "consentSnapshot" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_amount_check" CHECK ("subtotalAmount" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0 AND "feeAmount" >= 0 AND "totalAmount" >= 0)
);

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "planOfferId" TEXT NOT NULL,
  "accessPlanId" TEXT NOT NULL,
  "offerSnapshot" JSONB NOT NULL,
  "priceSnapshot" JSONB NOT NULL,
  "quantityOrSeats" INTEGER NOT NULL DEFAULT 1,
  "unitAmount" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "accessStartsAt" TIMESTAMP(3),
  "accessEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_quantity_check" CHECK ("quantityOrSeats" > 0 AND "unitAmount" >= 0 AND "lineTotal" >= 0)
);

CREATE TABLE "purchase_beneficiaries" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "beneficiaryType" "BeneficiaryType" NOT NULL,
  "userId" TEXT,
  "schoolId" TEXT,
  "programId" TEXT,
  "classId" TEXT,
  "guardianRelationKey" TEXT,
  "seatCount" INTEGER NOT NULL DEFAULT 1,
  "verificationStatus" "BeneficiaryVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_beneficiaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_beneficiaries_target_check" CHECK (num_nonnulls("userId", "schoolId", "programId", "classId") = 1),
  CONSTRAINT "purchase_beneficiaries_seat_check" CHECK ("seatCount" > 0)
);

CREATE TABLE "payment_attempts" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "methodType" TEXT,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "requestedAmount" DECIMAL(18,2) NOT NULL,
  "settledAmount" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "providerReference" TEXT,
  "paymentUrlExpiresAt" TIMESTAMP(3),
  "authorizedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_attempts_amount_check" CHECK ("requestedAmount" >= 0 AND ("settledAmount" IS NULL OR "settledAmount" >= 0))
);

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "subtotalAmount" DECIMAL(18,2) NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "billingIdentitySnapshot" JSONB,
  "pdfStorageKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_grants" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "schoolId" TEXT,
  "programId" TEXT,
  "classId" TEXT,
  "userId" TEXT,
  "targetType" "AccessGrantTargetType" NOT NULL,
  "accessPlanId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "source" "AccessGrantSource" NOT NULL,
  "status" "AccessGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "reason" TEXT,
  "grantedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_grants_target_check" CHECK (
    ("targetType" = 'ORGANIZATION' AND num_nonnulls("schoolId", "programId", "classId", "userId") = 0) OR
    ("targetType" = 'SCHOOL' AND "schoolId" IS NOT NULL AND num_nonnulls("programId", "classId", "userId") = 0) OR
    ("targetType" = 'PROGRAM' AND "programId" IS NOT NULL AND num_nonnulls("schoolId", "classId", "userId") = 0) OR
    ("targetType" = 'CLASS' AND "classId" IS NOT NULL AND num_nonnulls("schoolId", "programId", "userId") = 0) OR
    ("targetType" = 'USER' AND "userId" IS NOT NULL AND num_nonnulls("schoolId", "programId", "classId") = 0)
  ),
  CONSTRAINT "access_grants_period_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE TABLE "access_grant_events" (
  "id" TEXT NOT NULL,
  "accessGrantId" TEXT NOT NULL,
  "eventType" "AccessGrantEventType" NOT NULL,
  "actorId" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_grant_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "safeDetails" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_plans_code_key" ON "access_plans"("code");
CREATE INDEX "access_plans_status_rank_idx" ON "access_plans"("status", "rank");
CREATE UNIQUE INDEX "entitlement_definitions_key_key" ON "entitlement_definitions"("key");
CREATE INDEX "entitlement_definitions_isActive_idx" ON "entitlement_definitions"("isActive");
CREATE UNIQUE INDEX "plan_entitlements_accessPlanId_entitlementDefinitionId_effe_key" ON "plan_entitlements"("accessPlanId", "entitlementDefinitionId", "effectiveFrom");
CREATE INDEX "plan_entitlements_accessPlanId_effectiveTo_idx" ON "plan_entitlements"("accessPlanId", "effectiveTo");
CREATE INDEX "module_plan_access_minimumPlanId_idx" ON "module_plan_access"("minimumPlanId");
CREATE UNIQUE INDEX "plan_offers_code_key" ON "plan_offers"("code");
CREATE UNIQUE INDEX "plan_offers_slug_key" ON "plan_offers"("slug");
CREATE INDEX "plan_offers_accessPlanId_audience_status_idx" ON "plan_offers"("accessPlanId", "audience", "status");
CREATE INDEX "plan_offers_salesStartAt_salesEndAt_idx" ON "plan_offers"("salesStartAt", "salesEndAt");
CREATE INDEX "offer_prices_planOfferId_currency_status_effectiveFrom_effe_idx" ON "offer_prices"("planOfferId", "currency", "status", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE UNIQUE INDEX "orders_purchaserUserId_idempotencyKey_key" ON "orders"("purchaserUserId", "idempotencyKey");
CREATE INDEX "orders_purchaserUserId_status_createdAt_idx" ON "orders"("purchaserUserId", "status", "createdAt");
CREATE INDEX "orders_organizationId_status_createdAt_idx" ON "orders"("organizationId", "status", "createdAt");
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_planOfferId_idx" ON "order_items"("planOfferId");
CREATE INDEX "purchase_beneficiaries_orderItemId_idx" ON "purchase_beneficiaries"("orderItemId");
CREATE INDEX "purchase_beneficiaries_userId_idx" ON "purchase_beneficiaries"("userId");
CREATE INDEX "purchase_beneficiaries_schoolId_idx" ON "purchase_beneficiaries"("schoolId");
CREATE INDEX "purchase_beneficiaries_programId_idx" ON "purchase_beneficiaries"("programId");
CREATE INDEX "purchase_beneficiaries_classId_idx" ON "purchase_beneficiaries"("classId");
CREATE UNIQUE INDEX "payment_attempts_provider_providerPaymentId_key" ON "payment_attempts"("provider", "providerPaymentId");
CREATE INDEX "payment_attempts_orderId_status_idx" ON "payment_attempts"("orderId", "status");
CREATE INDEX "payment_attempts_providerReference_idx" ON "payment_attempts"("providerReference");
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
CREATE INDEX "invoices_orderId_status_idx" ON "invoices"("orderId", "status");
CREATE INDEX "invoices_status_dueAt_idx" ON "invoices"("status", "dueAt");
CREATE INDEX "access_grants_organizationId_status_startsAt_endsAt_idx" ON "access_grants"("organizationId", "status", "startsAt", "endsAt");
CREATE INDEX "access_grants_schoolId_status_idx" ON "access_grants"("schoolId", "status");
CREATE INDEX "access_grants_programId_status_idx" ON "access_grants"("programId", "status");
CREATE INDEX "access_grants_classId_status_idx" ON "access_grants"("classId", "status");
CREATE INDEX "access_grants_userId_status_idx" ON "access_grants"("userId", "status");
CREATE INDEX "access_grants_orderItemId_idx" ON "access_grants"("orderItemId");
CREATE INDEX "access_grant_events_accessGrantId_createdAt_idx" ON "access_grant_events"("accessGrantId", "createdAt");
CREATE INDEX "billing_audit_events_organizationId_createdAt_idx" ON "billing_audit_events"("organizationId", "createdAt");
CREATE INDEX "billing_audit_events_resource_resourceId_createdAt_idx" ON "billing_audit_events"("resource", "resourceId", "createdAt");

ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_accessPlanId_fkey" FOREIGN KEY ("accessPlanId") REFERENCES "access_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_entitlementDefinitionId_fkey" FOREIGN KEY ("entitlementDefinitionId") REFERENCES "entitlement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_plan_access" ADD CONSTRAINT "module_plan_access_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_plan_access" ADD CONSTRAINT "module_plan_access_minimumPlanId_fkey" FOREIGN KEY ("minimumPlanId") REFERENCES "access_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_offers" ADD CONSTRAINT "plan_offers_accessPlanId_fkey" FOREIGN KEY ("accessPlanId") REFERENCES "access_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offer_prices" ADD CONSTRAINT "offer_prices_planOfferId_fkey" FOREIGN KEY ("planOfferId") REFERENCES "plan_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_planOfferId_fkey" FOREIGN KEY ("planOfferId") REFERENCES "plan_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_accessPlanId_fkey" FOREIGN KEY ("accessPlanId") REFERENCES "access_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_beneficiaries" ADD CONSTRAINT "purchase_beneficiaries_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_accessPlanId_fkey" FOREIGN KEY ("accessPlanId") REFERENCES "access_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "access_grant_events" ADD CONSTRAINT "access_grant_events_accessGrantId_fkey" FOREIGN KEY ("accessGrantId") REFERENCES "access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
