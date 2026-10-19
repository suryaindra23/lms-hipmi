# Fase 6 — Monitoring, Early Warning, dan Reporting

Pembaruan: 28 Agustus 2026
Acuan: `Master_Prompt_Sunrise_Digital_Inklusif (3).md`

## Status

Selesai untuk local development. Dashboard memakai data aktual dan scope tenant/peran, early warning bersifat rule-based dan suportif, statistik publik melalui approval, serta laporan dibuat asynchronous sebagai file privat dengan audit unduhan.

## Dashboard

- Dashboard lanjutan memerlukan entitlement `dashboards.advanced.read`; report/export memerlukan `reports.export` di API dan diperiksa ulang oleh worker.
- Scope siswa, orang tua, guru, sekolah, dan program ditentukan di backend. Guru hanya melihat siswa dari kelas/course aktif yang ditugaskan kepadanya; orang tua hanya melihat anak dari relasi verified yang masih efektif.
- Semua assignment, submission, Student Store, affiliate, import, identitas, dan warning mengikuti organisasi/sekolah serta scope siswa yang telah dihitung.
- Nilai hanya menghitung grade yang sudah dipublikasikan dan dinormalisasi terhadap nilai maksimum assignment.
- Agregat affiliate hanya memakai snapshot `VERIFIED` terbaru per konten yang belum memiliki correction. Tren harian mencegah snapshot kumulatif ganda pada hari yang sama.
- Dashboard menampilkan periode, zona waktu, definisi metrik, waktu pembaruan, serta loading/error/empty state.
- Dashboard program menyembunyikan identitas siswa dan menampilkan perbandingan sekolah secara alfabetis, tanpa leaderboard. Rasio aktif, progress, dan submission dinormalisasi terhadap cohort/kewajiban masing-masing sekolah.
- Legacy dashboard juga memakai tenant guard, course/class scope, feature entitlement, serta metrik affiliate terverifikasi.

## Early warning

- Rule tersimpan per organisasi/sekolah, dapat dinonaktifkan, dan threshold dibaca dari konfigurasi.
- Trigger mencakup undangan belum diaktifkan, tidak aktif, progress materi terhenti, deadline mendekat, tugas terlambat, draft lama, revisi berulang, nilai rendah berulang, bukti/URL Student Store belum lengkap, konten affiliate belum dipublikasikan/terverifikasi, metrik lama, dan data-quality flag terbuka.
- Sinyal melakukan upsert idempotent dan otomatis terselesaikan ketika kondisi tidak lagi terdeteksi.
- Perubahan status memerlukan catatan, mencatat aksi immutable, tidak dapat membuka ulang melalui endpoint tindakan, dan keputusan final tidak dapat ditimpa.
- Siswa/orang tua hanya menerima pesan suportif yang aman; evidence internal, petugas, action note, dan identitas aktor tidak dikirim.

## Reporting dan export

- Tersedia 15 jenis laporan: user/enrollment, aktivitas belajar, progress siswa/course, assignment/submission, nilai/rubrik, Student Store, review/revisi toko, konten affiliate, riwayat metrik affiliate, early warning, status identitas tanpa dokumen, consent, beban kerja guru, import, dan ringkasan audit.
- Laporan governance hanya tersedia untuk pengelola sekolah/program. Guru hanya melihat riwayat export miliknya sendiri.
- Filter periode, class, student scope, school scope, organisasi, dan timezone disimpan pada job.
- Worker memeriksa ulang user aktif, permission export, entitlement aktif, dan peran governance sebelum memproses.
- CSV dinetralisasi dari formula injection. Dokumen identitas, NIK/NISN penuh, credential, evidence internal, alamat jaringan, user-agent, dan detail audit sensitif tidak diekspor.
- File disimpan di object storage privat, URL unduh berlaku 120 detik, file kedaluwarsa setelah 24 jam, dan setiap permintaan unduh dicatat pada `export_download_events`.

## Statistik publik

- Snapshot hanya berisi agregat sekolah, periode, ukuran cohort, dan metrik yang telah dibatasi.
- Minimum cohort diperiksa sebelum persetujuan.
- Pembuat snapshot tidak dapat menyetujui snapshot sendiri, penolakan memerlukan catatan, dan keputusan final tidak dapat ditimpa.
- Endpoint publik hanya mengembalikan statistik yang sudah disetujui, dipublikasikan, dan memenuhi minimum cohort.

## Migration

- `20260828120000_phase6_monitoring_hardening`
  - Menambahkan audit immutable untuk setiap akses unduhan export.
- `20260828130000_phase6_report_catalog`
  - Memperluas katalog enum laporan sesuai kebutuhan monitoring dan governance.

## Bukti verifikasi lokal

- Seluruh 23 migration berhasil diterapkan dan schema database up-to-date.
- 86 automated test lulus, termasuk package boundary, teacher export scope, governance report restriction, audit download, maker-checker statistik publik, redaksi warning keluarga, final-decision lock, CSV formula injection, dan tenant isolation.
- Type-check API, lint web, validasi Prisma, format check, build API, dan production build Next.js lulus.
- Smoke test lokal lulus: health API menyatakan database, Redis, dan object storage dapat dijangkau; endpoint statistik publik dan halaman paket merespons HTTP 200.

## Batas kesiapan produksi

- Export tabular saat ini menggunakan CSV. XLSX dan PDF ringkasan sebaiknya ditambahkan sebagai renderer terpisah hanya untuk layout yang sudah disetujui, dengan perlindungan formula yang setara.
- Materialized view belum ditambahkan karena query lokal belum menunjukkan bottleneck. Tambahkan berdasarkan hasil load test dan ukur freshness/refresh locking sebelum production.
- Uji beban dashboard lintas sekolah, export puluhan ribu baris, worker retry/failover, object-storage lifecycle, serta restore audit perlu dijalankan pada staging production-like.
- System health teknis tetap berada pada observability internal dan tidak dicampurkan dengan data program; ringkasan aman untuk dashboard pusat dapat ditambahkan setelah definisi indikator dan permission operasi disepakati.
