#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/compose.production.yml"
ENV_FILE="$ROOT_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  printf '%s\n' "File .env.production belum ada. Jalankan deploy/generate-production-env.sh terlebih dahulu." >&2
  exit 1
fi
if grep -q 'REPLACE_' "$ENV_FILE"; then
  printf '%s\n' "Masih ada placeholder REPLACE_ di .env.production." >&2
  exit 1
fi

cd "$ROOT_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull postgres redis minio storage-init clamav caddy
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build api web
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis minio storage-init clamav
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps api npx prisma migrate deploy --schema prisma/schema.prisma
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d api worker web caddy

printf '%s\n' "Deployment dimulai. Periksa: docker compose --env-file .env.production -f deploy/compose.production.yml ps"
