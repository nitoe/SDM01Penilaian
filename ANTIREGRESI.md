# ANTIREGRESI

> Append-only: aturan baru ditambahkan di BAWAH. Jangan menghapus atau mengubah makna aturan lama; kalau ada koreksi, tulis aturan baru yang merujuk nomor lama.

## §1. Firestore rules

1.1 **`users` create**: selalu batasi ke `role == 'orangtua' && status == 'pending'` dan daftar field (`keys().hasOnly`). Jangan pernah mengizinkan `create` hanya dengan `request.auth.uid == uid` — itu membuat siapa pun bisa menjadikan dirinya admin.

1.2 **`users` update oleh pemilik**: hanya `nama` dan `updatedAt`. Setiap field baru yang dibaca rules (`role`, `status`, `kelasAmpu`, `penugasan`, `anakIds`, `waliKelas`, `penugasanKelas`, `penugasanKelasMapel`, dst.) JANGAN ditambahkan ke daftar yang boleh diubah pemilik.

1.3 **Orang tua**: hanya `get` ke `siswa/{anakIds}`; tidak ada `list` pada `siswa`.

1.4 **Default deny** di blok paling bawah harus tetap ada. Koleksi baru wajib didaftarkan di `firestore.rules` dan `docs/DATA_MODEL.md` sekaligus.

1.5 **`setoran` / `menulis_log` immutable** (`update: if false`). Jangan membuka update tanpa keputusan eksplisit; riwayat penilaian anak tidak boleh bisa diubah diam-diam.

1.6 **Jangan membuat kembali** koleksi `students` (duplikat `siswa`) dan `nilai` generik (bertabrakan dengan `nilai_tp`/`nilai_sts`/`nilai_sas` dari v2).

1.7 Commit ke GitHub tidak mengubah rules produksi. Selalu `npm run deploy:rules` lalu uji dengan tiga jenis akun (admin, guru, orang tua).

## §2. Header & hosting

2.1 CSP saat ini **Report-Only**. Sebelum mengubahnya menjadi `Content-Security-Policy`, pastikan Console browser bersih dari pelanggaran di halaman login, beranda, dan tiap modul.

2.2 Domain `penilaian.sdmuhammadiyah01kks.sch.id` harus ada di Firebase Auth → Authorized domains.

## §3. Migrasi dari v2

