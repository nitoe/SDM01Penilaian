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

## Belum dirilis (basis: package.json 0.1.0) — Tahsin-Tahfizh: Baca & Tandai dan istilah status dikembalikan

- Penyebab fitur "menandai hafalan baik/kurang" hilang: `InputSetoran.tsx` menyimpan `detailAyat: []` dan `detailBacaanIqro: null` secara tetap, dan istilah status berbeda dari data v2.
- `src/components/BacaTandai.tsx` (baru): Baca & Tandai (ketuk kata = tajwid, lalu makhroj, lalu bersih; ayat Lulus / Perlu diulang; penanda ayat kritis ≥ 3 kata salah; statistik) dan Latihan Membaca Iqro. `src/lib/bacaTandai.ts` (baru, logika murni) dan `src/lib/quranText.ts` (baru, teks ayat dari equran.id dengan cache sesi dan batas waktu).
- `src/pages/tahsin/InputSetoran.tsx`: memakai komponen di atas; menyimpan `detailAyat`/`detailBacaanIqro` dalam bentuk v2; tanda ayat yang masih dalam rentang dipertahankan saat rentang digeser; validasi ayat akhir ≥ ayat mulai; label dihubungkan ke kontrol (aksesibilitas).
- `src/types/tahsin.ts`: `StatusHafalan` menjadi `'lulus' | 'ulang'` (sama dengan v2; sebelumnya `'mengulang' | 'belum'`, yang membuat status v2 tampil kosong). Data lama `'mengulang'`/`'belum'` dibaca sebagai `'ulang'` (`normalisasiStatus`).
- `src/pages/tahsin/RiwayatSiswa.tsx`, `src/lib/tahsinData.ts`: badge "Perlu diulang", ringkasan Baca & Tandai pada kartu, ubah (jenis/status/catatan) dan hapus catatan milik sendiri (admin boleh menghapus).
- `firestore.rules`: `setoran` dan `menulis_log` — update hanya oleh pembuat (setoran: hanya `jenis`, `statusHafalan`, `catatan`), delete oleh pembuat atau admin (sebelumnya update ditolak dan delete hanya admin). **Belum di-deploy.** `firebase.json`: CSP `connect-src` ditambah `https://equran.id`.
- `scripts/cek-baca-tandai.mts` (baru), `docs/PARITAS_FITUR.md` (baru, daftar fitur v2 vs situs baru dan daftar uji manual), `src/index.css` (gaya teks Arab dan tanda kata).

## Belum dirilis (basis: package.json 0.1.0) — Teks Al-Qur'an lengkap, tata letak PC Input Setoran, Target Hafalan

- Penyebab tulisan Arab kurang baik: situs memakai font sistem tanpa dukungan tanda baca Al-Qur'an yang baik, dan data hanya `teksArab`. `public/fonts/amiri-quran-arabic-400-normal.woff2` (+ lisensi SIL OFL 1.1) disajikan dari situs sendiri (sesuai CSP); semua 39 tanda baca Al-Qur'an yang diuji tersedia. `src/index.css`: `@font-face` dan ukuran teks 3 tingkat.
- `src/lib/quranText.ts` ditulis ulang: data surah dari EQuran.id berisi teks Arab, transliterasi, terjemahan Indonesia, audio per ayat dan surah penuh dari enam qari. URL audio hanya diterima bila https dan domain `equran.id`. Cache sesi memakai kunci baru (`tt_quran_v2_`). `src/lib/preferensiBaca.ts` (baru): qari, transliterasi, terjemahan, ukuran teks tersimpan per browser. `src/lib/useAudio.ts` (baru): satu pemutar, putar berurutan, berhenti sendiri.
- `src/components/BacaTandai.tsx`: bilah alat (qari, saklar transliterasi/terjemahan, ukuran, putar rentang, audio penuh), tombol putar per ayat dengan sorotan dan gulir otomatis, info surah, atribusi EQuran.id.
- `src/pages/tahsin/InputSetoran.tsx` dirombak untuk PC: dua kolom (daftar siswa tetap di kiri, area kerja di kanan), bilah simpan yang selalu terlihat, setoran terakhir + tombol Lanjutkan/Ulangi (`src/lib/lanjutan.ts`), Simpan & berikutnya, Ctrl+Enter. HP: daftar siswa diciutkan setelah memilih, bilah simpan diringkas, catatan dilipat. `src/components/PanelSiswa.tsx` (baru, dapat dipakai ulang).
- `src/components/Layout.tsx`: perbaikan `position: sticky` yang tidak berfungsi sejak pembungkus memakai `overflow-hidden` (sidebar dan header ikut tergulir); diganti `md:overflow-clip`. Halaman kerja harian memakai lebar penuh (`HALAMAN_LEBAR`).
- Target Hafalan: `src/pages/tahsin/TargetHafalan.tsx`, `src/lib/target.ts` (logika murni), `getTargetHafalan`/`saveTargetHafalan` di `tahsinData.ts`, rute `/tahsin/target`. Format data sama dengan v2. Riwayat Siswa → Ringkasan: Kualitas bacaan (5 sesi) dan progres terhadap target.
- `firebase.json`: CSP ditambah `media-src 'self' https://*.equran.id`. `scripts/cek-baca-tandai.mts` diperluas, `scripts/cek-target.mts` (baru), `docs/PARITAS_FITUR.md` diperbarui.

