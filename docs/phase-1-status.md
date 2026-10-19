# Sunrise Academy — Status Implementasi

Pembaruan: 27 Agustus 2026
Acuan: `Master_Prompt_Sunrise_Digital_Inklusif.md`

## Status ringkas

| Fase | Status | Hasil utama |
|---|---|---|
| Fase 1 — Fondasi | Selesai untuk local development | Auth server-side, RBAC/tenant, CSRF, Redis, queue/worker, storage privat, access plan/entitlement, commerce foundation, health, OpenAPI, CI, build dan test |
| Fase 2 — Pengguna & Master Data | Selesai | Invitation satu kali, lifecycle pengguna, siswa/guru/orang tua, kelas/tahun ajaran/enrollment, relasi wali, import async, search/filter/pagination |
| Fase 3 — Identitas & Consent | Implementasi inti selesai | Identifier terenkripsi + blind index, quarantine upload, file security scan dasar, private signed access, verification review, consent versioning, data subject request |
| Fase 4 — LMS Inti | Implementasi inti selesai | Program/course/module/lesson, enrollment/progress, materi, lima jenis tugas, rubrik, submission versioning, review/nilai, dan alur Student Store |
| Fase 5 — Affiliate | Implementasi inti selesai | Akun publik, konten berversi, produk/campaign/bukti, review rubrik, snapshot metrik historis, verifikasi/flag, impor CSV/XLSX async, adapter API, dan dashboard peran |
| Fase 6 — Monitoring | Implementasi inti selesai | Dashboard lima audiens, early warning suportif, report/export async, histori affiliate, dan statistik publik berpersetujuan |
| Fase 7+ | Belum dikerjakan | Mengikuti urutan event, integrasi, hardening, dan fase lanjutan pada master prompt |

## Fase 1 — Fondasi

- Monorepo Next.js + NestJS + Prisma/PostgreSQL.
- Redis dipakai untuk rate limiting dan BullMQ.
- Worker terpisah untuk healthcheck, import siswa, dan scan dokumen.
- MinIO/S3 adapter dengan bucket terpisah: public media, learning private, submission, identity private, export, dan quarantine.
- Access token singkat dan opaque refresh token yang disimpan dalam bentuk hash.
- Refresh rotation, reuse detection, session family revocation, logout, logout semua perangkat, serta reset kata sandi.
- Cookie HttpOnly melalui BFF, CSRF double-submit, Helmet/CSP, CORS allowlist, request ID, dan error envelope konsisten.
- Permission guard dan tenant guard diterapkan pada domain yang tersedia; test penolakan lintas sekolah/organisasi lulus.
- Swagger/OpenAPI, readiness PostgreSQL/Redis/object storage, Dockerfiles non-root, CI, backup/restore script, dan runbook tersedia.
- Paket canonical `FREE`, `MEDIUM`, dan `ADVANCED` memiliki batas modul 8/10/12 serta katalog entitlement terpusat.
- Resolver paket mengikuti prioritas user, class/program, school, organization, lalu default FREE; grant expired/revoked/future tidak ikut dihitung.
- Redis cache entitlement memakai key tenant/user dan invalidasi organisasi setelah access grant berubah, dengan TTL/fallback aman saat Redis tidak tersedia.
- Fondasi commerce menyimpan offer, harga efektif, immutable order-item price snapshot, beneficiary, payment attempt, invoice, dan billing audit.
- Endpoint publik paket dan halaman `/paket` membaca harga serta durasi dari database; data palsu tidak ditampilkan ketika API belum tersedia.
- Migration `20260827120000_phase1_access_commerce_foundation` berhasil diterapkan; schema database up-to-date dan seed sintetis lulus dua kali berturut-turut.

Catatan operasional: provider email transaksi, MFA, alerting produksi, tracing eksternal, dan secret manager tetap harus dipasang sebelum go-live. Hal tersebut merupakan hardening/deployment, bukan simulasi di UI.

## Fase 2 — Pengguna & Master Data

- Admin pusat dan admin sekolah dapat bekerja dalam scope tenant yang telah diverifikasi.
- Undangan memiliki token satu kali yang di-hash, masa berlaku 48 jam, revoke, dan activation flow.
- Pendaftaran publik akun dimatikan secara default; pengguna sekolah masuk melalui undangan/import.
- Lifecycle `DRAFT`, `PENDING_ACTIVATION`, `ACTIVE`, nonaktif/locked/deactivated/archive tersedia.
- Siswa, guru, orang tua, tahun ajaran, semester, kelas, enrollment historis, dan teacher assignment tersedia.
- Relasi orang tua-anak memiliki status verifikasi, jenis akses, effective date, verifier, dan revoke date.
- Import CSV siswa diproses asynchronous per chunk 200, maksimal 10.000 baris, dengan progress dan error per baris.
- Master Data memiliki pencarian, filter status/kelas, dan pagination server-side.
- Permission matrix dan cross-tenant guard memiliki test otomatis.

## Fase 3 — Identitas & Consent

