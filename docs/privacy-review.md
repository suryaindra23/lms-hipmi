# Privacy review dan retensi

## Inventaris data

| Kelas | Contoh | Tujuan | Akses | Retensi default |
|---|---|---|---|---|
| Restricted | NIK/NISN terenkripsi, dokumen identitas | verifikasi peserta | siswa terkait dan petugas verifikasi | masa program + 90 hari, lalu hapus/anonymize sesuai kewajiban |
| Confidential | nilai, submission, relasi orang tua, tiket dukungan | pembelajaran dan pendampingan | role dan tenant terkait | masa program + 2 tahun |
| Internal | audit event, job status, metrik operasional | keamanan/operasi | admin terbatas | audit 2 tahun; operational logs 30–90 hari |
| Public-approved | statistik agregat, portofolio/sertifikat dengan consent | transparansi dan publikasi | publik | sampai consent dicabut/masa publikasi berakhir |

NIK/NISN tidak disimpan plaintext: ciphertext AES-256-GCM, blind index HMAC untuk uniqueness, dan last-4 untuk tampilan. Analytics tidak boleh memuat NIK/NISN, email, nomor telepon, nama lengkap, isi dokumen, atau isi tiket.

## Prinsip dan proses

- Minimization: hanya field yang dibutuhkan; status dan last-4 dipakai untuk layar operasional.
- Consent: versioned consent document, timestamp, grantor, evidence, withdrawal history.
- Data subject rights: akses, koreksi, penghapusan, pembatasan, export, dan penarikan consent melalui modul privasi; keputusan dan alasan diaudit.
- Access review: owner sekolah meninjau user-role minimal triwulanan dan segera saat mutasi/keluar.
- Non-production: hanya data sintetis; dump production tidak boleh dipakai untuk development.
- Breach: isolasi, pertahankan bukti, nilai scope/subjek, rotasi secret, notifikasi pihak yang diwajibkan sesuai hukum/kebijakan, lalu postmortem.
- Subprocessor: isi register vendor sebelum production (hosting, email/SMS/WhatsApp, monitoring, object storage, malware scanner), lokasi pemrosesan, DPA, dan mekanisme penghapusan.

Backup mengikuti retensi 30 harian + 12 bulanan sebagai baseline, dienkripsi dan akses restore dipisahkan. Penyesuaian legal harus disetujui pemilik data sebelum go-live.

## Trigger retensi dan tindakan

| Trigger | Tindakan minimum | Pengecualian |
|---|---|---|
| Dokumen identitas gagal scan | hapus objek quarantine; simpan status/reason minimum untuk audit | investigasi insiden aktif atau legal hold |
| Verifikasi identitas selesai | pertahankan dokumen privat hanya selama masa program + 90 hari baseline | kewajiban kontraktual/hukum yang telah didokumentasikan |
| Consent ditarik | hentikan penggunaan opsional dan buat workflow hak data; jangan hapus histori consent/audit | pemrosesan wajib untuk keamanan, sengketa, atau kewajiban hukum |
| Akun/program berakhir | jadwalkan penghapusan/anonymization per kelas data | legal hold dan backup yang belum mencapai expiry |
| Export hak subjek selesai | tautan/object export kedaluwarsa maksimal 24 jam | tidak ada perpanjangan tanpa request baru |

## Keputusan legal yang belum final

- Yurisdiksi dan regulasi yang berlaku untuk setiap organisasi/sekolah.
- Dasar pemrosesan per tujuan, usia consent, dan pihak yang sah bertindak sebagai wali.
- Retensi final dokumen identitas, data akademik, audit, backup, dan catatan sengketa.
- SLA verifikasi identitas dan hak subjek data, termasuk mekanisme banding.
- Daftar subprocessor, lokasi data, DPA, mekanisme transfer, dan bukti penghapusan vendor.
- Prosedur legal hold, respons insiden, serta notifikasi pelanggaran.

Dokumen ini adalah baseline teknis untuk review dan tidak menyatakan kepatuhan hukum final.
