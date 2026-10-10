# CHANGELOG

> Append-only: entri baru ditambahkan di BAWAH, entri lama tidak diubah.
> Versi mengacu ke `package.json` (saat ini `0.1.0`); belum ada rilis bertag.

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan keamanan & dokumentasi

- `firestore.rules`: ditulis ulang. Pendaftaran `users` hanya sebagai `orangtua`+`pending` (sebelumnya pengguna login mana pun bisa membuat profil dengan role apa pun, termasuk `admin`). Orang tua hanya boleh `get` anaknya sendiri di `siswa` (sebelumnya bisa `list` semua siswa). Guru hanya boleh mengubah `tamatIqro` pada `siswa`; `create/delete` siswa khusus admin. `setoran`/`menulis_log` dibatasi per kelas yang diampu dan immutable. Koleksi `students` dan `nilai` dihapus dari rules. **Belum di-deploy** — jalankan `npm run deploy:rules` setelah uji.
- `firebase.json`: ditambah header keamanan dan CSP mode Report-Only.
- `docs/DATA_MODEL.md` (baru): kontrak data dan keputusan terbuka (project Firebase tunggal, ID siswa).
- `docs/DEPLOY.md`: ditambah langkah custom domain, Authorized domains, dan peringatan bahwa rules tidak ikut ter-deploy otomatis.
- `README.md`: perintah `firebase use` diperbaiki, tabel status migrasi diperbarui.
- `ANTIREGRESI.md` (baru).

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan build & persiapan migrasi data

- `src/lib/siswaAdmin.ts`: perbaikan error TS2352 (`siswaToCsv`) — konversi tipe lewat `unknown`. `npm run build` lolos.
- `src/lib/firebase.ts`: Firestore diinisialisasi dengan `ignoreUndefinedProperties: true`. `normalizeSiswa()` menghasilkan field `undefined` untuk kolom kosong; tanpa opsi ini `setDoc`/`batch.set` melempar "Unsupported field value: undefined" saat menyimpan siswa.
- `scripts/migrate-firestore.mjs` (baru): salin 23 koleksi dari `sdm01-penilaianv2` ke `sdm01kukusan-2e735`. Dry-run bawaan, tidak menimpa dokumen yang sudah ada, ID dokumen dipertahankan.
- `docs/MIGRASI_DATA.md` (baru): langkah migrasi Auth + Firestore, verifikasi, cutover.
- `docs/DATA_MODEL.md`: keputusan #1 ditetapkan (project tunggal `sdm01kukusan-2e735`); skema `siswa` diperbarui sesuai kode.
- `.gitignore`: menolak file kunci service account dan laporan migrasi.

## Belum dirilis (basis: package.json 0.1.0) — Fondasi UI baru (gaya dashboard)

