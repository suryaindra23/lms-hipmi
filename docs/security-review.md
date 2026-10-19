# Security review — Fase 8

Tanggal review: 6 Agustus 2026. Scope: API NestJS, web Next.js, worker BullMQ, PostgreSQL, Redis, dan object storage.

## Ringkasan

Kontrol utama OWASP sudah diterapkan: validasi input allowlist, ORM Prisma, RBAC dan tenant guard, pembatasan login, rotasi refresh token, cookie HttpOnly/SameSite/Secure, CSRF pada BFF web, security headers Helmet, CORS eksplisit, secret validation production, enkripsi AES-256-GCM untuk identifier, blind index, quarantine file, pemeriksaan magic bytes, scanner ClamAV wajib di production, audit log redacted, dan request correlation ID.

## Hasil review dan tindakan

| Area | Risiko | Kontrol/bukti | Status |
|---|---|---|---|
| Authentication | brute force, hash lama | rate limit, lock 5 percobaan/30 menit, bcrypt cost minimum 12 dan rehash saat login | Ditutup |
| Admin sensitive actions | pencurian password | TOTP MFA; `REQUIRE_ADMIN_MFA=true` diwajibkan saat production | Ditutup |
| Session | token reuse | access token 15 menit, refresh rotation/family revocation, server-side session revocation, MFA state pada session | Ditutup |
| Tenant isolation | IDOR/cross-school | tenant guard dan scope query school/organization; suite negative cross-tenant | Ditutup |
| Upload | MIME spoof, traversal, malware, oversized object | strict extension/MIME/size, HEAD-object reconciliation, random tenant key, quarantine, magic bytes, active-content checks, ClamAV, clean-only signed download | Ditutup |
| SSRF | private/metadata access | URL hanya disimpan dan tidak di-fetch server; parser menolak protocol non-HTTP(S), credential, localhost/private/link-local/metadata/IPv6, dan platform host mismatch | Ditutup |
| Injection | SQL/CSV/XSS | Prisma parameterization, DTO whitelist, formula-safe CSV, React escaping, no raw HTML pada alur materi | Ditutup |
| Secrets | credential default/bocor | production boot fails on missing/placeholder/short secrets; logs/body audit redacted | Ditutup |
| Observability | incident tidak terlihat | structured request logs, request ID, p50/p95/error rate, queue/job/upload/dead-letter health dan threshold alerts | Ditutup |
| Supply chain | dependency/container CVE | lockfile `npm ci`, audit high, non-root images, Trivy high/critical in CI | Ditutup |

## Residual risk dan syarat go-live

- ClamAV atau scanner malware terkelola harus tersedia dari jaringan worker; bila tidak tersedia file berstatus `FAILED` dan tidak dapat diakses.
- TLS termination, WAF, secret manager, database encryption-at-rest, bucket versioning, dan alert routing bergantung pada platform deployment dan harus dibuktikan pada checklist staging.
- Trivy dan `npm audit` harus hijau pada commit yang dirilis; exception CVE harus memiliki owner dan tanggal kedaluwarsa.
- Recovery codes MFA belum tersedia. Prosedur pemulihan dilakukan admin terotorisasi dengan verifikasi identitas dan audit log; recovery codes menjadi peningkatan lanjutan.

## Perintah verifikasi

`npm run verify`, `npm audit --audit-level=high`, lalu build dan scan kedua image sesuai workflow CI. Uji abuse upload memakai test EICAR hanya di environment terisolasi; jangan mengunggah malware nyata.
