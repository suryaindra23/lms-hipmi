# Laporan Pengujian Fase 1–6

Tanggal: 5 Agustus 2026
Lingkungan: production build lokal, PostgreSQL 16, Redis 7, MinIO, worker BullMQ, Asia/Jakarta

## Hasil

Semua pemeriksaan otomatis dan smoke test fitur Fase 1–6 yang tersedia lulus.

| Area | Hasil |
|---|---|
| Unit test keamanan, URL, metrik, dan CSV | 23/23 lulus |
| Type-check/lint API | Lulus |
| ESLint web | Lulus |
| Production build API + web | Lulus |
| Prisma validate/migration status | Lulus |
| Dependency audit high | 0 kerentanan pada pemeriksaan terakhir |
| Health ready | PostgreSQL, Redis, object storage reachable |
| Login/logout/forgot password | Lulus |
| Session rotation/revocation | Lulus melalui API dan smoke test |
| Master Data | Invitation, activation, import async, search/filter/pagination lulus |
| Tenant/permission | Penolakan lintas sekolah dan action mismatch lulus |
| Identitas privat | Upload, quarantine, scan, move private, signed access 90 detik, verify lulus |
| Consent/DSR | Dokumen berversi, grant, withdrawal, request lulus |
| LMS inti | Module/lesson terbit, materi terhubung, enrollment-scoped tree, progres 100% lulus |
| Student Store API E2E | Draft → multi-evidence private scan → hapus/ganti draf → submit v1 → review rubrik → nilai 95/approve lulus |
| Student Store security | URL normalization, credential/private-host rejection, MIME/signature scan, checksum, EXIF stripping/transcode (1.975.243 → 688.467 byte), signed access lulus |
| Browser desktop/mobile | Login, dashboard, Master Data, Identitas, Privasi, struktur guru, learning progress, Student Store, versi/nilai lulus |
| Affiliate API E2E | Akun → konten/bukti → submit → snapshot manual → flag → verifikasi → review rubrik/approve → impor async lulus |
| Affiliate history | Dua snapshot tersimpan append-only; snapshot impor tidak menimpa snapshot manual lulus |
| Affiliate permission | Siswa ditolak dari antrean verifier dengan HTTP 403; guru dapat memeriksa resource sekolah sendiri |
| Affiliate browser desktop/mobile | KPI, akun terverifikasi, status/nilai, tabel histori, menu mobile, verification queue, flag, dan status impor lulus tanpa console error |
| Monitoring lintas peran | Admin/program 3 siswa, guru 3 siswa, siswa 1 diri sendiri, dan orang tua 1 anak terverifikasi; scope lintas peran tidak bocor |
| Early warning | Evaluasi rule, daftar scoped, catatan tindak lanjut, dan perubahan status lulus; bahasa sinyal tetap suportif |
| Report/export async | Export admin selesai 3 baris dan siswa selesai 1 baris; worker, private object storage, expiry 24 jam, dan formula CSV guard lulus |
| Statistik publik | Snapshot 3/10 tetap pending dan approval ditolak; endpoint publik hanya mengembalikan data APPROVED yang melewati minimum cohort |
| Landing statistik | Loading, error, empty, dan approved state tersedia; tidak menampilkan angka contoh saat belum ada snapshot terverifikasi |
| Dependency audit | 0 vulnerability setelah pemeriksaan terakhir |

## Data sintetis pengujian

- Siswa undangan dan siswa import memakai domain `example.test`.
- Dokumen identitas memakai PNG 1×1 sintetis, NIK/NISN sintetis termasking, dan tidak memuat dokumen orang nyata.
- Satu permintaan akses data sintetis tersimpan untuk membuktikan workflow.
- Submission toko sintetis memakai URL publik contoh, gambar OG aplikasi sebagai bukti, satu versi immutable, dan nilai rubrik sintetis.
- Submission affiliate sintetis memakai profil/konten TikTok contoh, produk/campaign/bukti sintetis, satu review nilai, dua snapshot historis, satu impor async, dan flag kualitas untuk membuktikan pemeriksaan manusia.
- Satu snapshot statistik publik sintetis berukuran cohort 3/10 dibiarkan `PENDING_APPROVAL` untuk membuktikan perlindungan ambang minimum.
- Export QA bersifat privat dan otomatis kedaluwarsa setelah 24 jam.

## Batas klaim

Hasil ini membuktikan fungsi pada environment lokal, bukan sertifikasi production. Sebelum go-live masih diperlukan provider email, MFA bila kebijakan mewajibkan, secret manager, TLS/domain, external observability/alerting, engine antivirus produksi, EXIF stripping/transcoding, restore drill, load test, penetration test, review hukum, dan UAT lintas peran.
