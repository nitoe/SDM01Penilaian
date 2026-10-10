# Audit migrasi v2 → sdm01kukusan-2e735

Dibuat 10 Okt 2026 setelah membaca seluruh riwayat repo (9 commit), `penilaian-v2-main.zip`
(± 20.900 baris HTML + 3.500 baris JS), dan membangun ulang repo ini.

## 1. Temuan keamanan (kerjakan lebih dulu)

**1.1 Data pribadi 403 siswa ada di repo publik dan di JS situs.**
`src/data/siswaSeed.json` (commit `910cf81`) berisi NISN, alamat, HP, email, nama dan pekerjaan
orang tua, berat/tinggi badan. File itu di-`import` oleh `DataSiswa.tsx`, jadi ikut terbundel ke
`dist/assets/index-*.js` (terverifikasi: nama siswa ditemukan di bundle sebelum perbaikan). Siapa pun
yang membuka situs atau repo bisa mengunduhnya tanpa login.

Yang sudah diperbaiki di patch ini: file dihapus, import dan tombolnya dihapus, `.gitignore` diperketat.
Yang **harus dilakukan pemilik repo** (tidak bisa saya lakukan):

1. Ubah repo `nitoe/SDM01Penilaian` menjadi **Private** (Settings → Danger Zone).
2. Hapus file dari riwayat git, karena commit lama tetap menyimpannya:
   ```bash
   pip install git-filter-repo
   git filter-repo --path src/data/siswaSeed.json --invert-paths
   git push --force origin main
   ```
   (Lakukan di salinan baru hasil clone; semua orang yang punya clone lama harus clone ulang.)
3. Deploy ulang hosting (`npm run deploy`) agar bundle publik tidak lagi memuat data. Selama belum
   di-deploy, data tetap terunduh dari situs. Cek: buka situs, lihat sumber JS, cari satu nama siswa.
4. Anggap data itu sudah pernah terbuka. Pertimbangkan memberi tahu pihak sekolah sesuai kebijakan
   perlindungan data anak.

**1.2 Repo v2 (zip) juga memuat data siswa.** `tahsin-tahfizh/seed-siswa.html` (3.331 baris) berisi nama, NIS, kelas
403 siswa; `akademik/perbaiki-duplikat-siswa.html` memuat 355 pasangan NIS. Kalau repo v2 publik/GitHub Pages,
perlakukan sama. `assets/firebase.js` v2 juga memuat akun demo berpassword; jangan dimigrasi (sudah di ANTIREGRESI §3.3).

**1.3 Rules `siswa` terlalu longgar dibanding v2.** Di repo baru `allow list: if isGuru()` berarti setiap guru
(termasuk guru Tahsin kelas lain) bisa membaca alamat, HP, dan data orang tua seluruh siswa, karena biodata
ikut disimpan di dokumen `siswa`. v2 membatasi per kelas dan memisahkan biodata ke `identitas_siswa`
(wali kelas/admin saja). Perlu diputuskan: pisahkan lagi biodata sensitif (rekomendasi) atau batasi list per kelas.

**1.4 Field turunan rules** (`penugasanKelasMapel`, `waliKelas`) di v2 diisi manual lewat Console. Salah ketik =
guru kehilangan atau mendapat akses keliru. Halaman Kelola Akun harus menuliskannya otomatis (`turunkanFieldRules`).

## 2. Temuan lain

| # | Temuan | Dampak | Usulan |
|---|--------|--------|--------|
| a | ID siswa: v2 = NIS, repo baru = NIPD/NISN. Di v2, setelah perbaikan duplikat, 403 ID sudah berupa NIPD Dapodik (seed: `nis == nipd` untuk semua) | Aman bila migrasi mengikuti MIGRASI_DATA §3; berisiko bila ada NIS sementara | Jalankan cek ID sebelum cutover |
| b | `gantiNis` (v2) memigrasi 8–10 koleksi | Bila ID tetap NIPD, biaya perawatan besar | Putuskan ID stabil (auto-ID) sebelum menambah koleksi nilai |
| c | Indeks komposit v2 hanya di Console | Query baru bisa gagal | Ekspor ke `firestore.indexes.json` (MIGRASI_DATA §4) |
| d | Satu chunk JS 1,1 MB | Lambat di HP guru | `React.lazy` per modul |
| e | CSP masih Report-Only | Belum melindungi | Aktifkan setelah Console bersih |
| f | `tp_kktp` write per role saja, belum per mapel×tingkatan | Guru bisa mengubah TP mapel lain | Tambah field turunan `penugasanMapelTingkatan`, isi lewat Kelola Akun, lalu perketat rule |
| g | Hapus TP tidak menghapus nilai terkait | Nilai yatim | Pertimbangkan blokir hapus bila ada nilai |
| h | README v2 menyebut bobot SLM/SAS per mapel; kode memakai per TP | Dokumen menyesatkan | Kode yang berlaku; port mengikuti kode |

## 3. Peta migrasi halaman v2 → repo baru

| Modul / halaman v2 | Status |
|---|---|
| Login, beranda, hub, Input Setoran, Riwayat Siswa, Data Siswa (impor CSV/Dapodik) | ✅ sudah ada |
| Setup TP & KKTP, Bobot Semester TP, Input Nilai SLM | ✅ patch ini |
| Profil Sekolah / config akademik (admin) | ⏳ Fase 2 |
| Kelola Akun guru & admin (+ field turunan otomatis), Generator akun | ⏳ Fase 2 |
| Akun orang tua: daftar, persetujuan, riwayat anak (portal ortu) | ⏳ Fase 2 |
| Catat Menulis, Target Hafalan, Cetak Laporan Tahsin | ⏳ Fase 2 |
| Nilai STS/SAS + cakupan (`asesmen_cakupan`, `nilai_sts`, `nilai_sas`) | ⏳ Fase 3 |
| Absensi & keputusan, Kelola DPL, Proyek STEM, Kokurikuler, 7KAIH, Deskripsi Kokurikuler | ⏳ Fase 3 |
| Ekstrakurikuler (master + nilai) | ⏳ Fase 3 |
| Rapor STS, Rapor SAS (cetak), Kelengkapan Rapor (cover, identitas, pindah), Mutasi | ⏳ Fase 4 |
| Utilitas sekali-jalan v2 (seed, perbaiki duplikat/kapitalisasi, import NISN) | ❌ tidak dimigrasi (sudah dijalankan / digantikan) |

## 4. Yang belum diverifikasi

- `firestore.rules` belum diuji di emulator dan belum di-deploy. Uji dengan akun admin, `guru_akademik`, `guru_tahsin_tahfizh`, orang tua.
- Halaman baru lolos `tsc` dan `vite build`, tetapi belum dijalankan terhadap Firestore sungguhan.
- Rumus nilai diuji lewat `scripts/cek-rumus-akademik.mjs` (lolos).