## Belum dirilis (basis: package.json 0.1.0) — Kelola Akun Guru

- `src/pages/admin/KelolaAkun.tsx`, rute `/admin/users`: admin membuat akun guru (Tahsin-Tahfizh, Akademik, atau administrator), mengubah kelas/mapel/wali kelas, mengirim tautan atur ulang password, dan menonaktifkan akun. Kartu di hub admin ditandai siap. Akun orang tua tidak disentuh. Halaman masuk daftar lebar (`HALAMAN_LEBAR`).
- `src/lib/akunGuru.ts`: penyusunan dokumen (`susunDokumenAkun`) selalu menulis `kelasAmpu`, `penugasan`, `waliKelas`, `penugasanKelas`, dan `penugasanKelasMapel` sekaligus. Peran yang tidak memakai sebuah tugas menyimpan array kosong. Uji: `node --experimental-strip-types scripts/cek-akun-guru.mjs`.
- `src/lib/akunGuruData.ts`: user Auth dibuat lewat aplikasi Firebase sekunder dengan persistence memori, supaya sesi admin tidak terganti. Password awal hanya ditampilkan sekali.
- `users.aktif`: `false` menolak login di aplikasi. `firestore.rules` menolak baca/tulis lewat `akunAktif()` (dokumen lama tanpa field ini tetap aktif). **Rules belum di-deploy** — jalankan `npm run deploy:rules`, lalu `npm run deploy` agar halaman tampil di situs.
- Admin tidak dapat menonaktifkan atau mengganti peran akunnya sendiri dari halaman ini.



## Belum dirilis — Pendaftaran mandiri guru & fitur akun

- Pendaftaran mandiri guru: halaman `/register` dengan dropdown nama guru resmi (dari penugasan 2026-2027). Akun dibuat dengan `status: pending`, menunggu persetujuan admin.
- Field `gelar` (pendidikan terakhir) ditambahkan pada profil guru. Dipakai untuk penandatanganan rapor (`nama, gelar`).
- Guru dapat mengedit nama dan gelar sendiri di `/profil`.
- Halaman login: toggle tampilkan/sembunyikan password (default sembunyi), fitur lupa password (kirim tautan reset).
- Admin tetap dapat membuat akun langsung di Kelola Akun. Ditambah tombol Ekspor JSON akun guru (untuk backup/impor ulang tanpa duplikat).
- `firestore.rules`: diperbarui agar mendukung create guru pending dan update `gelar` oleh pemilik.
- Data nama guru resmi: `src/lib/dataGuruResmi.ts`.

## Belum dirilis — Approval akun guru di Kelola Akun

- Filter baru **Menunggu** di halaman Kelola Akun.
- Badge status: Menunggu (peach), Ditolak, Aktif/Nonaktif.
- Panel samping: untuk akun pending muncul tombol **Setujui & atur tugas** (membuka form) dan **Tolak pendaftaran**.
- Menyimpan form akun pending otomatis mengubah status menjadi `approved`.
- Fungsi `setStatusAkun` ditambahkan di `akunGuruData.ts`.
- Nama + gelar ditampilkan di panel detail.

## Belum dirilis — Integrasi nama + gelar untuk rapor

- Komponen baru `TandaTanganGuru` yang menampilkan "Nama, Gelar".
- Halaman `/akademik/rapor` (pratinjau): tanda tangan diri sendiri dan wali kelas terpilih memakai gelar.
- Layout (sidebar & header) menampilkan gelar di samping nama jika ada.
- AkademikHub menandai halaman Rapor sebagai siap (pratinjau tanda tangan).

## Belum dirilis — Pendaftaran guru: pilih peran dan kelas

- Form `/register` diperlebar dan guru dapat memilih peran:
  - Guru Tahsin-Tahfizh
  - Guru Akademik (wali kelas / bidang studi)
  - Kombinasi
