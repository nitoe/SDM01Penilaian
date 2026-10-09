# SDM 01 Kukusan — Sistem Penilaian

Aplikasi penilaian internal **SD Muhammadiyah 01 Kukusan**.

Frontend: **Vite + React 19 + TypeScript + Tailwind CSS v4**  
Backend: **Firebase** (Authentication + Firestore + Hosting)

URL target: `https://sdm01kukusan-2e735.web.app`

---

## Untuk pemula — mulai dari sini

Ikuti urutan di bawah. Jangan loncat langkah.

### 1. Prasyarat di komputer Anda

Pastikan sudah terpasang:

| Tools | Cek di terminal | Unduh jika belum |
|-------|-----------------|------------------|
| **Node.js** (versi 20 ke atas) | `node -v` | https://nodejs.org |
| **npm** (ikut Node.js) | `npm -v` | — |
| **Git** (opsional) | `git --version` | https://git-scm.com |

### 2. Install dependensi proyek

Buka terminal, masuk ke folder proyek ini, lalu jalankan:

```bash
cd sdm01kks
npm install
```

Tunggu sampai selesai (akan muncul folder `node_modules`).

### 3. Buat project Firebase (langkah demi langkah)

Ikuti panduan lengkap di **[docs/SETUP_FIREBASE.md](docs/SETUP_FIREBASE.md)**.

Ringkasnya:

1. Buka https://console.firebase.google.com
2. Buat project baru dengan ID **`sdm01kukusan-2e735`**
3. Aktifkan **Authentication** (Email/Password)
4. Buat database **Firestore**
5. Daftarkan aplikasi web → salin config
6. Isi file `.env` di folder ini (salin dari `.env.example`)
7. Deploy rules: `firebase deploy --only firestore:rules`

### 4. Jalankan di komputer (mode development)

```bash
npm run dev
```

Buka browser ke alamat yang muncul (biasanya `http://localhost:5173`).

### 5. Deploy ke internet (Firebase Hosting)

Setelah Firebase project siap dan `.env` terisi:

```bash
npm install -g firebase-tools
firebase login
firebase use sdm01kks
npm run deploy
```

Website akan hidup di **https://sdm01kukusan-2e735.web.app**

---

## Struktur folder

```
sdm01kks/
├── docs/                  # Panduan (Firebase, deploy, dll.)
├── public/                # File statis (favicon, logo)
├── src/
│   ├── components/        # Komponen UI bersama (Layout, dll.)
│   ├── lib/               # Firebase, auth, helper
│   ├── pages/             # Halaman (Login, Home, hub modul)
│   ├── types/             # Tipe TypeScript
│   ├── App.tsx            # Routing utama
│   ├── main.tsx           # Entry point
│   └── index.css          # Tailwind + design tokens
├── .env.example           # Contoh variabel Firebase
├── firebase.json          # Konfigurasi Hosting & Firestore
├── firestore.rules        # Security rules
├── package.json
└── vite.config.ts
```

## Status migrasi

| Modul | Status |
|-------|--------|
| Scaffold (Vite, React, Tailwind, Auth, Layout) | ✅ Selesai |
| Login + Beranda + Hub modul | ✅ Selesai |
| Tahsin-Tahfizh (halaman detail) | ⏳ Belum — placeholder |
| Akademik & Rapor (halaman detail) | ⏳ Belum — placeholder |
| Admin (kelola akun/siswa) | ⏳ Belum — placeholder |

Halaman detail akan dimigrasikan satu per satu dari versi HTML lama (`penilaian-v2`).

## Perintah berguna

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Jalankan server development |
| `npm run build` | Build produksi ke folder `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run deploy` | Build + deploy ke Firebase Hosting |
| `npm run deploy:rules` | Deploy hanya Firestore rules |

## Kontak

SD Muhammadiyah 01 Kukusan — internal.
