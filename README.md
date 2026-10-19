# Sunrise Academy

Platform pembelajaran multi-sekolah untuk siswa, guru, admin sekolah, orang tua/wali, reviewer, dan verifier identitas. Implementasi mencakup Fase 1–8, termasuk hardening keamanan dan kesiapan operasional.

## Yang sudah tersedia

- Next.js App Router untuk landing page, login, dashboard, Master Data, identitas, dan pusat privasi.
- NestJS modular API, Prisma, PostgreSQL, Redis, BullMQ worker, dan MinIO/S3.
- Session server-side dengan refresh rotation/reuse detection, CSRF, distributed rate limit, RBAC, tenant guard, audit, dan request ID.
- Paket akses Gratis/Medium/Advanced, entitlement terpusat, batas modul 8/10/12, access grant bertingkat, serta fondasi offer/order/payment/invoice.
- Invitation/activation, lifecycle akun, siswa/guru/orang tua, kelas, tahun ajaran, enrollment, dan relasi wali terverifikasi.
- Import siswa asynchronous dengan progress/error per baris serta Master Data search/filter/pagination.
- NIK/NISN terenkripsi + blind index, private quarantine upload, scan worker, signed access singkat, dan verification review.
- Consent berversi, withdrawal workflow, dan data subject request.
- OpenAPI, health/readiness, CI foundation, Docker images non-root, serta backup/restore runbook.
- MFA admin, upload quarantine + ClamAV, observability/alert dashboard, backup terenkripsi, test abuse/cross-tenant/SSRF, dan harness beban 50.000 siswa sintetis.

Status hardening dan bukti eksternal yang masih wajib sebelum production ada di [docs/phase-8-status.md](docs/phase-8-status.md). Lihat juga [security review](docs/security-review.md), [threat model](docs/threat-model.md), [privacy review](docs/privacy-review.md), [deployment guide](docs/deployment-guide.md), dan [operations runbook](docs/operations-runbook.md).

Roadmap berdasarkan master prompt terbaru tersedia di [docs/implementation-roadmap.md](docs/implementation-roadmap.md).

Paket deployment VPS untuk `sunriseadsacademy.com` tersedia di [deploy/README.md](deploy/README.md). Paket tersebut menyalakan HTTPS, web, API, worker, PostgreSQL, Redis, private object storage, dan ClamAV tanpa mengekspos layanan internal ke internet.

## Menjalankan lokal

Persyaratan: Node.js 22+, npm, Docker, dan Docker Compose.

```bash
cp .env.example .env
npm install
docker compose up -d
npx prisma migrate deploy
npm run prisma:seed --workspace apps/api
```

Jalankan tiga proses:

```bash
PORT=3100 npm run dev --workspace apps/api
npm run worker:dev --workspace apps/api
PORT=3001 API_URL=http://localhost:3100/api/v1 npm run dev --workspace apps/web
```

- Website: `http://localhost:3001`
- API: `http://localhost:3100/api/v1`
- OpenAPI: `http://localhost:3100/api/docs`
- MinIO console: `http://localhost:9001`

## Akun sintetis setelah seed

| Peran | Email | Password |
|---|---|---|
| Admin | `admin@lms.test` | `admin123` |
| Guru | `teacher@lms.test` | `teacher123` |
| Siswa | `student@lms.test` | `student123` |
| Orang tua | `parent@lms.test` | `parent123` |

Seed hanya diizinkan untuk development/test dan hanya mereset tenant sintetis berkode `HIPMI`.

## Verifikasi

```bash
npm run verify
npm audit --audit-level=high
docker compose config
npm run repo:hygiene
npm run smoke:roles
```

`npm run verify` memeriksa schema/migration Prisma, type-check/lint, unit test, dan production build API/web.
`npm run smoke:roles` memakai akun sintetis development untuk memeriksa login dan akses utama Super Admin, Guru, Siswa, dan Orang Tua; jangan jalankan seed atau smoke account pada production. Sebelum membuat rilis, jalankan `npm run release:check` dan ikuti [checklist pilot](docs/pilot-readiness-checklist.md).

## Keamanan data sensitif

- Jangan gunakan secret dari `.env.example` pada staging/production.
- `ENCRYPTION_KEY` harus tepat 32 byte; `BLIND_INDEX_KEY`, JWT secrets, dan storage secret minimal 32 karakter.
- File identitas hanya boleh dibuka setelah scan `CLEAN`, melalui signed URL singkat dan audit authorization.
- Production wajib menggunakan ClamAV/managed malware scanner, secret manager, TLS, storage encryption/versioning, dan alert routing sebelum menerima dokumen nyata.
- Konten legal adalah template yang wajib ditinjau penasihat hukum.