- Guru dapat memilih kelas Tahsin, wali kelas, dan penugasan mapel saat mendaftar.
- Data tersebut disimpan dengan status `pending`; admin meninjau dan menyetujui di Kelola Akun.
- `firestore.rules`: field kelasAmpu, penugasan, waliKelas, dan turunan diizinkan pada create pendaftaran guru.

## Belum dirilis — Form tambah guru admin selaras dengan pendaftaran

- Form Tambah/Ubah akun di Kelola Akun memakai pilihan peran yang sama:
  Guru Tahsin-Tahfizh, Guru Akademik, Kombinasi, Administrator.
- Pemilihan peran berupa kartu (bukan dropdown) dengan deskripsi singkat.
- Hint kelas dan penugasan diselaraskan dengan form pendaftaran mandiri.

## Belum dirilis — Daftar mapel dan tugas guru yang bisa digabung

- Admin → Mata Pelajaran: daftar bawaan (Pendidikan Pancasila sampai Tahfizh) langsung bisa dipilih, lalu disimpan ke Firestore.
- Form daftar dan tambah guru: tugas Tahsin-Tahfizh, Guru Kelas, dan Guru Bidang Studi bisa dipilih bersamaan. Tahsin + guru kelas tidak lagi tertutup oleh satu peran “Kombinasi”.
- Rules: akun kombinasi (`guru`) boleh mengakses data wali kelas dan mapel yang ditugaskan.

## Belum dirilis — Setup TP diselaraskan dengan penilaian-v2

- Daftar mapel bawaan memakai nama resmi v2: IPAS dan PJOK (bukan nama panjang). Tahsin dan Tahfizh dikeluarkan dari mapel akademik karena bukan TP/KKTP. Dokumen mapel yang sudah tersimpan tidak ditimpa.
- Halaman Mata Pelajaran menandai nama lama supaya bisa diganti manual.
- Setup TP: kartu mapel menampilkan jumlah TP (atau “Belum ada TP”) dan Fase A/B/C. Halaman detail menolak tingkatan di luar `tingkatanBerlaku`; gagal memuat data mapel tidak mengunci guru. Kartu TP menampilkan bobot SLM/SAS. Semester dan bobot mapel tetap hanya di halaman Bobot Semester.

## Belum dirilis — Input dan laporan SLM

- Input Nilai SLM menampilkan kelengkapan per mapel+kelas (semua TP / sebagian / belum ada TP) dan ringkasan rata-rata tertimbang SLM. Level KKTP dihitung dari SLM saja lewat `hitungNilaiAkhirTP`.
- Halaman baru `/akademik/laporan-slm`: tabel nilai per TP plus rata-rata, bisa dicetak. Hanya TP semester berjalan (dan yang belum dikelompokkan).
- Admin → Tahun Ajaran mengatur `config/akademik` (semester dan tahun ajaran) tanpa menimpa field lain. Mengganti semester tidak memindahkan nilai lama.
- `firestore.indexes.json`: indeks untuk `tp_kktp`, `nilai_tp`, dan `siswa`. **Belum di-deploy** — jalankan `npm run deploy:rules` supaya query nilai tidak ditolak Firestore.

## Belum dirilis — Guru kelas juga menyusun TP

- Keterangan Setup TP, bobot, dan input SLM tidak lagi menyebut hanya “guru mata pelajaran”. Yang menyusun TP adalah guru kelas maupun guru bidang studi yang mengampu mapel itu. Admin tetap tidak menulis TP.
- Formulir daftar dan Kelola Akun: guru kelas wajib memilih mapel yang diampu di kelas walinya. Pilihan itu disimpan sebagai penugasan, jadi guru kelas bisa membuka Setup TP, bobot, dan nilai SLM. Mapel di kelas lain tetap di bagian guru bidang studi.
- Kotak peringatan admin pada Setup TP, Bobot Semester, Input Nilai SLM, dan Laporan SLM memakai kalimat yang sama: disusun atau diisi oleh guru kelas maupun guru bidang studi; administrator tidak menulis.

## Belum dirilis — Akses guru kelas dan data sekolah

- Guru kelas membuka semua mapel di tingkat kelas walinya (termasuk PJOK dan mapel guru bidang studi) tanpa penugasan mapel. Guru bidang studi tetap hanya mapel yang ditugaskan. Guru Tahsin-Tahfizh tidak melihat menu Akademik.
- Admin dapat melihat TP, bobot, nilai, dan laporan SLM, tanpa tombol simpan atau hapus.
- Rules `nilai_tp`: guru kelas boleh menulis nilai di kelasnya; admin hanya membaca. **Belum di-deploy** — jalankan `npm run deploy:rules`.
- Administrasi → Data Sekolah: identitas, NPSN, alamat, kepala sekolah, tahun ajaran, semester, Seni Budaya, tanggal rapor, dan dimensi profil lulusan. Nilai baru menempel pada tahun ajaran aktif; data tahun lalu tidak dipindahkan.

