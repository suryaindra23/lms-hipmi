# Sunrise Academy

Sunrise Academy adalah **Learning Management System (LMS) multi-sekolah** untuk pembelajaran digital dan kewirausahaan berbasis praktik. Sekolah dapat mengelola materi, tugas, kelas, dan progres belajar; siswa dapat mengerjakan proyek seperti toko digital dan konten affiliate; guru dapat memberi penilaian, komentar, dan kesempatan revisi. Pengelola sekolah serta orang tua/wali mendapat tampilan sesuai perannya untuk memantau perkembangan siswa.

## Untuk siapa website ini?

- **Siswa:** mengakses materi, mengerjakan tugas dan proyek, serta melihat progres dan umpan balik.
- **Guru:** mengelola pembelajaran, rubrik, tenggat, review, dan nilai.
- **Pengelola sekolah:** mengatur data sekolah, kelas, pengguna, dan memantau partisipasi.
- **Orang tua/wali:** mengikuti perkembangan anak sesuai hak akses yang diberikan.
- **Reviewer dan verifikator:** menjalankan proses review atau verifikasi sesuai kewenangannya.

## Teknologi yang digunakan

| Bagian | Teknologi | Fungsi |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | Website publik, login, dan dashboard berdasarkan peran. |
| Backend | NestJS 11, TypeScript, Prisma 5 | API, autentikasi, aturan akses, pembelajaran, penilaian, dan laporan. |
| Database utama | PostgreSQL 16 | Menyimpan data pengguna, sekolah, kelas, materi, tugas, dan transaksi aplikasi. |
| Antrean pekerjaan | Redis 7 dan BullMQ | Menjalankan pekerjaan latar seperti impor data, notifikasi, dan pemrosesan berkas. |
| Penyimpanan berkas | MinIO (kompatibel S3) | Menyimpan berkas unggahan secara terpisah dari database. |

Kode frontend berada di `apps/web`, backend dan worker di `apps/api`, sedangkan skema serta migrasi database ada di `prisma`.

## Menjalankan di komputer lokal

**Persyaratan:** Node.js 22 atau lebih baru, npm, Docker Desktop (atau Docker Engine), dan Docker Compose.

1. Unduh proyek dan masuk ke direktorinya:

   ```bash
   git clone https://github.com/suryaindra23/lms-hipmi.git
   cd lms-hipmi
   ```

2. Siapkan konfigurasi lokal dan instal dependensi:

   ```bash
   cp .env.example .env
   cp .env.example apps/api/.env
   npm ci
   ```

   File `.env` di root dipakai oleh perintah Prisma. File `apps/api/.env` dipakai oleh API dan worker. Keduanya hanya untuk komputer lokal dan sudah dikecualikan oleh `.gitignore`. Nilai pada file contoh **bukan** kredensial production.

3. Nyalakan PostgreSQL, Redis, dan MinIO; siapkan database:

   ```bash
   docker compose up -d
   npm run prisma:generate --workspace apps/api
   npx prisma migrate deploy
   npm run prisma:seed --workspace apps/api
   ```

   Seed mengisi akun dan data sintetis untuk pengembangan. Jangan jalankan seed pada lingkungan production.

4. Buka **tiga terminal** di direktori proyek, lalu jalankan satu perintah pada setiap terminal:

   ```bash
   # Terminal 1 — API
   PORT=3100 npm run dev --workspace apps/api
   ```

   ```bash
   # Terminal 2 — worker (memuat konfigurasi lokal)
   node --env-file=apps/api/.env --watch --import tsx apps/api/src/worker.ts
   ```

   ```bash
   # Terminal 3 — website
   API_URL=http://localhost:3100/api/v1 NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 npm run dev --workspace apps/web
   ```

5. Buka layanan berikut:

   | Layanan | Alamat |
   | --- | --- |
   | Website | [http://localhost:3001](http://localhost:3001) |
   | API dan pemeriksaan kesiapan | [http://localhost:3100/api/v1/health/ready](http://localhost:3100/api/v1/health/ready) |
   | Dokumentasi API | [http://localhost:3100/api/docs](http://localhost:3100/api/docs) |
   | Konsol MinIO | [http://localhost:9001](http://localhost:9001) |

Untuk menghentikan layanan Docker, jalankan `docker compose down`. Perintah ini tidak menghapus data pada volume Docker.

### Akun contoh setelah seed

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Admin | `admin@lms.test` | `admin123` |
| Guru | `teacher@lms.test` | `teacher123` |
| Siswa | `student@lms.test` | `student123` |
| Orang tua | `parent@lms.test` | `parent123` |

Akun ini khusus untuk data sintetis development/test. Seed hanya mereset tenant sintetis berkode `HIPMI`.

## Pemeriksaan proyek

```bash
npm run lint
npm test
npm run build
```

Untuk pemeriksaan rilis yang lebih lengkap, gunakan `npm run verify` dan `npm run release:check`. Panduan operasional dan keamanan tersedia di [dokumentasi deployment](docs/deployment-guide.md), [panduan VPS](deploy/README.md), [security review](docs/security-review.md), serta [status kesiapan](docs/phase-8-status.md). Sebelum production, gunakan kredensial yang kuat, konfigurasi HTTPS dan pemindai malware, lalu tinjau [checklist pilot](docs/pilot-readiness-checklist.md).
