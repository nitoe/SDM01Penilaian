# Panduan Setup Firebase — untuk pemula

Tujuan: membuat project Firebase baru bernama **sdm01kukusan-2e735**, lalu menghubungkan aplikasi ini.

Ikuti **urutan nomor**. Centang setiap langkah setelah selesai.

---

## A. Buat project di Firebase Console

1. Buka browser → https://console.firebase.google.com  
2. Login dengan akun Google sekolah / pribadi yang akan dipakai jangka panjang.  
3. Klik **Add project** / **Buat project**.  
4. Nama project: ketik **`sdm01kukusan`** (Project ID yang dipakai: `sdm01kukusan-2e735`)  
   - Project ID biasanya otomatis menjadi `sdm01kukusan-2e735` (penting: samakan).  
5. Matikan Google Analytics jika tidak dibutuhkan (opsional).  
6. Klik **Create project** → tunggu selesai → **Continue**.

---

## B. Aktifkan Authentication (login email)

1. Di menu kiri, klik **Build** → **Authentication**.  
2. Klik **Get started**.  
3. Tab **Sign-in method** → pilih **Email/Password**.  
4. Aktifkan **Email/Password** (toggle ON) → **Save**.  
5. (Opsional) Jangan aktifkan "Email link" dulu.

---

## C. Buat database Firestore

1. Menu kiri → **Build** → **Firestore Database**.  
2. Klik **Create database**.  
3. Pilih lokasi terdekat (mis. `asia-southeast2` / Jakarta) → **Next**.  
4. Mode: pilih **Start in production mode** → **Enable**.  
5. Setelah database siap, buka tab **Rules**.  
6. Nanti kita akan deploy rules dari file `firestore.rules` di proyek ini (langkah G).

---

## D. Daftarkan aplikasi web (supaya dapat config)

1. Di halaman **Project Overview** (ikon gear / Project settings).  
2. Scroll ke **Your apps** → klik ikon **Web** (`</>`).  
3. App nickname: `sdm01kukusan-web` → centang juga **Firebase Hosting** jika diminta.  
4. Klik **Register app**.  
5. Akan muncul objek config seperti:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "sdm01kukusan-2e735.firebaseapp.com",
  projectId: "sdm01kukusan-2e735",
  storageBucket: "sdm01kukusan-2e735.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

**Salin semua nilai itu** — akan dipakai di langkah E.  
(Di scaffold ini, file `.env` sudah diisi dengan config project Anda.)

---

## E. Isi file `.env` di komputer Anda

1. Di folder proyek `sdm01kks`, pastikan file `.env` ada. Jika belum:

```bash
cp .env.example .env
```

2. Buka file `.env` dengan editor teks.  
3. Isi sesuai config dari Firebase Console (contoh untuk project ini):

```env
VITE_FIREBASE_API_KEY=AIza...          # dari apiKey
VITE_FIREBASE_AUTH_DOMAIN=sdm01kukusan-2e735.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sdm01kukusan-2e735
VITE_FIREBASE_STORAGE_BUCKET=sdm01kukusan-2e735.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

4. Simpan file. **Jangan** commit file `.env` ke Git (sudah diabaikan di `.gitignore`).

5. Restart server dev jika sedang jalan:

```bash
# Ctrl+C untuk stop, lalu:
npm run dev
```

---

## F. Install Firebase CLI & login

Di terminal:

```bash
npm install -g firebase-tools
firebase login
```

Browser akan terbuka → pilih akun Google yang sama dengan Console.  
Lalu hubungkan ke project:

```bash
cd sdm01kks
firebase use sdm01kukusan-2e735
```

Jika project belum muncul, coba:

```bash
firebase projects:list
firebase use --add
```

---

## G. Deploy security rules Firestore

```bash
firebase deploy --only firestore:rules
```

Pastikan berhasil tanpa error. Rules melindungi data agar hanya user yang berwenang yang bisa baca/tulis.

---

## H. Buat akun admin pertama (manual)

Firebase Auth belum otomatis membuat profil di Firestore. Lakukan sekali:

### H1. Buat user di Authentication

1. Console → **Authentication** → tab **Users** → **Add user**.  
2. Isi email (mis. `admin@sdm01kukusan.sch.id`) + password kuat → **Add user**.  
3. **Salin UID** yang muncul (string panjang seperti `xY7k...`).

### H2. Buat dokumen profil di Firestore

1. Console → **Firestore Database** → **Start collection**.  
2. Collection ID: **`users`** → Next.  
3. Document ID: **tempel UID** dari langkah H1 (penting: harus sama).  
4. Tambah field:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | email yang sama |
| `nama` | string | `Administrator` |
| `role` | string | `admin` |

5. Save.

Sekarang Anda bisa login di aplikasi dengan email + password tersebut.

---

## I. Deploy website (Hosting)

```bash
npm run build
firebase deploy --only hosting
```

Setelah selesai, buka: **https://sdm01kukusan-2e735.web.app**

---

## Troubleshooting cepat

| Masalah | Solusi |
|---------|--------|
| Login gagal "Firebase belum dikonfigurasi" | File `.env` belum ada / belum diisi / server belum di-restart |
| Login gagal "profil di Firestore belum ada" | Dokumen `users/{uid}` belum dibuat (langkah H2) |
| `firebase use` error project not found | Pastikan Project ID di Console benar-benar `sdm01kukusan-2e735` |
| Rules menolak baca/tulis | Deploy ulang rules; pastikan role di dokumen `users` benar |
| Halaman blank setelah deploy | Cek `firebase.json` rewrite ke `/index.html` (sudah disetel di scaffold) |

---

## Ringkasan checklist

- [ ] Project Firebase `sdm01kukusan-2e735` dibuat  
- [ ] Authentication Email/Password aktif  
- [ ] Firestore database dibuat  
- [ ] Web app didaftarkan → config disalin  
- [ ] File `.env` diisi  
- [ ] `firebase login` + `firebase use sdm01kukusan-2e735`  
- [ ] Rules di-deploy  
- [ ] Akun admin + dokumen `users/{uid}` dibuat  
- [ ] `npm run dev` berjalan lokal  
- [ ] (Opsional) `npm run deploy` → hidup di sdm01kukusan-2e735.web.app  