- NIK/NISN pada alur aktif disimpan sebagai AES-256-GCM ciphertext dan HMAC blind index untuk exact duplicate check.
- Nilai identifier tidak dikirim ke daftar admin; UI hanya menerima nilai termasking.
- Kolom NISN lama dipertahankan sementara dalam keadaan kosong untuk strategi migrasi dua tahap; penulisan baru diarahkan ke `student_identifiers`.
- Upload memakai pre-signed URL lima menit ke bucket quarantine. File dibatasi 8 MB dan hanya JPG/PNG/PDF.
- Worker memeriksa ukuran, magic signature, MIME consistency, pola script, dan EICAR test signature sebelum memindahkan file ke bucket identitas privat.
- Hanya file berstatus `CLEAN` yang masuk antrean verifier.
- Akses verifier memakai authorization ulang, signed URL 90 detik, `Content-Disposition: attachment`, dan audit sensitif.
- Keputusan valid/tolak/perbaikan menyimpan reviewer, reason code, notes, timestamp, dan riwayat review terpisah.
- Consent memiliki tipe, versi dokumen, actor, method, effective/granted/withdrawn time, evidence, dan histori yang tidak dihapus.
- Consent wali hanya dapat diberikan akun orang tua dengan relasi anak terverifikasi. Publikasi siswa di bawah 18 tahun juga memerlukan wali.
- Penarikan consent otomatis membuat workflow data subject request.
- Permintaan akses, koreksi, penghapusan sesuai retensi, pembatasan, export aman, dan penarikan consent tersedia dengan tenggat dan status penanganan.

Scanner lokal adalah baseline deterministik untuk development. Production wajib menghubungkan engine malware khusus seperti ClamAV/commercial scanner, image transcoding/EXIF stripping, dan alerting quarantine sebelum dinyatakan siap menerima dokumen nyata.

## Fase 4 — LMS Inti & Student Store

- Guru dapat menyusun program, course, modul, lesson, materi, dan enrollment kelas; siswa hanya melihat course yang memiliki enrollment aktif.
- Progres lesson disimpan per siswa dengan status, persentase, posisi terakhir, dan waktu selesai.
- Tugas mendukung `AFFILIATE`, `STORE`, `WRITTEN`, `PROJECT`, dan `QUIZ`, termasuk draf/publikasi, deadline, rubrik, dan checklist toko.
- Rubrik dan checklist memiliki builder berbobot; total bobot wajib tepat 100%.
- Submission umum dan Student Store mempertahankan versi immutable, riwayat review, feedback, status revisi/resubmission, nilai, waktu publikasi, dan penguncian setelah persetujuan.
- Form Student Store memakai enam langkah pada mobile, URL publik terstruktur, data produk, checklist configurable, catatan/kendala, deklarasi keamanan, preview, dan pemulihan draft otomatis dari penyimpanan perangkat.
- Bukti toko mendukung beberapa file JPG/PNG/WebP/PDF/MP4 maksimal 20 MB per file melalui quarantine, magic-signature/MIME check, baseline malware scan, checksum, private storage, signed access singkat, serta hapus/ganti selama draf. Gambar dirotasi sesuai orientasi, ditranscode/kompres, dan disimpan ulang tanpa metadata EXIF.
- URL menolak credential, protokol selain HTTP(S), host internal/privat, dan domain yang tidak sesuai platform. Query dan fragment dihapus saat normalisasi.
- Duplikasi URL, ID publik toko, dan checksum file membuat fraud flag dengan reason/evidence/confidence untuk pemeriksaan manusia; flag tidak otomatis menghukum dan dapat diselesaikan reviewer dengan catatan.

Thumbnail, resumable multipart untuk video, bulk reminder, dan scanner malware produksi tetap termasuk hardening lanjutan sebelum go-live.

## Fase 5 — Affiliate

- Siswa dapat mendaftarkan akun affiliate publik per platform tanpa password, OTP, cookie, token pribadi, atau credential marketplace. Akun memiliki status verifikasi, reviewer, catatan, dan waktu pemeriksaan.
- Platform aktif mencakup TikTok, Shopee Video, Instagram Reels, dan YouTube Shorts. URL dinormalisasi, tracking parameter dibuang, domain harus sesuai platform, serta URL/ID konten duplikat ditolak.
- Submission affiliate menyimpan akun, URL/ID konten, waktu publikasi, produk/URL produk, campaign, caption, hook, bukti publikasi, bukti insight, catatan siswa, deklarasi kepemilikan, dan disclosure iklan.
- Setiap revisi membuat `affiliate_content_versions` dan `submission_versions` immutable; versi lama tidak ditimpa. Alur draf, submit, revision, resubmit, review rubrik, feedback, nilai, publish, dan lock memakai infrastruktur Fase 4.
- Snapshot metrik append-only menyimpan tenant/siswa/konten/akun/platform, source, import job, captured/period time, raw/normalized values, currency, evidence, creator, status verifikasi, reviewer, dan correction link.
- Views, likes, comments, shares, clicks, orders, units, refund, GMV, dan commission tersedia. CTR, conversion rate, average order value, dan commission rate dihitung server-side dengan denominator nol menghasilkan 0.
- Flag kualitas mencakup clicks melebihi views, orders melebihi clicks, GMV tanpa order, commission tanpa GMV, rate komisi tidak wajar, evidence hilang, timestamp duplikat, metrik kumulatif menurun, dan perubahan ekstrem. Flag tidak menghukum otomatis; reviewer harus menyelesaikan dengan catatan.
- Verifikasi akun, snapshot, dan flag memiliki antrean guru, keputusan manusia, riwayat verification terpisah, serta scope sekolah.
- Impor CSV/XLSX dibaca dari UI dan diproses BullMQ secara asinkron dengan progress serta error per baris. Snapshot hasil impor tetap masuk antrean verifikasi.
- Adapter provider mendefinisikan capability OAuth/API resmi per platform. Saat ini belum ada koneksi resmi yang diaktifkan; sistem memakai manual/import dan tidak melakukan scraping.
- Dashboard siswa menampilkan akun, tugas, versi/status/feedback, KPI, dan histori snapshot. Dashboard guru menampilkan review akademik, akun, metrik, flag, serta impor.

