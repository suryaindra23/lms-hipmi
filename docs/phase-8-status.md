# Fase 8 — Hardening status

Tanggal: 6 Agustus 2026.

## Implemented

- Security/threat/privacy reviews and production deployment checklist.
- bcrypt cost 12 with opportunistic rehash, brute-force controls, TOTP MFA for sensitive admin actions.
- Tenant isolation negative tests for org, school, student submission, teacher file access.
- Upload metadata reconciliation, quarantine, magic-byte/active-content inspection, optional local checks and mandatory production ClamAV.
- SSRF regression suite for private/link-local/metadata/numeric/IPv6/protocol vectors; server never fetches store URLs.
- Case-insensitive sensitive-field redaction and mutation audit success/failure with actor, tenant, request ID, route, outcome.
- Structured HTTP logs, p50/p95/error rate, queue stats, job/upload/dead-letter counters, threshold alerts at `GET /api/v1/operations/overview`.
- Encrypted PostgreSQL backup, checksum verification, guarded restore, and documented RPO/RTO.
- k6 harness for dashboard, concurrent submission, and 50,000 synthetic-student baseline.
- Local isolated 50,003-student read baseline: 100 requests at concurrency 20, p50 151.65 ms, p95 253.39 ms, p99 304.77 ms, zero errors.
- Encrypted backup/restore drill passed: source and restored counts matched for users, students, audit logs, and all 15 migrations.
- CI migration/lint/test/build/audit plus non-root image build and Trivy scan.
- Accessibility/browser/SEO matrix and deployment/runbook documentation.
- Local production Lighthouse: Performance 97, Accessibility 100, Best Practices 96 (API lokal tidak aktif), SEO 100; mobile 320 px tanpa overflow.

## External staging evidence required before production

- Production-like staging repeat of the measured 50,000-row baseline, including mutation/upload, queue, database connection, and infrastructure metrics.
- Real-device/browser matrix checks (Safari, Firefox, iOS, and Android).
- ClamAV/provider connectivity and EICAR test.
- Alert delivery to the chosen on-call channel.
- Object storage versioning/lifecycle proof and encrypted restore drill on staging.

These are environment acceptance checks, not missing application code. Production remains blocked until the evidence is attached to the release record.
