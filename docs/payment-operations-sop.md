# SOP verifikasi pembayaran manual

Dokumen ini berlaku untuk pembayaran transfer bank per siswa pada Sunrise Academy. Akses tidak boleh diaktifkan hanya berdasarkan tangkapan layar dari pembeli.

## Pemisahan tugas

- Pembuat pesanan tidak boleh menyetujui pembayarannya sendiri.
- Admin pemeriksa harus memakai akun pribadi; akun bersama tidak diperbolehkan.
- Untuk nilai atau kasus yang meragukan, pemeriksa kedua wajib mengonfirmasi mutasi sebelum approval.

## Pemeriksaan sebelum approval

1. Cocokkan nomor pesanan, paket, siswa penerima, dan sekolah.
2. Periksa mutasi rekening secara langsung dari kanal bank resmi.
3. Cocokkan nominal tepat sampai kode unik, tanggal, dan nama pengirim bila tersedia.
4. Masukkan referensi mutasi yang stabil dan catatan pemeriksaan yang jelas.
5. Pastikan referensi tersebut belum pernah digunakan. Sistem menolak referensi yang sudah menyelesaikan pesanan lain.
6. Setujui hanya satu paket untuk satu siswa. Akses harus muncul pada akun siswa yang dipilih, bukan pada seluruh sekolah.

## Penolakan dan eskalasi

- Tolak dengan alasan yang dapat dipahami bila nominal tidak tepat, bukti tidak ditemukan, atau melewati batas waktu.
- Jangan mengubah pesanan gagal menjadi lunas secara manual melalui database.
- Selisih, pembayaran ganda, salah tujuan, refund, atau chargeback dicatat sebagai insiden keuangan dan diteruskan kepada penanggung jawab.

## Rekonsiliasi harian

- Bandingkan pesanan `PAID` dengan mutasi rekening dan `BillingAuditEvent` setiap hari operasional.
- Tinjau pesanan `PENDING_PAYMENT` yang mendekati kedaluwarsa dan pesanan `FAILED`.
- Laporkan pembayaran yang ada di mutasi tetapi tidak memiliki pesanan, tanpa meminta siswa membayar ulang sebelum pemeriksaan selesai.

## Larangan production

- Jangan memakai nilai rekening cadangan dari source code. Tiga variabel `PAYMENT_BANK_*` wajib tersedia di environment production.
- Jangan menjalankan seed akun demo atau memakai password demo.
- Refund dan chargeback belum otomatis; keduanya memerlukan prosedur dan persetujuan terpisah sebelum ditawarkan kepada pengguna.
