# Fase 3 — Identitas dan Consent

Pembaruan: 28 Agustus 2026
Acuan: `Master_Prompt_Sunrise_Digital_Inklusif (3).md`

## Status

Selesai untuk local development. Implementasi mencakup identifier sensitif, dokumen privat, scanning dan sanitasi file, verifikasi manusia, consent berversi, relasi wali efektif, serta workflow hak subjek data.

## Hasil implementasi

- NIK dan NISN disimpan sebagai ciphertext AES-256-GCM dengan blind index HMAC terpisah untuk exact duplicate check. Respons operasional hanya memuat empat digit terakhir yang dimasking.
- Kolom NISN lama dipertahankan kosong dan dilindungi database constraint agar penulisan plaintext baru ditolak.
- Upload identitas memakai signed URL lima menit ke bucket quarantine dengan allowlist JPG/PNG/PDF dan batas 8 MB.
- Worker memeriksa ukuran, signature, MIME, active PDF/script pattern, EICAR baseline, dan ClamAV saat dikonfigurasi. Production mewajibkan scanner eksternal.
- Gambar bersih dirotasi sesuai orientasi, ditranscode, dan disimpan ulang tanpa metadata EXIF/lokasi sebelum masuk bucket identitas privat.
- File hanya dapat diunduh saat scan `CLEAN` dan status masih `PENDING_VERIFICATION`, melalui signed URL 90 detik dengan `Content-Disposition: attachment`.
- Permission `identity:verify` dan `identity.document:read` dipisahkan. Akses file sensitif memerlukan MFA pada production dan audit wajib; guru akademik tidak memperoleh kedua permission tersebut.
- Keputusan verifikasi hanya berlaku sekali pada dokumen pending. Tolak/perbaikan mewajibkan reason code dan catatan; review history, reviewer, dan timestamp dipertahankan.
- Consent identitas memakai tipe `IDENTITY` tersendiri sehingga tidak mengganti consent penggunaan platform. Consent tidak dapat dipalsukan melalui endpoint consent generik.
- Siswa di bawah 18 tahun atau tanpa tanggal lahir terverifikasi memerlukan consent wali aktif sebelum mengajukan identitas.
- Relasi wali harus terverifikasi, belum dicabut, dan berada dalam effective date. Sekolah subjek selalu berasal dari record siswa, bukan input actor/client.
- Consent platform, wali, publikasi, analytics, dan identitas memiliki dokumen/version, actor, subject, method, effective time, withdrawal time, serta histori.
- Penarikan consent membuat workflow `CONSENT_WITHDRAWAL` tanpa menghapus histori.
- Permintaan akses, koreksi, penghapusan, pembatasan, export, dan penarikan consent memiliki tenggat, deduplikasi permintaan aktif, scope tenant, serta state transition yang tidak dapat dibuka ulang setelah final.
- Dashboard Privasi menampilkan riwayat milik pengguna; admin dengan permission `privacy:manage` mendapat antrean operasional dan aksi transisi terkontrol.
- Endpoint sensitif mengirim `Cache-Control: no-store, private` dan proxy web juga menonaktifkan cache.

## Bukti verifikasi lokal

- Migration consent dan permission Fase 3 diterapkan; schema database up-to-date.
- Unit/negative test mencakup encryption, blind index, file signature, active content, permission sensitif, tenant context siswa, guardian consent, duplicate submission, final verification, relasi wali efektif, dan state transition hak data.
- E2E identitas sintetis: quarantine → scan `CLEAN` → EXIF terhapus → guru menerima 403 → signed download verifier 200 → keputusan valid 200.
- E2E consent/hak data: grant wali 201, duplicate request 409, antrean admin 200, transisi `IN_REVIEW → APPROVED → COMPLETED` lulus, withdrawal 200.
- Nilai identifier sintetis tidak muncul sebagai plaintext pada kolom identifier atau kolom legacy.

## Batas kesiapan produksi

- Bukti koneksi ClamAV/scanner terkelola, enkripsi-at-rest object storage, bucket lifecycle, alert delivery, dan restore drill harus diperoleh di staging production-like.
- Jadwal retensi adalah baseline produk, bukan keputusan hukum final. Legal owner wajib menetapkan yurisdiksi, dasar pemrosesan, usia consent, SLA hak subjek, legal hold, serta vendor/subprocessor sebelum go-live.
- Key encryption dan blind-index wajib berasal dari secret manager, dipisahkan, memiliki prosedur rotasi, dan tidak boleh dibagikan ke database/operator umum.
