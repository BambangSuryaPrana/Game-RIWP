# RIWP Case Files

Game studi kasus **Respectful and Inclusive Workplace Policy (RIWP)** untuk Insan KAI, berdasarkan Peraturan Direksi PT Kereta Api Indonesia (Persero) Nomor PER.DZ/KC.202/IX/1/KA-2026.

- **Pegawai** membuka satu link, mengisi NIPP, nama, dan unit kerja, lalu memainkan 10 case file kapan saja.
- **Admin** melihat di dashboard siapa saja yang sudah akses, NIPP-nya, skornya, dan jawabannya per soal, lalu bisa mengunduh rekap ke Excel.

Arsitekturnya sama dengan aplikasi RPA sebelumnya: React + Vite untuk tampilan, Node.js + Express untuk server, serta SQLite (lokal) atau PostgreSQL (Neon/Supabase) untuk database.

---

## 1. Isi aplikasi

### Halaman pegawai (`/#/`)
| Fitur | Cara kerja |
|---|---|
| Masuk dengan NIPP | NIPP, nama, dan unit kerja wajib diisi. Unit bisa dipilih dari daftar atau diketik. Data diingat browser untuk main berikutnya. |
| Case file | Tampilan kiri *Case File*, kanan *On the Desk*, bawah pilihan A/B/C, garis progres di atas (hijau benar, merah salah, kuning soal sekarang). |
| Umpan balik | Benar: banner hijau dengan pujian bergantian. Salah: banner merah "Coba Lagi Yuk!". Keduanya menampilkan kunci jawaban dan Dasar RIWP. |
| Musik & suara | Musik 8-bit mulai saat menekan *Mulai Main*, bunyi saat benar/salah, fanfare di akhir. Ada tombol matikan suara. |
| Skor akhir | Skor, nilai (0–100), status lulus/belum lulus, dan rekap jawaban. Bisa *Main Lagi* kapan saja. |
| Tahan refresh | Kalau halaman ter-refresh di tengah permainan, pegawai lanjut dari soal terakhir. |

**Keamanan nilai:** kunci jawaban tidak pernah dikirim ke browser sebelum pegawai menjawab, dan skor dihitung di server. Jawaban pertama yang dihitung, jadi skor di dashboard tidak bisa diakali.

### Halaman admin (`/#/admin`)
| Menu | Isi |
|---|---|
| **Dashboard** | Link game + tombol salin, jumlah pegawai yang sudah akses (NIPP unik), total permainan, rata-rata nilai, jumlah & persentase lulus, ketepatan jawaban per kasus (kasus < 60% ditandai *perlu penguatan*), sebaran nilai, aktivitas harian, rekap per unit, aktivitas terbaru. Diperbarui otomatis tiap 15 detik. Bisa difilter per unit dan tanggal. |
| **Peserta** | Tabel per pegawai (NIPP, nama, unit, jumlah main, nilai terbaik & terakhir, status, terakhir akses) atau semua permainan. Klik baris untuk melihat riwayat dan detail jawaban per soal. Bisa menghapus permainan uji coba. |
| **Bank Soal** | Edit kasus, tambah kasus baru, tandai jawaban benar, nonaktifkan, urutkan naik/turun, hapus. |
| **Pengaturan** | Judul, teks pembuka, dasar peraturan, kalimat pertanyaan, pesan salah, daftar pujian, batas lulus (bawaan 80), daftar unit kerja. |
| **Akun** | Ganti password, tambah/hapus admin. |
| **Unduh Excel** | 4 sheet: Rekap Peserta, Semua Permainan, Detail Jawaban, Analisis Soal. Mengikuti filter yang sedang dipakai. |

---

## 2. Menjalankan di laptop

Butuh **Node.js 22.5 atau lebih baru** (unduh di nodejs.org, pilih versi LTS).

```bash
npm install
npm run dev
```

- Game: http://localhost:5173
- Admin: http://localhost:5173/#/admin
- Dari HP/laptop lain di Wi-Fi yang sama: alamat **Dari HP/laptop lain** yang tampil di terminal (port 5173)

Port 3001 pada mode dev hanya server API (data), bukan tampilan.

Saat pertama dijalankan, terminal menampilkan **Kode setup**. Buka halaman admin, masukkan kode itu, lalu buat akun admin pertama.

Tanpa `DATABASE_URL`, data tersimpan di `data/riwp.db` (SQLite). 10 soal dari dokumen RIWP otomatis terisi.

### Mode produksi (satu alamat)
```bash
npm run build
npm start
```
Buka http://localhost:3001. Supaya bisa dibuka dari HP di Wi-Fi yang sama, pakai alamat **Dari HP/laptop lain** yang tampil di terminal. Kalau tidak terbuka, izinkan Node.js di firewall Windows.

---

## 3. Database online (Neon, disarankan)

Supaya seluruh pegawai bisa main dari mana saja dan data tidak hilang, pakai PostgreSQL online gratis.