3.1 Satu project Firebase saja sebagai sumber kebenaran (lihat `docs/DATA_MODEL.md`, keputusan #1).

3.2 Impor siswa yang mencocokkan hanya berdasarkan NIS berisiko membuat duplikat (v2 antiregresi §16.6). Tampilkan pratinjau baru/update/duplikat sebelum menulis.

3.3 Akun demo dengan password tertulis di `assets/firebase.js` v2 tidak boleh ikut dimigrasi.

## §4. Build, data siswa, dan migrasi

4.1 **`ignoreUndefinedProperties: true` di `firebase.ts` jangan dihapus.** `normalizeSiswa()` sengaja menghasilkan `undefined` untuk kolom kosong. Tanpa opsi itu, menyimpan siswa gagal saat runtime (TypeScript tidak mendeteksinya).

4.2 `initializeFirestore` hanya boleh dipanggil sekali per app. Di `firebase.ts` dijaga dengan `isNewApp`; jangan diganti dengan pemanggilan langsung di tempat lain.

4.3 Casting `s as Record<string, unknown>` pada interface tanpa index signature gagal dibuild (TS2352). Gunakan `as unknown as Record<string, unknown>`.

4.4 **Kunci service account TIDAK PERNAH di-commit.** Simpan di luar folder repo dan hapus/cabut setelah migrasi selesai.

4.5 `scripts/migrate-firestore.mjs` terkunci ke pasangan project `sdm01-penilaianv2` → `sdm01kukusan-2e735`. Jangan melonggarkan pengecekan itu. `--overwrite` hanya untuk sinkron akhir (cutover), bukan untuk eksperimen.

4.6 Indeks komposit v2 dibuat manual di Console project lama dan tidak ada di repo. Setiap indeks yang dibutuhkan di project baru harus dicatat di `firestore.indexes.json`.

## §5. UI

5.1 Halaman baru memakai komponen di `src/components/ui.tsx` (`HeroBanner`, `StatCard`, `ModuleCard`, `Badge`, `IconTile`) dan ikon dari `Icon.tsx`. Jangan membuat gaya kartu/tombol sendiri per halaman; ubah token di `src/index.css` bila perlu.

5.2 **Tanpa font, ikon, atau skrip dari CDN.** CSP hanya mengizinkan `'self'` (lihat `firebase.json`). Ikon ditambah lewat `PATHS` di `Icon.tsx`.

5.3 Teks putih hanya di atas area hijau pada `.hero-banner` (kontras terjaga). Jangan memindahkan teks putih ke area peach.

5.4 `RoleGate` di `App.tsx` hanya merapikan UI. Hak akses sebenarnya ada di `firestore.rules`; jangan menganggap menu tersembunyi berarti data aman.

5.5 Ringkasan beranda memakai `getCountFromServer`. Jangan diganti dengan mengunduh seluruh koleksi `siswa` (biaya baca dan lambat).

## §6. Data pribadi siswa

6.1 **Jangan pernah mengimpor file data siswa (JSON/CSV/XLSX) ke kode frontend.** Semua yang di-`import` ikut terbundel ke `dist/assets/*.js` dan terunduh oleh siapa pun yang membuka URL situs, tanpa login. Kejadian nyata: `siswaSeed.json` (403 siswa) terbundel di build produksi. Cek sebelum deploy: `grep -c "<nama siswa>" dist/assets/*.js` harus 0.

6.2 Repo GitHub dianggap bisa dibaca publik kecuali dipastikan private. Data siswa tidak boleh di-commit; data hanya hidup di Firestore (dilindungi rules).

6.3 Data siswa masuk lewat halaman impor yang dipakai admin yang sudah login (unggah berkas lokal), bukan lewat berkas di repo.

## §7. Akademik

7.1 **Rumus nilai hanya di `src/lib/akademikRumus.ts`.** Halaman tidak boleh menghitung ulang. Setelah mengubah rumus jalankan `node --experimental-strip-types scripts/cek-rumus-akademik.mjs`.

7.2 `saveTP()` tidak boleh menulis `semester`/`bobotMapel` (dikelola halaman Bobot Semester). Kalau ditulis dengan nilai bawaan, setiap edit TP menimpa pengaturan guru (v2 §20.3).

7.3 Query ke `nilai_tp` (dan nanti `nilai_sts`/`nilai_sas`/`asesmen_cakupan`) wajib menyertakan `where('mapel')` DAN `where('kelas')`, karena rules memeriksa keduanya (v2 §1.1, §10.3).

7.4 `users.penugasanKelas`, `users.penugasanKelasMapel`, `users.waliKelas` dibaca `firestore.rules`. Kalau `penugasan` diubah, ketiganya harus diturunkan ulang (`turunkanFieldRules()`); kalau tidak, guru kehilangan atau mendapat akses yang salah. Di v2 field ini diisi manual lewat Console. Halaman Kelola Akun wajib menulis ketiganya sekaligus.

7.5 Admin tidak menulis TP/KKTP maupun nilai lewat UI (v2 §14.1). Jangan menambah `isAdmin()` ke rule `tp_kktp`.

7.6 Komponen di dalam komponen (mis. `const Kartu = () => ...` di dalam render) membuat `<input>` di-remount tiap ketikan dan kehilangan fokus. Pakai fungsi render atau komponen di luar.

## §8. Peran, beranda, dan masa transisi

8.1 `kelasAmpu` hanya untuk guru Tahsin-Tahfizh. Kelas guru akademik = `waliKelas` + kelas di `penugasan` (`kelasSaya()` / `mapelKelasSaya()`). Jangan memakai `kelasAmpu` untuk tampilan atau akses modul Akademik.

8.2 Fungsi website adalah administrasi penilaian semua guru; Tahsin-Tahfizh hanya salah satu modul. Beranda tidak boleh menjadikan Tahsin sebagai informasi utama, dan info Tahsin tidak tampil di layar kecil bila pengguna juga punya modul Akademik atau admin.

8.3 Beranda tidak menjalankan query ke koleksi nilai (rules mewajibkan `mapel` dan `kelas`, §7.3). Informasi akademik di beranda hanya dari profil dan `config/akademik`.

8.4 Selama transisi, sumber kebenaran data Tahsin-Tahfizh adalah v2. Jangan menginput setoran di situs baru, jangan mengubah rules v2 menjadi tolak-semua, dan jangan memakai `--overwrite` pada skrip migrasi sebelum membandingkan laporan dry-run.

8.5 Koreksi atas 8.4 (per 10 Okt 2026): v2 belum dipakai guru dan belum ada data nyata, jadi v2 bukan sumber kebenaran Tahsin. Aturan intinya tetap: sebelum guru menginput, tetapkan satu sumber kebenaran per modul dan jangan menginput di dua tempat.

## §9. Data siswa dan impor

9.1 **Biodata sensitif hanya di `identitas_siswa`**, bukan di `siswa` (v2 §12.1). `siswa` dibaca semua guru. Kunci yang boleh di `siswa` ada di `DASAR_KEYS`; pemetaan biodata di `IDENTITAS_KEY` (`siswaImport.ts`). Jangan menambah field pribadi baru ke `siswa`.

9.2 Halaman guru memakai `listAllSiswa` (data dasar). Hanya halaman admin memakai `listSiswaLengkap`. Jangan membaca `identitas_siswa` dari halaman guru; rules menolaknya kecuali wali kelas.

9.3 **Impor tidak boleh menimpa `aktif`, `tamatIqro`, `jenjang` siswa yang sudah ada** (kecuali ada di sumber). Versi sebelumnya mengaktifkan kembali siswa nonaktif dan mereset `tamatIqro`.

9.4 Impor harus lewat `praLihatImpor` (pencegah duplikat: NIPD ganda, NISN ganda, NISN dipakai siswa lain) lalu `jalankanImpor`. Jangan menulis siswa massal tanpa pratinjau.

9.5 Nama siswa/orang tua yang HURUF BESAR semua dirapikan per kata; nama campuran tidak disentuh (v2 §17). Jangan mengubah menjadi per huruf setelah tanda baca (merusak "Syafi'i").

9.6 **Data siswa tidak pernah masuk repo atau bundle** (`src/data/`, `public/`, `*.xlsx` diabaikan git). Impor dibaca di browser dari file lokal.

9.7 Setelah impor pertama terverifikasi, pertimbangkan membatasi `siswa` dengan `keys().hasOnly(DASAR_KEYS)` pada rules. Jangan dipasang sebelum semua dokumen lama dibersihkan, atau `setSiswaAktif` pada dokumen lama akan ditolak.

9.8 Berkas `.patch`/`.diff` dan contoh/placeholder di kode tidak boleh memuat data siswa sungguhan. `fase1.patch` (commit b81f5eb) memuat seluruh NIPD dan NISN 403 siswa di cabang utama, dan contoh template memakai identitas satu siswa nyata. Gunakan nilai palsu (`000000001`) untuk contoh.

## §10. Tahsin-Tahfizh: Baca & Tandai dan status

10.1 **Baca & Tandai adalah fitur inti, bukan opsional.** `detailAyat` dan `detailBacaanIqro` pada setoran tidak boleh diisi kosong/null secara tetap. Bentuk simpan (sama dengan v2): `detailAyat: [{ayat, status: 'lulus'|'gagal'|null, kataSalah: [{index, jenis}]}]`, `detailBacaanIqro: {teks, kataSalah}`; `jenis` hanya `'tajwid'` atau `'makhroj'`.

10.2 **Istilah status mengikuti data v2.** Status setoran: `'lulus'` | `'ulang'` (label "Perlu diulang"); per ayat: `'lulus'` | `'gagal'`. Jangan menambah nilai baru. Pembacaan data wajib lewat `recordSetoran`/`normalisasiStatus` agar data lama (`'mengulang'`, `'belum'`) tidak tampil kosong.

10.3 Teks ayat diambil dari `https://equran.id` (hanya nomor surah yang dikirim). Alamat itu harus ada di `connect-src` CSP. Jika gagal dimuat, penanda Lulus / Perlu diulang per ayat tetap harus bisa dipakai.

10.4 Rules `setoran`/`menulis_log` (v2 §5): update hanya oleh pembuat dan hanya field sederhana (`jenis`, `statusHafalan`, `catatan`; materi dan Baca & Tandai terkunci); delete oleh pembuat atau admin. Pembatasan ini dijaga di rules, bukan hanya di UI.

10.5 Sebelum mengubah logika tanda/ringkasan, jalankan `npx tsx scripts/cek-baca-tandai.mts` (harus mencetak SEMUA UJI LULUS).