## Belum dirilis — Nilai STS dan SAS

- Halaman `/akademik/nilai-sts`: guru memilih cakupan TP untuk STS atau SAS secara terpisah, lalu mengisi nilai per siswa. STS hanya menaikkan SLM bila lebih tinggi. SAS menampilkan SLM, STS, dan pratinjau nilai akhir TP.
- Koleksi `asesmen_cakupan`, `nilai_sts`, `nilai_sas`. Admin hanya membaca. **Rules dan indeks belum di-deploy** — jalankan `npm run deploy:rules`.







## Belum dirilis — Dashboard beranda per peran + filter admin + UI Data Sekolah

- `src/pages/Home.tsx`: ringkasan beranda disesuaikan per peran.
  - Guru akademik/kelas/bidang studi: **tidak lagi menampilkan daftar nama mapel**. Diganti kartu progres interaktif (Setup TP X/Y, TP tanpa bobot semester, pintasan nilai SLM) dengan badge "Perlu aksi".
  - Guru Tahsin: ringkasan siswa di kelas ampu + setoran 7 hari terakhir + pintasan Input Setoran.
  - Admin: tetap ringkasan sekolah + diagram siswa per kelas.
- `src/lib/dashboardStats.ts`: ditambah `loadGuruAkademikProgress`, `loadSiswaCountKelas`, `loadSetoranMingguIni`.
- `src/pages/akademik/SetupTp.tsx`: filter pencarian mapel + status (sudah/belum ada TP) di pemilih mapel×tingkatan.
- `src/pages/admin/Mapel.tsx`: kotak pencarian daftar mapel.
- `src/pages/admin/TahunAjaran.tsx` (Data Sekolah): UI dirapikan — section berikon, label wajib, layout 2 kolom, sticky tombol simpan di mobile, indikator jumlah DPL terpilih. Tidak mengikuti layout v2 secara ketat.

## Belum dirilis — Impor TP (JSON kurikulum → tp_kktp)

- `src/lib/tpImport.ts` (baru): parser murni untuk dua format — ekspor kurikulum (`tp[]` + `subjectKey`) dan format sistem (`items[]`). Mapel dinormalisasi ke nama resmi MAPEL_BAWAAN; `className` 5A → tingkatan `5`; `materiBuku` diabaikan; nomor TP diulang 1..n per mapel bila order sumber tidak berurutan.
- `src/lib/akademik.ts`: `importTPBatch` (mode `tambah` / `ganti`) memakai writeBatch; tidak menyentuh `semester`/`bobotMapel`.
- `src/pages/akademik/SetupTp.tsx`: panel **Impor JSON** di hub mapel×tingkatan dan di halaman detail mapel (filter otomatis ke pasangan aktif). Pratinjau ringkasan + peringatan sebelum tulis.
- `docs/tp-import-kelas5-faseC.json`: contoh siap impor (127 TP kelas 5 fase C) dari `tujuan-pembelajaran-20261013.json`. Deskripsi level KKTP masih kosong — guru melengkapi di Setup TP.

## Belum dirilis — Template Excel TP (ekspor + impor)

- `src/lib/tpImport.ts`: template Excel resmi (`TP_EXCEL_HEADERS`), `parseTpExcelRows`, `bacaExcelTp`, `buatExcelTp`, `unduhBlob`. Sheet "Petunjuk" menjelaskan kolom wajib. Baris contoh (`Contoh:…`) diabaikan saat impor. Nomor TP kosong diisi otomatis per mapel×tingkatan.
- `src/pages/akademik/SetupTp.tsx`: panel **Impor / Ekspor** — unduh template kosong, ekspor TP saat ini (detail mapel), unggah `.xlsx`/`.xls` atau JSON. Mode tambah/ganti tetap.

## Belum dirilis — TP per kelas paralel + template Excel KKTP

- **Skema**: `tp_kktp` sekarang per **mapel × kelas** (5A ≠ 5B). Field `kelas` wajib; `tingkatan` turunan. Mencegah guru rombel lain memakai TP tanpa menyusun sendiri.
- `getTPList`/`saveTP`/`importTPBatch`, Setup TP, Bobot Semester, Nilai SLM/STS/SAS, Laporan SLM, dashboard progres: memakai kelas.
- Template Excel: kolom `kelas` + deskripsi level KKTP (boleh kosong saat impor). UI filter Setup TP dirapikan (chip satu baris).
- Indeks Firestore: `tp_kktp` mapel+kelas. Deploy: `npm run deploy:rules`.

