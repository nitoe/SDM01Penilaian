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

## §11. Data Al-Qur'an, font, dan tata letak

11.1 **Font Al-Qur'an disajikan dari situs sendiri** (`public/fonts/amiri-quran-arabic-400-normal.woff2`, lisensi SIL OFL 1.1; berkas lisensi harus tetap menyertainya). CSP `font-src 'self'` melarang font dari CDN. Jangan mengembalikan ke font sistem untuk teks Al-Qur'an.

11.2 Sumber teks, transliterasi, terjemahan, dan audio adalah EQuran.id. Alamatnya harus ada di `connect-src` (API) dan `media-src` (audio) pada CSP. Atribusi "EQuran.id" di Baca & Tandai harus tetap ditampilkan. URL audio hanya diterima lewat `audioAman` (https dan domain equran.id); jangan melonggarkannya. Kunci cache sesi `tt_quran_v2_`; ubah versinya bila bentuk data berubah.

11.3 Tampilan teks memakai React (bukan HTML mentah), jadi isi API tidak pernah dijalankan sebagai HTML. Jangan memakai `dangerouslySetInnerHTML` untuk terjemahan atau transliterasi.

11.4 **Jangan memakai `overflow-hidden` pada pembungkus Layout.** Itu mematikan `position: sticky` (sidebar, header, panel siswa, bilah simpan, bilah alat Baca & Tandai). Gunakan `overflow-clip` bila perlu memotong sudut membulat.

11.5 Halaman kerja harian (Input Setoran, Riwayat, Target, Data Siswa) didaftarkan di `HALAMAN_LEBAR` pada `Layout.tsx` agar memakai lebar penuh di PC. Di PC, aksi utama (Simpan) harus selalu terlihat tanpa menggulir; jangan memindahkannya ke akhir halaman.

11.6 Progres target hanya menghitung setoran Ziyadah berstatus Lulus untuk satu surah yang sama dengan surah target (aturan v2). Jangan menghitung Muroja'ah, status Perlu diulang, atau rentang lintas surah. Uji: `npx tsx scripts/cek-target.mts`.

## §12. Kelola Akun Guru

12.1 **Jangan memanggil `createUserWithEmailAndPassword` pada `auth` utama.** Itu mengganti sesi admin yang sedang login. Pembuatan akun wajib lewat app Firebase sekunder bernama `sdm-buat-akun`, `inMemoryPersistence`, lalu `deleteApp` (lihat `buatAkunGuru`).

12.2 Setiap simpan akun menulis sekaligus `kelasAmpu`, `penugasan`, `waliKelas`, `penugasanKelas`, dan `penugasanKelasMapel` lewat `susunDokumenAkun()`. Peran yang tidak memakai sebuah tugas mendapat array kosong — jangan hanya menghapus field, dan jangan mengisi `kelasAmpu` untuk guru akademik (§8.1, §7.4).

12.3 `users.aktif === false` menolak login dan, setelah rules di-deploy, menolak baca/tulis (`akunAktif()`). Field tidak ada berarti aktif, supaya dokumen lama tidak terkunci. Pemilik akun tidak boleh mengubah `aktif` (§1.2). Jangan menghapus dokumen `users` dari halaman ini: user Auth-nya tidak ikut terhapus (tidak ada Admin SDK) dan login berikutnya hanya menghasilkan profil kosong.

12.4 Admin tidak menonaktifkan atau mengganti peran akunnya sendiri dari UI. Mencegah terkunci di luar sistem.

12.5 Password awal tidak ditulis ke Firestore dan tidak masuk log. Yang boleh dikirim ke guru adalah tautan `sendPasswordResetEmail`.

## §13. Akses akademik guru kelas dan tahun ajaran

13.1 Guru kelas (`waliKelas`) membuka semua mapel yang berlaku di tingkat kelasnya, termasuk mapel guru bidang studi. Guru bidang studi hanya pasangan di `penugasan`. Guru Tahsin-Tahfizh murni tidak membuka menu Akademik. Admin membaca TP, bobot, dan nilai, tetapi rules `tp_kktp` dan `nilai_tp` menolak tulis admin.

