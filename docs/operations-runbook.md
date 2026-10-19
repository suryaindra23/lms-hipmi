# Runbook Operasional — Fase 8

## Health dan readiness

- `GET /api/v1/health/live` memastikan proses API hidup.
- `GET /api/v1/health/ready` memeriksa PostgreSQL, Redis, dan object storage.
- Instance tidak boleh menerima trafik baru apabila readiness gagal.
- `GET /api/v1/operations/overview` (permission `monitoring:read`) menampilkan p50/p95, API error rate, queue depth, job/upload failure, dead letter, dan alert aktif.

Ambang default: error API 5%, p95 1.5 detik, backlog 100. `CRITICAL` membuka insiden dan menghentikan rollout; `WARNING` harus diakui on-call. Dashboard ini bersifat per-instance, sehingga deployment multi-replica harus mengagregasi structured log/metrics pada platform monitoring.

## Backup dan restore

Jalankan `scripts/backup-postgres.sh` melalui scheduler deployment dengan `DATABASE_URL`, `SUNRISE_BACKUP_ENCRYPTION_KEY`, dan credential backup least-privilege. Script menghasilkan dump terenkripsi AES-256/PBKDF2 dan checksum SHA-256 dengan permission privat. Simpan salinan immutable di region/account berbeda. Baseline retention: 30 harian dan 12 bulanan; legal owner dapat memperketatnya.

Restore wajib dilakukan ke environment terisolasi terlebih dahulu. Tetapkan `SUNRISE_ALLOW_RESTORE=true`, kunci backup, dan file eksplisit ke `scripts/restore-postgres.sh`; script menolak checksum yang hilang/rusak. Production juga memerlukan `SUNRISE_ALLOW_PRODUCTION_RESTORE=true`, change approval, dan maintenance window. Setelah restore, verifikasi migration status, jumlah organisasi/sekolah/siswa/submission/audit, login sintetis, tenant isolation, signed file access, serta queue health sebelum traffic dipulihkan.

Asumsi awal yang harus disahkan deployment owner:

- RPO: 24 jam.
- RTO: 4 jam.
- Restore drill: minimal setiap tiga bulan.

Catat waktu backup terakhir, umur backup, hasil checksum, durasi restore, data-loss window, dan sign-off. Kegagalan dua backup berturut-turut atau backup lebih tua dari RPO adalah insiden kritis.

## Incident dasar

1. Hentikan perubahan data bila integritas atau isolasi tenant diragukan.
2. Simpan request ID, waktu, endpoint, tenant, dan outcome tanpa menyalin PII sensitif.
3. Cabut sesi terdampak melalui logout-all atau database session revocation.
4. Rotasi secret bila terdapat indikasi kebocoran.
5. Pulihkan dari backup terverifikasi bila diperlukan.
6. Dokumentasikan akar masalah, dampak, pemulihan, dan tindakan pencegahan.

Severity: SEV-1 untuk kebocoran/cross-tenant, kehilangan data, auth bypass, atau outage total; SEV-2 untuk degradasi utama/backlog tanpa kehilangan data; SEV-3 untuk gangguan terbatas. Incident commander menentukan komunikasi. Jangan menyalin PII ke chat/tiket; gunakan request ID dan identifier internal.

## Queue dan file

- Job harus membawa organization/school context, idempotency key, retry, dan failure reason.
- Bucket privat dipisahkan untuk materi, submission, identitas, export, serta quarantine.
- Berkas di quarantine belum boleh diakses pengguna sampai workflow scanning menyatakan aman.
- Worker scan memeriksa ukuran, MIME/magic signature, EICAR, dan active content. Production wajib `MALWARE_SCANNER_REQUIRED=true` dengan ClamAV/engine kompatibel; scanner unavailable menghasilkan `FAILED`, bukan fail-open.
- File identitas bersih hanya diakses dengan signed URL maksimum 90 detik; akses harus muncul sebagai `ACCESS_IDENTITY_DOCUMENT` pada audit log.
- Pantau backlog `student-import` dan `identity-scan`, retry exhaustion, serta job yang berhenti di `PROCESSING`/`PENDING`.

## Alert response

- `HTTP_ERROR_RATE`: cek deployment terakhir, log 5xx via request ID, DB/Redis/storage readiness; rollback image bila regresi aplikasi.
- `HTTP_LATENCY`: cek DB pool/slow query, CPU/memory, downstream storage, lalu batasi traffic berat.
- `QUEUE_BACKLOG`: pastikan worker hidup, periksa failed job dan dependency, tambah concurrency hanya setelah DB capacity aman.
- `DEAD_LETTER`: periksa provider, credential, rate quota, dan reason; replay hanya job idempotent setelah akar masalah tertutup.
- Upload `INFECTED`: biarkan objek terhapus/terisolasi, jangan download untuk inspeksi manual; review akun dan pola berulang.

## Privasi dan hak subjek data

- Tinjau antrean `data_subject_requests` setiap hari dan prioritaskan request mendekati `dueAt`.
- Status akhir `REJECTED` atau `COMPLETED` wajib memiliki resolusi.
- Penarikan consent tidak menghapus histori; sistem membuat request tindak lanjut untuk pembatasan/penghentian workflow terkait.
- Export tidak boleh memuat ciphertext, blind index, NIK/NISN mentah, storage key, atau dokumen identitas tanpa workflow khusus dan approval.
