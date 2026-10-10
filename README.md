# SDM 01 Kukusan — Sistem Penilaian

Aplikasi penilaian internal **SD Muhammadiyah 01 Kukusan**.

Frontend: **Vite + React 19 + TypeScript + Tailwind CSS v4**  
Backend: **Firebase** (Authentication + Firestore + Hosting)

URL: `https://penilaian.sdmuhammadiyah01kks.sch.id`  
URL bawaan Firebase: `https://sdm01kukusan-2e735.web.app`

---

## Untuk pemula — mulai dari sini

Ikuti urutan di bawah. Jangan loncat langkah.

### 1. Prasyarat di komputer Anda

| Tools | Cek di terminal | Unduh jika belum |
|-------|-----------------|------------------|
| **Node.js** (versi 20 ke atas) | `node -v` | https://nodejs.org |
| **npm** (ikut Node.js) | `npm -v` | — |
| **Git** (opsional) | `git --version` | https://git-scm.com |

### 2. Install dependensi proyek

```bash
npm install
```

### 3. Siapkan project Firebase

Panduan lengkap: **[docs/SETUP_FIREBASE.md](docs/SETUP_FIREBASE.md)**. Ringkasnya:

1. Gunakan project dengan ID **`sdm01kukusan-2e735`** di https://console.firebase.google.com
2. Aktifkan **Authentication** (Email/Password)
3. Buat database **Firestore**
4. Daftarkan aplikasi web → salin config
5. Isi file `.env` (salin dari `.env.example`)
6. Deploy rules: `npm run deploy:rules`

### 4. Jalankan di komputer (mode development)

```bash
npm run dev
```

Buka alamat yang muncul (biasanya `http://localhost:5173`).

### 5. Deploy ke internet (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase use sdm01kukusan-2e735
npm run deploy
```

Panduan deploy, custom domain, dan header keamanan: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## Struktur folder

```
├── docs/                  # Panduan (Firebase, deploy, model data)
├── public/                # File statis (favicon, logo)
├── src/
│   ├── components/        # Komponen UI bersama (Layout, dll.)
│   ├── lib/               # Firebase, auth, akses data, helper
│   ├── pages/             # Halaman (Login, Home, hub modul, tahsin/, admin/)
│   ├── types/             # Tipe TypeScript
│   ├── App.tsx            # Routing utama
│   ├── main.tsx           # Entry point
│   └── index.css          # Tailwind + design tokens
├── .env.example           # Contoh variabel Firebase
├── firebase.json          # Konfigurasi Hosting & Firestore
├── firestore.rules        # Security rules
├── CHANGELOG.md           # Riwayat perubahan (append-only)
├── ANTIREGRESI.md         # Aturan agar perbaikan tidak rusak lagi (append-only)
├── package.json
└── vite.config.ts
```

## Status migrasi

Halaman detail dimigrasikan satu per satu dari versi HTML lama (`penilaian-v2`).
Daftar koleksi dan keputusan data: **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)**.

| Modul | Status |
|-------|--------|
| Scaffold (Vite, React, Tailwind, Auth, Layout) | ✅ Selesai |
| Login + Beranda + Hub modul | ✅ Selesai |
| Tahsin-Tahfizh: Input Setoran, Riwayat Siswa | ✅ Ada |
| Tahsin-Tahfizh: Catat Menulis, Cetak Laporan, Target Hafalan | ⏳ Belum — placeholder |
| Admin: Data Siswa | ✅ Ada |
| Admin: akun guru/orang tua, mutasi, impor siswa massal | ⏳ Belum — placeholder |
| Akademik: Setup TP & KKTP, Bobot Semester TP, Input Nilai SLM | ✅ Ada |
| Akademik: STS/SAS, rapor, absensi, kokurikuler, ekskul, mutasi | ⏳ Belum — placeholder |

## Perintah berguna

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan server development |
| `npm run build` | Build produksi ke folder `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run deploy` | Build + deploy ke Firebase Hosting |
| `npm run deploy:rules` | Deploy hanya Firestore rules & indexes |

## Kontak

SD Muhammadiyah 01 Kukusan — internal.