13.2 `nilai_tp` create/update memakai `tulisMapelKelas` (penugasan atau wali kelas), bukan `bolehMapelKelas` yang dulu mengizinkan admin menulis. Baca admin lewat `lihatMapelKelas`. Setelah mengubah rules, jalankan `npm run deploy:rules`.

13.3 Tahun ajaran aktif ada di `config/akademik`. Dokumen nilai menyimpan `tahunAjaran` dan `semester` saat diinput. Mengganti tahun ajaran tidak memindahkan nilai lama.

13.4 `asesmen_cakupan`, `nilai_sts`, dan `nilai_sas` di-query dengan `mapel` dan `kelas` (plus semester, tahun ajaran, dan `jenis` pada cakupan). Cakupan STS dan SAS tidak disamakan. STS tidak menimpa SLM; rumus tetap `hitungNilaiAkhirTP`.





## §14. Alokasi bobot TP multi-semester

14.1 Sumber kebenaran alokasi TP adalah `tp_kktp.bobotPerSemester` (map semester → persen). Field legacy `semester` + `bobotMapel` tetap diisi saat simpan agar dokumen lama dan klien lama tetap terbaca; jangan menghapus fallback di `tpMasukSemester` / `bobotTpDiSemester`.

14.2 Satu TP boleh masuk Semester 1 dan Semester 2 sekaligus dengan bobot berbeda. Total ideal **per semester** = 100% (bukan digabung antar-semester).

14.3 `saveTP` / `importTPBatch` **tidak** boleh menulis `semester`, `bobotMapel`, atau `bobotPerSemester` (milik halaman Bobot Semester). Melanggar ini menimpa pengaturan guru.

14.4 Perhitungan nilai mapel (`hitungNilaiAkhirMapel`) memakai `bobotTpDiSemester(tp, semesterAktif)`, bukan `tp.bobotMapel` mentah.

## §15. Pendaftaran mandiri guru dan penghapusan akun

15.1 **Pendaftaran di `/register` tidak boleh memakai `auth` utama.** `createUserWithEmailAndPassword` dan `signInWithEmailAndPassword` pada `auth` utama memicu `onAuthStateChanged` di `App.tsx`, yang melihat user tanpa profil dan memanggil `logout()` di tengah penulisan profil. Pendaftaran wajib lewat `daftarMandiriGuru()` (app sekunder `sdm-daftar-mandiri`, persistence memori, `deleteApp` di akhir). Perluasan dari §12.1.

15.2 Aturan `App.tsx` "user ada tapi profil tidak ada → logout" sengaja dipertahankan (menolak profil yang dihapus admin, §12.3). Jangan dilonggarkan untuk mengakali pendaftaran; perbaikannya ada di 15.1.

15.3 Penulisan Firestore yang offline tidak pernah gagal, hanya menggantung. Operasi yang menahan tombol di keadaan "memuat" wajib punya batas waktu (`batasWaktu` di `daftarMandiriGuru`, 30 detik).

15.4 **Menghapus profil di Kelola Akun tidak menghapus user Firebase Authentication** (tidak ada Admin SDK di klien). Label tombol dan teks konfirmasi harus tetap jujur tentang itu; jangan mengembalikan kata "permanen" tanpa Cloud Function yang benar-benar menghapus user Auth. Email baru bebas sepenuhnya setelah user dihapus di Firebase Console → Authentication. Koreksi atas label tombol yang dulu menyiratkan hapus total (lihat §12.3).

15.5 Email yang masih ada di Auth tanpa profil dipulihkan lewat `/register` bila password cocok; bila tidak cocok, tawarkan atur ulang password, bukan meminta admin lewat Console sebagai satu-satunya jalan. Profil hasil pemulihan tetap `status: 'pending'` (rules §1.1 tidak berubah).