## Belum dirilis — Alokasi TP multi-semester + bobot live

- **Masalah**: TP hanya bisa masuk Semester 1 ATAU 2; praktik di lapangan ada TP yang dipakai di kedua semester. Total bobot per semester tidak mudah dipantau secara live.
- **Model data** (`types/akademik.ts`): field baru `bobotPerSemester?: { '1'?: number; '2'?: number }`. Key yang ada = TP dialokasikan ke semester itu (boleh keduanya, bobot berbeda). Field legacy `semester` + `bobotMapel` tetap ditulis sebagai fallback.
- **Rumus** (`akademikRumus.ts`): `tpMasukSemester` membaca `bobotPerSemester` dulu; helper baru `bobotTpDiSemester` dan `normalisasiAlokasiTp`. Uji di `scripts/cek-rumus-akademik.mjs` lolos.
- **Simpan** (`saveBobotSemesterBatch`): menulis `bobotPerSemester` + legacy `semester`/`bobotMapel` (primer = Sem 1 jika ada). TP tanpa alokasi → hapus ketiga field.
- **UI Bobot Semester**: checkbox per semester per TP (boleh centang keduanya), input bobot per semester, ringkasan live (progress bar + sisa/% kelebihan) di atas halaman, badge "Dipakai di kedua semester", tombol ratakan per semester.
- **Konsumen**: Nilai SLM, Laporan SLM, Setup TP memakai `bobotTpDiSemester` / `normalisasiAlokasiTp` agar bobot yang ditampilkan sesuai semester aktif.

## Belum dirilis — UI/UX Nilai STS & SAS (fokus guru senior)

- `src/pages/akademik/NilaiStsSas.tsx` dirombak untuk kenyamanan guru 50+:
  - Label lengkap: **Ujian Tengah (STS)** / **Ujian Akhir (SAS)** — bukan singkatan saja.
  - Cakupan diganti bahasa sehari-hari: **Pilih materi yang diujikan**; tombol Centang semua / Kosongkan; kartu checkbox besar.
  - Default: jika belum pernah atur cakupan, semua TP semester aktif sudah dicentang (guru hanya uncentang yang tidak diujikan).
  - Isi nilai: **satu materi fokus** (chip pilih materi), input besar (h-12 / h-14, font 17–18px), progress bar terisi, warna baris sudah/belum.
  - **Enter** = siswa berikutnya; di baris terakhir Enter = simpan.
  - Sticky tombol Simpan di bawah layar (mobile & desktop).
  - Halaman memakai lebar penuh (`HALAMAN_LEBAR`).
- `src/components/Layout.tsx`: `/akademik/nilai-sts` masuk daftar halaman lebar.
- `src/pages/AkademikHub.tsx`: deskripsi kartu STS/SAS diperjelas.

## Belum dirilis — Nilai STS/SAS: layout spreadsheet 1 tabel

- `NilaiStsSas.tsx`: diganti layout **satu tabel** (baris = siswa, kolom = materi yang dicentang) menggantikan daftar bertumpuk per TP.
- Panel kanan (desktop) / atas (mobile): centang materi diujikan, bisa **Tampilkan / Sembunyikan**.
- Tombol **Simpan** selalu tersedia: di bawah panel materi saat panel terbuka, atau sticky di bawah layar saat panel disembunyikan. Menyimpan semua perubahan di semua kolom sekaligus.
- Navigasi sel: Enter / panah kanan-kiri-atas-bawah.
- Default cakupan: semua TP semester aktif dicentang jika belum pernah disimpan.

## Belum dirilis — Nilai SLM: layout spreadsheet sama seperti STS/SAS

- `NilaiSlm.tsx`: diganti **satu tabel** (siswa × materi semester), panel kanan tampil/sembunyi kolom, simpan semua perubahan sekaligus, navigasi panah/Enter, kolom rata-rata tertimbang live, badge level KKTP per sel.
- `/akademik/nilai-slm` masuk HALAMAN_LEBAR.
- SAS sudah memakai layout spreadsheet yang sama di `NilaiStsSas.tsx` (toggle Ujian Akhir).

## Belum dirilis — Guard nilai belum disimpan + cache lokal draf

