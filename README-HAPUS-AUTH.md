# Hapus permanen = Auth + Firestore

## Yang ditambahkan
- `functions/index.js` — Callable `hapusAkunPermanen` (region `asia-southeast2`)
- `src/lib/akunGuruData.ts` — `hapusAkunStaf` memanggil Function
- `firebase.json` — blok `functions`

## Prasyarat
1. Proyek Firebase paket **Blaze** (Callable Functions tidak jalan di Spark).
2. Firebase CLI login & project `sdm01kukusan-2e735`.

## Deploy Functions (sekali)
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Deploy hosting (setelah ubah frontend)
```bash
npm run build
firebase deploy --only hosting
```

## Uji
1. Login admin → Kelola Akun → Hapus permanen → ketik email → konfirmasi.
2. Cek Firebase Console → Authentication: user hilang.
3. Cek Firestore `users/{uid}`: dokumen hilang.
4. Daftar ulang dengan email yang sama harus berhasil (signUp baru).

## Catatan
Jika Function belum di-deploy, app menghapus profil Firestore saja dan menampilkan pesan agar deploy Function / hapus Auth manual.
