DROP INDEX IF EXISTS "affiliate_videos_normalizedUrl_key";
DROP INDEX IF EXISTS "affiliate_videos_externalId_key";

CREATE INDEX "affiliate_videos_normalizedUrl_idx" ON "affiliate_videos"("normalizedUrl");
CREATE INDEX "affiliate_videos_externalId_idx" ON "affiliate_videos"("externalId");

CREATE TABLE "affiliate_account_reviews" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "AffiliateAccountStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_account_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "affiliate_account_reviews_accountId_createdAt_idx" ON "affiliate_account_reviews"("accountId", "createdAt");
CREATE INDEX "affiliate_account_reviews_reviewerId_createdAt_idx" ON "affiliate_account_reviews"("reviewerId", "createdAt");

ALTER TABLE "affiliate_account_reviews"
  ADD CONSTRAINT "affiliate_account_reviews_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliate_account_reviews"
  ADD CONSTRAINT "affiliate_account_reviews_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