- `src/lib/nilaiDraftCache.ts` (baru): simpan/baca/hapus draf nilai di localStorage per mapel×kelas×semester×tahun×jenis (slm/sts/sas).
- `src/lib/useUnsavedGuard.ts` (baru): konfirmasi sebelum keluar jika ada perubahan — beforeunload (tutup tab/refresh), klik menu/back link, tombol back browser.
- `NilaiSlm.tsx` & `NilaiStsSas.tsx`: menulis draf lokal (debounce 400ms) saat ada perubahan; memulihkan draf saat buka ulang; menghapus cache setelah simpan sukses; dialog "Nilai belum disimpan".

## Belum dirilis (basis: package.json 0.1.0) — Perbaikan pendaftaran ulang guru dan kejelasan "hapus" akun

- **Masalah**: akun guru dibuat admin, profilnya dihapus lewat Kelola Akun, lalu orangnya mendaftar ulang di `/register`. Hasilnya pesan "email sudah terdaftar", dan setelah perbaikan sebelumnya tombol Daftar berhenti di "Mendaftar…". Di Console terlihat `POST accounts:signUp 400`, yaitu respons normal Firebase untuk email yang masih ada di Authentication.
- **Penyebab 1**: tombol "Hapus permanen" hanya menghapus dokumen `users/{uid}`. User Firebase Authentication tidak ikut terhapus (SDK web tidak bisa menghapus user lain; perlu Admin SDK). Email itu karenanya tetap tercatat di Auth.
- **Penyebab 2 (berhenti di "Mendaftar…")**: `Register.tsx` membuat/masuk akun lewat `auth` utama. `onAuthStateChanged` di `App.tsx` langsung melihat "user ada, profil belum ada" dan memanggil `logout()` di tengah penulisan profil. Selain itu penulisan Firestore yang offline tidak pernah gagal, hanya menggantung, sehingga tombol tidak kembali.
- `src/lib/akunGuruData.ts`: `daftarMandiriGuru()` (baru) menjalankan seluruh pendaftaran di app Firebase sekunder `sdm-daftar-mandiri` (persistence memori), sama polanya dengan `buatAkunGuru`. Email baru → user dibuat dan profil `pending` ditulis. Email sudah ada di Auth tanpa profil → masuk dengan password yang diketik lalu profil `pending` ditulis ulang. Batas tunggu 30 detik. `kodeGalat()` (baru) diekspor. Komentar `hapusAkunStaf` diperjelas.
- `src/pages/Register.tsx`: memakai `daftarMandiriGuru`; tidak lagi memakai `auth` utama untuk membuat/masuk akun. Bila password tidak cocok dengan login lama, muncul tombol "Kirim tautan atur ulang password" (`sendPasswordResetEmail`), lalu guru mendaftar lagi dengan password baru. Pesan galat diperbarui.
- `src/pages/admin/KelolaAkun.tsx`: tombol "Hapus permanen" diganti "Hapus dari daftar staf" dengan keterangan bahwa user Authentication tidak ikut terhapus. Setelah penghapusan muncul kartu petunjuk yang tidak hilang sendiri: tautan ke Firebase Authentication project dan tombol salin email.
- Tidak ada perubahan `firestore.rules` maupun `App.tsx`. Butuh `npm run deploy` (hosting) agar perbaikan tampil di situs.

## Belum dirilis (basis: package.json 0.1.0) — Hapus akun benar-benar permanen (Cloud Function)

- Project `sdm01kukusan-2e735` sudah di paket Blaze, sehingga Admin SDK bisa dipakai. Melanjutkan entri "Perbaikan pendaftaran ulang guru" di atas.
- `functions/` (baru): Cloud Function callable `hapusAkunAuth` (wilayah `asia-southeast2`, Node 22, v2). Menghapus user Firebase Authentication lalu dokumen `users/{uid}`. Hanya administrator aktif; menolak menghapus akun sendiri, akun orang tua, dan administrator aktif terakhir. User Auth yang sudah tidak ada (dihapus manual di Console) dianggap berhasil dan profilnya tetap dibersihkan. Aturan murni ada di `functions/aturan.js`.
- `scripts/cek-hapus-akun.mjs` (baru): uji aturan di atas (`node scripts/cek-hapus-akun.mjs`).
- `src/lib/akunGuruData.ts`: `hapusAkunStaf` memanggil fungsi itu dan mengembalikan `{ authDihapus }`. Bila fungsi belum di-deploy (`functions/not-found`) jatuh ke cara lama (hanya profil Firestore). Galat lain tidak menghapus apa pun. `pesanGalatAuth` memetakan `functions/internal` dan `functions/unavailable`.
- `src/pages/admin/KelolaAkun.tsx`: label kembali "Hapus permanen" dengan teks konfirmasi yang sesuai. Kartu petunjuk Console hanya muncul bila fungsi belum aktif (fallback).
- `firebase.json`: blok `functions`; CSP `connect-src` ditambah `https://*.cloudfunctions.net`. `package.json`: skrip `deploy:functions` (versi tetap 0.1.0).
- Urutan deploy: `npm run deploy:functions` DULU, baru `npm run deploy` (hosting). `firestore.rules` tidak berubah.

