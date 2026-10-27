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

14.5 Pengecualian disengaja: `salinTPKeKelas` **boleh** menyalin `bobotPerSemester` (+ legacy) ke kelas paralel setingkat bila guru mencentang opsi tersebut. Ini aksi eksplisit menyamakan alokasi antar-rombel, bukan simpan form TP biasa. Kelas beda tingkatan wajib ditolak. Nilai siswa tidak ikut disalin.

## §15. Model AI (Gemini)

15.1 **Nama model Gemini sudah ada yang dipensiunkan Google dan dibalas 404** (1.5, 2.0 per 1 Jun 2026, 2.5 per 16 Okt 2026). Daftar model hanya ada di `MODEL_GEMINI` (`functions/generateAi.js`); jangan menulis nama model di tempat lain. Sebelum menambah atau mempertahankan model, cek halaman deprecations Gemini API. Jangan mengembalikan model yang sudah pensiun ke daftar.

15.2 Model 3.x berpikir secara bawaan dan token berpikir memakan `maxOutputTokens`; keluaran JSON bisa terpotong. Selalu atur `thinkingConfig` lewat `thinkingGemini()` untuk jalur teks dan vision.

15.3 Pesan galat `panggilGemini` harus menyebut semua model yang gagal, bukan hanya yang terakhir. Pesan "model terakhir 404" pernah menutupi bahwa tiga model sekaligus sudah mati (lihat CHANGELOG, 21 Okt 2026).

## §16. AI Proyek STEM (kokurikuler)

16.1 AI Proyek STEM harus berjalan hanya dari keterangan aktivitas. Jangan menambah kembali syarat "minimal 3 DPL aktif" atau syarat lain yang memaksa guru menyiapkan DPL/TP lebih dulu, selain katalog TP minimal 2 mapel berbeda (AI tidak boleh mengarang TP).

16.2 `tpId` dan `dplId` hasil AI wajib divalidasi terhadap katalog yang dikirim klien (`tpIdsSah`, `dplIdsSah`). Jangan menerima id di luar katalog.

16.3 `dplLevel` dari AI hanya boleh mengisi level DPL yang masih kosong; jangan menimpa deskripsi level yang sudah ditulis wali kelas. DPL baru diaktifkan dan diperbarui saat proyek DISIMPAN, bukan saat AI dijalankan, supaya hasil AI bisa diperiksa dulu.

16.4 Rubrik STEM tetap 4 rentang sesuai `STEM_NILAI_RANGE` (0–60, 61–75, 76–85, 86–100). Jangan mengubah urutan atau batasnya tanpa mengubah rumus akademik.

16.5 Fitur AI tetap dibatasi pada UID + email di `bolehPemanggilAi` (lihat §15 dan `src/lib/generateAi.ts`). Pemeriksaan di klien hanya kosmetik; yang menjaga adalah Cloud Function.

16.6 Prompt materi ajar tidak boleh menghasilkan judul bergaya julukan, slogan, atau persona (mis. "detektif", "petualang", "agen").

## §17. 7KAIH

17.1 7KAIH **tidak ditautkan ke DPL**. Jangan mengembalikan pilihan DPL per kebiasaan atau syarat "DPL aktif" pada tab 7KAIH. Bila deskripsi rapor perlu menyebut DPL, itu urusan penyusun deskripsi akhir, bukan data 7KAIH.

17.2 Skala 7KAIH adalah 4 level (`LEVEL_7KAIH_LABEL`), **bukan 0–100**. Skala 0–100 khusus Proyek STEM karena berkaitan dengan mapel (`STEM_NILAI_RANGE`).

17.3 `level: null` berarti belum diisi/tidak teramati dan bukan level terendah. Jangan menafsirkan kosong sebagai 1 saat menyusun rapor.

17.4 `catatan` dan `dplId` pada dokumen `g7kaih` lama harus tetap tersimpan ulang apa adanya (data pengguna). UI tidak lagi mengisinya.

17.5 Penyimpanan 7KAIH hanya menulis baris siswa yang berubah (`simpanG7kaihBanyak`, batch). Jangan menulis seluruh kelas pada setiap simpan.

17.6 Aksi massal per kolom 7KAIH ("Atur semua") harus **menimpa** seluruh kolom dan menyediakan "Kosongkan". Jangan kembali ke perilaku "hanya isi sel kosong": pilihan itu tidak berefek bila kolom sudah terisi penuh dan tidak ada jalan menghapus massal. Perubahan baru tersimpan setelah tombol Simpan.

