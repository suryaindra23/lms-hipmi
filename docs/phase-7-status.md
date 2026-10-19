# Status Fase 7 — Pengalaman Pendukung

## Selesai

- Notifikasi dalam aplikasi, preferensi kanal, jam tenang, digest, idempotensi, log pengiriman, retry, dan dead-letter.
- Pengumuman bertarget dengan alur draf dan publikasi.
- Template, pemeriksaan kelayakan, penerbitan PDF asinkron, unduhan privat, verifikasi publik, persetujuan publikasi, dan pencabutan sertifikat.
- Pencapaian/badge dan pemberian pencapaian kepada siswa.
- Portofolio dari karya yang sudah disetujui, dengan publikasi opt-in berbasis persetujuan.
- Helpdesk dengan nomor tiket, kategori, prioritas, SLA, percakapan, catatan internal, redaksi data sensitif, status, resolusi, dan kepuasan.
- CMS untuk FAQ, testimoni, studi kasus, mitra, dan halaman; konten terbit tampil dinamis di landing page.
- Lead management untuk melihat pendaftar dan memperbarui status tindak lanjut.
- PWA dengan manifest, ikon, halaman offline, status koneksi, prompt instalasi, dan cache aman hanya untuk halaman publik.
- Draf Student Store tersimpan lokal dan tersinkron lintas perangkat dengan deteksi konflik versi.
- Dark mode, SEO/Open Graph, structured data, dan analitik berbasis persetujuan.
- Event notifikasi untuk tugas baru, submission masuk, hasil review/revisi, pengumuman, sertifikat, pencapaian, dan helpdesk.

## Batas keamanan yang disengaja

- Dashboard, API, halaman autentikasi, dan data identitas tidak dimasukkan ke cache service worker.
- Email, WhatsApp, dan SMS berstatus nonaktif sampai adapter penyedia resmi tersedia; job tidak memalsukan status terkirim.
- Verifikasi publik menampilkan identitas siswa hanya ketika publikasi dan persetujuan aktif.
- Lampiran helpdesk belum dibuka di UI sebelum alur karantina dan pemindaian antivirus khusus helpdesk tersedia. Tiket dan percakapan sudah privat sesuai tenant.

## Pemeriksaan

- Prisma migration dan client generation.
- Type-check API.
- ESLint web.
- Unit test utilitas notifikasi/redaksi/helpdesk.
- Build produksi API dan web.
- Uji alur per peran melalui browser lokal.