## Belum dirilis — Admin sebagai pemantau (Tahap 1 dari 3)

- Peran: admin tidak lagi menulis apa pun yang menjadi tugas guru. Halaman Akademik sudah mode lihat sejak sebelumnya; yang ditutup sekarang adalah jalur Tahsin-Tahfizh (Input Setoran, Target Hafalan, hapus catatan guru) dan jalur rules (`delete` nilai, `seni_kelas`).
- `firestore.rules`: `bolehKelas()` tanpa admin, `lihatKelas()` baru untuk baca, `waliKelasSendiri()` baru, `delete` nilai `if false`, `delete` setoran/menulis_log hanya pembuat. **Belum di-deploy.**
- `src/lib/roles.ts`: `isGuruTahsinRole`, `teksPeran`. `src/App.tsx`: `RoleGate` menerima tujuan alih; input setoran dijaga.
- Nama menu khusus admin: Pantauan Akademik, Tujuan Pembelajaran, Bobot Tujuan Pembelajaran, Daftar Nilai Harian, Daftar Nilai STS & SAS, Rekap Nilai Harian, Pantauan Tahsin & Tahfizh. `AkademikHub` dan `TahsinHub` punya varian admin (Input Setoran dan Rapor tidak ditampilkan untuk admin).
- `scripts/cek-peran-admin.mjs` (baru). `ANTIREGRESI.md` §17. `docs/PROGRES_ADMIN.md` (baru): rencana dan status Tahap 1–3.

## Belum dirilis — Dashboard beranda admin bertab (Tahap 2 dari 3)

- `src/pages/AdminDashboard.tsx`, `src/components/Tabs.tsx` (baru): tab Ringkasan, Tujuan Pembelajaran, Bobot, Nilai, Tahsin-Tahfizh; guru sudah/belum, saring, cari, rincian per mapel×kelas dengan tautan lihat; tombol Muat ulang; ikut periode terpilih di header.
- `src/lib/monitoringAdminRumus.ts` (logika murni) dan `src/lib/monitoringAdmin.ts` (pemuat, hanya baca): tanggung jawab per mapel×kelas, status TP/bobot/nilai, setoran Tahsin per guru.
- `src/pages/Home.tsx`: admin menampilkan dashboard di atas diagram siswa per kelas; kartu modul memakai nama pantauan.
- `scripts/cek-monitoring-admin.mjs` (baru). `ANTIREGRESI.md` §18. Tidak ada perubahan rules atau indeks pada tahap ini.

## Belum dirilis (basis: package.json 0.1.0) — Identitas visual biru sekolah dan perombakan beranda

Perbaikan tampilan; tidak ada perubahan logika data, `firestore.rules`, indeks, maupun rumus.