1. Daftar di **neon.com**, lalu buat project dengan region **Singapore**.
2. Klik **Connect**, lalu salin *Connection string*.
3. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL=` dengan connection string tadi.
4. Jalankan `npm run dev`. Terminal menampilkan `Database: Neon (…)` dan tabel dibuat otomatis.

**Supabase** juga didukung. Pakai connection string **Session pooler**, unduh sertifikat SSL (Project Settings → Database → SSL Configuration), lalu isi `DATABASE_SSL_CA=server/certs/supabase-ca.crt`. Ingat: project Supabase gratis dijeda setelah 1 minggu tidak aktif.

Semua tabel memakai awalan `riwp_`, jadi aman berbagi database dengan aplikasi RPA. Di PostgreSQL, *Row Level Security* dinyalakan sehingga tabel tidak bisa dibaca lewat API publik Supabase; hanya server aplikasi ini yang bisa membaca dan menulis.

---

## 4. Online-kan di Render (gratis)

1. Upload folder proyek ke GitHub (misalnya lewat GitHub Desktop). File `.env` tidak ikut ter-upload.
2. Di **render.com**: **New → Blueprint**, lalu pilih repository ini. Render membaca `render.yaml` (paket Free, region Singapore).
3. Isi **DATABASE_URL** dengan alamat Neon. `SETUP_KODE` dibuat otomatis.
4. Klik **Deploy Blueprint**, lalu tunggu sampai status **Live** (sekitar 3–5 menit).
5. Ambil kode setup di menu **Environment → SETUP_KODE**, lalu buka `https://…onrender.com/#/admin` untuk membuat akun admin.
6. Cek `https://…onrender.com/api/health`. Hasilnya harus `{"ok":true,"database":"postgres"}`.
7. Bagikan `https://…onrender.com` ke pegawai. Link yang sama juga ada di Dashboard dengan tombol **Salin link**.

**Catatan paket gratis Render:** server tidur setelah 15 menit tidak dibuka. Pengunjung pertama setelah itu menunggu sekitar 1 menit, tapi data tidak hilang karena tersimpan di Neon. Supaya server selalu bangun, buat jadwal gratis di **cron-job.org** untuk membuka `/api/health` setiap 10 menit.

**Jangan pakai SQLite di Render:** file SQLite terhapus setiap server restart. Selalu isi `DATABASE_URL`.

---

## 5. Backup & pemulihan

| Perintah | Fungsi |
|---|---|
| `npm run backup` | Simpan seluruh data ke `backups/riwp-backup-<tanggal>.json` |
| `npm run restore -- backups/riwp-backup-….json` | Pulihkan ke database yang sedang dipakai (harus kosong). Tambah `--timpa` untuk mengganti isi lama. |

**Pindah dari SQLite lokal ke Neon:** jalankan `npm run backup` (tanpa `DATABASE_URL`), isi `DATABASE_URL` di `.env`, lalu jalankan `npm run restore -- backups/<file>.json --timpa`.

---

## 6. Uji otomatis

```bash
npm test
```
Menguji alur lengkap: bermain, perhitungan skor di server, kunci jawaban tidak bocor, dashboard, filter, bank soal, pengaturan, akun admin, dan ekspor Excel. Untuk menguji PostgreSQL juga, isi `TEST_DATABASE_URL` (database khusus uji, karena tabelnya dihapus dulu).

---

## 7. Struktur folder

```
server/
  index.js            menjalankan server
  app.js              rute Express
  routes/public.js    API game (mulai main, jawab, selesai)
  routes/admin.js     API admin (login, dashboard, peserta, soal, pengaturan, akun, Excel)
  db/                 adapter SQLite/PostgreSQL + skema tabel
  stats.js            perhitungan rekap dashboard
  excel.js            ekspor Excel
  defaultContent.json 10 soal & pengaturan bawaan dari dokumen RIWP
src/
  game/               tampilan game pegawai
  admin/              tampilan dashboard admin
  sound.js            musik & efek suara (Web Audio, tanpa file lagu)
scripts/              backup & restore
test/                 uji otomatis
```

### Tabel database
| Tabel | Isi |
|---|---|
| `riwp_plays` | Satu baris per permainan: NIPP, nama, unit, waktu mulai & selesai, skor, jumlah soal |
| `riwp_answers` | Jawaban per soal: pilihan, kunci, benar/salah, waktu (judul kasus disalin, jadi riwayat aman walau soal diubah) |
| `riwp_cases` | Bank soal |
| `riwp_settings` | Pengaturan game |
| `riwp_admins`, `riwp_sessions` | Akun admin (password hash scrypt) dan sesi login (token hash) |

---

## 8. Batasan

- NIPP tidak dicocokkan dengan data kepegawaian, jadi pegawai bisa saja salah ketik NIPP. Kalau ada daftar NIPP resmi, aplikasi bisa dikembangkan untuk menolak NIPP yang tidak terdaftar.
- Pegawai boleh main berkali-kali. Dashboard menampilkan nilai terbaik dan terakhir, dan status lulus memakai nilai terbaik.
