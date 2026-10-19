# Deployment guide

## Environment

Pisahkan development, test, staging, dan production. Seed/demo hanya boleh di development/test. Production memakai PostgreSQL 16+, Redis 7+, S3-compatible private storage dengan versioning/lifecycle, ClamAV/managed scanner, TLS domain, secret manager, worker terpisah, dan monitoring.

Bundle single-VPS untuk `sunriseadsacademy.com` tersedia di `deploy/`. Gunakan `deploy/README.md` sebagai prosedur instalasi; bundle ini memerlukan VPS dan tidak ditujukan untuk shared hosting/cPanel.

## Urutan release

1. CI: lockfile install, Prisma validate/migration, type/lint/test/build, dependency audit, image build, Trivy scan.
2. Deploy migration job tunggal dengan `prisma migrate deploy`; migration harus backward-compatible untuk rolling release.
3. Deploy worker, API, lalu web image berdasarkan digest. Semua container berjalan non-root.
4. Jalankan `/api/v1/health/live`, `/api/v1/health/ready`, login, dashboard role utama, upload quarantine, queue worker, dan operasi overview.
5. Naikkan traffic bertahap dan awasi error rate, p95, DB connection, queue backlog, upload failure, dead letter.

## Konfigurasi wajib production

Selain `.env.example`: secret unik minimal 32 karakter, `REQUIRE_ADMIN_MFA=true`, `MALWARE_SCANNER_REQUIRED=true`, `CLAMAV_HOST`, CORS HTTPS eksplisit, object storage private, backup key terpisah, email domain/provider, timezone, trusted proxy yang tepat, serta threshold alert. Jangan bake secret ke image.

## Rollback

Rollback aplikasi memakai image digest sebelumnya. Jangan otomatis rollback migration destruktif. Jika schema incompatible, hentikan write, gunakan forward-fix yang telah diuji. Restore database hanya sebagai langkah insiden terakhir berdasarkan runbook, setelah snapshot tambahan dan persetujuan incident commander.

## Checklist go-live

- DNS/TLS/HSTS dan redirect HTTPS terverifikasi.
- Bucket public/private/quarantine terpisah; public access block, encryption, versioning, lifecycle aktif.
- DB/Redis tidak publik, encryption-at-rest aktif, least-privilege credential per service.
- MFA seluruh admin aktif dan access review selesai.
- Backup otomatis terakhir sukses dan restore drill staging lulus.
- Alert route on-call diuji, dashboard operasional sehat, RPO/RTO disetujui.
- Lighthouse/accessibility dan browser/device matrix lulus; privacy notice/subprocessor register disetujui.

Jalankan `npm run release:check` pada commit rilis. Untuk pilot, lampirkan bukti dari `docs/pilot-readiness-checklist.md`; pembayaran transfer manual mengikuti `docs/payment-operations-sop.md`.