- `src/index.css`: palet merek dipindah dari hijau ke biru lambang sekolah (`#313083`) lewat token `muh-*` yang sama, sehingga semua halaman ikut berubah tanpa disunting. `peach-*`/`gold-*` disatukan menjadi satu skala ambar (perhatian). Radius kartu 20px → 12px, `.card-soft` datar bergaris tipis. Gaya Stripe (gradient mesh, indigo/magenta/ruby, huruf 300, tombol pil) dihapus; kelas `auth-*` dipertahankan namanya dan digayakan ulang. `.hero-banner` menjadi biru tua rata. Angka tabel memakai `tabular-nums`.
- Inter kini dihosting sendiri: `public/fonts/inter-latin-wght-normal.woff2` dan `Inter-LICENSE-OFL.txt` (baru). `index.html`: tautan Google Fonts dihapus (sebelumnya melanggar §5.2 dan akan diblokir saat CSP dijadikan enforce), `theme-color` menjadi `#313083`, ikon memakai aset baru.
- Aset baru: `public/logo-sdm.png`, `public/favicon-sdm-32.png`, `public/apple-touch-icon-sdm.png`; `public/favicon.svg` memuat lambang sekolah. `favicon-32.png` dan `apple-touch-icon.png` lama tidak lagi dipakai (boleh dihapus).
- `src/components/Layout.tsx`: bingkai panel melayang dihapus; sidebar biru tua dengan lambang sekolah dan blok profil polos (menggantikan kartu banner "Masuk sebagai"); di layar kecil header memuat lambang.
- `src/components/ui.tsx`: `IconTile` disatukan (hijau/sky/violet → biru merek, `peach` → ambar, `ink` → netral). `Badge`: `green` kini berarti sukses (zamrud), tone baru `brand` (biru) dan `ok`. Komponen baru `StatStrip` dan `FlowRow`.
- `src/pages/Home.tsx`: beranda guru disusun ulang menjadi sapaan ringkas → `StatStrip` → "Alur penilaian" bernomor dengan status dari progres TP → diagram siswa per kelas. Banner, "Akses cepat", dan "Modul" dihapus (menduplikasi navigasi). Hook dan pemuatan data tidak diubah; tidak ada query ke koleksi nilai (§8.3). Diagram: kelas saya biru tua, lainnya biru muda.
- `src/pages/Login.tsx`, `src/pages/Register.tsx`: warna Stripe yang tertulis langsung (`#0d253d`, `#64748d`, `#4434d4`, dst.) dan `font-light` diganti token; panel kiri login memakai lambang sekolah dan teks singkat tanpa slogan pemasaran. Logika tidak diubah.
- Makna status dipertahankan: Lulus di `BacaTandai.tsx`, `InputSetoran.tsx`, `RiwayatSiswa.tsx` (termasuk bilah progres selesai) tetap hijau; `SetupTp.tsx` memakai `Badge tone="brand"` untuk label tipe.
- `DESIGN.md`: diganti seluruhnya (sebelumnya analisis gaya Stripe yang tidak cocok untuk aplikasi kerja). `ANTIREGRESI.md` §19.
- Diperiksa: `npm run build`, `npx oxlint` (0 galat; 4 peringatan lama di berkas yang tidak disentuh), `scripts/cek-baca-tandai.mts`, `scripts/cek-rumus-akademik.mjs`; tampilan dirender di 1440px dan 390px dengan data tiruan. Belum diuji dengan data Firestore sungguhan.

## Belum dirilis (basis: package.json 0.1.0) — Kelola Periode dan Kelola Akun disinkronkan dengan halaman lain

Perbaikan tampilan; tidak ada perubahan logika data, `firestore.rules`, indeks, maupun fungsi di `lib/`.

- `src/pages/akademik/shared.tsx`: token bersama ditambah — `btnPrimarySm`, `btnGhostSm`, `btnDanger`, `btnDangerGhost`, `btnDangerGhostSm`, `btnWarn`, serta komponen `Field`, `ChipToggle`, `Segmented`. `Notice` bernada `info` kini biru merek (bukan `sky`) dan ada nada `ok`. `inputCls` kini punya gaya `disabled`. Nama dan perilaku token lama tidak berubah.
- `src/pages/admin/KelolaPeriode.tsx`: formulir dipindah ke samping daftar (di bawah daftar pada layar kecil); tiga kartu ringkasan diganti `StatStrip`; penjelasan Aktif/Default yang tertulis dua kali dijadikan satu di panel "Cara kerja singkat"; semester memakai kontrol bersegmen; periode default ditandai strip biru dan lencana; konfirmasi hapus kini inline (sebelumnya `confirm()` bawaan browser); `rounded-xl`, `shadow-sm`, dan cincin dihapus. Fungsi simpan, ubah, aktif, default, dan hapus tidak diubah.
- `src/pages/admin/KelolaAkun.tsx`: tombol, isian, dan kotak pesan memakai token bersama (teks 10–11px dinaikkan ke 12–13px); tombol "Daftar/Tambah guru" yang mencampur pengganti tampilan dengan aksi diganti "+ Tambah guru" dan "Ekspor JSON" (serta "Kembali ke daftar" di mode formulir); chip saringan menampilkan jumlah dan "Menunggu" disorot bila > 0; panel detail memisahkan aksi biasa dari "Tindakan lain" (nonaktifkan, hapus permanen); notifikasi memakai `useToast` bersama (mengambang, seperti halaman Akademik); baris tabel dapat difokus dengan keyboard; di layar < 1024px panel detail digulir ke tampilan saat akun dipilih. Alur konfirmasi (nonaktifkan, hapus permanen dengan mengetik email) dan seluruh logika data tidak diubah.
- `ANTIREGRESI.md` §20 (termasuk temuan bahwa `.card-soft` mengalahkan utilitas Tailwind dan daftar tempat yang terkena). `DESIGN.md`: bagian Halaman admin.
- Diperiksa: `npm run build`, `npx oxlint` (0 galat, 4 peringatan lama), tujuh skrip `scripts/cek-*` lolos; tampilan dirender di 1440px dan 390px dengan data tiruan (daftar penuh/kosong, mode edit, konfirmasi hapus, formulir tambah). Belum diuji dengan data Firestore sungguhan.
