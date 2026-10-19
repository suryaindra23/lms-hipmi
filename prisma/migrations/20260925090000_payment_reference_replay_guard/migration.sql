-- A manual bank reference may settle at most one order. PostgreSQL permits
-- multiple NULL values, so unpaid attempts remain unaffected.
DROP INDEX IF EXISTS "payment_attempts_providerReference_idx";
CREATE UNIQUE INDEX "payment_attempts_provider_providerReference_key"
ON "payment_attempts"("provider", "providerReference");
