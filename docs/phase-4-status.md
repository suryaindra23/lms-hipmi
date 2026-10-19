# Fase 4 — LMS Inti dan Student Store

Pembaruan: 28 Agustus 2026
Acuan: `Master_Prompt_Sunrise_Digital_Inklusif (3).md`

## Status

Selesai untuk local development. Implementasi LMS inti dan Student Store kini memakai pemeriksaan tenant, permission, effective entitlement, enrollment, modul terbit, dan periode tugas secara berlapis. Enrollment saja tidak lagi membuka assignment atau submission.

## Hasil implementasi

- Course memiliki modul dan lesson berurutan; tree siswa membedakan modul terbuka dan terkunci berdasarkan batas 8/10/12 serta `minimum_plan`.
- UI siswa menampilkan alasan lock dan CTA ke katalog paket berbasis data. Paket Gratis tidak menampilkan assignment/rubrik/submission.
- Materi siswa hanya dikembalikan jika terhubung ke lesson dan modul terbit yang termasuk paket aktif. Materi tanpa lesson tidak lagi menjadi jalur bypass.
- Setiap assignment wajib terhubung ke satu modul pada course yang sama. Assignment terbit pada modul draft ditolak.
- Daftar, detail, draf, submit, resubmit, rubrik, review, dan nilai memeriksa entitlement fitur sekaligus akses modul.
- Assignment standar memerlukan entitlement Medium/Advanced; Student Store dan Affiliate memerlukan Advanced. Pemeriksaan juga berlaku pada antrean guru/reviewer sesuai paket sekolah/pengguna.
- Perubahan assignment menghasilkan snapshot immutable pada `assignment_versions`; penghapusan API mengarsipkan assignment dan mempertahankan submission historis.
- Submission generik menyimpan versi immutable. Resubmission ditolak sampai siswa menyimpan versi baru setelah permintaan revisi.
- Submission kosong tidak dapat dikirim. Open date dan deadline diperiksa kembali saat menyimpan, menambahkan konten, mengunggah bukti toko, dan submit final.
- Nilai/review draft tidak terlihat oleh siswa. Review tanpa `publishGrade` mempertahankan status `UNDER_REVIEW`, tidak menulis nilai/feedback publik, dan tidak mengirim notifikasi hasil.
- Student Store mempertahankan form terstruktur, URL ternormalisasi, checklist berbobot 100%, minimum produk, autosave/offline draft, optimistic row version, multi-file privat, scanning, sanitasi gambar, signed URL singkat, versioning, review/revisi, rubric, serta duplicate/fraud flag.
- File Student Store hanya dapat diakses setelah status scan `CLEAN`; akses siswa memeriksa ulang assignment dan entitlement. Pencarian duplikat file/URL dibatasi ke sekolah yang sama agar tidak menjadi oracle lintas tenant.
- Platform toko mencakup Shopee, TikTok, Tokopedia, Lazada, Instagram Shop, WhatsApp Business, website mandiri, dan platform lain.
- Detail Student Store milik siswa menyembunyikan fraud flag internal dan review yang belum dipublikasikan.
- Controller LMS, assignment, submission, rubric, dan Student Store memakai tenant guard selain permission guard.

## Migration

- `20260828100000_phase4_entitlement_workflows`
  - Menambahkan `assignments.moduleId` dengan backfill aman.
  - Menambahkan foreign key/index modul assignment.
  - Menambahkan `assignment_versions` dan snapshot awal data legacy.
- `20260828101000_phase4_store_platforms`
  - Menambahkan platform Student Store yang diwajibkan produk.

## Bukti verifikasi lokal

- Seluruh 20 migration berhasil diterapkan dan schema database up-to-date.
- 71 automated test lulus, termasuk negative test package scoping, tenant isolation, unpublished grade, draft write setelah entitlement dicabut, serta sanitasi detail Student Store.
- E2E Paket Gratis:
  - materi belajar `200`;
  - assignment list kosong;
  - detail assignment langsung `403`;
  - rubric `403`;
  - Student Store `403`;
  - Affiliate workspace `403`.
- E2E grant sekolah Advanced sementara:
  - assignment, submission, rubric, Student Store, Affiliate, dan review queue siswa/guru seluruhnya `200` sesuai permission;
  - grant sintetis dibersihkan setelah pengujian dan tidak meninggalkan data akses aktif.
- Health lokal menyatakan PostgreSQL, Redis, dan object storage reachable.

## Batas kesiapan produksi

- Generic submission saat ini mendukung teks dan URL referensi. File sensitif generik tidak boleh memakai URL publik; pipeline upload privat terkelola seperti Student Store perlu ditambahkan sebelum tipe upload-file generik diaktifkan untuk production.
- Materi berupa URL eksternal harus memakai sumber yang disetujui. PDF/video privat membutuhkan pipeline object/video storage dan signed playback khusus sebelum production.
- Scanner malware production, bucket lifecycle, backup/restore, concurrency test upload/submit, serta uji browser/perangkat tetap harus dibuktikan pada staging production-like.
- Reviewer allocation, moderation berlapis, late-policy configurable, max-attempt policy, dan prerequisite akademik belum diaktifkan sebagai workflow configurable; struktur saat ini menggunakan reviewer guru pemilik assignment dan deadline ketat.
