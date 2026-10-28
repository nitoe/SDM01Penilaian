# Integrasi Publikasikan rapor STS — file lengkap

Salin **seluruh isi file** ke repo `SDM01Penilaian` (timpa file yang sama path-nya).

| File | Aksi |
|------|------|
| `firestore.rules` | **Ganti seluruh file** di root repo (sudah termasuk sarpras + perpus + `sts_publikasi`) |
| `src/lib/stsPublikasi.ts` | **File baru** |
| `src/pages/akademik/PublikasiSts.tsx` | **File baru** |
| `src/App.tsx` | **Ganti seluruh file** (tambah import + route) |
| `src/pages/AkademikHub.tsx` | **Ganti seluruh file** (tambah item menu) |

## Deploy rules

```bash
npm run deploy:rules
# atau: firebase deploy --only firestore:rules
```

Uji dengan akun **wali kelas** dan **admin** sebelum dipakai guru secara luas.

## Perubahan rules (ringkas)

1. **`sts_publikasi/{id}`** — read: siapa saja; write: admin atau `waliKelasSendiri(kelas)`.
2. **`nilai_sts`** — `allow read` ditambah `|| true` agar portal ortu (tanpa Auth) bisa membaca nilai untuk rapor. Guru tetap memakai `lihatMapelKelas` untuk tulis.

Tidak mengubah rules sarpras_*, perpus_*, setoran, mutasi, dll.

## Uji cepat

1. Login wali → Akademik → **Publikasikan rapor STS**
2. Pilih kelas → Publikasikan
3. Console Firestore: dokumen `sts_publikasi/...` `published: true`
4. Portal ortu: beranda status Tersedia → buka Rapor STS
