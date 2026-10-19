# Deployment production Sunrise Academy

Target: VPS Ubuntu 24.04 dengan Docker Engine dan Docker Compose plugin. Paket NEO Web Hosting Business Standard tidak menjalankan bundle ini; domain/email dapat tetap dikelola di sana.

## DNS

Sebelum menyalakan HTTPS, buat tiga record A menuju IP VPS yang sebenarnya:

- `@` → IP VPS
- `www` → IP VPS
- `storage` → IP VPS

Jangan arahkan DNS ke `103.125.180.37` untuk deployment aplikasi penuh karena alamat tersebut adalah shared hosting LiteSpeed saat ini.

## Instalasi awal

1. Salin repository ke `/opt/sunrise-academy` pada VPS.
2. Instal Docker Engine + Compose plugin dari repository resmi Docker.
3. Pastikan firewall hanya membuka TCP 22, 80, 443 dan UDP 443. PostgreSQL, Redis, MinIO console, API, serta ClamAV tidak diekspos ke internet.
4. Dari root repository jalankan:

```bash
chmod +x deploy/generate-production-env.sh deploy/deploy.sh
./deploy/generate-production-env.sh
./deploy/deploy.sh
```

Untuk mengaktifkan email undangan, reset kata sandi, dan notifikasi, berikan konfigurasi SMTP ketika membuat environment:

```bash
EMAIL_PROVIDER_ENABLED=true \
SMTP_HOST=smtp.example.com \
SMTP_USER=akun-smtp \
SMTP_PASSWORD='kata-sandi-smtp' \
EMAIL_FROM='Sunrise Academy <no-reply@example.com>' \
./deploy/generate-production-env.sh
```

Jika email belum dikonfigurasi, production tetap dapat berjalan, tetapi pembuatan undangan akan ditolak dengan pesan operasional yang jelas dan reset kata sandi tidak akan membuat token yang tidak dapat dikirim.

Jangan menjalankan seed production. Simpan `SUNRISE_BACKUP_ENCRYPTION_KEY` secara terpisah dari server sebelum go-live.

## Verifikasi

```bash
docker compose --env-file .env.production -f deploy/compose.production.yml ps
curl -fsS https://sunriseadsacademy.com
curl -fsS https://sunriseadsacademy.com/api/backend/health/ready
```

Uji login, aktivasi MFA admin, unggah file EICAR khusus pengujian scanner, penerbitan sertifikat, antrean worker, dan restore backup sebelum menerima data nyata.

## Operasi

- Log: `docker compose --env-file .env.production -f deploy/compose.production.yml logs -f --tail=200`
- Restart: `docker compose --env-file .env.production -f deploy/compose.production.yml restart api worker web`
- Update: tarik kode/image yang disetujui lalu jalankan ulang `./deploy/deploy.sh`.
- Rollback: gunakan `IMAGE_TAG` sebelumnya; jangan rollback migration database secara destruktif.

MinIO hanya dipublikasikan melalui `storage.sunriseadsacademy.com` untuk signed URL. Bucket dibuat private, versioning diaktifkan, dan objek export/quarantine kedaluwarsa setelah 30 hari. HTTPS dikelola otomatis oleh Caddy setelah DNS mengarah ke VPS.
