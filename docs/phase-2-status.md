# Fase 2 — Pengguna dan Master Data

Pembaruan: 27 Agustus 2026
Acuan: `Master_Prompt_Sunrise_Digital_Inklusif (3).md`

## Status

Selesai untuk local development. Fase ini menyediakan lifecycle pengguna dan undangan, data siswa/guru/orang tua, tahun ajaran/semester/kelas, enrollment historis, penugasan guru, relasi wali, serta impor siswa asinkron.

## Hasil implementasi

- Daftar dan detail pengguna selalu dibatasi organisasi serta sekolah terpilih. Hanya akun dengan mandat organisasi yang dapat bekerja tanpa memilih sekolah.
- Perubahan status pengguna memakai scope yang sama dan otomatis mencabut sesi saat akun dinonaktifkan.
- Undangan memiliki token acak satu kali yang disimpan sebagai hash, masa berlaku 48 jam, revoke, dan aktivasi akun.
- Admin sekolah tidak dapat memberikan peran tingkat organisasi. Aktivasi menolak perpindahan profil siswa/guru secara terselubung ke sekolah lain.
- Master Data memiliki pencarian, filter status/kelas, pagination server-side, dan hitungan total dari database, bukan panjang sampel daftar.
- Mutasi guru, wali, enrollment, penugasan guru, dan relasi wali memakai konteks sekolah yang telah diverifikasi.
- Pencabutan wali di satu sekolah tidak menonaktifkan akun wali yang masih memiliki relasi aktif di sekolah lain.
- Pembuatan dan perubahan siswa memvalidasi kepemilikan user, kelas, organisasi, dan sekolah. NISN wajib sepuluh digit bila diberikan.
- Impor siswa berjalan melalui BullMQ per chunk 200 dengan batas 10.000 baris, progress, dan error per baris.
- NISN dienkripsi sebelum baris import disimpan. Worker hanya mendekripsi di memori untuk blind index dan menghapus ciphertext dari payload setelah baris berhasil diproses.
- Daftar pengguna dan undangan mendukung pencarian, filter status, pagination, serta batas page size 100.

## Bukti verifikasi

- Type-check API lulus.
- 56 unit test lulus, termasuk negative test scope pengguna, delegasi peran undangan, validasi pagination/status siswa, dan staging NISN terenkripsi.
- API development berhasil restart tanpa error dan worker kembali siap memproses antrean.
- Tidak ada perubahan schema pada Fase 2 ini; migration baru tidak diperlukan.

## Batas kesiapan produksi

Pengiriman email transaksi, kebijakan retensi final, secret manager, monitoring antrean produksi, dan pengujian multi-sekolah pada staging tetap wajib sebelum go-live. Evaluasi entitlement untuk alokasi seat/class/program mengikuti implementasi commerce institusi dan tidak disimulasikan dalam Fase 2.