## §16. Cloud Function hapus akun

16.1 Penghapusan akun staf yang menghapus user Firebase Authentication hanya boleh lewat Cloud Function `hapusAkunAuth` (Admin SDK). Jangan mencoba menghapus user lain dari klien, dan jangan mengganti pemeriksaan di `functions/aturan.js` dengan pemeriksaan di UI saja. Melengkapi §15.4: label "Hapus permanen" kini sah karena fungsi menghapus Auth dan profil. Jika fungsi dilepas, kembalikan label jujur seperti di §15.4.

16.2 Wilayah fungsi (`asia-southeast2`) harus sama di `functions/index.js` dan `REGION_FUNGSI` di `akunGuruData.ts`. Alamat `https://*.cloudfunctions.net` harus tetap ada di `connect-src` CSP (§2.1).

16.3 Fungsi menolak: pemanggil bukan administrator aktif, menghapus akun sendiri, menghapus akun orang tua, menghapus administrator aktif terakhir. Setelah mengubah `functions/aturan.js` jalankan `node scripts/cek-hapus-akun.mjs`.

16.4 Urutan di fungsi: hapus Auth dulu, profil kemudian, dan "user Auth tidak ditemukan" dianggap sukses, supaya pemanggilan ulang setelah gagal di tengah tetap menyelesaikan penghapusan. Jangan dibalik (profil lebih dulu bisa meninggalkan user Auth tanpa jejak di daftar).

16.5 Fallback `functions/not-found` di `hapusAkunStaf` hanya untuk masa sebelum fungsi di-deploy. Jangan memperluasnya ke galat lain: menghapus profil diam-diam saat fungsi gagal di tengah jalan meninggalkan user Auth yatim.

16.6 `functions/node_modules` tidak di-commit (sudah tercakup `.gitignore`). `functions/package-lock.json` di-commit.

## §17. Administrator sebagai pemantau (per 15 Okt 2026)

17.1 **Admin tidak menulis TP, bobot, nilai, setoran, maupun target hafalan.** Itu tanggung jawab guru kelas, guru bidang studi, dan guru Tahsin-Tahfizh. Admin mengelola master data (siswa, akun, mapel, periode, data sekolah) dan memantau. Melengkapi §7.5 dan §13.1.

17.2 Di `firestore.rules`, `bolehKelas()` (tulis Tahsin) tidak memuat `admin`. Baca Tahsin untuk admin lewat `lihatKelas()`. `delete` pada `nilai_tp`, `asesmen_cakupan`, `nilai_sts`, `nilai_sas` adalah `if false`; `delete` pada `setoran`/`menulis_log` hanya pembuatnya. `seni_kelas` ditulis lewat `waliKelasSendiri()`. Jangan menambahkan `isAdmin()` kembali ke jalur tulis ini. Uji: `node --experimental-strip-types scripts/cek-peran-admin.mjs`.

17.3 Rute `/tahsin/input-setoran` hanya untuk `isGuruTahsinRole`. `TargetHafalan` memakai `modeLihat` untuk admin (`<fieldset disabled>` dan tanpa tombol simpan). Menu Input Setoran tidak tampil untuk admin.

17.4 Nama menu untuk admin berbeda dari guru dan hanya berlaku untuk admin: Pantauan Akademik, Tujuan Pembelajaran, Bobot Tujuan Pembelajaran, Daftar Nilai Harian, Daftar Nilai STS & SAS, Rekap Nilai Harian, Pantauan Tahsin & Tahfizh. Nama untuk guru tidak diubah. Gunakan `teksPeran()` atau cabang `admin`/`tulis`, jangan menyalin teks admin ke tampilan guru.

17.5 Commit tidak mengubah rules produksi. Setelah menarik perubahan ini jalankan `npm run deploy:rules` lalu `npm run deploy`, dan uji dengan akun admin: tidak ada tombol simpan, dan penulisan lewat Console peramban ditolak.

