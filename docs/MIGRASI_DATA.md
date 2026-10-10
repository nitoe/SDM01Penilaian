# Migrasi Data: sdm01-penilaianv2 → sdm01kukusan-2e735

Tujuan: semua akun dan data v2 pindah ke project tunggal `sdm01kukusan-2e735`.
Urutannya penting: **Auth dulu, baru Firestore** (dokumen `users/{uid}` memakai UID akun).

> Skrip tidak pernah menghapus apa pun dan, tanpa `--overwrite`, tidak menimpa dokumen
> yang sudah ada di tujuan. Selalu mulai dari dry-run.

## 0. Persiapan

1. **Keadaan per 10 Okt 2026:** v2 baru tahap uji coba fitur sederhana dan belum dipakai guru; belum ada nilai atau
   setoran nyata yang diinput di v2 maupun di situs baru. Data nyata yang ada hanya akun, data siswa, dan konfigurasi.
   Jadi langkah di bawah adalah *salinan awal* dan v2 diperlakukan sebagai referensi. Tetap jangan mengubah rules v2
   menjadi tolak-semua sampai salinan dikonfirmasi lengkap. Skrip aman diulang bila nanti ada yang perlu disusulkan.
2. **Kunci service account untuk kedua project.** Firebase Console → ⚙ Project settings → Service accounts → *Generate new private key*.
   Simpan sebagai `v2-key.json` dan `baru-key.json` **di luar folder repo** (mis. `C:\Users\USER\Documents\kunci\`).
   Kunci ini setara password admin penuh: jangan dikirim lewat chat/email, hapus/cabut setelah selesai.
3. Di folder repo (PowerShell):
   ```powershell
   npm install --no-save firebase-admin
   ```
   (`--no-save` agar `package.json` tidak berubah.)

## 1. Pindahkan akun (Authentication)

Password tersimpan sebagai hash, jadi akun bisa dipindah tanpa guru perlu reset password.

1. Ambil parameter hash project **lama**: Console `sdm01-penilaianv2` → Authentication → Users → menu ⋮ di kanan atas tabel → *Password hash parameters*. Catat `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`.
2. Ekspor:
   ```powershell
   firebase auth:export akun-v2.json --format=json --project sdm01-penilaianv2
   ```
3. Impor ke project **baru** (isi nilai dari langkah 1):
   ```powershell
   firebase auth:import akun-v2.json --hash-algo=SCRYPT --hash-key="<base64_signer_key>" --salt-separator="<base64_salt_separator>" --rounds=<rounds> --mem-cost=<mem_cost> --project sdm01kukusan-2e735
   ```
4. Jika di project baru sudah ada akun uji dengan email yang sama tetapi UID berbeda, hapus akun uji itu lebih dulu (Authentication → Users), atau impor akan menolak baris tersebut.
5. Jangan menyimpan `akun-v2.json` di repo (berisi hash password). Hapus setelah selesai.

Alternatif bila parameter hash tidak tersedia: buat akun baru dan kirim tautan *reset password* — tapi UID akan berbeda dan `users/{uid}` harus dibuat ulang. Cara di atas lebih baik.

## 2. Pindahkan data (Firestore)

**Dry-run** (tidak menulis apa pun):
```powershell
node scripts/migrate-firestore.mjs --source-key=C:\Users\USER\Documents\kunci\v2-key.json --target-key=C:\Users\USER\Documents\kunci\baru-key.json
```
Baca ringkasan per koleksi: `baru` (akan dibuat), `sama` (sudah ada, identik), `beda` (sudah ada tapi isi berbeda — TIDAK ditimpa). File `migrasi-laporan-*.json` memuat ID dokumen yang `beda`. Skrip juga memperingatkan koleksi di v2 yang tidak dikenalnya.

Jika angka `beda` tidak nol di koleksi yang seharusnya kosong di tujuan, berhenti dan periksa dulu — itu tanda data tumpang tindih.

**Terapkan:**
```powershell
node scripts/migrate-firestore.mjs --source-key=... --target-key=... --apply
```
Aman diulang: dokumen yang sudah sama dilewati.

## 3. Verifikasi

- Jumlah dokumen tiap koleksi: kolom `sumber` = `tujuan_kini` (kecuali ada dokumen tujuan yang memang sudah ada sebelumnya).
- Jumlah akun di Authentication tujuan = jumlah dokumen `users` (admin, guru, orang tua).
- **ID siswa:** buka beberapa siswa di aplikasi baru (Admin → Data Siswa). Dokumen v2 berkunci NIS, aplikasi baru berkunci NIPD (atau NISN). Kalau ada siswa yang NIS-nya berbeda dari NIPD-nya, upsert dari aplikasi baru akan membuat dokumen **ganda**. Cek sebelum impor Dapodik pertama.
- Login dengan satu akun admin dan satu guru (di domain `sdm01kukusan-2e735.web.app` atau domain sekolah, setelah masuk Authorized domains).
- Riwayat setoran satu siswa tampil lengkap.

## 4. Setelah pindah

- **Rules.** Aplikasi baru hanya membaca koleksi yang rules-nya sudah ditulis (`users`, `siswa`, `setoran`, `menulis_log`, `target_hafalan`, `kktp_tahsin_tahfizh`, placeholder `mapel`/`tp_kktp`). Koleksi Akademik/Rapor (`nilai_*`, `absensi_rapor`, dst.) sudah tersalin tetapi sengaja belum bisa dibaca aplikasi sampai modulnya dimigrasi dan rules-nya ditulis (lihat `DATA_MODEL.md`).
- **Indeks.** Indeks komposit v2 dibuat manual di Console project lama dan tidak ada di repo. Ambil dengan:
  ```powershell
  firebase firestore:indexes --project sdm01-penilaianv2 > indeks-v2.json
  ```
  lalu gabungkan yang dibutuhkan ke `firestore.indexes.json` dan `npm run deploy:rules`. Kalau aplikasi menampilkan "The query requires an index", klik tautan di Console untuk membuatnya.
- **Sinkron ulang.** Jalankan ulang langkah 2 (dry-run, lalu `--apply`) kapan pun perlu menyusulkan data baru dari v2.
  Tanpa `--overwrite`, yang ikut hanya dokumen baru (mis. setoran baru); dokumen yang sudah ada tidak berubah.
  Akun baru yang dibuat di v2 setelah langkah 1 perlu diekspor/diimpor ulang (langkah 1 aman diulang).
- **Cutover (hanya setelah modul terkait pindah dan guru sudah memakai situs baru).** Bekukan v2 untuk modul itu,
  jalankan sinkron terakhir, dan pakai `--overwrite` hanya bila dokumen yang `beda` jelas lebih baru di v2 dan belum
  diedit di aplikasi baru.
- **Matikan v2.** Baru setelah SEMUA modul dipindah: ganti rules project lama menjadi tolak-semua
  (`allow read, write: if false;`), lalu hapus kunci service account yang dibuat di langkah 0.

## Bila ada guru mulai menginput di dua tempat

Dua project Firebase berbeda berarti data yang diinput di dua tempat **tidak otomatis menyatu**. Sebelum guru mana pun
mulai menginput data nyata:

1. Tetapkan satu sumber kebenaran per modul, dan hanya input di sana.
2. Hub Tahsin di situs baru menampilkan catatan agar tidak menginput sebelum ada pengumuman.
3. Kalau sudah telanjur diinput di dua tempat, hentikan salah satu dan jangan pakai `--overwrite` sebelum
   membandingkan laporan dry-run.
4. Rules v2 baru boleh diubah menjadi tolak-semua setelah semua modul pindah dan salinan terakhir dikonfirmasi.