## §18. Catat Menulis (Tahsin-Tahfizh)

18.1 **Rata-rata menulis = tiga aspek inti saja** (`hurufSambungan`, `harakat`, `keutuhanTeks`), dihitung hanya di `rataInti` (`src/lib/menulis.ts`). Jangan memasukkan `kerapian` ke rata-rata dan jangan menghitung ulang di halaman. Ini koreksi atas rata-rata empat aspek di v2 (aturan lama tidak dihapus; yang berlaku adalah aturan ini). Uji: `npx tsx scripts/cek-menulis.mts` dan `node --experimental-strip-types scripts/cek-laporan-cetak.mjs`.

18.2 Kunci `penilaian` tetap `hurufSambungan`, `harakat`, `keutuhanTeks`, `kerapian` agar data impor v2 terbaca. `kerapian` boleh `null` (tidak dinilai); `null` berarti belum dinilai, bukan level terendah. Skor sah hanya bilangan bulat 1-4.

18.3 `jenisTugas` (`salin` | `dikte` | `hafalan`) dan `kesalahan[]` opsional pada catatan impor v2. Pembaca wajib menoleransi keduanya kosong. Jangan menambah aspek skor baru tanpa keputusan eksplisit pemilik proyek: rancangan sengaja ramping agar tidak membebani guru.

18.4 Catat Menulis hanya untuk guru Tahsin (`isGuruTahsinRole`); admin memantau (§17). Setiap catatan menyimpan `tahunAjaran` dan `semester` periode aktif; ringkasan per periode tidak menghitung catatan tanpa periode.

18.5 Tanggal pemeriksaan (`tanggalPeriksa`, yyyy-mm-dd) tidak boleh di masa depan. Semua aspek diawali 3 ("Baik") di UI; jangan mengubah nilai awal menjadi kosong sehingga guru wajib mengisi tiap aspek.

18.6 **Skor menulis di laporan orang tua = rata-rata seluruh catatan dalam rentang laporan** (`ringkasMenulis`), bukan catatan terakhir. Posisi menulis ("hingga …") boleh dari catatan terbaru, tetapi angka skor dan kata "rata-rata" tidak. Rincian aspek di bagian 3 laporan memakai kotak (tanpa menambah tinggi) agar laporan tetap satu halaman A4; jangan menambah blok baru di bagian ini tanpa memeriksa cetaknya.

18.7 Pembandingan selisih rata-rata (tren) wajib dibulatkan satu desimal dulu; jangan membandingkan hasil pengurangan floating point langsung dengan ambang.


## §27. Input nilai STS/SAS: draf, impor Excel, dan tempel

> Catatan penomoran: nomor §19–§26 dipakai oleh versi ANTIREGRESI sebelum 20 Okt 2026 (commit `7c3b762`) dan masih dirujuk oleh komentar di kode (notifikasi, rapor STS/SAS, UI). Nomor itu sengaja dilewati agar tidak bentrok bila bagian lama dipulihkan.

27.1 **Objek/array yang menjadi dependensi `useEffect`/`useMemo` harus stabil.** `config` di `NilaiStsSas.tsx` wajib `useMemo` (dependensi nilai primitif `periodeAk.ready/semester/tahunAjaran`). Objek baru di tiap render membuat efek sinkron draf berjalan setiap kali toast tampil atau hilang dan menghapus isian yang belum disimpan.

27.2 Efek sinkron draf pada `<Detail>` hanya boleh bergantung pada data server (`props.nilai`) dan kunci cache. Jangan menambahkan dependensi yang berubah di tiap render. `NilaiSlm.tsx` memakai `[nilai, kunciCache, show]` dengan `show` dari `useCallback`; jangan diubah tanpa menguji impor dan tempel.

27.3 Impor Excel dan tempel (Ctrl+V) hanya memuat nilai ke **draf**; penulisan ke Firestore hanya lewat tombol Simpan (`simpanSemuaNilai`/`simpanSemua`). Jangan membuat impor langsung menulis ke Firestore tanpa pratinjau.

27.4 Peringatan `parseNilaiExcelRows` yang paling penting ("baris siswa tidak cocok", "kolom tidak dikenali") harus tetap berada di dua posisi pertama, karena toast di halaman input hanya menampilkan `peringatan.slice(0, 2)`.

