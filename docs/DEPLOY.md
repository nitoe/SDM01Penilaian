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

## Deploy semuanya

```bash
npm run deploy:all
```

## URL

Setelah sukses: **https://sdm01kukusan-2e735.web.app**

Custom domain bisa ditambahkan nanti di Firebase Console → Hosting → Add custom domain.
