#!/usr/bin/env sh
set -eu
umask 077

if [ -z "${DATABASE_URL:-}" ]; then
  printf '%s\n' "DATABASE_URL wajib diisi." >&2
  exit 1
fi

if [ "${NODE_ENV:-development}" = "production" ] && [ -z "${SUNRISE_BACKUP_ENCRYPTION_KEY:-}" ]; then
  printf '%s\n' "Backup production wajib dienkripsi dengan SUNRISE_BACKUP_ENCRYPTION_KEY." >&2
  exit 1
fi

SUNRISE_BACKUP_DIR="${SUNRISE_BACKUP_DIR:-./backups}"
SUNRISE_BACKUP_NAME="sunrise-$(date -u +%Y%m%dT%H%M%SZ).dump"
mkdir -p "$SUNRISE_BACKUP_DIR"
SUNRISE_BACKUP_TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$SUNRISE_BACKUP_TEMP_DIR"' EXIT HUP INT TERM
SUNRISE_BACKUP_TEMP_FILE="$SUNRISE_BACKUP_TEMP_DIR/$SUNRISE_BACKUP_NAME"
if command -v "${PG_DUMP_BIN:-pg_dump}" >/dev/null 2>&1; then
  "${PG_DUMP_BIN:-pg_dump}" --format=custom --no-owner --no-privileges --file="$SUNRISE_BACKUP_TEMP_FILE" "$DATABASE_URL"
elif [ -n "${SUNRISE_POSTGRES_CONTAINER:-}" ] && [ -n "${SUNRISE_CONTAINER_DATABASE_URL:-}" ]; then
  docker exec "$SUNRISE_POSTGRES_CONTAINER" pg_dump --format=custom --no-owner --no-privileges "$SUNRISE_CONTAINER_DATABASE_URL" > "$SUNRISE_BACKUP_TEMP_FILE"
else
  printf '%s\n' "pg_dump tidak tersedia. Isi SUNRISE_POSTGRES_CONTAINER dan SUNRISE_CONTAINER_DATABASE_URL untuk mode container." >&2
  exit 1
fi

if [ -n "${SUNRISE_BACKUP_ENCRYPTION_KEY:-}" ]; then
  SUNRISE_BACKUP_OUTPUT="$SUNRISE_BACKUP_DIR/$SUNRISE_BACKUP_NAME.enc"
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 \
    -pass env:SUNRISE_BACKUP_ENCRYPTION_KEY -in "$SUNRISE_BACKUP_TEMP_FILE" -out "$SUNRISE_BACKUP_OUTPUT"
else
  if [ "${SUNRISE_ALLOW_UNENCRYPTED_BACKUP:-false}" != "true" ]; then
    printf '%s\n' "Set SUNRISE_BACKUP_ENCRYPTION_KEY, atau izinkan backup plaintext khusus non-production." >&2
    exit 1
  fi
  SUNRISE_BACKUP_OUTPUT="$SUNRISE_BACKUP_DIR/$SUNRISE_BACKUP_NAME"
  cp "$SUNRISE_BACKUP_TEMP_FILE" "$SUNRISE_BACKUP_OUTPUT"
fi

(cd "$(dirname "$SUNRISE_BACKUP_OUTPUT")" && {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$(basename "$SUNRISE_BACKUP_OUTPUT")"
  else
    sha256sum "$(basename "$SUNRISE_BACKUP_OUTPUT")"
  fi
} > "$(basename "$SUNRISE_BACKUP_OUTPUT").sha256")
printf '%s\n' "$SUNRISE_BACKUP_OUTPUT"