17.6 Pemantauan admin (Tahap 2 ke atas) hanya membaca. Query nilai wajib menyertakan `mapel` dan `kelas` (§7.3); hitungan memakai `getCountFromServer`.

## §18. Dashboard pemantauan admin

18.1 **Tanggung jawab input per mapel×kelas** ditentukan di `hitungPasangan()`: guru yang punya `penugasan` pada pasangan itu; bila tidak ada, wali kelas; bila tidak ada keduanya, pasangan dilaporkan sebagai "tanpa penanggung jawab". Jangan menghitung guru kelas untuk mapel yang punya guru penugasan (terhitung ganda). Jangan memindahkan logika ini ke halaman.

18.2 Akun yang dihitung hanya yang aktif dan berstatus `approved` atau tanpa status (`akunDipantau()`). Akun pending, ditolak, nonaktif, admin, dan orang tua tidak ikut.

18.3 Status bobot memakai `tpMasukSemester`/`bobotTpDiSemester` (§14). TP tanpa alokasi eksplisit tidak dihitung sebagai teralokasi. Total ideal 100% per semester, toleransi 0,5.

18.4 Status nilai = isian `nilai_tp` pada periode terpilih dibanding (TP semester itu × siswa aktif kelas). Hitungan memakai `getCountFromServer` dengan filter `mapel`, `kelas`, `semester`, `tahunAjaran` (§7.3), semua nama alias mapel dijumlahkan. Jangan mengunduh dokumen nilai untuk dashboard.

18.5 Setoran Tahsin dihitung per guru lewat `createdBy` + `tahunAjaran` + `semester`. Dokumen setoran lama tanpa field periode tidak ikut hitungan. Rules memperbolehkan admin membaca lewat `lihatKelas()` (§17.2).

18.6 `tp_kktp` dibaca sekali penuh per pemuatan dashboard dan hanya untuk admin. Jika koleksi membesar, ganti dengan hitungan per pasangan; jangan memanggilnya dari beranda guru.

18.7 Uji: `node --experimental-strip-types scripts/cek-monitoring-admin.mjs` (harus mencetak SEMUA UJI LULUS) setiap kali mengubah `monitoringAdminRumus.ts`.

## §19. Notifikasi dan laporan guru (Tahap 3)

19.1 Satu koleksi `notifikasi` untuk laporan tugas, laporan kendala, dan mutasi siswa masuk/keluar (dibedakan field `jenis`). Jenis baru: tambahkan ke `JenisNotifikasi`, `JENIS_LABEL`, daftar `jenis in [...]` di rules, dan uji di `scripts/cek-notifikasi.mjs`. Jangan membuat koleksi terpisah per jenis.

19.2 Rules: guru dan admin boleh `create` dengan `dariUid == uid`, `status == 'baru'`, `createdAt == request.time`, dan kunci dibatasi `hasOnly`. Hanya admin yang `update`, dan hanya `status`, `catatanAdmin`, `updatedAt`. `delete` selalu ditolak. Baca: admin semua, pengirim hanya miliknya. Jika menambah field dokumen, ubah `hasOnly` di rules, `susunDokumen()`, dan `dariDok()` bersamaan.

19.3 Batas panjang (judul 120, isi 2000) ada di `types/notifikasi.ts` dan rules; keduanya harus sama. Validasi klien (`validasiLaporan`) mencerminkan rules, bukan menggantikannya.

19.4 Kotak masuk admin membaca 200 laporan terbaru (`orderBy createdAt desc`) dan menyaring di klien. Laporan guru memakai indeks `dariUid + createdAt` di `firestore.indexes.json`; deploy indeks sebelum halaman Laporan ke Admin dipakai guru (`npm run deploy:indexes` bila skripnya ada, atau `firebase deploy --only firestore:indexes`).

19.5 Lonceng di header hanya menghitung (`getCountFromServer`, status `baru`) untuk admin dan disegarkan saat pindah halaman. Tidak ada listener real-time; kegagalan hitung diabaikan agar header tidak terganggu.