- `src/index.css`: token baru (palet peach, radius kartu 20px, latar hangat), kelas `.hero-banner`, dukungan `prefers-reduced-motion`. `.card-soft` dipertahankan agar halaman lama otomatis ikut tampilan baru.
- `src/components/Icon.tsx`, `src/components/ui.tsx` (baru): ikon SVG tanpa dependensi, `IconTile`, `Badge`, `HeroBanner`, `Chip`, `StatCard`, `ModuleCard`, `SectionTitle`.
- `src/components/Layout.tsx`: shell baru — sidebar berikon, header dengan judul bagian dan tanggal, kartu "Masuk sebagai", navigasi bawah bergaya ikon di mobile.
- `src/pages/Home.tsx`: beranda berisi banner sapaan, ringkasan siswa (terdaftar, Iqro, Al-Qur'an), diagram siswa per kelas, dan kartu modul.
- `src/lib/dashboardStats.ts` (baru): ringkasan memakai count aggregation (15 query per kelas + 1 nonaktif), tanpa mengunduh dokumen siswa.
- `src/lib/roles.ts` (baru): hak akses menu di satu tempat. `src/App.tsx`: `RoleGate` menjaga rute `/tahsin`, `/akademik`, `/admin` per role (sebelumnya semua pengguna login bisa membuka halaman admin; Firestore tetap menolak tulisnya).
- `TahsinHub`, `AkademikHub`, `AdminHub`, `Placeholder`, `Login`: tampilan baru memakai komponen di atas. Logika login tidak diubah.

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan privasi data siswa + fondasi Akademik

- **KEAMANAN**: `src/data/siswaSeed.json` (NISN, alamat, HP, email, nama orang tua 403 siswa) dihapus. File itu diimpor statis oleh `DataSiswa.tsx` sehingga ikut terbundel ke JS publik dan terbaca siapa pun yang membuka situs tanpa login. Tombol "Impor data resmi" dihapus; impor tetap lewat CSV/Dapodik oleh admin. `.gitignore` menolak `src/data/*.json`, `*seed*.json`, `*.xlsx`. Riwayat git masih menyimpan file lama: lihat `docs/AUDIT_MIGRASI.md` §1.
- `src/types/akademik.ts`, `src/lib/akademikRumus.ts` (rumus murni), `src/lib/akademik.ts` (Firestore), `src/lib/penugasan.ts` (baru): TypeScript port dari `firestore-data-akademik.js` v2 untuk mapel, config, TP/KKTP, bobot semester, nilai SLM.
- Halaman baru: `/akademik/setup-tp`, `/akademik/bobot-semester`, `/akademik/nilai-slm`. Validasi baru dibanding v2: rentang KKTP (0–100, naik, tidak tumpang tindih), bobot SLM+SAS = 100, nomor TP unik, penyimpanan nilai hanya untuk baris yang berubah (batch).
- `firestore.rules`: ditambah `bolehMapelKelas`, `bolehWaliKelas`, `config/akademik`, `nilai_tp`. **Belum di-deploy.**
- `src/types/user.ts`, `src/lib/auth.ts`: profil membawa `waliKelas`, `penugasanKelas`, `penugasanKelasMapel`.
- `scripts/cek-rumus-akademik.mjs` (baru): uji rumus nilai (`node --experimental-strip-types scripts/cek-rumus-akademik.mjs`).
- `docs/AUDIT_MIGRASI.md` (baru): temuan audit dan peta migrasi sisa modul.

## Belum dirilis (basis: package.json 0.1.0) — Beranda berorientasi akademik + catatan masa transisi

- `src/pages/Home.tsx`: kartu ringkasan sekarang Tahun ajaran/semester (dari `config/akademik`), siswa terdaftar, dan siswa di kelas saya (admin: rombongan belajar). Info Iqro/Al-Qur'an dihapus dari beranda. Untuk `guru_akademik` ditambah "Mapel dan kelas saya" (dari `penugasan`) dan akses cepat ke Setup TP, Bobot Semester, Input Nilai SLM. Diagram siswa per kelas menyorot kelas milik pengguna. Info dan kartu Tahsin disembunyikan di layar kecil bila pengguna juga punya modul Akademik atau admin.
- `src/components/Layout.tsx`: urutan menu Beranda, Akademik, Tahsin, Administrasi. Kartu "Masuk sebagai" memakai wali kelas/penugasan, bukan `kelasAmpu`.
- `src/lib/kelasSaya.ts` (baru): kelas wali dan kelas mengajar dari profil. `src/lib/dashboardStats.ts`: `loadAkademikConfig()` ditambah; hitungan Iqro/Al-Qur'an dihapus.
- `src/pages/TahsinHub.tsx`: catatan masa transisi (input setoran tetap di sistem lama).
- `docs/MIGRASI_DATA.md`: v2 tidak lagi dibekukan di awal; ditambah bagian "Masa transisi" dan sinkron ulang. `docs/DATA_MODEL.md`: catatan peran dan kelas.

## Belum dirilis (basis: package.json 0.1.0) — Koreksi catatan masa transisi

- Pemilik proyek memastikan v2 belum dipakai guru dan belum ada data nilai/setoran nyata. `docs/MIGRASI_DATA.md`: v2 diperlakukan sebagai referensi, bagian "Masa transisi" diganti menjadi panduan bila ada guru mulai menginput di dua tempat. `src/pages/TahsinHub.tsx`: catatan diubah menjadi netral ("Belum dibuka untuk guru"); sebelumnya menyebut input harian di sistem lama.

## Belum dirilis (basis: package.json 0.1.0) — Impor Excel Dapodik dan pemisahan biodata siswa

- `src/lib/siswaImport.ts` (baru): logika murni data siswa dipindah dari `siswaAdmin.ts` (tanpa perubahan perilaku) ditambah: `rapikanNama` (aturan Title Case v2), `normalisasiTanggal`, `pisahSiswa`/`gabungSiswa`, `praLihatImpor` (baru/update/duplikat), `bacaExcel`, `validasiLayoutDapodik`.
- `src/lib/siswaAdmin.ts`: biodata sekarang ditulis ke `identitas_siswa` (kunci mengikuti v2), `siswa` hanya data dasar; sisa biodata lama di `siswa` dihapus saat disimpan. Ditambah `listSiswaLengkap` (admin), `jalankanImpor`. `upsertSiswaBatch` dihapus (digantikan `jalankanImpor`). Impor tidak lagi menimpa `aktif`, `tamatIqro`, `jenjang` siswa yang sudah ada (sebelumnya impor mengaktifkan kembali siswa nonaktif dan mengosongkan `tamatIqro`).
- `src/pages/admin/DataSiswa.tsx`: impor file Excel Dapodik dengan pratinjau (baru/diperbarui/bermasalah, jumlah per kelas); impor teks CSV tetap ada (di bagian lipat). Daftar admin memuat data gabungan.
- `firestore.rules`: koleksi `identitas_siswa` (admin + wali kelas), mengembalikan pola v2.
- `docs/IMPOR_SISWA.md` (baru), `docs/DATA_MODEL.md` (skema dan pemetaan), `.gitignore` (`*.xlsx`, `*.xls`, `src/data/`).

## Belum dirilis (basis: package.json 0.1.0) — Hapus identitas nyata dari contoh template

- `src/pages/admin/DataSiswa.tsx`: baris contoh pada "Unduh template" memakai NIPD/NISN siswa sungguhan; diganti nilai palsu (`000000001`, `0000000001`). `.gitignore`: `*.patch` dan `*.diff` ditolak karena `fase1.patch` ternyata memuat data 403 siswa.

