# Fase 5 — Affiliate

Pembaruan: 28 Agustus 2026
Acuan: `Master_Prompt_Sunrise_Digital_Inklusif (3).md`

## Status

Selesai untuk local development. Domain Affiliate kini mencakup akun publik, submission konten berversi, review akademik, snapshot metrik append-only, impor asinkron, verifikasi manusia, koreksi tertaut, dashboard, dan ekspor yang dibatasi paket Advanced.

## Hasil implementasi

- Seluruh endpoint akun, provider, workspace, konten, performa, antrean verifikasi, metric snapshot, import, flag, dan export memeriksa entitlement Advanced di API. Export juga memerlukan entitlement laporan.
- Worker impor memeriksa ulang entitlement saat job mulai diproses. Job antrean gagal aman dengan alasan `ENTITLEMENT_NOT_ACTIVE` jika grant sudah dicabut atau kedaluwarsa.
- Data akun hanya berupa profil publik. URL profil dinormalisasi sesuai allowlist platform; URL dengan kredensial ditolak.
- Keputusan verifikasi akun bersifat final dan memiliki riwayat immutable pada `affiliate_account_reviews`.
- Konten menyimpan akun, platform, URL/ID, waktu publikasi, produk, campaign, caption/hook, evidence, deklarasi, catatan, versi, review, dan nilai.
- URL konten dinormalisasi per platform. URL produk/evidence hanya menerima HTTP(S) publik tanpa kredensial, localhost, private IP, link-local, atau metadata host.
- Duplikasi URL/external ID dan ketidaksesuaian username akun menjadi fraud flag dalam scope sekolah. Submission tetap tersimpan dan tidak dihukum otomatis.
- Submit final mensyaratkan akun affiliate sudah diverifikasi. Draft tetap boleh disiapkan saat akun menunggu review.
- Alur konten mendukung draft, submit, review draft, grade publish, revision request, resubmit dengan versi baru, approval/rejection, dan lock. Review nilai yang belum dipublikasikan tidak terlihat oleh siswa.
- Keputusan akademik yang dipublikasikan menyelaraskan status verifikasi konten affiliate.
- Snapshot menyimpan raw value, normalized/derived metric, sumber, periode, currency, evidence, quality flags, creator, dan status verifikasi; nilai uang menggunakan Decimal.
- Validasi snapshot mencakup tanggal publikasi, waktu masa depan, urutan periode, timestamp duplikat, metrik kumulatif menurun, lonjakan ekstrem, evidence hilang, hubungan views/clicks/orders, refund, unit, GMV, dan commission.
- Flag konten wajib diselesaikan sebelum submission dapat disetujui; flag snapshot wajib diselesaikan sebelum snapshot dapat diverifikasi. Flag dan keputusan final tidak dapat diselesaikan/ditimpa ulang.
- Koreksi membuat superseding snapshot baru yang tertaut melalui `supersedesId`; snapshot asli tidak diubah atau dihapus. UI siswa menyediakan aksi Koreksi.
- Dashboard siswa tetap menampilkan riwayat snapshot, tetapi agregat finansial hanya memakai snapshot terverifikasi terbaru yang belum disupersede. Fraud flag, raw payload, dan catatan internal reviewer tidak dikirim ke siswa.
- Impor CSV/XLSX diparsing di UI, masuk antrean BullMQ, diproses per baris, dan menyimpan progress serta error per baris. Abstraksi provider menyatakan kemampuan OAuth/official metric sync tanpa scraping.

## Migration

- `20260828110000_phase5_affiliate_hardening`
  - Mengubah unique URL/external ID menjadi index non-unique agar duplikasi dapat direview manusia tanpa otomatis menolak siswa.
  - Menambahkan `affiliate_account_reviews` beserta foreign key dan index audit.

## Definisi metrik

- CTR = clicks / views × 100%.
- Conversion rate = orders / clicks × 100%.
- Average order value = GMV / orders.
- Commission rate = commission / GMV × 100%.
- Denominator nol menghasilkan 0, bukan error atau nilai tak terhingga.
- Ringkasan memakai snapshot terbaru yang berstatus `VERIFIED` dan belum memiliki correction; riwayat tetap append-only.

## Bukti verifikasi lokal

- Seluruh 21 migration berhasil diterapkan dan schema database up-to-date.
- 79 automated test lulus, termasuk entitlement Affiliate, audit keputusan akun, final-decision lock, unpublished review filter, approval block untuk flag terbuka, URL publik, ownership hint, serta quality flag refund/unit.
- Type-check API dan lint web lulus.
- Health API, web, dan katalog paket merespons normal.
- Browser lokal membuka aplikasi tanpa error console; halaman sensitif mengarahkan sesi tanpa autentikasi ke halaman login sebagaimana mestinya.

## Batas kesiapan produksi

- Adapter official API masih berupa capability abstraction; OAuth/token vault, provider-specific consent, webhook/sync cursor, rate limit, dan reconciliation perlu dibuat hanya ketika akses API resmi tersedia.
- Sistem tidak melakukan scraping dan tidak menyimpan password, OTP, cookie, atau token pribadi marketplace.
- Bukti saat ini berupa URL publik. Evidence file privat dengan checksum, malware scan, retention policy, dan signed URL perlu memakai pipeline object storage terkelola sebelum diwajibkan di production.
- Pemeriksaan apakah URL publik benar-benar dapat diakses belum melakukan outbound fetch agar tidak membuka jalur SSRF. Jika diperlukan, gunakan worker egress terisolasi dengan DNS/IP revalidation, redirect limit, content-type/size limit, dan audit.
- Uji beban impor 10.000 baris, concurrency correction, failover worker, serta integrasi provider nyata tetap perlu dilakukan pada staging production-like.