19.6 Mutasi siswa pada tahap ini hanya MELAPORKAN ke admin. Admin tetap mengubah data siswa sendiri di Data Siswa. Jangan menambahkan jalur otomatis dari laporan ke `siswa` tanpa keputusan baru (menyentuh §5 dan §14).

19.7 Beranda admin tidak lagi menampilkan grafik jumlah siswa per kelas (diputuskan 15 Okt 2026). Gantinya: grafik Kelengkapan per kelas (TP/Bobot/Nilai) dari data pantauan, dan dropdown guru. Beranda guru tetap memakai `KelasBars` bila punya kelas.

## §20. Admin boleh mencetak, tidak menulis (per 16 Okt 2026)

20.1 Admin tetap memerlukan fitur cetak (Rapor STS dan Laporan Tahsin-Tahfizh). Mencetak bukan menulis: halaman cetak hanya membaca. `scripts/cek-laporan-cetak.mjs` gagal bila `laporanTahsin.ts`, `raporSts.ts`, `Rapor.tsx`, atau `LaporanTahsin.tsx` memuat operasi tulis (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `save*`).

20.2 "Laporan STS" yang dimaksud pemilik adalah **rapor bayangan untuk orang tua** (laporan hasil belajar berdasarkan STS saja), BUKAN rekap nilai per kelas. Halaman rekap STS/SAS yang sempat dibuat (15 Okt) sudah dihapus; jangan dibuat lagi tanpa permintaan baru.

20.3 Cetak memakai iframe tersembunyi (`lib/cetakIframe.ts`), bukan `window.open`, dan dialog cetak dibuka satu kali. Pratinjau di layar memakai iframe `srcDoc` dengan HTML dan CSS yang sama dengan cetak, supaya pratinjau tidak berbeda dari hasil cetak.

## §21. Rapor STS (rapor bayangan)

21.1 Format dasar mengikuti rapor PAS/SAS v1 (`rapor/preview.html`) dan dibangun oleh `raporHtml.ts` (murni, diuji). **Rapor STS = hanya nilai dan capaian**: judul "Laporan Hasil Belajar" + "Sumatif Tengah Semester" (TANPA Ganjil/Genap, semester ada di identitas), identitas siswa dan sekolah (kolom kanan digeser ke tepi kanan agar alamat sekolah cukup satu baris), A.1 Muatan Wajib, A.2 Muatan Yayasan, lalu tanda tangan Orang Tua/Wali dan Wali Kelas saja. TIDAK ada ketidakhadiran, catatan wali, tanggapan orang tua, maupun tanda tangan kepala sekolah (permintaan pemilik, 16 Okt 2026). Jangan menambahkannya kembali ke STS.

21.1a **Form lengkap v1 dipertahankan untuk Rapor SAS** (`buildBodyPrintSas`): A nilai, B Kokurikuler, C Ekstrakurikuler, D Ketidakhadiran + Catatan Wali, Tanggapan Orang Tua/Wali Murid, kotak Keputusan (hanya semester 2; Naik/Tinggal, pola v1), tanda tangan tiga pihak. Datanya (`kokurikuler`, `ekskul`, `absensi`, `catatanWali`, `keputusan`) opsional di `DataRaporSts`; belum ada halaman SAS dan modul sumber datanya (Absensi, Kokurikuler, Ekstrakurikuler) belum dibangun. Saat Rapor SAS dibuat, pakai `buildBodyPrintSas` dan isi field itu dari modul-modulnya.

21.2 Kokurikuler, Ekstrakurikuler, dan Absensi memang tidak ada di STS. Ketiganya hanya untuk Rapor SAS; modulnya belum dibangun (hub Akademik: "Segera hadir").

21.3 Muatan Yayasan = Bahasa Arab dan Kemuhammadiyahan (`MUATAN_YAYASAN` di `asesmenRumus.ts`, mengikuti MP12/MP13 di v1). Kelas 1–2 (Fase A) menampilkan dua baris keterangan baku v1 karena kedua mapel tidak berlaku di tingkatan itu.

