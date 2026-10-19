#!/usr/bin/env sh
set -eu
umask 077

TARGET="${1:-.env.production}"
DOMAIN="${DOMAIN:-sunriseadsacademy.com}"
PAYMENT_BANK_NAME="${PAYMENT_BANK_NAME:-BCA}"
PAYMENT_BANK_ACCOUNT_NUMBER="${PAYMENT_BANK_ACCOUNT_NUMBER:-3151262625}"
PAYMENT_BANK_ACCOUNT_HOLDER="${PAYMENT_BANK_ACCOUNT_HOLDER:-Surya Indra Permana}"
EMAIL_PROVIDER_ENABLED="${EMAIL_PROVIDER_ENABLED:-false}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
EMAIL_FROM="${EMAIL_FROM:-Sunrise Academy <no-reply@$DOMAIN>}"
EMAIL_REPLY_TO="${EMAIL_REPLY_TO:-}"
if [ "$EMAIL_PROVIDER_ENABLED" = "true" ] && { [ -z "$SMTP_HOST" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASSWORD" ]; }; then
  printf '%s\n' "SMTP_HOST, SMTP_USER, dan SMTP_PASSWORD wajib diisi saat EMAIL_PROVIDER_ENABLED=true." >&2
  exit 1
fi
if [ -e "$TARGET" ]; then
  printf '%s\n' "Dibatalkan: $TARGET sudah ada." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  printf '%s\n' "openssl diperlukan untuk membuat secret production." >&2
  exit 1
fi

POSTGRES_PASSWORD="$(openssl rand -hex 24)"
REDIS_PASSWORD="$(openssl rand -hex 24)"
MINIO_PASSWORD="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -hex 16)"
BLIND_INDEX_KEY="$(openssl rand -hex 32)"
BACKUP_KEY="$(openssl rand -hex 32)"

{
  printf '%s\n' "DOMAIN=$DOMAIN"
  printf '%s\n' "NODE_ENV=production" "TZ=Asia/Jakarta" "PORT=3000"
  printf '%s\n' "CORS_ORIGIN=https://$DOMAIN,https://www.$DOMAIN" "TRUST_PROXY=1" "ENABLE_API_DOCS=false" "ALLOW_PUBLIC_REGISTRATION=false"
  printf '%s\n' "PASSWORD_BCRYPT_COST=12" "REQUIRE_ADMIN_MFA=true" "MALWARE_SCANNER_REQUIRED=true"
  printf '%s\n' "POSTGRES_USER=sunrise_app" "POSTGRES_DB=sunrise_academy" "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
  printf '%s\n' "DATABASE_URL=postgresql://sunrise_app:$POSTGRES_PASSWORD@postgres:5432/sunrise_academy"
  printf '%s\n' "REDIS_PASSWORD=$REDIS_PASSWORD" "REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379"
  printf '%s\n' "JWT_SECRET=$JWT_SECRET" "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" "ENCRYPTION_KEY=$ENCRYPTION_KEY" "BLIND_INDEX_KEY=$BLIND_INDEX_KEY" "SUNRISE_BACKUP_ENCRYPTION_KEY=$BACKUP_KEY"
  printf '%s\n' "WORKER_CONCURRENCY=4" "IMPORT_WORKER_CONCURRENCY=2" "IDENTITY_SCAN_CONCURRENCY=2" "NOTIFICATION_WORKER_CONCURRENCY=4" "CERTIFICATE_WORKER_CONCURRENCY=2"
  printf '%s\n' "CLAMAV_HOST=clamav" "CLAMAV_PORT=3310"
  printf '%s\n' "MINIO_ROOT_USER=sunrise_storage" "MINIO_ROOT_PASSWORD=$MINIO_PASSWORD"
  printf '%s\n' "OBJECT_STORAGE_ENDPOINT=http://minio:9000" "OBJECT_STORAGE_PUBLIC_ENDPOINT=https://storage.$DOMAIN" "OBJECT_STORAGE_REGION=us-east-1"
  printf '%s\n' "OBJECT_STORAGE_ACCESS_KEY=sunrise_storage" "OBJECT_STORAGE_SECRET_KEY=$MINIO_PASSWORD" "OBJECT_STORAGE_PREFIX=sunrise" "OBJECT_STORAGE_AUTO_CREATE=false"
  printf '%s\n' "PAYMENT_BANK_NAME=$PAYMENT_BANK_NAME" "PAYMENT_BANK_ACCOUNT_NUMBER=$PAYMENT_BANK_ACCOUNT_NUMBER" "PAYMENT_BANK_ACCOUNT_HOLDER=$PAYMENT_BANK_ACCOUNT_HOLDER"
  printf '%s\n' "NEXT_PUBLIC_SITE_URL=https://$DOMAIN" "NEXT_PUBLIC_STORAGE_ORIGIN=https://storage.$DOMAIN" "API_URL=http://api:3000/api/v1"
  printf '%s\n' "ALERT_HTTP_ERROR_RATE=0.05" "ALERT_HTTP_P95_MS=1500" "ALERT_QUEUE_BACKLOG=100"
  printf '%s\n' "EMAIL_PROVIDER_ENABLED=$EMAIL_PROVIDER_ENABLED" "SMTP_HOST=$SMTP_HOST" "SMTP_PORT=$SMTP_PORT" "SMTP_SECURE=$SMTP_SECURE"
  printf '%s\n' "SMTP_USER=$SMTP_USER" "SMTP_PASSWORD=$SMTP_PASSWORD" "EMAIL_FROM=$EMAIL_FROM" "EMAIL_REPLY_TO=$EMAIL_REPLY_TO" "SMTP_TLS_REJECT_UNAUTHORIZED=true"
  printf '%s\n' "WHATSAPP_PROVIDER_ENABLED=false" "SMS_PROVIDER_ENABLED=false"
} > "$TARGET"

printf '%s\n' "$TARGET dibuat dengan permission privat. Simpan backup key di secret manager terpisah sebelum deployment."
