# Threat model

## Aset dan batas kepercayaan

Aset paling sensitif adalah NIK/NISN, dokumen identitas, hubungan siswa-orang tua, nilai, bukti tugas, sesi, dan laporan. Batas kepercayaan berada antara browser–BFF Next.js, BFF–API, API/worker–PostgreSQL/Redis/object storage, serta worker–scanner malware/provider notifikasi.

## Ancaman prioritas

| Ancaman | Jalur serangan | Mitigasi | Uji |
|---|---|---|---|
| Cross-tenant data access | mengganti organization/school/resource ID | scope server dari sesi, TenantGuard, query `findFirst` ber-school/org, permission guard | `tenant.guard.spec.ts`, `student-store.service.spec.ts` |
| Credential stuffing | login berulang | rate limit Redis, account lock, pesan generik, bcrypt 12 | auth/security tests dan monitoring 4xx |
| Session theft/reuse | refresh token bocor | HttpOnly cookies, short access token, hash refresh token, rotation and family revoke | integration auth suite |
| Malicious upload | spoofed MIME, EICAR, active PDF, oversized file | metadata reconciliation, quarantine, magic-byte and active-content inspection, ClamAV, signed clean downloads | `file-security.utils.spec.ts` |
| SSRF | store URL menuju metadata/private network | aplikasi tidak melakukan server fetch; strict normalization/allowlist | `store-url.util.spec.ts` |
| Sensitive logging | secret/identifier tertulis ke log | field-only audit, case-insensitive redaction, no body/query structured HTTP log | `security.utils.spec.ts`, audit interceptor test |
| Privileged account takeover | password admin bocor | TOTP and sensitive-action enforcement | `totp.util.spec.ts`, permissions guard behavior |
| Queue poisoning | job lintas tenant | tenant envelope pada job, resource re-check dari DB, worker concurrency caps/retry | queue and service tests |
| Backup theft/corruption | dump dicuri/diubah | AES-256 backup encryption, PBKDF2, SHA-256 checksum, restrictive permissions | restore drill |

## Asumsi eksplisit

- Database, Redis, object storage, dan ClamAV tidak diekspos ke internet publik.
- TLS 1.2+ dihentikan pada load balancer terpercaya; `TRUST_PROXY` hanya diisi dengan hop/CIDR yang benar.
- Production memakai secret manager, bukan `.env` di image.
- URL toko tidak pernah di-fetch oleh API. Jika preview URL ditambahkan kelak, wajib memakai egress proxy terisolasi, resolusi DNS berulang, redirect limit, timeout, dan response-size limit.

Review ulang threat model saat ada provider baru, upload type baru, fetch URL server-side, perubahan tenancy, atau akses publik baru.
