#!/usr/bin/env sh
set -eu
umask 077

if [ "${SUNRISE_ALLOW_RESTORE:-false}" != "true" ]; then
  printf '%s\n' "Restore dibatalkan. Set SUNRISE_ALLOW_RESTORE=true setelah memastikan target non-production atau maintenance window." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  printf '%s\n' "DATABASE_URL wajib diisi." >&2
  exit 1
fi

if [ "${NODE_ENV:-development}" = "production" ] && [ "${SUNRISE_ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]; then
  printf '%s\n' "Restore production memerlukan SUNRISE_ALLOW_PRODUCTION_RESTORE=true dan maintenance window." >&2
  exit 1
fi

SUNRISE_RESTORE_FILE="${1:-}"
if [ -z "$SUNRISE_RESTORE_FILE" ] || [ ! -f "$SUNRISE_RESTORE_FILE" ]; then
  printf '%s\n' "Berikan path file backup yang valid." >&2
  exit 1
fi

if [ -f "$SUNRISE_RESTORE_FILE.sha256" ]; then
  (cd "$(dirname "$SUNRISE_RESTORE_FILE")" && {
    if command -v shasum >/dev/null 2>&1; then
      shasum -a 256 -c "$(basename "$SUNRISE_RESTORE_FILE").sha256"
    else
      sha256sum -c "$(basename "$SUNRISE_RESTORE_FILE").sha256"
    fi
  })
else
  printf '%s\n' "Checksum backup tidak ditemukan." >&2
  exit 1
fi

SUNRISE_RESTORE_TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$SUNRISE_RESTORE_TEMP_DIR"' EXIT HUP INT TERM
SUNRISE_RESTORE_DUMP="$SUNRISE_RESTORE_TEMP_DIR/restore.dump"
case "$SUNRISE_RESTORE_FILE" in
  *.enc)
    if [ -z "${SUNRISE_BACKUP_ENCRYPTION_KEY:-}" ]; then
      printf '%s\n' "SUNRISE_BACKUP_ENCRYPTION_KEY diperlukan untuk membuka backup." >&2
      exit 1
    fi
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
      -pass env:SUNRISE_BACKUP_ENCRYPTION_KEY -in "$SUNRISE_RESTORE_FILE" -out "$SUNRISE_RESTORE_DUMP"
    ;;
  *)
    if [ "${NODE_ENV:-development}" = "production" ] || [ "${SUNRISE_ALLOW_UNENCRYPTED_BACKUP:-false}" != "true" ]; then
      printf '%s\n' "Backup tanpa enkripsi hanya boleh untuk pengujian non-production." >&2
      exit 1
    fi
    cp "$SUNRISE_RESTORE_FILE" "$SUNRISE_RESTORE_DUMP"
    ;;
esac

if command -v "${PG_RESTORE_BIN:-pg_restore}" >/dev/null 2>&1; then
  "${PG_RESTORE_BIN:-pg_restore}" --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "$DATABASE_URL" "$SUNRISE_RESTORE_DUMP"
elif [ -n "${SUNRISE_POSTGRES_CONTAINER:-}" ] && [ -n "${SUNRISE_CONTAINER_DATABASE_URL:-}" ]; then
  docker exec -i "$SUNRISE_POSTGRES_CONTAINER" pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "$SUNRISE_CONTAINER_DATABASE_URL" < "$SUNRISE_RESTORE_DUMP"
else
  printf '%s\n' "pg_restore tidak tersedia. Isi SUNRISE_POSTGRES_CONTAINER dan SUNRISE_CONTAINER_DATABASE_URL untuk mode container." >&2
  exit 1
fi
printf '%s\n' "Restore selesai dan checksum telah diverifikasi."