21.4 Nilai akhir mapel dan bahan capaian dihitung SATU fungsi, `hitungStsMapel()` (`asesmenRumus.ts`), dipakai rapor satu siswa dan rapor seluruh kelas. Kalimat capaian memakai pola v1: "Mencapai kompetensi dengan sangat baik dalam …" (TP tertinggi) dan "Perlu peningkatan dalam …" (TP terendah, hanya bila ada lebih dari satu TP terisi). Ini menganggap deskripsi level KKTP berupa frasa lanjutan; bila guru menulis kalimat penuh, awalan ini perlu ditinjau.

21.5 Cetak seluruh kelas (`muatDataRaporStsKelas`) memuat bahan tiap mapel sekali per kelas (TP, cakupan, nilai), bukan per siswa. Halaman cetak banyak siswa tidak memakai pengaki nama/NISN karena pengaki satu @page tidak bisa berganti per siswa.

21.6 Akses: wali kelas hanya kelas yang diwalikan; admin semua kelas. Nama wali kelas di tanda tangan untuk admin dicari dari akun (`cariWaliKelas`), kosong bila belum ada.

## §22. Laporan Tahsin-Tahfizh untuk orang tua

22.1 Format mengikuti `tahsin-tahfizh/cetak-laporan.html` v2: kepala laporan + identitas, 1. Membaca Al-Qur'an (ayat dinilai, catatan tajwid/makhraj, perkiraan akurasi, narasi), 2. Menghapal (materi baru lulus, sesi muroja'ah, narasi), Target Hafalan (Iqro: jilid+halaman; Al-Qur'an: surah tercapai), 3. Menulis Al-Qur'an, tanda tangan. Satu siswa atau seluruh kelas (satu siswa per halaman). Tanpa emoji.

22.2 Narasi dan perkiraan akurasi memakai rumus v2 persis (`tahsinLaporanRumus.ts`); mengubah ambang kualitas berarti mengubah laporan semua siswa. Akurasi hanyalah perkiraan (100 − 35 × galat per ayat), diberi keterangan di laporan.

22.3 Pemuatan: satu query `setoran` (kelas + `tahunAjaran` + `semester`) dan satu query `menulis_log` (kelas) per pembukaan kelas, dikelompokkan di klien. Jangan query per siswa. Rentang tanggal bawaan semester (`rentangSemester`) dapat dipersempit; setoran lama tanpa field periode tidak ikut. Target dihitung dari seluruh setoran periode, bukan hanya rentang tanggal.

22.4 Catat Menulis belum ada di situs baru; bagian Menulis tampil dari data `menulis_log` yang ada (migrasi v2) dan berisi "Belum ada catatan" bila kosong.

22.5 Akses: admin semua kelas; guru Tahsin hanya `kelasAmpu`. Baca lewat rules `lihatKelas()` (§17.2).

21.7 **Tanggal rapor STS** diatur admin di Periode Akademik (field `tglRaporSts`, teks bebas, berlaku semua kelas, ada di kedua semester) dan TERPISAH dari tanggal rapor akhir semester (`tglRaporKelas1sampai6Sem1`, dst., milik rapor SAS). Rapor STS tidak boleh memakai tanggal rapor akhir. Bila `tglRaporSts` kosong, rapor memakai tanggal hari ini dan daftar periode menandainya "Tanggal rapor STS belum diisi". Field ini tidak disinkron ke `config/akademik` (kode legacy tidak mengenal STS).

21.8 **Tempat dan tanggal** ("Depok, 16 Oktober 2026") dicetak DI DALAM kolom Wali Kelas, rata tengah sejajar jabatan, bukan rata kanan halaman. Kolom lain memakai baris kosong setinggi sama (`.rpr-ttd-tempat`) agar "Orang Tua/Wali", "Kepala Sekolah", dan "Wali Kelas," tetap sejajar. Diuji di `cek-laporan-cetak.mjs`.

## §23. Rapor SAS dan data pelengkapnya (per 16 Okt 2026)

23.1 **Rapor SAS** (`/akademik/rapor-sas`, halaman yang sama dengan Rapor STS: `Rapor.tsx` prop `jenis`). Format penuh v1: A.1/A.2 nilai dan capaian, B Kokurikuler, C Ekstrakurikuler (No, Kegiatan, Predikat, Keterangan), D Ketidakhadiran + Catatan Wali, Tanggapan Orang Tua/Wali Murid, kotak Keputusan (hanya semester 2), tanda tangan Orang Tua/Wali, Kepala Sekolah, Wali Kelas dengan tempat/tanggal di atas kolom Wali Kelas. Pembangunnya `buildBodyPrintSas` (`raporHtml.ts`).

23.2 **Nilai akhir SAS** per mapel = `hitungSasMapel()` (`asesmenRumus.ts`): per TP digabung SLM, STS (bila lebih tinggi menggantikan SLM), dan SAS hanya bila TP masuk cakupan SAS; lalu rata tertimbang `bobotTpDiSemester` (bobot 0 tidak dihitung). Sama dengan kolom "Akhir" di Nilai STS & SAS. Capaian: TP berhasil akhir tertinggi ("Mencapai kompetensi dengan sangat baik dalam …") dan terendah ("Perlu peningkatan dalam …", bila beda TP). Catatan: v2 memakai `bobotMapel ?? 1` (model lama); v2 baru memakai bobot semester, jangan disamakan.

23.3 **Dimuat per kelas**, bukan per siswa: `muatDataRaporSasKelas` membaca tiap mapel sekali (TP, cakupan, nilai SLM/STS/SAS kelas) dan satu query per kelas untuk absensi, kokurikuler, ekskul. Pratinjau memilih siswa dari hasil itu; cetak seluruh kelas memakai hasil yang sama.

23.4 **Tanggal rapor SAS**: tanggal rapor akhir di Periode Akademik (semester 1 semua kelas; semester 2 kelas 1–5 dan kelas 6 terpisah). Tanggal STS terpisah (§21.7). Kosong → tanggal hari ini.

23.5 **Penulisan hanya oleh wali kelas** (`waliKelasSendiri`), admin hanya membaca dan mencetak (§17). Halaman `Kelengkapan Rapor SAS` (`/akademik/kelengkapan-rapor`) berisi tiga tab: Ketidakhadiran & Keputusan, Kokurikuler, Ekstrakurikuler; untuk admin semua isian dinonaktifkan. Master kegiatan ekstrakurikuler dikelola admin di `/admin/ekstrakurikuler`.

23.6 **Keputusan kenaikan**: 'Belum diputuskan' (bawaan) mencetak kedua pilihan TANPA coretan agar dicoret tangan; 'Naik Kelas'/'Tinggal Kelas' mencoret pilihan lain. Kelas 6 mengikuti v1 (tetap "Naik ke Fase D | Kelas 7"); belum ada penyesuaian untuk kelulusan.

23.7 Ekskul berpredikat level 4 ("Tidak Ikut") disaring dari rapor (`ekskulUntukRapor`). Siswa tanpa ekskul tercetak keterangan "tidak mengikuti kegiatan ekstrakurikuler semester ini".

23.8 Deskripsi kokurikuler pada tahap ini ditulis MANUAL oleh wali kelas. Penyusun otomatis v2 (Dimensi Profil Lulusan, Proyek STEM, 7 Kebiasaan/G7KAIH, Kelola DPL) belum dimigrasi; bila dibangun, hasilnya mengisi `kokurikuler_rapor.deskripsi`.

23.9 Uji: `node --experimental-strip-types scripts/cek-rapor-sas.mjs`. Deploy rules sebelum halaman Kelengkapan dipakai (koleksi baru ditolak tanpa rules).