27.5 Sebelum mengubah `nilaiImportExport.ts` atau efek draf, jalankan `npx tsx scripts/cek-nilai-import.mts` (harus mencetak SEMUA UJI LULUS). Uji ini tidak mencakup perilaku React; setelah mengubah efek draf, uji manual: impor template di STS, nilai harus tetap tampil di tabel dan tombol Simpan menampilkan jumlah perubahan.

## §28. Tanda tangan digital Rapor STS (Storage)

28.1 Fitur gambar TTD **hanya untuk Rapor STS** (distribusi online). Jangan memaksa URL gambar ke alur cetak SAS/rapor semester offline kecuali produk meminta ulang.

28.2 Penyimpanan:
- Kepala sekolah: `config/akademik.ttdKepsekUrl` + objek Storage `tanda-tangan/kepsek.png`.
- Guru/wali: `users/{uid}.ttdUrl` + objek Storage `tanda-tangan/guru/{uid}.png`.
Jangan menyimpan blob base64 besar di dokumen Firestore.

28.3 Rules:
- `users` self-update boleh `ttdUrl` (bersama `nama`, `gelar`, `updatedAt`); jangan memperlonggar field lain (role, penugasan, aktif, …).
- Storage: baca TTD untuk user login; tulis/hapus kepsek hanya admin; tulis/hapus path guru hanya `request.auth.uid == uid`. Setelah mengubah `storage.rules`, wajib `firebase deploy --only storage`.

28.4 Cetak STS: tiga kolom Ortu | Wali Kelas | Kepala Sekolah. Bila `ttdWaliUrl` / `ttdKepsekUrl` kosong, ruang tetap kosong (TTD basah). Jangan menghapus fallback ruang kosong.

28.5 Nama wali tetap dari `cariWaliKelas` / `cariWaliKelasLengkap`. Bila satu kelas punya lebih dari satu wali terdaftar, TTD digital tidak dipilih otomatis (hanya nama digabung) agar tidak menampilkan tanda tangan orang yang salah.

28.6 Kompresi gambar dilakukan di klien sebelum upload. Jangan menaikkan batas ukuran Storage rules tanpa menyesuaikan kompresi.

28.7 Layout `/profil`: jangan mengembalikan `/profil` ke `HALAMAN_SEMPIT` / `max-w-md` tanpa alasan UX — halaman mengikuti lebar konten biasa (`max-w-6xl`) agar tidak menyisakan ruang kosong kiri-kanan saat zoom.

28.8 Marker merge (`<<<<<<<`, `=======`, `>>>>>>>`) tidak boleh masuk ke `main`. Sebelum `npm run build`, pastikan `src/lib/akademik.ts` dan file lain bebas marker (pernah memblokir deploy karena sisi `PLACEHOLDER`).

28.9 `fetchUserProfile` di `src/lib/auth.ts` **wajib** memetakan `ttdUrl` dan `nbm` dari dokumen `users/{uid}`. Menyimpan ke Firestore saja tidak cukup — tanpa mapping ini nilai hilang setelah refresh/login ulang.

28.10 Self-update `users/{uid}` (rules): allowlist field hanya `nama`, `gelar`, `nbm`, `ttdUrl`, `updatedAt`. Menambah field profil yang boleh diubah guru harus mengubah rules lalu `firebase deploy --only firestore:rules`.

28.11 Storage path guru: objek bernama `{uid}.png`. Rules harus membandingkan `fileName == request.auth.uid + '.png'`. Match `guru/{uid}` saja membuat 403 karena `uid` terikat ke string termasuk `.png`.

28.12 Stempel: unggah lewat `kompresStempel` (latar putih, PNG). Jangan mengandalkan transparansi murni di cetak. Setelah mengubah algoritma kompresi, unggah ulang stempel di Data Sekolah.

28.13 Lapisan cetak kepsek (keputusan produk terkini): **TTD di depan stempel** (`z-index` TTD > stempel), stempel digeser sedikit kiri agar tidak menutup tinta. Tinggi ruang TTD seragam antar kolom; tempat+tanggal hanya di kolom Kepala Sekolah.

28.14 Pratinjau rapor memakai `iframe` + `srcDoc` dengan `sandbox` yang mencakup `allow-scripts` (konten dipercaya dari app). Tanpa itu konsol penuh peringatan `about:srcdoc` (bukan kegagalan bisnis, tetapi mengganggu diagnosis).