Integrasi OAuth/API platform tetap bergantung pada akses resmi dari masing-masing provider dan secret manager deployment. Sistem sengaja tidak meminta credential pribadi atau memakai scraping sebagai pengganti integrasi resmi.

## Fase 6 — Monitoring

- Dashboard terpadu menggunakan data aktual dan menyesuaikan isi untuk siswa, guru, orang tua, sekolah, serta program/pusat. Setiap tampilan menyertakan periode, waktu pembaruan, zona waktu, definisi metrik, loading, empty, dan error state.
- Ruang lingkup data mengikuti tenant dan peran. Siswa hanya melihat dirinya, orang tua hanya melihat anak dengan relasi aktif yang sudah terverifikasi, guru/sekolah melihat sekolahnya, dan program manager dapat melihat agregat organisasinya.
- KPI mencakup siswa aktif, progres belajar, tugas/review, Student Store, affiliate, nilai terpublikasi, status import/verifikasi, serta tren snapshot affiliate historis.
- Early warning memiliki aturan tersimpan dan evaluasi untuk ketidakaktifan, tugas lewat tenggat, revisi berulang, metrik affiliate lama, dan flag kualitas data. Bahasa sinyal bersifat suportif; keputusan tetap dilakukan manusia.
- Petugas dapat menandai tindak lanjut, menyelesaikan, atau menutup sinyal dengan catatan. Riwayat tindakan disimpan append-only dan sinyal dapat terselesaikan otomatis saat indikator tidak lagi aktif.
- Report builder menyediakan lima laporan CSV dengan filter periode. Export diproses worker BullMQ, tersimpan pada bucket privat, memakai tautan unduh singkat, dan kedaluwarsa setelah 24 jam.
- Export menetralkan formula CSV serta mengecualikan dokumen identitas, credential, dan data sensitif. Siswa/orang tua hanya dapat membuat dan melihat export pada ruang lingkup masing-masing.
- Snapshot statistik publik memerlukan review eksplisit dan minimal 10 peserta. Endpoint serta landing page hanya menampilkan snapshot yang sudah disetujui dan lolos ambang privasi; keadaan kosong tidak memakai angka contoh.

Format XLSX, laporan PDF khusus, agregasi materialized untuk dataset besar, dan perluasan aturan early warning termasuk peningkatan lanjutan sebelum skala produksi besar.

## Bukti verifikasi terakhir

- 23/23 unit test keamanan, validasi URL, metrik affiliate, dan keamanan CSV lulus.
- API dan web lint/type-check lulus.
- API dan Next.js production build lulus.
- Prisma schema valid dan 13 migration sudah diterapkan.
- E2E API: upload quarantine → worker scan → private storage → verifier signed access → keputusan valid lulus.
- E2E privacy: empat dokumen consent, grant/withdrawal, dan data subject request lulus.
- Browser: Master Data search/filter/pagination, status identifier termasking, serta pusat privasi berhasil dirender.
- E2E Affiliate: akun → konten → submit → snapshot manual/flag → verifikasi → review rubrik/approve → impor async → histori dua snapshot lulus; siswa ditolak dari antrean verifier dengan HTTP 403.
- Browser Affiliate: dashboard siswa desktop/mobile, navigasi mobile, KPI/history, antrean guru, flag, dan status impor berhasil dirender tanpa console error.
- E2E Monitoring: dashboard admin, siswa, orang tua terverifikasi, dan guru lulus dengan scope yang sesuai; orang tua tanpa verifikasi menerima ruang lingkup kosong.
- E2E report: export admin selesai 3 baris dan export siswa selesai 1 baris melalui worker/object storage; tautan unduh privat memiliki masa berlaku.
- E2E early warning/statistik publik: tindak lanjut tersimpan, aturan dievaluasi, dan approval statistik cohort 3/10 ditolak sesuai ambang privasi.

Konten legal masih merupakan template dan wajib ditinjau penasihat hukum. Tidak ada klaim kepatuhan hukum final dalam implementasi.
