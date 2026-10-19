# Load test baseline — Fase 8

## Target dan skenario

- Authenticated dashboard: p95 < 1.5 s, error < 1%.
- Concurrent draft save: tidak ada 5xx; konflik optimistic locking menghasilkan 409 yang eksplisit.
- Upload initiation: tidak ada bypass ukuran/MIME/scope; queue scan tidak melewati threshold backlog.
- Dataset 50,000 siswa sintetis: lima batch 10,000, bukan data production.

Harness ada di `load/k6`. Tes 50k dan mutation sengaja diberi opt-in agar tidak pernah berjalan tidak sengaja. Baseline lokal membuktikan fungsi pagination dan query pada data besar; baseline tetap wajib diulang di staging dengan ukuran database/worker yang menyerupai production.

## Hasil lokal — 6 Agustus 2026

Database PostgreSQL terisolasi berisi 50.003 murid (50.000 sintetis dan 3 data seed). Uji membaca halaman awal, tengah, dan akhir, masing-masing 50 baris, melalui endpoint terautentikasi. Sebelum run akhir, pengujian menemukan dan memperbaiki konversi parameter query `skip`/`take` dari string menjadi angka.

| Environment | Rows | Requests/concurrency | p50 | p95 | p99 | Maks. | Error |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mac lokal, API production build, PostgreSQL Docker | 50.003 | 100 / 20 | 151,65 ms | 253,39 ms | 304,77 ms | 304,77 ms | 0% |

Seluruh 100 request menghasilkan HTTP 200. Database pengujian terisolasi telah dihapus setelah pengukuran. Angka lokal bukan jaminan kapasitas production karena belum memasukkan latensi jaringan, autoscaling, dan beban worker nyata.

## Baseline staging yang masih wajib

Catat penggunaan koneksi database, puncak antrean, CPU/memori, dan hasil skenario mutation/upload dengan topologi yang setara production. Target p95 tetap di bawah 1,5 detik dan error di bawah 1%.

Kegagalan threshold memblokir go-live sampai query/index, pool, worker concurrency, atau kapasitas diperbaiki dan baseline diulang.
