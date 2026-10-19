# Checklist pilot Sunrise Academy

Gunakan checklist ini sebelum melibatkan satu sampai dua sekolah pilot. Bukti setiap butir disimpan bersama catatan rilis.

## Release dan data

- [ ] Semua perubahan aplikasi sudah direview dan masuk commit rilis.
- [ ] `npm run release:check` lulus pada commit yang akan dipasang.
- [ ] Migrasi dijalankan pada staging disposable, lalu pada staging utama.
- [ ] Seed/demo tidak dijalankan pada staging atau production.
- [ ] Backup terenkripsi terbaru tersedia dan restore drill staging lulus.

## Akses dan keamanan

- [ ] MFA aktif untuk Super Admin dan seluruh admin sekolah.
- [ ] Setiap admin memakai akun pribadi; tidak ada akun bersama.
- [ ] Hak akses Super Admin, Admin Sekolah, Guru, Siswa, dan Orang Tua diuji.
- [ ] ClamAV atau scanner terkelola aktif dan uji EICAR terisolasi lulus.
- [ ] HTTPS, HSTS, CORS, storage privat, versioning, dan lifecycle sudah dibuktikan.
- [ ] Alert error, antrean, storage, dan backup sampai ke kanal penanggung jawab.

## Pembayaran

- [ ] Rekening pembayaran berasal dari environment production.
- [ ] Admin menjalankan SOP pada `docs/payment-operations-sop.md`.
- [ ] Referensi transfer ganda dan self-approval ditolak saat pengujian.
- [ ] Rekonsiliasi harian memiliki penanggung jawab dan jalur eskalasi.
- [ ] Kebijakan refund, salah transfer, dan chargeback telah disetujui.

## UAT pengguna

- [ ] Desktop: Chrome, Safari, dan Firefox.
- [ ] Mobile: Android Chrome dan iOS Safari.
- [ ] Guru dapat memberi tugas, review, nilai, dan feedback.
- [ ] Siswa dapat membuka materi, melanjutkan progres, dan mengirim tugas.
- [ ] Admin sekolah hanya melihat sekolah yang ditugaskan.
- [ ] Orang tua hanya melihat anak dengan relasi aktif terverifikasi.
- [ ] Tampilan 320 px, keyboard, zoom 200%, dan pembaca layar diuji.

## Batas pilot

- Mulai dari satu sampai dua sekolah dengan jumlah peserta yang disepakati.
- Jangan menerima dokumen identitas nyata sebelum scanner, legal review, dan retensi data disetujui.
- Pantau error rate, waktu respons p95, antrean worker, kegagalan upload, tiket pengguna, dan selisih pembayaran setiap hari.
- Lanjutkan perluasan hanya setelah review pilot tertulis dan seluruh insiden kritis ditutup.
