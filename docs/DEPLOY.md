# Deploy ke Firebase Hosting

Pastikan langkah di **SETUP_FIREBASE.md** sudah selesai (project, `.env`, rules, akun admin).

## Deploy biasa (hanya website)

```bash
npm run deploy
```

Perintah ini menjalankan `npm run build` lalu `firebase deploy --only hosting`.

## Deploy rules saja

```bash
npm run deploy:rules
```

> **Penting:** commit ke GitHub TIDAK otomatis mengubah rules di Firebase.
> Rules baru hanya berlaku setelah `deploy:rules`. Setelah deploy, uji login
> sebagai (1) admin, (2) guru Tahsin-Tahfizh, (3) orang tua — pastikan
> masing-masing hanya melihat yang seharusnya.

## Deploy semuanya

```bash
npm run deploy:all
```

## URL

- Bawaan Firebase: **https://sdm01kukusan-2e735.web.app**
- Custom domain: **https://penilaian.sdmuhammadiyah01kks.sch.id**

## Custom domain

1. Firebase Console → **Hosting** → **Add custom domain** → isi `penilaian.sdmuhammadiyah01kks.sch.id`.
2. Tambahkan record DNS yang diminta Firebase (TXT untuk verifikasi, lalu A/AAAA) di pengelola DNS domain `sch.id` sekolah.
3. Tunggu status **Connected**. Sertifikat HTTPS (Google Trust Services) diterbitkan otomatis; sebelum selesai, browser bisa menampilkan "Not secure".
4. Firebase Console → **Authentication** → **Settings** → **Authorized domains** → tambahkan `penilaian.sdmuhammadiyah01kks.sch.id`. Tanpa ini, login di domain tersebut gagal.
5. Setelah semuanya selesai, buka situs lewat jendela incognito (hindari cache status lama browser).

## Header keamanan

`firebase.json` mengirim header keamanan (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS) dan **CSP dalam mode Report-Only**. Buka situs, tekan F12 → Console. Kalau tidak ada pesan `Content Security Policy`, ubah nama header menjadi `Content-Security-Policy` agar diberlakukan sungguhan. Kalau ada, tambahkan sumber yang diblokir ke kebijakan lalu uji ulang.
