## §Tugas.Video.Ukuran — batas video hanya dari ukuran (2026-11-25)

1. **Menggantikan §Tugas.Video butir 3** (durasi > 60 dtk ditolak, ukuran ≤ 15 MB) dan «video ≤ 15 MB dan ≤ 60 detik» pada §Tugas.Bukti.Batas10 butir 3 serta payload butir 6. Alasan: video performa (mis. seni musik) tidak muat 1 menit. Jangan mengembalikan pemeriksaan durasi `BATAS_DURASI_VIDEO_DETIK` (konstanta sudah dihapus).
2. **Satu sumber angka, dua tempat yang HARUS sama:** `BATAS_UKURAN_VIDEO` (100 MB) di `videoTugas.ts` dan `videoPengumpulanSah` di `storage.rules` (`request.resource.size <= 100 * 1024 * 1024`). `storage.rules` IDENTIK di repo `lms` dan SDM01Penilaian (salin utuh). Mengubah salah satu saja membuat video lolos klien tetapi ditolak Storage (permission-denied) atau sebaliknya.
3. **Dua ambang di klien:** `UKURAN_LANGSUNG` (30 MB; mp4/webm di bawahnya dikirim apa adanya, kecuali HEVC bila HP bisa konversi) dan `BATAS_UKURAN_VIDEO` (100 MB; batas hasil akhir). Di atas 30 MB wajib diperkecil. Alasan tidak mengirim langsung sampai 100 MB: unggahan besar rapuh di sinyal lemah (§Kirim.Diagnostik).
4. **Konversi tetap real-time (≈ durasi video).** Karena itu tidak ada batas durasi, tetapi ada penolakan dini berbasis ukuran: `perkiraanUkuranKonversi(durasi)` (≈ 107 KB/dtk, ±16 menit = 100 MB). Pemeriksaan ini dilakukan di `periksaVideo` (hanya untuk video yang HARUS dikonversi) dan diulang di `kompresVideo`. Jangan dihapus: tanpanya siswa menunggu konversi puluhan menit lalu ditolak.
5. **Deteksi HEVC memakai potongan** (2 MB awal + 2 MB akhir), bukan `arrayBuffer()` seluruh berkas. Jangan kembali membaca berkas penuh: berkas sampai 30 MB bisa mematikan tab di HP RAM kecil. Penanda codec ada di kotak `moov` (awal atau akhir berkas).
6. **AI tidak membaca video > 9 MB** (`BATAS_VIDEO_BYTE` di `nilaiTugasLmsAi.js`; total media 15 MB). Itu disengaja dan sudah ditangani function («periksa manual»). Jangan menaikkan batas itu tanpa menguji batas payload Gemini dan memori function. Label editor guru menyebut hal ini.
7. **Berkas asal sampai 2 GB** (`BATAS_FILE_ASAL`) hanya dibuka lewat object URL / `slice`; jangan menambah pembacaan penuh (`arrayBuffer`, `FileReader`) pada berkas video.
8. **Urutan deploy:** `firebase deploy --only storage` dari SDM01Penilaian DAHULU, baru hosting LMS.
9. **Uji (belum dijalankan di perangkat):** (a) HP Android Chrome, video 20 MB tanpa konversi → langsung «siap», terkirim, guru memutar; (b) video ±3 menit dari kamera (±200 MB) → muncul «Perkecil video» dengan perkiraan waktu, hasil ±16–20 MB, terkirim; (c) video ±20 menit → ditolak di awal dengan pesan ukuran, tanpa konversi; (d) rekaman 2 video × ±50 MB → keduanya terunggah; (e) unggah > 100 MB langsung via konsol → ditolak rules; (f) penilaian AI pada video > 9 MB → catatan «periksa manual», tidak galat; (g) HP tanpa dukungan konversi dan video > 30 MB → pesan arahkan memakai foto.

## §Tugas.Terkumpul — «Sudah mengumpulkan» dihitung per siswa & sesuai kelompok (2026-11-25)

1. **JANGAN membaca `tugas.jumlahPengumpulan` untuk menampilkan angka.** Field itu hanya diisi 0 saat tugas dibuat dan tidak pernah dinaikkan oleh kode mana pun (itulah sebab dashboard selalu 0). Sumber angka: `hitungTerkumpulTugas*` (`lib/terkumpulTugas.ts`) atau, di panel yang sudah memegang daftarnya, `siswaTercakupPengumpulan`.
2. **Satuan = SISWA, bukan pengirim.** `siswaTercakupPengumpulan(pengirimIds, kelompokList)`: tiap pengirim + SELURUH anggota (dan ketua) kelompok yang buktinya dikirim ketua atau wakil. Pengirim ambigu (ketua kosong, ≥2 anggota mengirim) hanya menghitung dirinya.
3. **Kelompok «sudah mengumpulkan» = `statusKumpulKelompok().jenis` ∈ {`ketua`, `wakil`}** — bukan `kumpulPerSiswa.has(ketuaId)`. Jangan kembali memeriksa ketua saja. `anggota` = «Sebagian mengumpulkan» (bukan sudah); `belum` = tak ada pengirim. Aturan wakil tetap satu-satunya `wakilBuktiKelompok` (§Tugas.Kelompok.Wakil); jangan menduplikasinya.
4. **Dashboard menghitung hanya tugas Aktif siswa non-arsip** (yang lain tampil `jumlahPengumpulan` lama = 0), 3 paralel, cache 90 dtk (`hitungTerkumpulTugasCache`). Tampilan: `undefined` = «…» (menghitung), `null` = «—» (gagal), angka = hasil. Jangan memuat semua dokumen pengumpulan untuk tugas individual — pakai agregat `getCountFromServer` (jatuh ke daftar dokumen bila agregat ditolak).
5. **Query guru tetap tugasId + mapel + kelas per rombel** (§132.4), baik untuk agregat maupun daftar; rombel yang ditolak rules dilewati, bukan menggagalkan semuanya (kecuali rombel utama).
6. **Jumlah di dashboard/tab/panel harus konsisten:** tiga tempat memakai aturan yang sama. Bila menambah tempat tampil baru, pakai fungsi di atas, jangan menulis perhitungan sendiri.
7. Uji: (a) kelompok 4 orang diwakili Shakila → «Sudah mengumpulkan», keterangan «mewakili ketua», anggota lain «lewat Shakila», dashboard menghitung 4; (b) ketua mengumpulkan → seluruh anggota dihitung; (c) ketua kosong & 2 anggota mengirim → «Sebagian mengumpulkan», hanya 2 dihitung; (d) tugas individual 23 pengumpulan lintas 2 rombel → 23; (e) agregat ditolak → tetap benar lewat daftar dokumen.

## §Tugas.Kelompok.Wakil — anggota yang mengirim mewakili ketua (2026-11-25)

1. **Aturan wakil** (`wakilBuktiKelompok` di `lib/tugasKelompok.ts`, dipakai `wakilBukti` di `TugasDetail.tsx`): wakil = anggota satu-satunya yang punya pengumpulan, SELAMA ketua tidak punya pengumpulan sendiri. Ketua punya pengumpulan → tidak ada wakil (pengirim mandiri dinilai sendiri). Pengirim lebih dari satu → tidak ada wakil (ambigu). Jangan melonggarkan «tepat satu» tanpa antarmuka bagi guru untuk memilih wakil, karena menebak pengirim yang salah menilai kelompok dari bukti yang keliru.
2. **Empat tempat yang HARUS konsisten:** `sumberBuktiSiswa` (bukti ketua/anggota lain = bukti wakil, `mewakili: true`), `ikutKetua` (wakil ikut nilai ketua; pengirim mandiri lain tidak), `samakanAnggota` (target menyertakan wakil), dan `barisKelompokBelumSimpan` (lewat `ikutKetua`). Mengubah salah satu saja menghasilkan gejala lama: ketua tanpa bukti, «Samakan» tak mencakup pengirim, atau pengirim tidak tersimpan bersama kelompok.
3. **Gejala lama yang dicegah:** `usulkanNilaiTugasAi(tugasId, ketuaId)` untuk ketua tanpa pengumpulan gagal di function `nilaiTugasLmsAi` («Siswa ini belum mengumpulkan tugas», `failed-precondition`). Pemilik bukti yang dikirim ke AI HARUS siswa yang punya dokumen pengumpulan (`pemilikId` dari `sumberBuktiSiswa`), bukan otomatis ketua.
4. **`kirimMandiri` di `PenilaianTerpadu`** kini `punya pengumpulan && !(mewakili && kel)`. Jangan mengembalikan ke «punya pengumpulan» saja: wakil akan tampil «dinilai dari buktinya sendiri» dan tak ikut nilai ketua.
5. **Nilai yang sudah tersimpan tidak ditimpa otomatis** (aturan `ikutKetua` lama tetap): wakil yang sudah dinilai terpisah dan nilainya berbeda dari ketua baru tersamakan lewat «Samakan semua anggota dengan ketua» (sengaja menimpa).
6. **Belum tertangani:** sisi siswa. Ketua melihat «belum mengumpulkan» dan anggota lain tidak melihat «terkumpul lewat ketua» saat wakil yang mengirim (`ketuaSudahMengumpulkan` hanya memeriksa dokumen ketua). Bila ini membingungkan, perlu perubahan terpisah di `KelompokSiswaPanel`/`SiswaTugas`.
7. **Uji:** (a) ketua tanpa pengumpulan + anggota A mengirim → baris ketua menampilkan bukti A dan «Dikirim A mewakili ketua», Usulan AI bekerja; (b) isi/terapkan nilai pada ketua → «Samakan semua anggota dengan ketua» menyalin ke A dan anggota lain; «Simpan nilai kelompok» menyimpan semuanya; (c) ketua punya pengumpulan sendiri + A kirim mandiri → A tetap «Kirim mandiri» dan dinilai sendiri; (d) A dan B sama-sama mengirim, ketua kosong → keduanya «Kirim mandiri», tidak ada wakil; (e) A sudah dinilai berbeda dari ketua → tidak tertimpa kecuali «Samakan»; (f) uji unit `wakilBuktiKelompok` (7 kasus) lulus.

## §Tugas.PredikatAi — Predikat AI di tab Pengumpulan (2026-11-25)

1. **AI = usulan predikat, bukan nilai.** `predikatTugasLmsAi` tidak menulis ke Firestore. Hasil hanya masuk DRAF lewat `terapkanPredikatAi` (TugasDetail) → `patchDraft`. Jangan menambah penyimpanan otomatis.
2. **Skor per kategori TIDAK dari AI di mode ini.** Diturunkan oleh `generateSkorPerKategoriDariPredikat` (acak dalam rentang predikat, perilaku lama). Jangan meminta AI skor per kategori di jalur ini; itu tugas `nilaiTugasLmsAi` (§Tugas.NilaiAi).
3. **Otorisasi dua lapis & pembungkus bersama:** kedua fungsi AI memakai `jalankanAi()` (otentikasi, `bolehPemanggilAi`, validasi ID, `ambilBahan`, log). Jangan menduplikasi logika itu ke fungsi baru; klien memakai `bolehAiTugas()` dan UI hanya dirender bila `bisaAi`.
4. **Predikat divalidasi server** terhadap `rentangPredikat` tugas (default A–E), dinormalisasi besar/kecil huruf; di luar daftar → galat «predikat yang valid», bukan diterima diam-diam. Tugas TANPA rubrik tetap bisa diberi predikat; tanpa bukti sama sekali → galat jelas tanpa memanggil AI.
5. **`null` berarti berhasil.** `onTerapkanPredikat` mengembalikan `null` bila sukses dan teks bila galat. JANGAN menulis `onTerapkanPredikat?.(…) ?? 'galat'` — `??` memperlakukan `null` sebagai kosong sehingga setiap keberhasilan dilaporkan sebagai galat (bug yang tertangkap uji).
6. **Tab Pengumpulan butuh Daftar nilai dimuat** (`muatNilai` + `pengumpulanMap/kelompokList` dimuat juga saat `bisaAi && tab === 'kumpul'`) agar draf bisa ditulis dan penyebaran ke anggota kelompok bekerja. Tombol AI dinonaktifkan sampai `nilaiSiap`.
7. **Mode massal:** hanya baris berstatus `kosong` (dari `statusNilai` induk); nilai tersimpan tidak disentuh; berurutan; berhenti setelah 3 kegagalan; `confirm` sebelum mulai.
8. **Slot foto 1–10:** semua pembacaan slot harus memakai `slotDariFotoId` (klien) / `slotDariIdFoto` (server) yang mengenal `10`. Jangan menulis regex satu angka (`/_([1-9])$/`) — itu membuat foto slot 10 hilang (sempat terjadi di «Menilai per siswa»).
9. **Privasi:** foto/video anak dikirim ke Google Gemini hanya atas aksi guru akun AI (sama dengan §Tugas.NilaiAi no. 9).
10. Uji: (a) `node functions/uji/nilaiTugasLmsAi.uji.mjs` lulus; (b) deploy `predikatTugasLmsAi`; (c) satu siswa: usulan muncul → «Terapkan ke nilai» → Input nilai menampilkan predikat + skor di draf (belum tersimpan); (d) tugas kelompok: terapkan ke ketua → anggota ikut; (e) siswa bernilai tersimpan dilewati mode massal.

## §Tugas.Bukti.Batas10 — bukti berlabel dan video maksimal 10 (2026-11-25)

1. **Menggantikan keputusan «bukti berlabel sengaja tetap 6»** pada §Tugas.Foto.Batas10 butir 3. Semua slot kini 1..10: `BATAS_BUKTI_TUGAS` (`types/tugas.ts`), `BATAS_SLOT_FOTO`, `videosDariDok` (`slot > BATAS_SLOT_FOTO`), rules `lmsVideosSah` (kunci '1'..'10'), `storage.rules` `namaVideoSiswa`, dan function `nilaiTugasLmsAi.js` (`buktiTugas.slice(0, 10)`, slot video ≤ 10). **Semuanya wajib berubah bersamaan** (rules di KEDUA repo); salah satu tertinggal membuat bukti/video slot 7–10 ditolak atau diabaikan diam-diam.
2. **Pola nama video:** `'_(10|[1-9])\\.(webm|mp4)$'`. Jangan memakai `[1-9]` saja (slot 10 ditolak) atau `[1-10]` (kelas karakter «1», «0»: salah). Uji: `_1`, `_9`, `_10` lolos; `_0`, `_11`, `_110` ditolak.
3. **Yang SENGAJA tetap:** `lmsVideosSah` `v.size() <= 2` (maks 2 video per pengumpulan), video ≤ 100 MB tanpa batas durasi (menggantikan 15 MB/60 detik, §Tugas.Video.Ukuran), serta saran generator tugas AI ≤ 6 bukti (`generateTugasLmsAi.js` `bukti.length >= 6`, prompt «Maksimal 6 bukti», dan `tugasAi.ts` `.slice(0, 6)`). Batas 10 berlaku untuk bukti buatan guru; generator hanya menyarankan. Jangan menaikkan saran AI tanpa menaikkan jumlah kategori (satu bukti per kategori) dan menguji kualitas usulan.
4. **Urutan deploy:** rules dan storage DAHULU (`firebase deploy --only firestore:rules,storage,functions:nilaiTugasLmsAi` dari Penilaian), baru hosting LMS.
5. **Uji:** (a) guru membuat tugas dengan 10 bukti (campuran foto dan video; tombol tambah nonaktif di 10); (b) siswa mengumpulkan 10 bukti foto, hasilnya terbaca guru di 10 kartu; (c) bukti ke-8 berjenis video (≤ 2 video) terunggah dan terputar; (d) penilaian AI membaca 10 bukti; (e) tugas lama ≤ 6 bukti tetap normal; (f) bukti ke-10 wajib: tombol kumpul menunggu 10 bukti lengkap.
6. **Payload:** 10 foto berlabel + 2 video bisa ±2,5 MB foto + 2×(≤ 100 MB, §Tugas.Video.Ukuran). Konkurensi foto tetap 2 (§Tugas.Foto.Kemajuan); batas waktu §Kirim.Diagnostik tetap berlaku per langkah.

## §Tugas.Draf — draf foto pengumpulan di IndexedDB (2026-11-25)

1. **Tujuan:** foto yang sudah dipilih tidak hilang bila Android mematikan tab saat kamera terbuka (HP RAM kecil) atau halaman dimuat ulang. Implementasi: `lib/drafPengumpulan.ts` (IndexedDB `lms-draf-pengumpulan`, store `draf`, kunci `{tugasId}_{siswaId}`) dan dua `useEffect` di `PengumpulanSiswa.tsx`.
2. **Urutan wajib: pulihkan DULU, simpan sesudahnya.** Penyimpanan hanya boleh jalan setelah `drafSiap` bernilai true. Tanpa gerbang ini state kosong saat mount memicu `hapusDraf` sebelum draf sempat dibaca, dan draf hilang justru saat dibutuhkan. Pemulihan memakai pembaruan fungsional (`p.length > 0 ? p : …`) supaya tidak menimpa foto yang sudah dipilih siswa.
3. **Hanya pengumpulan pertama (`ada === null`).** Bila dokumen sudah ada, efek pemuatan foto dari server (`kunciAda`) menimpa `items`/`fotoSlot`; menggabungkan draf dengan itu belum ditangani. Jangan menyimpan/memulihkan draf saat `ada` terisi tanpa merancang penggabungannya.
4. **Dibersihkan saat sukses:** `kirim()` memanggil `hapusDraf` sebelum `onTersimpan`. Bila ditambah jalur kirim baru, ia juga wajib menghapus draf. Draf kedaluwarsa 7 hari (`UMUR_MAKS_MS`) dan dihapus saat dibaca; data dari IndexedDB disaring (`data:image/`, ≤ `BATAS_KARAKTER_GAMBAR`, maks 10 foto, slot 1..10) karena bisa rusak atau diubah.
5. **Privasi:** isi draf adalah foto pekerjaan siswa di perangkatnya sendiri. Kunci memuat `siswaId`, jadi siswa lain di HP yang sama tidak memuatnya. Tidak ada yang dikirim ke server. Draf TIDAK dihapus saat logout (agar sesi yang berakhir tidak membuang pekerjaan); batas 7 hari menjadi penyapunya.
6. **Uji:** (a) pilih 3 foto + catatan, muat ulang halaman → 3 foto dan catatan kembali dengan keterangan pemulihan; (b) kumpulkan → muat ulang → tidak ada draf; (c) hapus semua foto → muat ulang → tidak ada draf; (d) mode bukti berlabel: foto per slot kembali ke kartu yang benar, video perlu dipilih ulang; (e) siswa B login di HP yang sama → tidak melihat draf siswa A; (f) mode privat/IndexedDB nonaktif → halaman tetap berfungsi tanpa galat.
7. Draf bukan pengganti kirim: foto di draf BELUM dikumpulkan. Keterangan pemulihan sengaja mengatakan «Periksa dulu, lalu kumpulkan».

## §Tugas.Kelompok.PanelGuru — Panel kelompok guru berbasis kartu (2026-11-25)

1. **Prefiks kelas `kg-`** untuk panel guru; kelas `sw-kelompok-*` tetap milik sisi siswa (`KelompokSiswaPanel`, `KelompokBannerBeranda`) — jangan dihapus/diganti saat merapikan panel guru. Semua CSS ada di `kelompok-status.css` yang diimpor komponen (§Tugas.UiGuru no. 9: tidak boleh snippet lepas).
2. **Jangan kembali ke «chip berwarna untuk semua status».** Prinsip tampilan: hanya yang butuh tindakan guru yang berwarna (belum mengumpulkan, pengajuan menunggu); konfirmasi otomatis sengaja redup. Chip konfirmasi/sumber baru ditambahkan sebagai teks kecil, bukan pil berwarna.
3. **Status konfirmasi tetap dari `statusKonfirmasi()`** (§Tugas.Kelompok.AutoKonfirmasi) — panel ini tidak boleh membaca `konfirmasiMs` langsung.
4. **Hook harus dipanggil sebelum `return` awal** (`useMemo` ringkasan ditempatkan sebelum `if (kelompok === null) return …`); jangan memindahkannya ke bawah.
5. Saringan memakai kelas `tg-seg` yang sudah ada (§Tugas.UiGuru no. 12); jangan membuat kelas segmen baru. Ringkasan dihitung dari `pengumpulan` (kiriman ketua) dan `status` (pengajuan `menunggu`).
6. Uji: (a) 7 kelompok → 7 kartu, ringkasan «N sudah / M belum»; (b) saringan «Belum mengumpulkan» & «Ada pengajuan» mengubah jumlah kartu dan «Semua» mengembalikan; (c) pengajuan menunggu/diizinkan/ditolak tampil sebagai kotak di bawah nama anggota; (d) HP 360px: satu kolom, tanda konfirmasi turun ke bawah nama.

## §Tugas.Kelompok.AutoKonfirmasi — Auto-konfirmasi anggota 1 jam (2026-11-25)

1. **Dihitung di klien, tidak disimpan.** `statusKonfirmasi(kelompok, status, now)` (di `lib/tugasKelompok.ts`) adalah SATU-SATUNYA tempat aturan ini. Semua tampilan (guru, panel siswa, banner beranda) wajib memakainya — jangan lagi membandingkan `konfirmasiMs > 0` secara langsung (itu hanya konfirmasi MANUAL dan akan menampilkan «belum konfirmasi» yang keliru).
2. **Aturan:** manual (`konfirmasiMs > 0`) menang; selain itu `otomatis` bila `now − max(diubahMs, dibuatMs) ≥ WAKTU_AUTO_KONFIRMASI_MS` (1 jam); jika waktu mulai tidak diketahui (0) → `belum` (konservatif). Mengubah anggota oleh ketua memperbarui `diubahMs` sehingga hitungan diulang untuk semua anggota yang belum konfirmasi manual.
3. **Tidak ada penulisan Firestore/Cloud Function terjadwal** karena konfirmasi hanya informatif (§Tugas.Kelompok). Bila suatu saat konfirmasi dipakai sebagai syarat (mis. ekspor, penolakan), status `otomatis` TIDAK ada di dokumen `lms_tugas_kelompok_anggota` — gunakan `statusKonfirmasi`, jangan membaca dokumen mentah.
4. **Tampilan beda:** manual = `sw-kelompok-chip--ok`; otomatis = `sw-kelompok-chip--auto` (hijau bergaris putus). Jangan disamakan agar guru bisa membedakan siswa yang benar-benar merespons.
5. **Penanda waktu hidup:** komponen memakai `useSekarang()` supaya hitung mundur dan peralihan ke «otomatis» terjadi tanpa memuat ulang halaman. Jam perangkat yang salah hanya memengaruhi tampilan (informatif).
6. Uji: (a) bentuk kelompok → anggota «belum konfirmasi · otomatis ±59 mnt»; (b) setelah 1 jam → «terkonfirmasi otomatis», banner beranda anggota hilang; (c) anggota menekan «Saya sudah tahu» → «sudah konfirmasi»; (d) ketua mengubah anggota → hitungan 1 jam mulai lagi.

## §Kirim.Diagnostik — batas waktu, deteksi macet, dan kode diagnostik pada pengiriman tugas (2026-11-25)

1. **Firestore tidak menolak penulisan saat server tak terjangkau; ia menunggu tanpa batas.** Karena itu setiap langkah tulis di `kirimPengumpulan` dibungkus `langkah(nama, fn, batasMs)` (foto 90 dtk `BATAS_WAKTU_FOTO_MS`, meta 45 dtk `BATAS_WAKTU_META_MS`) yang melempar galat berkode `kirim/timeout`. Jangan menghapus batas ini: tanpanya tombol macet selamanya di «Mengirim foto…». Penulisan yang tertunda tetap berjalan di SDK dan aman diulang (id dokumen tetap; pola foto yatim §Tugas.FotoYatim menangani `setDoc` pada dokumen yang ternyata sudah ada).
2. **`firebase.ts` memakai `initializeFirestore(app, { experimentalAutoDetectLongPolling: true })`** (dengan `try/catch` ke `getFirestore` karena HMR). Jangan mengembalikan ke `getFirestore(app)` saja: jaringan sekolah/proxy yang memblokir streaming membuat penulisan menggantung. Opsi ini TIDAK boleh digabung dengan `experimentalForceLongPolling`.
3. **Video wajib dibungkus `langkah('video-N')`** dan unggahan dipantau macet (`BATAS_MACET_UNGGAH_MS` 90 dtk di `videoTugas.ts`; macet → `task.cancel()` + galat `storage/stalled`). Tanpa ini galat Storage keluar sebagai teks Inggris tanpa petunjuk langkah. `pesanGagalKumpul` memetakan `permission-denied` DAN `storage/unauthorized` ke pesan «ditutup/sudah dinilai»; galat Firebase berkode lain tampil sebagai pesan Indonesia generik + kode, bukan `e.message`.
4. **Offline:** `kirimPengumpulan` menolak di awal bila `navigator.onLine === false` (`kirim/offline`). `onLine === true` TIDAK menjamin ada internet, jadi batas waktu pada butir 1 tetap diperlukan.
5. **Baca ulang meta setelah menulis bersifat tidak fatal.** Pada titik itu pengumpulan SUDAH tersimpan; kegagalan `getDoc` terakhir memakai data lokal. Jangan menjadikannya galat pengiriman (siswa akan mengulang pengiriman yang sebenarnya sudah berhasil).
6. **Kode diagnostik (`lib/diagnostik.ts`):** `akhiranDiagnostik(e)` menambahkan « (kode: langkah/kode; peramban; OS; online/offline; jaringan)» pada pesan galat pengiriman; `gambar.ts` menambahkan `ringkasPerangkat()` pada «rincian». Isi TIDAK BOLEH memuat nama, kelas, ID siswa, atau token. Alasannya: konsol HP siswa tidak bisa dilihat; foto layar pesan galat adalah satu-satunya jejak. Saat ada laporan gagal kirim, minta foto layar pesannya dan baca kodenya: `kirim/timeout` = koneksi lambat/terblokir, `permission-denied`/`storage/unauthorized` = tugas dinilai/ditutup, `unavailable` = server tak terjangkau, `WebView`/`FacebookApp` = dibuka dari dalam aplikasi lain (minta «Buka di Chrome»).
7. **Video:** tipe dari `tipeVideoDari` (`file.type`, atau ekstensi bila kosong/`application/octet-stream`); jangan kembali ke `file.type.startsWith('video/')` saja (video valid dari pemilih file Android sering bertipe kosong). mp4 ≤ 6 MB berkodek HEVC (`hvc1`/`hev1`) dikonversi ke webm bila `dukungKonversiVideo()`, karena PC guru sering tak bisa memutar HEVC; bila tak bisa konversi, tetap dikirim apa adanya.
8. **Batas 50 MB** di `storage.rules` hanya untuk lampiran tugas guru dan video materi, BUKAN pengumpulan siswa (video siswa ≤ 15 MB, foto di Firestore). Jangan menaikkannya demi pengumpulan siswa.
9. **Belum tertangani (jangan mengira sudah):** video iPhone (`.mov`, Safari tanpa MediaRecorder webm → «belum bisa memperkecil video»); draf foto tidak disimpan lokal sehingga hilang bila Android mematikan tab saat kamera terbuka; penutupan tugas di tampilan memakai jam HP (`Date.now()`), sedangkan rules memakai jam server.
10. **Uji:** (a) matikan data/WiFi lalu kirim → «Tidak ada koneksi internet» dengan kode; (b) aktifkan mode pesawat di tengah pengiriman 10 foto → dalam ±90 dtk muncul «Foto ke-N belum terkirim» dengan kode `kirim/timeout`, sambungkan lagi dan kirim ulang berhasil tanpa permission-denied; (c) matikan sinyal di tengah unggah video → ±90 dtk kemudian «Video belum terkirim…»; (d) tugas dinilai lalu coba kirim video → pesan «ditutup/sudah dinilai»; (e) video `.mp4` dari pemilih file bertipe kosong tetap diterima; (f) pesan galat menampilkan baris «(kode: …)» dan tidak memuat nama/ID; (g) kirim normal 10 foto + video tetap berhasil dan hasilnya terbaca guru.

## §Tugas.Foto.Batas10 — Batas foto pengumpulan 10, bukti berlabel tetap 6 (2026-11-25)

1. **Menggantikan §Tugas.Foto.Kemajuan butir 1** (batas 6). Batas foto siswa kini **10**: UI `BATAS_FOTO_PENGUMPULAN`/`BATAS_SLOT_FOTO` = 10, `SLOT`/`DAFTAR_SLOT` 1..10, rules `fotoIds.size() <= 10` (create DAN update) + slot `'1'..'10'`, Cloud Function `nilaiTugasLmsAi.js` (`slotDariIdFoto`, `.slice(0, 10)`). Kelima tempat WAJIB sama; mengubah sebagian membuat foto ke-7+ ditolak rules atau diam-diam diabaikan guru/AI.
2. **Regex slot:** `/_([1-6])$/` TIDAK BOLEH kembali. Slot 10 berakhiran `_10`; pola yang benar `/_(10|[1-9])$/` (klien `slotDariFotoId`, function `slotDariIdFoto`). Pola `[1-9]` saja akan membaca `_10` sebagai slot 0 dan foto ke-10 hilang di tampilan guru. Regex pesan galat `foto-(\d+)` juga wajib `\d+` (bukan `\d`).
3. **Yang SENGAJA tetap 6:** `BATAS_BUKTI_TUGAS` (bukti berlabel), kunci video `'1'..'6'` di `lmsVideosSah`, `storage.rules` `namaVideoSiswa` `_[1-6]`, `videosDariDok`, function (`buktiTugas.slice(0, 6)`, slot video ≤ 6), dan prompt generator tugas AI («maksimal 6 bukti»). Bukti berlabel dan video berbagi slot 1..6; menaikkannya berarti mengubah semuanya bersamaan (termasuk `storage.rules` di KEDUA repo) dan menguji video.
4. **Urutan deploy:** rules DAHULU (`firebase deploy --only firestore:rules,functions:nilaiTugasLmsAi` dari Penilaian), baru hosting LMS. Hosting lebih dulu = foto ke-7+ gagal `permission-denied` («kode: foto-7»).
5. `KONKURENSI_FOTO` tetap 2 (§Tugas.Foto.Kemajuan butir 2). Dengan 10 foto, ±2,2 MB per kirim; jangan menaikkan konkurensi tanpa uji sinyal lemah.
6. **Uji:** (a) tugas tanpa bukti berlabel: pilih 10 foto → tombol «Mengirim foto 1 dari 10 … 10 dari 10», guru melihat 10 foto berurutan, penilaian AI membaca 10; (b) coba menambah foto ke-11 → ditolak UI «Maksimal 10 foto»; (c) kirim ulang 10 → 7 foto menghapus slot 8–10 lama; (d) tugas berbukti berlabel (6 bukti, ada video) tetap jalan; (e) pengumpulan lama ≤ 6 foto terbuka normal; (f) `node functions/uji/nilaiTugasLmsAi.uji.mjs` lulus (termasuk `slotDariIdFoto('t_s_10') === 10`).

## §Gambar.Dekode — pembacaan gambar berlapis; kegagalan satu foto tidak boleh menggagalkan yang lain (2026-11-25)

1. **Gejala:** satu HP Android siswa gagal mengirim gambar dengan «The source image cannot be decoded» (galat `createImageBitmap`). Konsol HP siswa tidak tersedia, jadi pesan di layar HARUS cukup informatif: `kompresGambar` menyertakan «(rincian: format, ukuran, jenis galat)» yang bisa difoto layarnya.
2. **Jangan kembali ke `createImageBitmap` tunggal.** Urutan di `bacaGambar` (`lib/gambar.ts`): createImageBitmap → `<img>` object URL → salin byte (`blob.arrayBuffer()`) + kenali format dari byte → ulangi dengan Blob bertipe benar. Tipe MIME dari galeri Android sering kosong/keliru; jangan mengandalkan `file.type` untuk memutuskan bisa-tidaknya dibaca.
3. **HEIC/HEIF/AVIF** tidak bisa didekode peramban Android; pesan khusus mengarahkan siswa mengubah kamera ke JPEG. `accept` input masih memuat `image/heic`/`heif` (iOS Safari bisa mengonversinya) — jangan dihapus tanpa uji di iPhone. Solusi konversi HEIC di sisi klien (pustaka tambahan) belum dipakai; pertimbangkan hanya bila keluhan berulang.
4. **`toDataURL` bisa gagal diam-diam** (canvas besar di HP RAM kecil) dan mengembalikan `data:,` yang pendek sehingga lolos cek `SASARAN_KARAKTER` lalu dibuang `dataUrlGambarAman` — siswa melihat «Tambahkan minimal satu foto» tanpa sebab. `gambarKeDataUrl` kini menolak hasil yang bukan `data:image/…` (panjang < 200) dan mencoba skala lebih kecil. Pertahankan pemeriksaan ini.
5. **Multi-pilih:** `pilih` dan `pilihBukti` di `PengumpulanSiswa.tsx` memproses tiap foto dalam `try/catch` sendiri; yang berhasil tetap masuk, yang gagal dilaporkan dengan namanya. Jangan membungkus seluruh loop dalam satu `try` (satu foto buruk membuang semuanya).
6. **Perubahan ini memengaruhi semua pemakai `kompresGambar`** (unggah gambar soal, materi, bank soal). Setelah mengubah `lib/gambar.ts`, uji juga unggah gambar di editor soal/materi.
7. **Uji:** (a) foto JPG/PNG/WebP biasa tetap terkirim; (b) foto HEIC di HP yang tak mendukung → pesan HEIC + rincian; (c) pilih 3 foto dengan 1 foto rusak → 2 masuk, 1 dilaporkan; (d) foto dari Google Foto/Drive yang belum terunduh → pesan «tidak bisa dibuka dari galeri»; (e) minta siswa yang bermasalah mengirim foto layar pesan galatnya bila masih gagal — baris «rincian» menunjukkan format dan jenis galat.

## §Tugas.Foto.Kemajuan — Pengiriman foto paralel terbatas + indikator kemajuan (2026-11-25)

1. **Batas tidak berubah:** maksimal 6 foto/siswa/tugas (UI `BATAS_FOTO_PENGUMPULAN`, rules `fotoIds.size() <= 6` + slot '1'..'6'), video maks. 2, tiap foto ≤ 300.000 karakter. Menaikkan batas = ubah rules di KEDUA repo + `BATAS_FOTO_PENGUMPULAN`/`BATAS_SLOT_FOTO`/`SLOT`/`DAFTAR_SLOT` + `BATAS_BUKTI_TUGAS` sekaligus; jangan mengubah sebagian.
2. **Foto dikirim paralel dengan konkurensi 2** (`KONKURENSI_FOTO`). Jangan dinaikkan tanpa uji di sinyal lemah (tiap foto ±220 KB; lebih banyak permintaan bersamaan justru memperbanyak kegagalan di HP murah). Jangan mengembalikan ke `Promise.all` tanpa batas.
3. **Urutan `fotoIds` mengikuti `entri` (slot),** dihitung SEBELUM pengiriman — bukan urutan selesai. Meta (`lms_pengumpulan`) tetap ditulis TERAKHIR setelah semua foto berhasil (guru tidak boleh melihat meta yang menunjuk foto yang belum ada). Bila satu foto gagal: tidak ada foto baru dimulai, yang sedang berjalan diselesaikan, galat PERTAMA dilempar dan meta TIDAK ditulis.
4. **Setiap foto tetap dibungkus `langkah('foto-N')`** agar galat membawa kode langkah. `pesanGagalKumpul` memakainya: galat non-izin pada langkah foto menampilkan «Foto ke-N belum terkirim…». Jangan menghapus pembungkus `langkah` atau pola foto yatim (§Tugas.FotoYatim): keduanya berjalan di tiap pekerja.
5. **UI:** tombol kirim menampilkan «Mengirim foto X dari Y…» (`onProgressFoto`); tombol pilih galeri menampilkan «Memproses foto X dari Y…» saat kompres. Video tetap memakai persen sendiri (`onProgressVideo`) dan didahulukan.
6. **Uji:** (a) kirim 6 foto → tombol berubah 1 dari 6 … 6 dari 6, semua foto terbaca guru urut sesuai slot; (b) putus internet di tengah → pesan «Foto ke-N belum terkirim», lalu kirim ulang berhasil tanpa permission-denied; (c) kirim ulang dengan jumlah foto lebih sedikit menghapus slot lama; (d) tugas berbukti berlabel tetap jalan; (e) tugas selesai/lewat tenggat tetap ditolak dengan pesan ditutup (kode langkah tetap ada).

## §Tugas.Tenggat.Otomatis — Tutup otomatis saat tenggat (2026-11-25)

1. **Opt-in per tugas:** field `tutupSetelahTenggat` (boolean). Default form untuk tugas BARU = aktif (bila ada tenggat); dokumen lama tanpa field = `false`. Jangan menjadikannya berlaku global: tugas lama yang tenggatnya sudah lewat tetapi masih dikerjakan siswa akan mendadak tertutup (perilaku lama: tenggat hanya label «Lewat tenggat»).
2. **Diturunkan, bukan ditulis:** penutupan oleh tenggat dihitung saat dibaca lewat `alasanTugasDitutup` (`lib/tugasTutup.ts`) — `selesai` TIDAK diubah. Alasannya tidak ada Cloud Function/penjadwal; klien yang membuka dashboard tidak boleh dijadikan pemicu tulis (balapan, bergantung siapa yang login). Jangan menambahkan tulis `selesai=true` dari klien.
3. **Tiga lapis harus sejalan (kelanjutan §Tugas.Selesai.Ditutup.2):** UI (`alasanTugasDitutup` → `statusTugasSiswa` = `ditutup`), `firestore.rules` (`lmsTugasTutupOlehTenggat`, dipakai `lmsSiswaBolehKumpul`), `storage.rules` (`siswaBolehKelolaVideo`). Rules memakai `request.time` (jam server) + toleransi **5 menit**; konstanta `TOLERANSI_UNGGAH_MENIT` di klien dan dua berkas rules WAJIB sama. UI menutup tepat di tenggat (jam perangkat siswa), rules baru menolak setelah tenggat + 5 menit: selisih ini disengaja agar unggahan yang sudah berjalan tidak gagal, dan penutupan UI hanya memengaruhi siswa yang baru membuka tugas.
4. **Pola rules:** field dibaca dengan `in` dulu dan `tenggat is timestamp` (dokumen lama/tenggat kosong → tidak menutup). Jangan membaca `tugas.tenggat` langsung. `lmsTugasDoc` dipanggil berulang tetapi `get` dokumen yang sama dihitung sekali per evaluasi; jangan menambah `get`/`exists` baru di jalur ini (batas Storage rules: satu `get` tugas + satu `exists` nilai).
5. **Perbaikan terkait:** `buatTugas` sebelumnya tidak menulis `modeKelompok`/`kelompokMaxAnggota` saat tugas dibuat (nilai dari form hilang sampai pengaturan disimpan ulang). Kini ditulis. Pada tugas baru dengan opsi kelompok, periksa bahwa `modeKelompok` tersimpan.
6. **Guru:** kartu dashboard memberi tanda «Ditutup otomatis untuk siswa» dan gaya selesai bila tenggat terlewati. Membuka kembali: perpanjang tenggat atau matikan opsi (tombol «Batal selesai» hanya memengaruhi `selesai` manual). Hitungan/saringan «Selesai» di dashboard tetap berdasarkan `selesai` manual.
7. **Tanpa tenggat = tidak pernah tertutup otomatis;** opsi dinonaktifkan di form dan `buatTugas` menulis `false` bila tenggat kosong. Menghapus tenggat pada tugas yang sudah menyala opsinya membuat tugas terbuka lagi.
8. **Uji:** (a) tugas baru bertenggat 2 menit lagi, opsi aktif → siswa mengirim sebelum tenggat berhasil; (b) lewat tenggat, kartu berlabel «Penugasan ditutup» dan detail hanya keterangan «Batas waktu…»; (c) pengiriman setelah tenggat + 5 menit (mis. lewat konsol) ditolak `permission-denied`; (d) unggahan yang dimulai sebelum tenggat dan selesai dalam 5 menit berhasil; (e) tugas lama (opsi tidak ada) dengan tenggat lewat tetap bisa dikirim seperti biasa; (f) perpanjang tenggat → tugas terbuka lagi; (g) tugas baru berkelompok → `modeKelompok` tersimpan.

## §Tugas.Selesai.Ditutup — «Tandai selesai» menutup penugasan untuk siswa (2026-11-25)

1. **Semantik:** `selesai === true` (tombol guru «Tandai selesai») = penugasan DITUTUP untuk siswa. Sebelumnya flag ini hanya penanda sisi guru dan sama sekali diabaikan sisi siswa dan rules, sehingga siswa masih bisa membuka dan mengirim. Jangan kembali menganggap `selesai` murni label guru.
2. **Tiga lapis harus tetap sejalan:** (a) UI siswa: `statusTugasSiswa` mengembalikan `ditutup` dan detail tugas hanya menampilkan keterangan «Penugasan telah ditutup» (tanpa deskripsi, instruksi, lampiran, panel kelompok, form pengumpulan); (b) `firestore.rules` `lmsSiswaBolehKumpul` menolak create/update/delete pengumpulan, foto, dan sejenisnya bila `selesai == true`; (c) `storage.rules` `siswaBolehKelolaVideo` menolak unggah/ganti/hapus video. Mengubah salah satu lapis tanpa yang lain menimbulkan tampilan menyesatkan atau celah tulis.
3. **Urutan status siswa:** `dinilai` > `ditutup` > `lewat` > `belum`. Siswa yang sudah dinilai tetap berlabel «Sudah dinilai/Nilai X» di katalog, tetapi detailnya tetap ditutup. Nilai dilihat di menu nilai, bukan di detail tugas.
4. **`arsip` tetap berbeda dari `selesai`:** arsip menonaktifkan tugas (`aktif=false`) sehingga HILANG dari menu siswa (kueri `aktif == true`). Selesai TIDAK mengubah `aktif`, jadi tugas tetap tampil di katalog sampai diarsipkan. Jangan menjadikan `selesai` otomatis menyetel `aktif=false`.
5. **Beranda:** tugas `ditutup` dikeluarkan dari «Tugas untukmu», penanda tenggat pekan, hitungan menunggu, dan persentase (penyebut = total − ditutup). `KelompokBannerBeranda` juga mengabaikan `ditutup`. Setiap tempat yang menyaring `status !== 'dinilai'` harus ikut mengecualikan `ditutup`.
6. **Guru:** menandai selesai kini meminta konfirmasi (akibatnya berat bagi siswa yang belum mengumpulkan). «Batal selesai» membuka kembali tugas. Menandai selesai tidak menghalangi guru menilai atau mereset pengumpulan (cabang rules guru tidak berubah).
7. **Rules:** ekspresi baru memakai `'selesai' in doc` sebelum membaca nilainya karena dokumen lama tidak punya field itu (membaca field tak ada = galat = tulis ditolak). Pertahankan pola ini.
8. **Uji:** (a) tandai selesai tugas yang belum dikumpulkan siswa A → A melihat kartu berlabel «Penugasan ditutup»; membuka kartu hanya menampilkan keterangan; (b) A tidak punya tugas itu di Beranda; (c) kirim lewat konsol/aplikasi lama ditolak `permission-denied`; (d) «Batal selesai» → A bisa membuka dan mengirim lagi; (e) arsipkan → kartu hilang dari katalog A; (f) guru tetap bisa menilai tugas yang ditandai selesai.

## §Tugas.Terpadu — Menilai per siswa & penyebaran nilai kelompok (2026-11-25)

1. **Satu sumber kebenaran.** `PenilaianTerpadu` tidak menyimpan data nilai: draf (`draft`), status (`statusBarisNilai`), dan penyimpanan (`simpanSatuNilai`) tetap milik `TugasDetail` dan dipakai bersama Daftar nilai. Jangan membuat state nilai kedua di komponen itu.
2. **CSS komponen diimpor oleh komponennya** (`penilaian-terpadu.css`). Jangan memindahkannya ke berkas snippet lepas (§Tugas.UiGuru no. 9).
3. **Pengumpulan & kelompok dimuat untuk SEMUA guru** saat sub-tab Daftar nilai/Menilai dibuka (bukan lagi hanya akun AI). Kueri kelompok wajib `tugasId` + `kelas` per rombel dan rombel yang ditolak rules dilewati.
4. **Aturan «ikut ketua» (`ikutKetua`)** — anggota hanya ditimpa otomatis bila: bukan ketua, tidak `lepasKelompok`, tidak punya pengumpulan sendiri, dan (belum ada nilai tersimpan ATAU nilai tersimpannya identik dengan ketua). **Nilai tersimpan yang berbeda tidak boleh ditimpa otomatis.** Penyebaran hanya mengubah draf; `Samakan anggota`/`Ikuti ketua` adalah satu-satunya jalan memaksa.
5. **Setiap jalur yang menulis draf harus lewat `patchDraft` / `onSkorKategori` / `terapkanUsulan`** (memanggil `tandaiLepas` + `sebarDariKetua`). Menulis `setDraft` langsung untuk satu baris akan melewati penyebaran. Pengecualian sah: `samakanAnggota`, `ikutiKetuaLagi`, dan penyebaran itu sendiri. Mode massal AI memakai `tanpaLepas = true`.
6. **`lepasKelompok` direset saat «Muat ulang»** bersama draf. Jangan menyimpannya ke Firestore (hanya status sesi).
7. **Simpan kelompok** (`simpanKelompok`) hanya menyimpan baris berstatus `ubah` yang ketua/pengikut (`barisKelompokBelumSimpan`), berurutan, ketua dulu, berhenti pada kegagalan pertama.
8. **Skor cepat** dihitung dari `rentangPredikat` tugas (tengah tiap rentang, maks. 100) — jangan memakai angka tetap.
9. **Sub-tab awal Input nilai = «Menilai per siswa».** Saat rubrik kosong layar ini menampilkan ajakan «Atur rubrik»; saat tugas masih draf menampilkan pesan yang sama dengan Daftar nilai (`bolehInputNilaiTugas`).
10. Uji: (a) tugas kelompok — isi nilai ketua → anggota terisi; ubah satu anggota → «Disesuaikan» dan tidak ikut perubahan ketua berikutnya; «Ikuti ketua» mengembalikan; (b) «Simpan kelompok» menyimpan semua; (c) anggota yang kirim mandiri tidak ikut ketua; (d) tugas individual: foto/video tampil, fokus kategori menyorot bukti tertaut; (e) HP 360px: bukti di atas, rubrik di bawah, bilah simpan tidak menutupi input.

## §Tugas.NilaiAi — Penilaian bukti foto/video dengan AI (2026-11-24)

1. **AI = usulan, bukan nilai.** `nilaiTugasLmsAi` TIDAK menulis ke Firestore. Penerapan ke draf hanya lewat tombol «Terapkan ke draf nilai» (atau mode massal yang juga hanya mengisi draf); penyimpanan tetap `simpanSatuNilai` oleh guru. Jangan menambah penyimpanan otomatis.
2. **Otorisasi dua lapis:** klien `bolehAiTugas()` + server `bolehPemanggilAi()` (UID + email). UI (kolom «Bukti siswa», tombol massal, dialog) hanya dirender bila `bisaAi`. Jangan memakai pembatas yang lebih longgar.
3. **Klien hanya mengirim `tugasId` + `siswaId`.** Rubrik, bukti, foto (`lms_pengumpulan_foto`), dan video (Storage `lms/pengumpulan/{tugasId}/…`) dibaca server. Server memeriksa path video berawalan folder tugas itu dan ID foto berawalan `{tugasId}_`.
4. **Server menentukan kategori mana yang boleh dinilai AI** (`susunKonteks`): `sumber: 'observasi'` → tidak dinilai; kategori tanpa bukti terkumpul → tidak dinilai; AI tidak boleh mengisi skor kategori itu walau mengembalikannya (`normalisasiHasil` memaksa `skor: null`). Urutan hasil mengikuti rubrik guru; id asing dari AI dibuang; skor dibulatkan & dijepit 0–100.
5. **Tautan bukti→kategori:** bila ada satu pun `buktiList[].kategoriIds` terisi, kategori hanya dinilai dari bukti tertaut; bila tidak ada tautan sama sekali (tugas lama/mode foto bebas), semua bukti dipakai untuk semua kategori. Jangan ubah tanpa menjalankan `node functions/uji/nilaiTugasLmsAi.uji.mjs`.
6. **Anti prompt-injection:** catatan siswa, tulisan di foto, dan ucapan di video diperlakukan sebagai DATA (aturan di `SISTEM` + penanda di prompt). Jangan menghapus aturan itu; jangan menaruh teks siswa di `systemInstruction`.
7. **Batas ukuran:** video inline ≤ 9 MB, total media ≤ 15 MB per permintaan (batas inline Gemini); yang melebihi dilewati + dicatat «periksa manual», bukan dipotong diam-diam. Video dihapus lifecycle 120 hari → «berkas tidak ditemukan». Bila perlu video besar, pakai Gemini Files API (belum dibuat).
8. **Timeout:** callable klien memakai `timeout: 295000` (default SDK 70 dtk akan memutus analisis video); fungsi `timeoutSeconds: 300`, `memory: 1GiB`, `maxInstances: 2`. Mode massal berjalan SEKUAL (satu siswa sekali), berhenti setelah 3 kegagalan, bisa dibatalkan.
9. **Privasi:** foto/video anak dikirim ke Google Gemini hanya atas aksi guru akun AI. Pastikan kunci API memakai layanan berbayar (data tidak dipakai melatih model) sebelum dipakai pada data siswa sungguhan.
10. **Tugas kelompok:** tidak ada dokumen pengumpulan «bayangan» untuk anggota (§Tugas.Kelompok). Sumber bukti baris = pengumpulan sendiri bila ada, jika tidak bukti ketua (`sumberBuktiSiswa`). Hasil AI di-cache per PEMILIK bukti (`usulanAi[pemilikId]`), bukan per siswa; panggilan server selalu memakai `pemilikId`. Kueri kelompok guru wajib `tugasId` + `kelas` per rombel (rombel yang tidak diampu dilewati, bukan galat). «Terapkan ke anggota» hanya mengubah DRAF dan melewati baris berstatus `ok` serta anggota yang punya pengumpulan sendiri. Jangan membuat panggilan AI per anggota.
11. **Pemeriksaan wajib setelah ubah prompt/normalisasi:** (a) `node functions/uji/nilaiTugasLmsAi.uji.mjs` lulus; (b) deploy `functions:nilaiTugasLmsAi`; (c) uji 1 siswa nyata dan bandingkan dengan penilaian guru sebelum memakai mode massal.

## §Tugas.Kelompok.Konfirmasi — Pemberitahuan anggota, pengajuan kirim mandiri, kueri kelompok (2026-11-25)

1. **Konfirmasi anggota hanya INFORMATIF.** Keputusan guru: anggota disusun lewat diskusi antar siswa. Status «sudah/belum konfirmasi» tidak boleh dijadikan syarat ketua mengirim, dan tidak boleh memblokir `kirimPengumpulan`. Anggota yang tidak menjawab tidak boleh menahan kelompok.
2. **Rules bukan filter (kelanjutan §Rules.Sinkron.3).** Rules `lms_tugas_kelompok` dan `lms_tugas_kelompok_anggota` memeriksa `resource.data.kelas`. Kueri SISWA WAJIB memuat `where('kelas','==',…)`; kueri GURU WAJIB `tugasId` + `kelas` per rombel (pola `daftarPengumpulanTugas`). Versi awal (`tugasId` + `array-contains` tanpa `kelas`) ditolak `permission-denied`, ditelan `catch`, sehingga anggota tidak pernah melihat kelompoknya. Jangan kembali ke `array-contains`: butuh index komposit (§Rules.Sinkron.4); saring `anggotaIds` di klien. Semua kueri baru hanya memakai `==` (cukup index tunggal bawaan).
3. **Id kelompok baru deterministik `{tugasId}_{ketuaId}`** (`idKelompokBaru`, `setDoc`), ditegakkan rules `create`. Alasannya: id pengumpulan ketua sama persis, sehingga rules `lms_pengumpulan` bisa memberi anggota hak BACA atas pengumpulan ketuanya (status «terkumpul lewat kelompok»). Jangan kembali ke `addDoc`. Kelompok lama (id acak) tetap berfungsi tetapi `ketuaSudahMengumpulkan` mengembalikan `null` (UI tidak boleh menulis «terkumpul» pada `null`).
4. **Status anggota di koleksi terpisah** `lms_tugas_kelompok_anggota/{kelompokId}_{siswaId}` agar rules kelompok lama tidak disentuh. `setDoc` pada dokumen yang sudah ada dibaca rules sebagai UPDATE (§Tugas.FotoYatim.2): `simpanStatusSaya` memakai `updateDoc` bila dokumen sudah dimuat dan `setDoc` hanya untuk dokumen baru. Jangan `setDoc` ulang dokumen status yang sudah ada (pengajuan bisa tertimpa `tidak`).
5. **Alur pengajuan:** anggota set `menunggu` (+ alasan ≤ 200). Anggota TIDAK bisa menulis `diterima`/`ditolak`; hanya ketua (rules update kedua). Izin = `pengajuan == 'diterima'` DAN siswa masih ada di `anggotaIds` (`punyaIzinMandiri`). Mengeluarkan anggota atau menghapus kelompok membersihkan dokumen statusnya (best-effort, galat hanya `console.warn`).
6. **Batas yang diketahui:** (a) izin kirim mandiri hanya ditegakkan di UI; rules `lms_pengumpulan` sengaja TIDAK diubah (risiko regresi foto/video). (b) «Satu siswa satu kelompok per tugas» dicek di klien (`pastikanTanpaBentrok`) tepat sebelum simpan; rules tidak bisa membuktikannya, jadi dua ketua yang menyimpan bersamaan masih mungkin. (c) Nilai kelompok tetap diinput per siswa.
7. **Rules pengumpulan:** cabang baca anggota kelompok (`exists(lms_tugas_kelompok/$(id))` + `siswaId in anggotaIds`) ditempatkan TERAKHIR pada `allow read`. Jangan dipindah ke depan atau digabung ke cabang lain. `getDoc` pada pengumpulan ketua yang belum ada bergantung pada cabang ini (tidak menyentuh `resource`); bila ditolak, hasilnya `null` dan UI tetap aman.
8. **Beranda:** `KelompokBannerBeranda` mandiri dan gagal-sendiri (§124.3); tidak mengubah `useBerandaSiswa`. Jangan menaruh kueri kelompok di dalam `muatTugas` karena satu penolakan akan mematikan daftar tugas.
9. **CSS** ada di `styles/kelompok-status.css` dan DIIMPOR langsung oleh komponen. Jangan membuat `*-snippet.css` lepas (pernah terlantar dan tidak pernah dimuat).
10. **Penanda rules** yang wajib ada sebelum kirim (tambahan atas §Rules.Sinkron.2): `match /lms_tugas_kelompok_anggota/`. Rules dikirim UTUH ke kedua repo (SDM01Penilaian sumber tunggal) dan di-deploy SEBELUM hosting.
11. **Uji (dua akun siswa sekelas + akun guru):** (a) A membuat kelompok memilih B → B login: banner beranda + lencana katalog + kotak «Anda masuk kelompok» di detail tugas; (b) B menekan «Saya sudah tahu» → banner hilang, chip A berubah; (c) B mengajukan → beranda A menampilkan banner pengajuan; A «Izinkan» → B melihat form unggah («izin dari ketua»); A «Tolak» → B melihat catatan; (d) A mengirim → B melihat «Sudah terkumpul lewat kelompok (dikirim ketua)»; (e) siswa C tidak melihat B di daftar pilihan bila B sudah di kelompok A; (f) guru: tab Pengumpulan menampilkan kelompok + chip; (g) konsol siswa dan guru bebas `permission-denied`.
12. **Kelas tombol siswa (regresi 2026-11-25):** tombol panel kelompok memakai `sw-btn sw-btn--primary/--secondary/--ghost` (gaya BEM ganda) yang TIDAK PERNAH didefinisikan di CSS mana pun, sehingga tampil polos dan siswa bingung mana yang harus ditekan. Kelas tombol siswa yang sah: `sw-btn-primary`, `sw-btn-ghost` (siswa.css) serta `sw-btn-secondary` dan `sw-btn-bahaya` (kelompok-status.css). Jangan menulis `sw-btn--*` atau `sw-btn` saja. Sebelum memakai kelas tombol baru, `grep` definisinya di `src/styles/` dan `src/index.css`; kelas tanpa definisi tidak memunculkan galat apa pun.
13. **Hierarki tombol panel kelompok:** utama = `sw-btn-primary` (Buat kelompok, Simpan anggota, Saya sudah tahu, Izinkan); lanjutan = `sw-btn-secondary` (Ubah anggota, Ajukan ke ketua); batal = `sw-btn-ghost`; merusak = `sw-btn-bahaya` (Hapus/Keluar kelompok, Tolak, Cabut izin). Satu aksi utama per kotak; aksi merusak tidak boleh memakai gaya utama.
14. **Jangan `deleteDoc`/`getDoc` pada dokumen yang belum tentu ada (regresi 2026-11-25).** Rules membaca `resource.data`; pada dokumen yang tidak ada `resource` null sehingga ditolak `Missing or insufficient permissions`. `hapusStatusAnggota` memanggil `deleteDoc` buta pada anggota yang belum pernah konfirmasi/mengajukan (tidak punya dokumen status) dan mengisi konsol dengan galat. Penggantinya `hapusStatusKelompok` memuat daftar status lewat kueri lalu menghapus HANYA dokumen yang terbukti ada. Jangan kembali ke penghapusan berdasarkan id tebakan.
15. **Peringatan konsol `@firebase/firestore … BloomFilterError`** berasal dari SDK Firestore (filter keberadaan pada listener/cache), bukan dari kode aplikasi; tidak memengaruhi data dan tidak perlu ditangani. Yang wajib diselidiki hanya galat `permission-denied`.


## §Tugas.Video.Role — Role guru di storage.rules harus selaras isGuru() (2026-11-24)

1. `guruStorage()` (storage.rules) wajib memuat SEMUA role guru yang ada di `isGuru()` (firestore.rules): `admin`, `guru`, `guru_akademik`, `guru_tahsin_tahfizh`. Menambah role baru ke `isGuru()` berarti menambahkannya juga di `guruStorage()`. Daftar role yang berbeda menimbulkan `storage/unauthorized` (403) hanya pada akun role tertentu sehingga sulit terlihat saat uji dengan akun lain.
2. Orang tua (`orangtua`) sengaja TIDAK termasuk (ANTIREGRESI §Tugas.Video.6).
3. Revisi §Rules.Sinkron butir 5: «galat `console.warn` kueri bersama = bug» berlaku untuk kueri SISWA. Galat guru `daftarTugas/daftarKuis kelasList` adalah keterbatasan yang sudah dicatat di §93.5/§128 dan boleh muncul selama kueri kelas utama berhasil.
4. Uji video sebagai guru dengan role non-`guru` (mis. `guru_akademik`), bukan hanya akun admin.

## §Tugas.FotoYatim — Dokumen foto yatim & penanda langkah pengiriman (2026-11-24)

1. Urutan simpan **foto dulu, meta terakhir** menimbulkan dokumen foto yatim bila meta gagal. `setDoc` pada dokumen yang sudah ada = **update** di mata rules; field `createdAt` berubah sehingga ditolak (update foto hanya `data` + `updatedAt`). Jangan pernah mengandalkan `ada.fotoIds` sebagai satu-satunya penentu dokumen foto sudah ada.
2. Pola wajib untuk foto baru: `setDoc`; bila `permission-denied` → `updateDoc({ data, updatedAt })`. Rules **tidak** dilonggarkan (createdAt tetap tidak boleh diubah siswa).
3. Rules bukan filter dan `getDoc` pada dokumen yang tidak ada ditolak oleh rules siswa (resource null), jadi «cek dulu dengan getDoc» bukan solusi.
4. Setiap langkah tulis di `kirimPengumpulan` dibungkus `langkah(nama, …)`; jangan dihapus. Kode `(kode: …)` pada pesan galat siswa dan log konsol dipakai untuk diagnosis permission-denied.
5. Bila menambah langkah tulis baru (mis. dokumen kelompok/shadow), bungkus dengan `langkah()` juga.

## §Rules.Sinkron — Sumber tunggal rules & kueri siswa harus mencerminkan rules (2026-11-24)

1. **Sumber tunggal `firestore.rules` / `storage.rules` / `firestore.indexes.json` = repo SDM01Penilaian (HEAD).** Salinan di repo LMS hanya cermin dan bisa tertinggal. Sebelum menyusun rules: ambil berkas dari SDM01Penilaian terbaru, ubah bagian `lms_*` saja, kirim UTUH ke KEDUA repo.
2. **Regresi 2026-11-24:** rules kelompok (12:58) dan rules video (19:04) saling menghapus karena masing-masing disusun dari salinan LMS yang usang. Setelah mengubah rules, wajib cek keberadaan SEMUA penanda ini sebelum dikirim: `match /lms_tugas_kelompok/`, `function lmsVideosSah`, `function lmsAdaBuktiKumpul`, `match /lms_pengumpulan/`, `match /lms_pengumpulan_foto/`, `match /lms_jawaban/`. Cara cepat: `grep -c` tiap penanda dan bandingkan dengan HEAD sebelumnya; `diff` terhadap HEAD hanya boleh menampilkan baris yang memang disengaja.
3. **Rules bukan filter.** Kueri siswa wajib memuat SEMUA predikat yang dipakai cabang rules yang dituju. Cabang `kelasList` di `lms_tugas` mensyaratkan `aktif == true`, jadi kueri wajib `where('kelasList','array-contains',k)` + `where('aktif','==',true)`. Jangan lagi «filter aktif di klien».
4. Kueri `array-contains` + `==` butuh index komposit di `firestore.indexes.json` (sudah ditambahkan untuk `lms_tugas`). Deploy index DULU dan tunggu Enabled sebelum hosting; kalau belum siap, kueri gagal `failed-precondition` dan tugas bersama tidak tampil.
5. Galat kueri bersama yang hanya `console.warn` (mis. `daftarTugasAktifKelas kelasList`) tetap dianggap gejala bug, bukan kebisingan: periksa konsol siswa setiap selesai mengubah rules atau kueri.
6. Tugas kelompok dan video bergantung pada rules yang berbeda tetapi harus hidup bersamaan: `lms_tugas_kelompok` (Firestore) + `videos` pada `lms_pengumpulan` + `lms/pengumpulan/…` (Storage). Menghilangkan salah satunya menimbulkan «Missing or insufficient permissions» pada siswa.

## §Tugas.UiGuru — Penyegaran UI halaman Tugas guru (2026-11-24)

1. **Jangan pakai dropdown absolut di dalam `.tg-kartu`** — kartu `overflow: hidden` (untuk bar aksen) sehingga menu terpotong. Aksi sekunder memakai baris inline «Lainnya» (`.tg-lain`).
2. **Ubin ringkasan = `<button>`** dengan reset gaya (`font: inherit`, `appearance: none`). Ubin «Pengumpulan» sengaja bukan saringan (tetap `div`).
3. **Radio status memakai `<fieldset class="td-status-set">`, JANGAN diberi kelas `.td-field`** — `.td-field input` menimpa gaya radio (padding/border) dan merusak tampilan.
4. **Tab di URL:** `setTab` wajib lewat wrapper (menulis `?tab=` dengan `replace`). Ref `tabDitentukan` mencegah tab awal otomatis (`tabAwalUntuk`) menimpa tab pilihan pengguna/URL; setelah «Buat tugas» arahkan ke `?tab=isi` dan set ref sebelum `navigate`.
5. **Penanda «belum disimpan»** membandingkan `sigPengaturan(form)` dengan `sigPengaturan(tugas)`. Bila menambah field baru ke form Pengaturan, tambahkan ke KEDUA sisi (dan ke `isiFormDariTugas`), kalau tidak penanda salah menyala/padam.
6. **Bilah simpan lekat** (`.td-aksi--lekat`) memakai `position: sticky`; jangan beri `overflow` pada leluhur `.td-form`/`.lms-content` karena sticky akan mati. Umpan balik katalog (`.tg-info`) memakai `top: 4.25rem` agar tidak tertutup topbar sticky (z-index 20).
7. **`.td-tabs` 4 kolom** di ≥761px, 2 kolom 561–760px, 1 kolom di bawahnya. Jangan kembalikan ke 3 kolom (tab ke-4 turun baris sendirian).
8. **Hapus tugas** lewat `KonfirmasiHapusDialog`; `hapusTugas` hanya menghapus dokumen `lms_tugas` (pengumpulan/nilai tidak ikut) — teks dialog harus tetap jujur soal itu.
9. **Snippet CSS wajib digabung ke berkas yang diimpor.** `kelompok-guru-snippet.css` dan `kelompok-snippet.css` berisi komentar «sisipkan ke …» tetapi tidak pernah diimpor, sehingga tampilan Tugas kelompok (guru & siswa) tidak bergaya. Sekarang sudah digabung ke `tugas.css` dan `siswa.css`. Jangan membuat berkas `*-snippet.css` baru; kalau CSS baru muncul untuk komponen, pastikan kelasnya ada di CSS yang diimpor (cek dengan `grep` nama kelas) sebelum dianggap selesai.
10. **Status baris Daftar nilai** dihitung oleh `statusBarisNilai()` (membandingkan draf dengan baris server via `draftSamaDenganServer`). Setelah `simpanSatuNilai` baris server (`barisNilai`) dan draf harus sama-sama di-update (sudah dilakukan) — kalau salah satu tidak, baris selamanya «Belum disimpan». Bila format simpan berubah (mis. pembulatan), ubah juga snapshot di `statusBarisNilai` dan `muatNilai`.
11. **`Simpan semua` hanya baris berstatus `ubah`** (bukan semua yang berisi data) — jangan dikembalikan, karena menyimpan ulang puluhan baris tak berubah memperlambat dan menimpa `diubahPada`.
12. Tombol saringan Daftar nilai memakai kelas `tg-seg` yang sudah ada; jangan membuat kelas segmen baru. Tabel `td-tabel--nilai`: tetap DILARANG mengubah `display` pada `th/td`; sel nama tetap `position: sticky` dan harus ikut diberi warna latar pada baris `--ubah`.
13. Uji: (a) klik ubin «Segera berakhir» → daftar tersaring & tombol segmen ikut aktif; (b) buka tugas Aktif siswa tanpa `?tab` → langsung Pengumpulan; (c) ubah judul → penanda kuning, simpan → hijau; (d) buat tugas baru → mendarat di Isi tugas; (e) HP 360px: bilah simpan tidak menutupi tombol, status jadi satu kolom.

## §Tugas.Reset — Reset pengumpulan siswa (2026-11-24)

1. Guru/admin menghapus `lms_pengumpulan` + `lms_pengumpulan_foto` + video Storage; opsional `lms_nilai_tugas` agar kunci `lmsSudahDinilai` terbuka.
2. Jangan biarkan siswa menghapus meta sendiri setelah dinilai (rules sudah melarang).
3. UI: konfirmasi eksplisit; dua tombol terpisah (dengan/tanpa hapus nilai).

## §Tugas.Lampiran — Berkas lampiran guru (2026-11-24)

1. Path Storage hanya `lms/tugas/{tugasId}/{id}_{nama}` lewat `unggahLampiranTugas`.
2. Siswa unduh lewat `url` bertoken — jangan mengandalkan `isLoggedIn()` Storage untuk token siswa.
3. Batas: 8 berkas, 50 MB; jenis dari content-type + ekstensi.

## §Tugas.Kelompok — Mekanisme (2026-11-24)

1. **Guru** menandai `modeKelompok` + `kelompokMaxAnggota` (2–12) di tab Pengaturan.
2. **Siswa** membentuk kelompok di panel Kelompok (`lms_tugas_kelompok`):
   - Buat kelompok → pembuat otomatis ketua.
   - Pilih teman sekelas (hasil diskusi kelas). Anggota mendapat pemberitahuan + konfirmasi informatif — lihat §Tugas.Kelompok.Konfirmasi.
   - Ketua boleh ubah anggota; ketua keluar = hapus kelompok; anggota keluar = lepas diri.
3. **Pengumpulan:** hanya ketua yang memanggil `kirimPengumpulan`. Anggota non-ketua melihat pesan; status «terkumpul» dihitung di klien jika ketua sudah mengirim (tidak ada dokumen shadow pengumpulan per anggota — hindari regresi rules foto).
4. **Penilaian (lanjutan):** nilai dari bukti ketua; guru bisa salin ke semua anggota di tab nilai (belum otomatis di V1 — input per siswa tetap tersedia).
5. **Rules:** create hanya jika tugas `modeKelompok == true` & aktif & kelas cocok; update anggota hanya ketua (atau non-ketua mengurangi diri); delete ketua/guru/admin.
6. Jangan menambahkan field wajib baru ke `lms_pengumpulan` hasOnly tanpa memperbarui rules.

## §Tugas.MultiFile — Multi-pilih foto pengumpulan (2026-11-24)

1. **Mode bebas:** `input[type=file][multiple]` + `BATAS_FOTO_PENGUMPULAN = 6` (sama dengan `fotoIds.size() <= 6` di rules). Jangan turunkan ke 3 lagi tanpa mengubah rules.
2. **Mode bukti berlabel — isolasi + multi-galeri:** `multiple` di «Dari galeri» **tetap ada**. File pertama → `fotoSlot[slot]` kartu yang diklik. Sisa file → **antrian** (`antrianFoto`); siswa memasang manual lewat «Pasang foto dari antrian» pada kartu kosong. **Jangan** mengisi slot lain otomatis (nyebrang). Tombol global «Pilih beberapa foto sekaligus» tidak dipakai.


3. **Video:** tetap satu file per slot (`accept="video/*"` tanpa `multiple`); maks. 2 video/tugas (§Tugas.Video).
4. Uji: (a) mode bebas pilih 4 foto sekali → 4 thumbnail; (b) bukti 3 foto kosong, pilih 3 sekaligus → ketiga slot terisi; (c) pilih 5 saat hanya 2 slot kosong → 2 terisi + pesan sisa.
5. **Android:** jangan mengandalkan satu tombol dengan `accept="image/*"` saja — di banyak HP muncul dialog sistem «Select an image» (Camera | Browse) dengan thumbnail kosong bila izin media belum diberikan. Sediakan **dua input**: galeri (tanpa `capture`, `multiple`, MIME eksplisit + HEIC) dan kamera (`capture="environment"`). Jangan pasang `capture` pada input galeri (memaksa kamera).
6. Jelaskan ke siswa: Settings → Apps → Browser → Permissions → Photos/Media → Allow; atau ketuk **Browse** di dialog sistem.
7. **Pratinjau lengkap:** setelah multi-pilih, UI WAJIB menampilkan SEMUA foto yang akan dikirim (panel «Pratinjau · N foto siap dikirim»), bukan hanya kartu bukti pertama. Multi-isi slot memakai satu `setFotoSlot` (bukan loop setState per file) agar React merender semua thumbnail.


## §Kuis.CetakNomor — Nomor soal PDF/Word berurutan (2026-11-24)

1. **Nomor di lembar cetak = urutan setelah pengelompokan bentuk**, bukan indeks mentah array `kuis.soal` sebelum partisi. Alur: partisi objektif → isian → uraian (stable, relatif = daftar soal) → `no = 1…n`.
2. **Jangan** `push({ no: no++, s })` di dalam loop partisi campuran: nomor akan loncat saat bagian dicetak terpisah.
3. **Kunci jawaban** wajib memakai nomor yang sama (`dataKunci` lewat `susunBagian`), jangan `soal.map((_, i) => i + 1)`.
4. Uji: kuis dengan PG, uraian, PG, isian → PDF menampilkan objektif 1…k, isian k+1…, uraian …n tanpa loncat; kunci cocok dengan nomor di lembar soal.



## §Kuis.ModalTambahSoal — Lightbox tambah soal dari bank (2026-11-24)

1. **Jangan mengunci lebar modal pemilihan soal di ~46–56rem.** Dual-pane (daftar + pratinjau lengkap) butuh hampir full viewport: kelas `soal-modal-kotak--lebar` (`width: min(96rem, 100vw − …)`, `height: calc(100vh − …)`).
2. **Badan modal harus flex + `min-height: 0`** agar `.pilih-soal-layout` mengisi sisa tinggi; jangan hanya `overflow-y: auto` pada badan tanpa memberi tinggi pada picker (daftar akan pendek meski layar besar).
3. **Import `styles/soal.css` dari `KuisDetail`** (atau entry yang selalu memuat panel kuis). Mengandalkan import hanya di `BankSoalPanel` membuat modal tanpa gaya jika guru belum membuka Bank soal di sesi yang sama.
4. HP (`max-width: 900px`): stack satu kolom; daftar/pratinjau boleh `max-height` viewport-fraksi, bukan memaksa tinggi full-screen yang memotong footer aksi.

## §Kuis.MultiTp — Multi-TP & jenis penilaian (2026-11-24)

1. **`tpIds` = ID kanonis dari paket (`paket.tpId`), `tpNamaList` = label tampilan.** Jangan pernah menulis nama ke `tpIds` saat simpan dari Atur kuis. Regresi lama: `daftarTp = tpList` (nama) ditulis ke keduanya → sinkron rapor/STS multi-TP rusak dan UI TP “runtuh”.
2. **State UI harus paralel:** hapus satu baris TP menghapus index yang sama di `tpIds` dan `tpNamaList`. «Perbarui dari paket» membangun ulang Map `tpId → label` dari **semua** `sumberPaketIds` (boleh banyak TP).
3. **Ubah jenis penilaian (latihan↔SLM/STS/SAS) tidak boleh menyentuh array `soal`.** Simpan wajib mengirim snapshot soal utuh; jika state lokal soal kosong padahal dokumen punya soal, **batalkan simpan** (pengaman anti-wipe).
4. **SLM “biasanya 1 TP” adalah panduan pedagogis, bukan batasan teknis.** STS/SAS dan kuis multi-paket boleh banyak TP; jangan hard-code `tpIds.length === 1` saat jenis = slm.
5. **`daftarKuis` query `kelasList` array-contains** boleh gagal permission bila ada dokumen berbagi dengan `kelasList` yang gagal evaluasi rules (list >6 / struktur aneh). Query kelas utama tetap dijalankan; jangan biarkan error itu menggagalkan seluruh daftar. Lihat juga §128.

## §Materi.HtmlBlok — blok teks halaman: elemen lanjutan, kunci jawaban lipat, gambar base64 (2026-11-19)

1. **Kunci jawaban lipat = `<details><summary>…</summary>…</details>`** di blok teks materi halaman. Daftar tag ada di `TAG_MATERI` (`lib/html.ts`) dan dipakai SEMUA jalur: impor JSON, simpan (`normalisasiHalaman`), editor (mode HTML + pratinjau), pembaca. Jangan menghapus `details`/`summary` dari daftar itu: akibatnya jawaban tampil terbuka permanen tanpa tombol (kasus «Mengenal Nilai, Norma, dan Aturan»).
2. **Atribut `open` SENGAJA tidak diizinkan** (`ALLOWED_ATTR` tidak memuatnya) agar kunci jawaban selalu tertutup saat siswa membuka halaman. Jangan menambahkannya tanpa keputusan guru. Tetap tanpa `style`/`class`/`on*`/`script` (§9, §115.2); materi yang butuh JS/CSS memakai jenis «html» (§MateriHtml.Iframe), bukan blok teks halaman.
3. **Editor visual (Tiptap StarterKit) tidak mengenal** `details`, `table`, `blockquote`, `hr`, `pre`, `dl`, `h4`, `mark`. Blok yang memuatnya WAJIB disunting di mode «HTML / tabel»: mode awal otomatis (`materiPunyaStrukturLanjut`, dipakai di inisialisasi `modeHtmlBlok` dan saat isi AI) dan tombol «Visual» dinonaktifkan. Jangan mengganti kembali ke `materiPunyaTabel` saja. Bila menambah tag baru ke `TAG_MATERI` yang tidak dikenal Tiptap, tambahkan juga ke regex `materiPunyaStrukturLanjut`.
4. **Gambar base64 (`data:image/…`) tidak boleh tersimpan di dokumen Firestore** (batas 1 MiB per dokumen; satu gambar PNG bisa ±1,9 MB). Alurnya: parser menerima data URI (`adalahDataUriGambar`, maks. ±6 MB teks) → `onFileImporHalaman` mengunggah ke Storage lewat `unggahDataUrlHalaman` (kompres otomatis) → blok menyimpan `url` https + `storagePath`. `normalisasiHalaman` menolak url `data:` sebagai pengaman terakhir. Jangan melonggarkan pengaman itu, dan jangan menghapus langkah unggah di impor.
5. **Blok yang dilewati saat impor harus terlihat.** `onFileImporHalaman` menaruh galat blok (`Dilewati — …`) di depan daftar peringatan dan menampilkan hingga 4 pesan. Jangan kembali ke `slice(0, 2)` dengan galat di belakang: impor tampak sukses padahal blok gambar hilang.
6. **Uji sebelum deploy:** (a) impor `01-mengenal-nilai-norma-dan-aturan.json` → 6 blok, gambar terunggah (url https), kunci jawaban tertutup dan bisa dibuka-tutup di Pratinjau dan di pembaca siswa; (b) blok latihan terbuka di mode HTML, tombol Visual nonaktif; (c) simpan lalu buka ulang: kunci jawaban dan gambar tetap ada; (d) data URI rusak → pesan «Dilewati» tampil; (e) HP lebar 360 px: ringkasan «Lihat kunci jawaban» mudah diketuk dan tidak meluber; (f) `<script>`, `onclick`, `style`, `class`, `open` pada blok teks tetap dibuang.

## §Materi.TempelGambar.Tombol — Unggah file dan Tempel gambar harus tombol terpisah (2026-11-19)

Melengkapi §Materi.TempelGambar (poin 4 di sana digantikan oleh poin 2 di bawah).

1. **Jangan menggabungkan «unggah file» dan «tempel» dalam satu tombol/label.** Keduanya mekanisme berbeda: dialog pilih file vs pembacaan clipboard. Label «Unggah / tempel» membuat guru mengira tombol itu menempel, padahal hanya membuka dialog file.
2. **Dua target berbeda, dua state berbeda.** `unggahUntukBlok` = target dialog file («Unggah file»/«Ganti file»). `blokSiapTempel` = target Ctrl+V yang sengaja diset tombol «Tempel». Listener `paste` memakai `blokSiapTempel`, bukan `unggahUntukBlok`. Urutan target tempel: `blokSiapTempel` → blok gambar `url` kosong pertama → blok baru (cek `BATAS_BLOK_PER_HALAMAN`).
3. **Dialog file dibatalkan harus melepas target.** Event `cancel` pada input file mengosongkan `unggahUntukBlok` (efek bergantung `mode` karena input ikut unmount saat pratinjau). Tanpa ini target tertinggal dan aksi berikutnya salah sasaran.
4. **Tombol «Tempel» memakai `ambilGambarDariClipboardApi` (`src/lib/gambar.ts`)**, bukan menulis ulang pembaca clipboard. Bila helper melempar galat (tidak didukung / izin ditolak) → fallback menandai blok `blokSiapTempel` dengan petunjuk Ctrl+V terlihat (bukan hanya pesan di bilah atas). Bila helper mengembalikan `null` → galat «Clipboard tidak berisi gambar», jangan jatuh ke mode siap-tempel.
5. **Unggah tetap lewat `unggahGambarHalaman`** (kompres + Storage); jangan simpan data-URL mentah.
6. **Siap-tempel harus terlihat dan bisa dibatalkan** (bingkai hijau + tombol Batal), dan dilepas setelah tempel selesai (`finally` listener paste) maupun saat «Unggah file» ditekan.

## §Import.Tka2026 — Import ekspor bank soal website lama (2026-11-19)

1. **Jangan menolak `pgk-cat`.** Tipe ini di tka2026 = BS kategori 2 kolom. Map ke `bs` lewat `rows`/`cols`/`kunciJawaban`. Soal dengan `cols.length !== 2` boleh ditolak + dilaporkan; yang 2 kolom wajib masuk.
2. **Kunci tka2026 adalah teks opsi, bukan huruf A/B/C.** `cariOpsi` harus mencocokkan teks persis sebelum fallback huruf. Memakai hanya `raw.kunci` (tanpa `kunciJawaban`) membuat semua soal PG/PGK gagal import.
3. **Satu file = banyak materi.** Ekspor BI/MTK berisi 3 `tipeMateri`. Jangan memaksa `tipeMateri` tunggal di metadata root untuk format tka2026; pecah paket per materi di UI (`hasil.multiMateri`).
4. **Gambar bacaan di `stimulusImage` (base64).** Jangan membuang field ini saat parse; unggah ke `lms_gambar` di alur import (`prosesGambarStimulusImport`) lalu set `gambarId`. Batas karakter dokumen gambar tetap 300.000 (kompres lewat `unggahGambar`).
5. **Kompleksitas berlabel.** `L1-Pemahaman` dll. harus dinormalisasi ke `L1`/`L2`/`L3` (`normalisasiKompleksitasImport`); membiarkan string penuh membuat filter analisis TKA kosong.
6. **Mapel dari subjectId.** `bahasa-indonesia` → `TKA Bahasa Indonesia`, `matematika` → `TKA Matematika`. Validasi mapel memakai nama kanonis ruang TKA, bukan slug.
7. **Jangan menandai duplikat agresif pada file tka2026 besar.** Soal lintas materi bisa berbagi stem mirip; cek duplikat ketat hanya untuk template LMS biasa.
8. **Form import TKA: materi tidak wajib.** Tombol «Impor & buka editor» hanya boleh bergantung pada judul + file. Memaksa `materiIdImport` (disabled/required) mengunci import file multi-materi. Paket kosong baru (+ Paket soal baru) tetap wajib materi.


## §Soal.Ganda — Deteksi & penghapusan soal ganda (2026-11-19)

1. **Duplikat ditentukan menurut ISI, bukan ID.** Soal hasil salin/gabung/snapshot kuis selalu berID baru (`salinSoal`, `snapshotSoal`), jadi membandingkan `id`/`sumberSoalId` tidak pernah menemukan soal yang sama dari paket berbeda. Gunakan `cariSoalGanda` / `sidikJariSoal` (`src/lib/soalGanda.ts`); jangan membuat pembanding sendiri di komponen.
2. **Normalisasi harus tetap longgar terhadap format, ketat terhadap makna:** HTML, kapital, tanda baca teks, spasi, dan urutan pilihan diabaikan; simbol rumus (`+ - * / = < > % ^ × ÷ $`) dan angka desimal (`0,5`) DIPERTAHANKAN. Jika simbol/angka dibuang, «2+3» dan «2−3» dianggap sama dan soal berbeda terhapus.
3. **Bacaan (stimulus) ikut dibandingkan.** Pertanyaan yang sama («Ide pokok paragraf ini adalah…») dengan bacaan berbeda adalah soal berbeda. `gambarId` yang berbeda juga berarti berbeda (ID gambar yang sama = gambar yang sama).
4. **«Mirip» wajib angka identik** (multiset angka pada bacaan+pertanyaan+pilihan sama) dan bentuk soal sama; default OFF dan harus dipilih guru. Kunci jawaban tidak ikut menentukan kesamaan, tetapi kelompok dengan kunci berbeda ditandai `kunciBeda` dan UI/peringatan harus menampilkannya.
5. **Penghapusan tidak otomatis pada kuis/paket yang sedang diedit:** `SoalGandaDialog` hanya mengembalikan daftar baru ke pemanggil. Editor paket menyimpan lewat `setSoal` (autosimpan); `KuisDetail` hanya mengubah state — tetap harus klik Simpan. Jangan menulis ke Firestore dari dialog.
6. **Gabungkan paket:** mode `lewati` (pertahankan versi pertama) dan `timpa` (versi terakhir menggantikan versi lama di POSISI anggota pertama kelompok — `hapusSoalGanda(..., { kebijakan: 'terakhir', posisi: 'pertama' })`). Materi TKA dihitung dari soal yang BERTAHAN (bukan dari semua soal sumber), kalau tidak `tipeMateri` paket menjadi kosong padahal soal tersisa satu materi.
7. **Susun otomatis** (`susunOtomatis`) menandai isi yang sudah terambil (`isiTerpakai`) sebelum memilih soal berikutnya; pemeriksaan harus dilakukan SETELAH predikat filter tipe/kompleksitas lolos agar soal yang tidak cocok filter tidak «membakar» kuota isinya. `susunManual` sengaja tidak membuang soal (pilihan eksplisit guru) — wizard hanya memperingatkan.
8. **Dialog dirender lewat portal ke `document.body`** (z-index 1200) dengan kelas `.sg-*` pada `src/styles/soal-ganda.css` yang diimpor oleh dialognya sendiri. Jangan memindahkan CSS ke berkas yang hanya dimuat satu halaman: editor paket dan detail kuis berada di rute berbeda dari panel bank.
9. Kecepatan: perbandingan «mirip» O(n²) hanya untuk pasangan se-bentuk + angka sama dengan n ≤ 300 soal per paket — aman. Jangan dipakai pada gabungan lintas ratusan paket tanpa memangkas kandidat.

10. **Cek ganda dari daftar paket (BankSoalPanel):** dialog menerima gabungan soal dari satu paket (kartu) atau semua paket ruang (toolbar). Soal yang dipertahankan dipetakan kembali ke paket asalnya lewat IDENTITAS objek (`Set<Soal>`), bukan lewat `id` soal; jangan diganti dengan pencocokan `id` karena soal hasil salin lama dapat berbagi `id` antar paket. Hanya paket yang jumlah soalnya berubah yang disimpan (`simpanPaket`), lalu `muat()` dipanggil ulang — juga saat sebagian penyimpanan gagal, supaya daftar tidak menampilkan data basi.

## §Bank.Gabung — Gabungkan paket & export paket (2026-11-19)

1. **Paket sumber tidak boleh diubah.** Gabungkan selalu membuat paket BARU (`buatPaket` + `simpanPaket`) berstatus `draf`. Jangan menambah opsi yang menghapus/menimpa sumber tanpa konfirmasi tegas.
2. **Salin soal hanya lewat `salinSoal`** (klon JSON + ID baru; kunci dipetakan ulang). Jangan menyusun ulang soal bidang demi bidang: `stimulus`, `rumus`, `labelBenar/labelSalah`, `gambarId`, `pembahasan` akan hilang (selaras §84.1). ID soal/opsi yang sama di dua paket menyebabkan jawaban dan kunci bertabrakan.
3. **`gambarId` aman dibawa** antar paket karena dokumen `lms_gambar` tidak dihapus saat paket dihapus. Export JSON TIDAK membawa gambar; UI wajib menyebut hal itu.
4. **Batas:** hasil gabungan ≤ `BATAS_SOAL_PER_PAKET` (300, sama dengan rules `soal.size() <= 300`, lihat §0) dan ≤ `BATAS_UKURAN_PAKET`. Pemblokiran dilakukan di klien (`gabungkanPaket().galat`) agar bukan «permission denied» yang membingungkan.
5. **Lintas mapel TKA:** paket gabungan disimpan pada mapel ruang tempat tombol ditekan (kelas bank `6`). Kuis & rekap TKA dipisah per mapel (§120, Rekap per mapel), jadi soal Matematika yang digabung ke paket Bahasa Indonesia akan dinilai sebagai bagian kuis Bahasa Indonesia. Materi per soal dipertahankan (`tipeMateri` diwariskan dari paket bila soal belum punya); `tipeMateri` paket hanya diisi bila seragam. Jangan memaksa satu materi bila campuran (editor mengunci materi soal mengikuti paket).
6. **Sumber lintas mapel dibaca lewat `daftarPaket(KELAS_TKA_BANK, mapel)`** (menggabung kelas 6/6A/6B, §121). Jangan query `lms_paket_soal` langsung dengan `kelas == '6'`. Pada modul Lomba opsi lintas mapel dimatikan (query harus tetap `lombaId` saja, §Lomba.31).
7. **Jika `simpanPaket` gagal setelah `buatPaket`**, paket kosong dihapus kembali (best effort) agar tidak meninggalkan paket «soal kosong».
8. **Format export = format import**, tetapi import bank soal TKA hanya menerima satu materi per file (`validasiMetadataTka`) dan tidak membaca `labelBenar/labelSalah`/`rumus`/gambar. Untuk menyatukan paket multi-materi atau bergambar gunakan Gabungkan paket, bukan export-lalu-import.

## §Lomba.32 — Otorisasi pengampu di Cloud Function kuis Lomba (2026-11-19)

1. Hak guru atas kuis Lomba **hanya** ditentukan keanggotaan pengampu lomba (`guruPengampuUids` atau `guruPengampuUid` legacy) atau admin LMS — **bukan** `dibuatOleh` dan **bukan** `penugasanKelasMapel`. Pengampu lomba bisa >1 orang; kuis buatan pengampu lain atau admin harus tetap dapat diakses.
2. Setiap CF yang mengotorisasi guru terhadap `lms_kuis` / `lms_jawaban` WAJIB punya cabang Lomba (kuis `kelas == 'LB'` + `lombaId`): `resetJawabanKuisLms`, `simpanJawabanOfflineKuis`, **`nilaiManualKuisLms`**. Cabang Lomba ditentukan dari **dokumen kuis**, bukan dari `jawaban.kelas`/`jawaban.mapel`.
3. `jawaban.kelas` pada Lomba = rombel nyata siswa dan `jawaban.mapel` bisa «Gabungan». Jangan mengandalkan `bolehMapelKelas(profil, jawaban.mapel, jawaban.kelas)` untuk Lomba.
4. Kuis non-Lomba tetap memakai `bolehMapelKelas`; urutan galat (izin → «Kuis tidak ditemukan») jangan diubah.
5. Admin Lomba CF = `profil.role === 'admin'` atau email `arif.nitoe@gmail.com`; akun `aktif === false` ditolak (selaras `akunAktif()` rules).
6. `sinkronNilaiKuisLms` (sinkron ke rapor Penilaian) sengaja **tidak** diberi cabang Lomba: nilai Lomba tidak masuk rapor.
7. Rules `lms_kuis` / `lms_paket_soal`: cabang Lomba harus **di depan** `lmsLihatMapelKelas` dan berpagar `resource.data.kelas == 'LB'` (§Lomba.31); query klien `daftarKuisLomba` / `daftarPaketLomba` memakai `where lombaId` + `where kelas == 'LB'` (melengkapi butir 1 §Lomba.31). Jangan memindahkan cabang `lombaId` di `lms_jawaban` ke depan tanpa uji emulator — risiko menolak query Hasil mapel biasa.
8. Rules hidup di **SDM01Penilaian** (`npm run deploy:rules`); salinan di repo LMS hanya referensi. Perbaikan rules/CF tidak aktif sebelum di-deploy dari sana.


## §Offline.UX.Suara — Dikte isian/uraian offline (2026-11-19)

1. Soal isian/uraian di Input offline boleh memakai Web Speech API (`id-ID`) sebagai **bantuan** ketik, bukan pengganti koreksi guru.
2. Hasil dikte **append** ke teks yang ada; guru tetap bisa mengedit.
3. Bilah aksi bawah: **jangan** `mx-auto` yang memusatkan tombol saat zoom berubah — pakai rata kiri (`justify-start`).


## §Offline.UX.Sentuh — Target sentuh input offline (2026-11-19)

1. Kontrol jawaban offline (BS, PG, PGK, jodoh) **wajib** mudah disentuh: tinggi minimum ≈ 44px (`min-h-11`), bukan radio/checkbox native kecil saja.
2. Benar/Salah: tombol segmen **B** / **S** (bukan pasangan radio `text-xs`); status terpilih jelas (warna).
3. Jangan mengembalikan radio B/S ukuran default browser di form offline.

## §0. PRIORITAS — Batas klien vs rules (permission denied berulang)

**Ini sudah berulang.** Gejala: simpan/import paket soal (atau write lain) gagal dengan `Missing or insufficient permissions` padahal user berhak menulis kelas×mapel.

### Akar yang sering terlupa
1. **Rules `soal.size() <= N` tidak ikut dinaikkan** saat `BATAS_SOAL_PER_PAKET` di klien dinaikkan.  
   - Klien: `src/types/soal.ts` → `BATAS_SOAL_PER_PAKET = 300`  
   - Rules (lama): `lms_paket_soal` create/update → `request.resource.data.soal.size() <= 100`  
   - Akibat: paket >100 soal selalu ditolak rules → permission denied (bukan error validasi klien).
2. **Rules belum di-deploy** setelah diubah di repo (`npm run deploy:rules` dari SDM01Penilaian). UI Hosting baru ≠ rules baru.
3. **firestore.indexes.json parsial** (lihat §128.7) — deploy index minimal menawarkan hapus index production.

### Wajib sebelum merge/deploy fitur yang menyentuh jumlah soal / ukuran array
- [ ] `BATAS_*` di `src/types/*` **sama** dengan `*.size() <= N` di `firestore.rules` untuk field yang sama.
- [ ] Setelah ubah rules: salin **file utuh** ke SDM01Penilaian → `npm run deploy:rules`.
- [ ] Uji simpan paket dengan jumlah soal **di atas** batas lama (mis. 101, 150) dengan akun guru biasa (bukan hanya admin).
- [ ] Jangan menaikkan hanya klien. Jangan menaikkan hanya rules tanpa update konstanta klien (pesan error UI akan salah).

### Batas resmi saat ini (sinkronkan bila diubah lagi)
| Field / koleksi | Klien | Rules |
|-----------------|-------|-------|
| `lms_paket_soal.soal` | `BATAS_SOAL_PER_PAKET = 300` | `soal.size() <= 300` |
| `lms_kuis.jumlahSoal` | `BATAS_SOAL_PER_KUIS = 100` | `jumlahSoal <= 200` (rules lebih longgar) |
| Ukuran dokumen paket | `BATAS_UKURAN_PAKET = 900_000` (peringatan klien) | Batas Firestore 1 MiB (bukan permission) |

Bila error tetap permission setelah rules 300 ter-deploy: cek penugasan `penugasanKelasMapel` / `lmsTulisMapelKelas`, bukan jumlah soal.

---


## §TKA.ImportTahap2 — Import Try Out II (MTK & BI eksternal) (2026-11-19)

1. **Poin maksimum dibawa per baris.** Data Try Out II membawa `sbMtk.maksK/maksM` dan `sbBi.maks`. Konstanta `MAKS_MTK_*` / `MAKS_BI_*` di `tryoutTahap1.ts` hanya bawaan Try Out I — **jangan diubah** (merusak data tahap I) dan jangan mengimpor data tahap lain tanpa maks sendiri.
2. `sbMtk.k` = 2 angka (Try Out I) atau 3 angka (L3). `maksK` wajib sama panjang dengan `k`.
3. `periksaSebaranImport` wajib dipanggil sebelum pratinjau/simpan (data bawaan **dan** JSON kustom). Jangan dihapus: jumlah poin kompetensi dasar harus = kompetensi materi, dan poin ≤ maks.
4. **Data bawaan terkunci ke tahapnya** (`sumberAktif.tahap` di `TkaImportRekap`). Jangan hapus penjaga ini — Try Out II tertulis ke tahap I = laporan salah ke orang tua.
5. Nilai mapel = `round(poin ÷ maks × 100)` (`nilaiDariSebaran`); penyebut tetap seluruh soal (50). Soal dilewati = 0 poin (selaras §109.2).
6. Skor parsial sumber dibulatkan 2 desimal (0,67 / 1,33 / 0,63 / 0,42). Kembalikan ke pecahan eksak (1/3, 1/2, 2/3 × bobot) **sebelum** dijumlah; jangan menjumlah angka bulat sumber langsung (galat menumpuk).
7. Kompetensi materi Matematika Try Out II adalah **klasifikasi isi soal** dari PDF soal paket 6A-I, bukan kisi-kisi resmi penyelenggara. Bila kisi-kisi resmi didapat, ganti isi `m` — jangan menyunting `k`. Level Kognitif penyelenggara dipakai untuk L1–L3 (1–3/4–6/7–9); **jangan memakai tagar LOTS/HOTS** (tidak konsisten antar paket: soal 4 dan 23).
8. Bahasa Indonesia: tipe materi = L1/L2/L3 tetapi tetap **dua daftar terpisah** (§123). Jangan menggabung atau memasangkan.
9. Siswa tidak hadir / susulan tanpa rincian per soal (mis. Dzaky Abdul Rauf, nilai gabungan 35) **tidak diimpor**. Jangan memecah nilai gabungan menjadi MTK/BI dengan perkiraan; impor setelah ada Excel per soal.
10. Kode Soal berbeda antar paket tidak otomatis berarti isi soal berbeda; yang menentukan adalah bukti (level, bobot, tingkat keberhasilan) atau PDF paket tersebut. Asumsi paket B = salinan paket A dikonfirmasi guru.
11. Grid input manual Matematika masih L1–L2 (`kelompokInputSebaran`); mengubah nilai manual membuang `sebaran` (§109.3). Jangan menambah L3 ke grid tanpa menyesuaikan data Try Out I (yang tidak punya L3).


## §Admin.Dashboard — Panel kurikulum di Beranda (2026-11-19)

1. **Deteksi admin:** WAJIB `adalahAdminLms(user, profil)` (bukan hanya `role === 'admin'`). Fungsi itu mencakup role/peranLms admin **dan** email admin LMS (`arif.nitoe@gmail.com`). Tanpa email, panel bisa tidak pernah tampil.
2. Panel hanya di-render bila `aktif` true. Guru biasa tidak memuat query agregat.
3. Query full-collection `lms_materi` / `lms_kuis` / `lms_tugas` / `users` / `siswa` **hanya aman untuk admin** (rules `isAdmin()` pada read). Jangan panggil `muatAdminDashboard` dari peran guru. Catatan: email-admin tanpa `role: admin` di Firestore rules tetap **bukan** isAdmin() — agregat bisa gagal permission; pastikan dokumen `users` role = admin untuk akun kurikulum.
4. Konten Lomba (`lombaId` terisi) **dikecualikan** dari statistik materi & kuis.
5. Aktivitas hari ini: `createdAt >= awal hari` + limit 500; gagal → angka 0, panel tetap tampil.
6. CSS prefix `.ad-*` di `ruang.css`.

## §Lomba.30 — Cetak rekapitulasi hasil lomba (2026-11-19)

1. `window.open('about:blank')` **sinkron** di awal handler klik (sebelum `await`), sama pola kartu peserta (§Lomba.29) dan cetak kuis PDF. Setelah HTML siap, `document.write`; bila gagal, tutup jendela.
2. Data baris = roster `lms_lomba.siswaList` + jawaban terbaru per `siswaId` dari `daftarJawabanKuisLomba` (sudah di panel Hasil). Jangan query ulang di lib cetak bila data sudah di UI.
3. Peringkat **kompetisi** (1, 2, 2, 4): bandingkan `nilai100` lalu skor mentah; yang belum mengerjakan tidak mendapat nomor peringkat.
4. Kolom mapel sumber hanya jika ≥2 `sumberMapel` pada soal kuis (Gabungan). Satu mapel → kolom itu disembunyikan agar tabel tidak berlebih.
5. Nilai = `skorOtomatis / totalPoin × 100` (`skorKe100`). Soal uraian belum dinilai manual tetap memakai skor otomatis yang tersimpan.
6. Publikasi hasil Lomba memakai field `hasilDipublish` di `lms_kuis` (sama TKA). `togglePublishHasil` harus mengizinkan `isLomba`, bukan hanya `isTka`.
7. Tidak menulis koleksi baru; cetak murni klien.


## §Lomba.31 — Daftar kuis/paket lomba: query hanya lombaId (2026-11-19)

1. **Jangan** query `lms_kuis` / `lms_paket_soal` dengan `where lombaId` **+** `where mapel` untuk UI pengampu. Gunakan `where lombaId == …` saja, saring mapel di klien. Alasan sama §Lomba.13 (paket semua mapel).
2. `daftarKuisLomba(lombaId, mapel)` dan `daftarPaketLomba(lombaId, mapel)` mengikuti pola itu. `daftarKuisLombaAktif` / `daftarPaketLombaSemua` sudah query tanpa mapel.
3. Hasil harus mencakup kuis/paket yang `dibuatOleh` admin atau pengampu lain — akses ditentukan `lombaKontenBoleh` (anggota `guruPengampuUids`), bukan `dibuatOleh`.
4. Hitung jawaban sebelum hapus kuis Lomba: `daftarJawabanKuisLomba(kuisId, lombaId)`, **bukan** `daftarJawabanKuis(…, kelas=LB, mapel)` (§Lomba.26).
5. Rules `lombaKontenBoleh` tetap wajib di-deploy; perbaikan ini hanya bentuk query klien.


## §Materi.TempelGambar — Paste clipboard ke blok gambar (2026-11-18)

1. Listener `paste` hanya aktif di mode **edit** editor halaman (`MateriHalamanEditor`).
2. Hanya menangani item/file `image/*`. Clipboard teks murni dibiarkan ke input/textarea.
3. Unggah **wajib** lewat `unggahGambarHalaman` (kompres + Storage) — jangan simpan data-URL mentah di dokumen materi.
4. Target blok: `unggahUntukBlok` (tombol Ganti) → blok gambar `url` kosong → blok baru (cek `BATAS_BLOK_PER_HALAMAN`).
5. Jangan `preventDefault` jika tidak ada gambar di clipboard.


## §Materi.MultiTp — Satu materi boleh lebih dari satu TP (2026-11-18)

**Jangan kembalikan ke single-select TP.** Materi tema/bab sering mencakup beberapa Tujuan Pembelajaran.

1. Field dokumen: `tpIds: string[]` (semua TP) + `tpId`/`tpNomor`/`tpNama` (utama = urut nomor terkecil).
2. UI form materi & editor halaman: multi-select (toggle). Validasi: minimal 1 TP kecuali Lomba/TKA (`tanpaTpWajib`).
3. Simpan lewat `normalisasiTpFields` di `lib/materi.ts` — jangan tulis hanya `tpId` tanpa `tpIds`.
4. Dokumen lama tanpa `tpIds` tetap dibaca sebagai `[tpId]`.
5. Batas: `BATAS_TP_PER_MATERI = 12` di `types/materi.ts`.
6. Grouping daftar tetap by `tpId` utama; label boleh menampilkan «(+N TP lain)».



## §Hasil.RosterMapel — Tabel hasil mapel menampilkan seluruh siswa (2026-11-19)

1. Hasil kuis **mapel biasa** (bukan hanya TKA/Lomba) wajib menampilkan roster siswa aktif kelas (`muatSiswaKelas`) + `kelasList` bila berbagi paralel.
2. Siswa tanpa `lms_jawaban` tetap tampil dengan status «Belum mengerjakan» (mode online) atau «Belum diinput» (mode offline).
3. Ringkasan angka: **mengerjakan / total roster**, bukan hanya jumlah dokumen jawaban.
4. Jangan kembali ke tabel yang hanya `tampil.map` dari jawaban saja — guru tidak bisa melihat siapa yang belum menunaikan kewajiban.


## §128. Query kelasList array-contains (berbagi paralel) — permission list

128.1 Query sekunder `where('kelasList','array-contains', kelas)` di `daftarTugas`, `daftarKuis`, `daftarMateri` **wajib** didukung rules **dan** menyertakan constraint `mapel`.

128.2 **Wajib di klien:** `where('mapel','==', mapel)` + `where('kelasList','array-contains', kelas)`. Tanpa mapel di query, list evaluation menolak (dokumen hipotetis mapel lain). Jangan mengandalkan filter mapel hanya di klien setelah getDocs.

128.3 Helper rules `lmsLihatViaKelasList(mapel, list)`: OR `lmsLihatMapelKelas` untuk tiap elemen list (maks 6). Dipakai di `allow read` `lms_kuis` dan `lms_tugas` (cabang `isGuru() && 'kelasList' in resource.data && …`). Dengan mapel ter-constraint + user ampu kelas yang di-query, rule benar untuk semua dokumen match.

128.4 `lms_materi` sudah `allow read: if isGuru() || …` sehingga lebih longgar; tetap sertakan mapel di query kelasList agar siap jika rules diperketat.

128.5 Composite index: `mapel` ASC + `kelasList` CONTAINS untuk koleksi `lms_tugas`, `lms_kuis`, `lms_materi`. Tanpa index, error berubah dari permission menjadi «requires an index» (ikuti link di console Firebase).

128.6 Tulis/update `kelasList` tetap lewat `lmsKelasListBoleh` (semua kelas dalam list wajib `lmsTulisMapelKelas`) — jangan longgarkan write. Deploy rules **dan** index; push kode klien saja tidak cukup jika rules lama masih aktif di Firebase.

## §128.7 firestore.indexes.json — JANGAN file parsial

128.7 `firestore.indexes.json` adalah **sumber kebenaran penuh**. Deploy file yang hanya memuat index baru akan membuat CLI menawarkan **hapus** semua index yang tidak tercantum (nilai_*, perpus_*, tp_kktp, siswa, notifikasi, …). Selalu: ambil file lengkap dari SDM01Penilaian (atau `firebase firestore:indexes`), **tambah** index baru, baru deploy. Jangan pernah menimpa dengan daftar minimal.

## §127.33 Judul dokumen & semester export kuis (2026-11-15)

127.33 Judul kop dihitung di `judulUtama()` dari `kuis.jenisPenilaian` (latihan → «ASESMEN TERTULIS LATIHAN», slm, sts, sas). Jangan kembali ke «LEMBAR SOAL» / hardcode satu judul. Semester **jangan hardcode 'ganjil'**: pakai `opsi.semester ?? semesterOtomatis(kuis)` (waktuMulai kuis, fallback tanggal hari ini; Jul–Des ganjil, Jan–Jun genap). Tahun pelajaran masih default konstanta `2026/2027` (`metaDokumen`) — perbarui bila tahun ajaran berganti atau turunkan otomatis.

## §127.26–§127.32 Export PDF v4: paginasi sendiri (2026-11-15)

127.26 **Jalur PDF tidak boleh mengandalkan pemecah halaman browser** (`break-inside`, `break-after`, `column-count`, `column-span`, `@page @bottom-*`). Terbukti di Chromium: halaman 1 hanya kop (soal mulai hal. 2), opsi terpisah dari soal, meta tercecer. Pembagian halaman dihitung di `susunHalaman()` (ukur tinggi blok → tempatkan pada `.halaman` A4 tetap, posisi `absolute`). Jangan mengembalikan CSS kolom/pemecah halaman untuk jalur PDF.

127.27 **Satu soal = satu blok utuh** (`htmlSatuSoal`): nomor, teks, gambar, stimulus, opsi/tabel tidak dipisah. `potongan` hanya cadangan bila satu soal lebih tinggi dari satu halaman penuh. Judul bagian `jaga: true` (selalu bersama blok sesudahnya). Kop+identitas+judul+soal pertama harus di halaman 1 selama muat.

127.28 **Footer**: elemen `.footer-halaman` per halaman — `border-top` tipis (0.5pt), nomor halaman `.footer-no` di **kanan bawah**, keterangan kuis di kiri. Batas isi (`geometriCetak().bawah`) ≥ 3 mm di atas garis footer. Jangan memakai `@page { @bottom-center }` (tak bisa bergaris penuh & tak konsisten).

127.29 **Mode 2 kolom**: hanya `jenis === 'uraian'` yang `mode: 'penuh'` (1 kolom selebar halaman); semua bentuk lain `mode: 'kolom'`. Judul bagian di awal wilayah kolom selebar halaman (`penuhBilaAwal`). Kolom di halaman terakhir wilayah diseimbangkan (`seimbangkan`) tanpa mengubah urutan soal. Font ≥ 11pt (BS 11pt di `body.dua`).

127.30 Ukuran halaman `.halaman` = 210mm × **296.5mm** (bukan 297) + `@page { margin: 0 }` agar pembulatan tidak melahirkan halaman kosong. Posisi/lebar dalam px dari `geometriCetak()`; jangan memakai satuan relatif viewport.

127.31 Pengukuran harus menunggu gambar didekode (`tungguGambar`) dan font siap sebelum `print()`; gambar tetap JPEG (§127.17). Garis jawaban isian pakai `.garis-isi` ber-border (jangan deretan `_` — melebihi lebar kolom).

127.32 `window.open` dipanggil **sinkron di awal** `cetakKuisPdf` (dalam klik pengguna), baru diisi setelah proses async; bila gagal, jendela ditutup dan error dilempar (UI menampilkan `alert`). Jalur Word memakai `STYLE_WORD` terpisah — mengubah CSS PDF tidak boleh mengubah Word dan sebaliknya.

## §127.23–§127.25 Export PDF v3: alur, uraian, footer halaman (2026-11-15)

> **DIGANTIKAN untuk jalur PDF oleh §127.26–§127.32** (paginasi dihitung sendiri; aturan CSS di bawah tetap berlaku hanya untuk jalur Word bila relevan).


127.23 Jangan membiarkan halaman 1 hanya berisi kop/identitas. Margin identitas & garis ganda diperketat; `max-height` ilustrasi dibatasi agar blok soal muat mulai di halaman pertama.

127.24 Bagian **uraian** tidak ikut `column-count: 2`. Selalu dibungkus `.isi-soal--penuh` (1 kolom) dengan minimal 8 baris garis jawaban.

127.25 Nomor halaman hanya di **bottom margin** via `@page { @bottom-center { content: counter(page) } }`. Margin bawah ≥ 1.6 cm. Jangan menaruh nomor halaman menempel konten soal.

## §127.20–§127.22 Export PDF: anti-potong, rata kiri, dua kolom (2026-11-15)

> **DIGANTIKAN untuk jalur PDF oleh §127.26–§127.32** (paginasi dihitung sendiri; aturan CSS di bawah tetap berlaku hanya untuk jalur Word bila relevan).


127.20 Setiap blok soal (`table.soal-wrap`) dan ilustrasi (`.soal-gambar` / `.opsi-gambar`) **wajib** `break-inside: avoid` + `page-break-inside: avoid` pada `@media print` agar narasi, opsi, dan gambar tidak terpotong pergantian halaman.

127.21 Ilustrasi soal **rata kiri** (`margin: … 0`, bukan `margin-inline: auto` / tengah), sejajar teks soal dan opsi.

127.22 Mode **dua kolom** (`opsi.duaKolom`): isi soal dalam `.isi-soal--dua` (`column-count: 2`), margin `@page` ≈ 1 cm, `font-size: 11pt` minimum. Jangan mengecilkan di bawah 11pt. Judul bagian memakai `column-span: all`. Word tetap satu kolom.

## §127.17–§127.19 Export: JPEG, anti-potong, PDF (2026-11-15)

127.17 Gambar soal **wajib** dikonversi ke JPEG (`keJpegDataUrl`) sebelum embed di HTML cetak. Jangan menyematkan data-URL WebP mentah — Word menampilkan ikon rusak (X).

127.18 Jangan memakai `page-break-inside: avoid` pada seluruh `table.soal-wrap` untuk soal panjang — Word memotong narasi/opsi. Pakai `auto` + orphans/widows pada teks.

127.19 Cetak PDF lewat `cetakKuisPdf` (window.print / Save as PDF) adalah jalur **utama** untuk hasil cetak andal. `unduhKuisCetak` (.doc) tetap ada sebagai cadangan. Popup diblokir → tampilkan pesan jelas.

## §127.14–§127.16 Export Word: identitas tunggal, spasi, gambar (2026-11-15)

127.14 Default cetak **identitas tunggal** (`htmlIdentitasSiswa`: Nama + No. Absen). Jangan mengembalikan tabel paraf 10 baris kosong sebagai default (`barisParaf` default **0**). Tabel paraf multi-siswa hanya jika pemanggil set `barisParaf > 0`.

127.15 Spasi antar soal: `table.soal-wrap { margin: 0 0 22pt }` (minimal). Jangan ≤ 12pt.

127.16 Ilustrasi soal **wajib** di-embed bila `gambarId` / `opsi.gambarId` / `kiriGambarId` ada: `unduhKuisCetak` dan `htmlKuisCetak` **async**, muat lewat `ambilGambar` (`lms_gambar`), sematkan `<img class="soal-gambar|opsi-gambar">`. Pemanggil UI: `void unduhKuisCetak(...)`. Gagal muat gambar tidak menggagalkan unduh seluruh dokumen.

## §127.10–§127.13 Export cetak: logo, spasi, unduh tunggal, pratinjau (2026-11-15)

127.10 Kop cetak memakai **logo SDM** (kiri) dan **logo Kota Depok** (kanan) sebagai `<img>` data-URI, bukan karakter bintang/placeholder. Jangan mengembalikan `&#9733;` di `.kop-logo`.

127.11 Huruf opsi A–D: `td.opsi-huruf { font-weight: normal }` — jangan tebal (hanya nomor soal yang tebal). Spasi antar soal: `table.soal-wrap { margin: 0 0 16pt }` (bukan ≤ 9pt).

127.12 Tombol unduh Word **hanya** di `KuisKepala` (prop `aksi`). Jangan mengembalikan pasangan «Unduh soal» / «Unduh + kunci» di bilah sticky tab Atur kuis (`KuisDetail`) — menyebabkan menu ganda.

127.13 Pratinjau isi kuis (termasuk ilustrasi `gambarId`) lewat tombol «Pratinjau» di kepala detail → modal `PratinjauSoal` dengan `soal` dari kuis. Jangan mengandalkan unduh Word untuk mengecek apakah soal punya gambar (gambar belum di-embed di .doc).

## §127.9 Tombol unduh di kepala kuis

Tombol unduh Word wajib di `KuisKepala` (prop `aksi`) agar mudah ditemukan dari semua tab. Sejak §127.12 tombol **tidak** lagi di bilah sticky tab Atur (`KuisDetail`) — hanya di kepala (satu tempat).

## §127.1 Optimasi cetak Word (2026-11-15)

127.6 Layout cetak memakai **tabel** (bukan flex/grid) agar stabil di Microsoft Word.
127.7 `@page { size: A4; margin: 1.5cm }`; soal `page-break-inside: avoid`; kunci `page-break-before: always`.
127.8 Opsi PG = tabel 2 kolom (huruf | teks). Uraian = baris border-bottom. Jangan kembalikan ke `<ol type="A">` yang sering rusak di Word.

## §127. Export kuis cetak (.doc)

127.1 Unduh lembar soal lewat `unduhKuisCetak` / `htmlKuisCetak` di `lib/exportKuisCetak.ts`. Format HTML + MIME `application/msword` (sama pola `unduhLaporanDoc`) — **jangan** menambah dependency `docx` tanpa keputusan eksplisit.

127.2 Tombol «Unduh soal» / «Unduh + kunci» di **kepala detail** (`KuisKepala` prop `aksi`). Jangan mengembalikan ke bilah sticky tab Atur (`KuisDetail`) — lihat §127.12. Jangan sembunyikan untuk kuis offline.

127.3 Pengelompokan cetak: objektif (pg/pgk/bs/jodoh) → isian → uraian, dengan nomor soal global berurutan. Instruksi bagian menyesuaikan template sumatif sekolah.

127.4 Teks soal lewat `teksPolos` (bukan HTML mentah). Gambar soal **belum** di-embed di v1.

127.5 Judul dokumen mengikuti `jenisPenilaian` (STS/SAS/SLM/Latihan), bukan hanya judul kuis.

## §126. Reset attempt kuis mapel (online) — CF & klien

126.1 Reset attempt **bukan** hanya TKA. UI di `HasilKuisPanel` (detail + daftar) menampilkan aksi reset untuk **semua** kuis; jangan mengembalikan guard `if (!isTka) return` pada `resetAttempt`.

126.2 Client memakai `resetJawabanKuis` (CF `resetJawabanKuisLms`). Alias `resetJawabanKuisTka` boleh tetap untuk kompatibilitas.

126.3 Marker draf perangkat tetap di koleksi **`lms_tka_progress_reset/{kuisId}_{siswaId}`** (nama historis). Klien **SiswaKuis** dan **SiswaTka** wajib cek marker sebelum memakai localStorage progress (`sinkronProgressSetelahReset`).

126.4 Mode: `attempt` | `progress` | `semua`. Default UI daftar = `semua` (Reset+). Detail menyediakan ketiga mode.

126.5 Setelah reset attempt, daftar hasil di-muat ulang; siswa boleh mengerjakan ulang (termasuk jenis SLM/STS/SAS yang sebelumnya terkunci setelah kirim).

126.6 **CF `resetJawabanKuisLms` wajib mendukung tiga jalur** (regresi 2026-11-19: guard «hanya TKA/Lomba/admin» menolak mapel biasa → HTTP 400):
  - **Mapel biasa:** `admin` **atau** `bolehMapelKelas(profil, mapel, kelas)` (penugasanKelasMapel / waliKelas). Cek terhadap `kuis.kelas`, `kuis.kelasList`, dan kelas dari dokumen `lms_jawaban` / argumen `kelasSiswa`.
  - **TKA** (mapel ∈ MAPEL_TKA): admin / email khusus / wali 6A·6B.
  - **Lomba** (`lombaId` + kelas `LB`): admin LMS atau pengampu (`guruPengampuUid` / `guruPengampuUids`).
  - Jangan mengembalikan guard yang membatasi CF hanya untuk TKA/Lomba.

126.7 **CF `simpanJawabanOfflineKuis`:** izin mapel biasa harus mempertimbangkan `kelasList` (bukan hanya `kuis.kelas`); Lomba izinkan pengampu. Loop penilaian wajib defensif (lewati soal tanpa `id`, tangkap exception) agar tidak 500.

## §125.4 Gambar HP-first: 1200px + ~180KB WebP

## §125. Viewer materi

125.5 Tabel lebar: `.mh-blok--teks { overflow-x: auto }`, tabel `width: max-content; min-width: 100%`.

## §123. Kompetensi dasar & materi: dua daftar terpisah

## §125. Viewer materi multi-halaman: CSS Grid responsif

125.1 `.mh-viewer` memakai **grid 3 kolom** `minmax(0,1fr) | minmax(0, min(100%, 72rem)) | minmax(0,1fr)` — anak langsung `grid-column: 2`. Jangan kembali ke `max-width: 42rem` + `margin: auto` saja (ruang kosong tidak merata / konten terasa sempit).

125.2 Teks: `max-width` berbasis **ch** (≈65–70ch) di `.mh-blok--teks`. Gambar full-width kartu halaman (`max-width: none` pada blok gambar).

125.3 Nav: grid 3 kolom (prev | dots | next), sticky, lebar 100% kolom konten.

## §124. Katalog Kuis & Tugas siswa: kelompok mapel + filter

124.1 Daftar kuis/tugas siswa **dikelompokkan per `mapel`**. Jangan kembali ke daftar datar tanpa section mapel jika jumlah item bisa banyak.

124.2 Filter status wajib:
- Kuis: Semua | Belum dikerjakan | Sudah dikerjakan | Draf tersimpan (draf = progress localStorage, belum ada `lms_jawaban`).
- Tugas: Semua | Belum dinilai | Sudah dinilai | Lewat tenggat. «Sudah dinilai» = ada `lms_nilai_tugas` milik siswa; pengumpulan file belum menjadi sumber status sampai `lms_pengumpulan` aktif.

124.3 Query tugas siswa: `kelas` + `aktif == true` saja (selaras rules `isSiswaLms`). Jangan compound index tambahan tanpa deploy.

124.4 Instruksi tugas (HTML) wajib lewat `bersihHtml` sebelum `dangerouslySetInnerHTML` (ANTIREGRESI §9).

124.5 Kuis TKA tetap di `/siswa/tka`, tidak dicampur katalog kuis biasa (ANTIREGRESI §77).

124.6 Katalog Kuis/Tugas memakai kelas `sw-kat-*` di `siswa.css` + `aksenMapel` untuk bilah/ikon. Jangan mengembalikan kartu generik `rounded-xl border` tanpa aksen mapel di daftar utama.



123.1 Kompetensi dasar (L1–L3) dan kompetensi materi (BI/MTK: tipe materi; IPA: domain) SELALU ditampilkan sebagai **dua daftar/tabel/kolom terpisah**. Pada Bahasa Indonesia nilainya kebetulan identik (L1=Tekstual, L2=Inferensial, L3=Evaluasi), tetapi JANGAN digabung, dipasangkan, atau dideduplikasi.

123.2 Aturan §109.5 («BI: satu tabel berpasangan», `pasangkanDimensiSama`) **dicabut** — penyebab data tampil ganda (pasangan + kompleksitas) di tab BI. `kolomDariAgregat` adalah satu-satunya sumber kolom (rekap, laporan hasil kuis, ekspor); jangan menambah logika penggabungan di UI.

123.3 Input manual BI tetap hanya meminta poin L1–L3; tipe materi diturunkan saat menyimpan (`bangunSebaranManual`), sehingga data tersimpan memuat kedua daftar.

## §122. Laporan hasil kuis TKA: kolom kompetensi

122.1 «Laporan hasil TKA» (HasilKuisPanel) harus menampilkan kompetensi dari **jawaban kuis itu** lewat `hitungSebaranDariJawaban` + `kolomDariAgregat` (berbobot poin). Jangan kembali ke kolom domain saja — domain hanya terisi untuk IPA, sehingga BI/MTK menjadi kosong.

122.2 Nilai Akhir mapel tanpa domain (BI, MTK) = `skorKe100(skorOtomatis, totalPoin)`, selaras Rekap TKA. IPA mempertahankan rata-rata domain (`nilaiAkhirTka`); jangan menyatukan tanpa keputusan eksplisit.

## §121. Paket soal TKA lintas kelas 6 / 6A / 6B

121.1 Paket hasil migrasi tka2026 bisa berkelas **6A/6B**, bukan hanya «6». Semua pembaca paket TKA (Bank Soal, wizard kuis, `buatKuisDariPaket`, «Tambah paket») HARUS lewat `daftarPaket()` yang menggabungkan 6, 6A, 6B untuk mapel TKA. Jangan query `lms_paket_soal` dengan `kelas == '6'` saja.

121.2 Query per kelas memakai `Promise.allSettled`; hanya bila SEMUA gagal, lempar error. Wizard menampilkan diagnosis (`ringkasanPaket`) bila tak ada paket Siap.

## §120. Kuis TKA terpisah per mapel & daftar kuis aktif

120.1 Mapel TKA berbagi kelas bank «6». Daftar kuis ruang TKA HARUS difilter `mapel` yang sama; jangan menggabung `daftarKuisDibuatOleh()` tanpa memeriksa mapel untuk mapel TKA.

120.2 Setiap query `lms_kuis` `where kelas + mapel` (rules); daftar kuis aktif di `/tka` = satu query per mapel. «Aktif» = `aktif === true` dan `waktuSelesai` kosong/di masa depan; waktu bisa string ISO atau Timestamp (`keTanggal`).

## §119. Ekspor TKA & konfirmasi hapus kuis

119.1 Ekspor XLSX tanpa dependensi (`exportTabel.ts`): header tebal, kolom nama dibekukan, angka tetap numerik, nama sheet ≤ 31 karakter. CSV: UTF-8 **BOM**, `;`, desimal `,`, sel berawalan `= + - @` diberi `'`.

119.2 Ekspor mengikuti filter tahap/kelas yang tampil; jangan mengekspor kelas di luar `kelasRekapTkaBolehDilihat`.

119.3 Hapus kuis HARUS lewat `KonfirmasiHapusDialog` (ketik **HAPUS**), bukan `confirm()` satu klik. `hapusKuis` hanya menghapus dokumen kuis; hasil `lms_jawaban` tertinggal (yatim).

## §118. Input sebaran manual

118.1 Sebaran manual disimpan sebagai **poin & maks** per kompetensi (bukan persen) lewat `bangunSebaranManual`; jumlah poin & maks kompetensi dasar WAJIB sama dengan kompetensi materi.

118.2 Grid hanya memuat siswa `sumber !== 'otomatis'`. Menyimpan lewat `simpanNilaiManualTka({ sebaran })` agar nilai & sebaran tertulis bersamaan; mengubah nilai manual tanpa `sebaran` membuang sebaran lama (§109.3). Validasi semua baris dulu; satu salah → jangan simpan apa pun. Setelah menyimpan, «Perbarui publikasi».

118.3 Catatan nomor: entri §113–§117 yang pernah saya tulis bentrok dengan §113 Navigasi, §114 CSS `tka-ka-*`, dan rujukan kode §115.x (materi AI); dinomori ulang menjadi §118–§122. Sebelum menulis entri baru, cek nomor tertinggi yang dirujuk di `src/` (`grep -rhoE "§1[0-9]{2}" src`), bukan hanya heading di ANTIREGRESI.md.

## §113. Navigasi di dalam panel Kuis (`kn-*`)

113.1 Tombol navigasi di dalam Kuis (kembali, menu Atur/Offline/Hasil, sub-menu hasil, filter kelas) memakai komponen `components/KuisNav.tsx` (`KuisKepala`, `KnSegmen`, `KnChips`, `KnKembali`). Jangan kembali ke tombol Tailwind ad-hoc. Aksen lewat `--rg-a` yang diset wrapper `KelasDetail`; fallback ungu sekolah.

113.2 Kuis **online** tidak punya tab «Input offline». Bila `detailTab === 'offline'` tetapi kuis online, perilaku lama = jatuh ke Hasil siswa: gunakan `tabEfektif` yang sama untuk sorotan menu **dan** isi panel (jangan hitung terpisah).

113.3 ARIA: menu segmen di `KuisKepala` = `tablist` (`idPrefix` `kuis-detail`, panel `#kuis-detail-panel`, roving tabindex). Sub-menu hasil dan filter kelas = `group` + `aria-pressed` karena kontennya bukan panel terpisah.

113.4 Ponsel (≤ 640 px): judul kuis boleh membungkus (clamp 2 baris) — jangan `white-space: nowrap` (judul terpotong «Tah…»); menu segmen memakai `flex: 1 1 0` tanpa scroll horizontal.

113.5 `.tka-tabs` (TkaRekap) harus `display: flex; width: fit-content`; `inline-flex` di dalam kolom flex membuatnya melebar penuh.

113.6 Label tombol kembali di dalam kuis memakai tujuan singkat («Daftar kuis», «Daftar nilai»).

## §112. UI Beranda / Ruang Kelas (`rg-*`)

112.1 Ringkasan tugas & kuis aktif **hanya** lewat `lib/ringkasanRuang.ts` (`useRingkasanRuang` / `muatRingkasanRuang`). Jangan menyalin query `daftarTugasGuru`/`daftarKuis` ke halaman lain. Hook aman balapan (hanya hasil permintaan terbaru yang dipakai).

112.2 `useRingkasanRuang(ruang, …)` memuat ulang setiap **identitas array `ruang`** berubah. Di Beranda/KelasList `ruang` hanya di-set dari efek `[profil]`; di KelasDetail dibungkus `useMemo`. Jangan meneruskan array yang dibuat baru tiap render (akibatnya «Maximum update depth exceeded»).

112.3 `KelasDetail`: semua hook baru wajib di atas early return `!parsed` (sama dengan aturan KuisPanel §108.4). Ruang TKA **tidak** memuat ringkasan (`ruangSatu` kosong) dan **tidak** menampilkan pil tugas/kuis; tab TKA tetap hanya Kuis + Bank Soal (§77).

112.4 `.kelas-hero*` dan `.tka-ruang-*` dipakai bersama hero TKA — jangan diubah untuk mempercantik hero non-TKA (tambahan non-TKA lewat `.rg-hero-pills`). `.lms-hero`, `.lms-card*`, `.lms-tab*` masih dipakai halaman siswa dan panel; **jangan dihapus** walau Beranda/KelasList tidak lagi memakainya.

112.5 Tab ruang memakai pola ARIA: `role=tablist/tab/tabpanel`, id `tab-<id>` / `panel-<id>`, roving `tabIndex`, panah kiri/kanan/Home/End. Jangan kembali ke tab tanpa atribut ini.

112.6 Label hitungan di kartu ruang («tugas aktif», «kuis aktif») huruf biasa, **bukan** uppercase ber-letter-spacing — versi uppercase terpotong («TUGAS AK…») pada kartu ±215 px. Hitungan nol berwarna `#64748b` (bukan `#94a3b8`, kontras kurang).

112.7 Item grid ruang adalah `<li>` `display: flex` berisi kartu (`<a class="rg-ruang">`); jangan `display: contents` pada `<li>`. Lebar halaman penuh — tanpa `max-width` pada `.rg-halaman` / `.rg-grid` (§111.2).

112.8 Urutan agenda (`urutkanAgenda`): tugas bertenggat mendatang (terdekat dulu) → tugas lewat tenggat (terbaru dulu) → tugas tanpa tenggat → kuis; selaras «Tenggat terdekat» di katalog Tugas. Nada tenggat memakai `infoTenggat` (§111.3).

## §111. UI katalog Tugas (`tg-*`)

111.1 Aksen kartu = variabel `--tg-a` yang diset **inline per kartu** dari `aksenMapel(mapel).bar`; soft/garis diturunkan dengan `color-mix`. Warna teks berwarna boleh memakai `--tg-a` langsung karena palet `aksenMapel` seluruhnya gelap (kontras ≥ 4,5:1). Jangan mengganti palet itu dengan warna terang tanpa mengecek kontras (ANTIREGRESI §108.2).

111.2 Jangan menambah `max-width` pada `.tg-halaman` / `.tg-grid` — konten shell memang lebar penuh (regresi lebar UI TKA, CHANGELOG 2026-11-12).

111.3 Tenggat dihitung dengan **selisih hari kalender** (`infoTenggat` di `lib/tugasUi.ts`), bukan selisih 24 jam; «lewat» bila waktu tenggat < sekarang. Nada alarm (lewat / hari ini / segera) hanya untuk tugas **aktif**; draf memakai nada netral.

111.4 Label penilaian di UI **guru** boleh singkat (Latihan/SLM/STS/SAS) dengan label lengkap di `title`. Di UI **siswa** tetap tanpa «(tidak masuk nilai)» (CHANGELOG 2026-11-11, `NAMA_JENIS_PENILAIAN_SISWA`) — jangan tertukar.

111.5 Item grid adalah `<li>` yang `display: flex` berisi `<article>`; jangan memakai `display: contents` pada `<li>` (menghilangkan semantik daftar di sebagian peramban).

111.6 Statistik ringkasan dan hitungan segmen dihitung dari **daftar penuh**, bukan hasil saringan. Urutan «Terbaru» = urutan asal dari `daftarTugasGuru` (sudah menurut `updatedAt`).

## §110. Kompetensi IPA di sebaran TKA

110.1 Kompetensi dasar = `kompleksitas` L1–L3 untuk semua mapel. Kompetensi materi: MTK & BI = `tipeMateri`; **IPA = `domainTka`** (pengetahuan / keterampilan_proses). Jangan menambahkan 11 tipe materi IPA ke `SebaranMapelTka.materi`.

110.2 Soal IPA wajib punya `kompleksitas` dan `domainTka`; tanpa domain, sebaran materi IPA kosong (rekap menampilkan peringatan).

110.3 Sebaran rentang nilai (histogram) sengaja **tidak** ditampilkan di tab mapel (permintaan pengguna: memakan ruang, belum perlu). Jika dimunculkan lagi, jadikan opsional/lipat, hanya untuk guru/admin, dan **jangan** masuk snapshot portal orang tua. Utamakan capaian kompetensi per siswa.

## §109. Sebaran capaian TKA di rekap

109.1 Sebaran dihitung **berbobot poin** (`poin ÷ maks`), bukan jumlah soal benar — skor parsial PGK / Benar-Salah ikut dihitung. Jangan kembali ke `benar === true`.

109.2 Penyebut = **seluruh soal kuis** (soal tanpa jawaban = 0 poin). Sebaran harus dihitung dari kuis & jawaban yang **sama** dengan nilai akhir yang dipilih (`nilaiOtomatisMapel`), bukan kuis lain.

109.3 Nilai manual/import (mis. Try Out I dari portal lama) tidak punya jawaban per butir. Sebarannya hanya dari field `lms_rekap_tka.sebaran[mapel]`. Mengubah/menghapus nilai manual **membuang** `sebaran[mapel]` (`deleteField`) agar tidak tampil capaian yang tak cocok dengan nilai.

109.4 Data Try Out I menyimpan **poin per kelompok** (`data/tryoutTahap1.ts`), bukan persen berbulat. Dua siswa waktu habis (Daenzel Zhafran 6A, Zakiyah Fathinah Fauziyah 6B) memakai maks sumber 36 / 37 (bukan 40) dan ditandai `waktuHabis`. Untuk tahap yang dikerjakan di LMS, penyebut tetap seluruh soal.

109.5 Bahasa Indonesia: kompleksitas L1/L2/L3 ≡ Pemahaman Tekstual / Inferensial / Evaluasi dan Apresiasi (pembagian soal sama). UI menampilkan satu tabel berpasangan (`pasangkanDimensiSama`); Matematika tetap dua dimensi terpisah.

109.6 Snapshot portal: `SebaranBarisOrtu.benar/total` kini berarti **poin/maks**. Label kompleksitas `L1 · Pemahaman / L2 · Aplikasi / L3 · Penalaran` (`NAMA_KOMPLEKSITAS_TKA`). `hitungSebaranDariDetail` lama deprecated.

109.7 Soal TKA harus berlabel `tipeMateri` (dan `domainTka` untuk IPA); bila kosong rekap menampilkan peringatan dan sebaran materi/domain tidak lengkap.

109.8 Rules `lms_rekap_tka` tidak membatasi field tambahan, jadi field `sebaran` tidak butuh deploy rules. Jangan menambah `hasOnly` tanpa memasukkan `sebaran`.

## §108. UI Bank Soal / wizard kuis (kartu `pk-*`, wizard `wz-*`)

108.1 Variabel warna `--pk-*` hanya aktif di dalam pembungkus `kelasAksenMapel(mapel)` (`pk-aksen pk-aksen--ipa|mtk|bi|umum`). Pembungkus wajib ada di root BankSoalPanel, daftar kuis, dan wizard — tanpa itu kartu jatuh ke aksen default.

108.2 Teks/tombol berwarna memakai `--pk-ink`, **bukan** `--pk-a` (teal/biru terang gagal kontras di atas putih). `--pk-a` hanya untuk bar/titik dekoratif.

108.3 Helper materi paket (`materiPaket`, `paketMemuatMateri`) satu sumber di `src/lib/aksenTka.ts`. Filter materi di Bank Soal, pengelompokan, dan wizard harus memakainya — jangan menyalin logika (paket bisa membawa materi di level paket **atau** di soal).

108.4 `KuisPanel`: semua `useState`/`useMemo` baru wajib di atas early return `langkah === 'detail' | 'wizard'` (kalau tidak: error «Rendered fewer hooks»). `resetWizard` harus ikut mereset state wizard baru (`qPaket`, `materiPaketAktif`).

108.5 Hitungan «tersedia» wizard (`tersedia`) memakai logika filter yang sama dengan `filterSusun` (TKA kosong = hanya `TIPE_SOAL_TKA`, ANTIREGRESI §88). Ubah keduanya bersamaan.

108.6 Kelas lama `.paket-item/.paket-list/.paket-grup*` di `soal.css` sudah tidak dipakai komponen; jangan dihapus tanpa cek, jangan dipakai lagi untuk kartu baru.

## §107. Snapshot sebaran TKA ke portal

107.1 Portal menampilkan sebaran hanya dari field `sebaran` di `lms_tka_hasil_ortu` — bukan hitung ulang live dari `lms_jawaban`.

107.2 Publish menghitung sebaran best-effort dari kuis sumber (`SelNilaiTka.kuisId`) + detail jawaban. Gagal sebaran **tidak** menggagalkan publish nilai akhir.

107.3 Label portal: Bahasa Indonesia / Matematika / IPA (jangan singkatan BI di UI orang tua).

107.4 IPA: `domainTka` pada soal → sebaran domain Pengetahuan IPA vs Keterampilan Proses Sains.

## §106. Publikasi Try Out TKA → portal orang tua

106.1 Portal **tidak** membaca `lms_rekap_tka` / `lms_jawaban`. Hanya snapshot `lms_tka_hasil_ortu` + gerbang `lms_tka_publikasi` + `lms_tka_peringkat`.

106.2 Publish **per kelas × tahap** (mis. 6A_I terpisah 6B_I). Ranking selalu dihitung dari **gabungan 6A+6B**.

106.3 Rata ranking: tahap I = BI+MTK; II–V = BI+MTK+IPA. Tanpa mapel wajib → tidak masuk ranking (`peringkat: null`).

106.4 Baca snapshot `allow read: if true` (portal tanpa Auth). Tulis hanya staf (`tkaBolehPublishKelas`). Deploy rules utuh.

106.5 Setelah ubah nilai rekap, wali harus **Perbarui publikasi** agar portal mendapat snapshot baru.

## §105. Rules `lms_rekap_tka`: admin TKA harus bisa baca

105.1 `allow list` / `allow get` wajib mengizinkan `tkaEmailKhusus()` **langsung** (bukan hanya di dalam `isGuru() && tkaBolehRombelRekap`). Create/update sudah benar; baca sering tertinggal.

105.2 Jangan memakai `resource.data.keys().hasAll([...])` pada `allow list` — satu dokumen tanpa field wajib menggagalkan seluruh query klien.

105.3 `tkaEmailKhusus`: bandingkan email dengan `.lower()` agar token Auth tidak gagal karena kapitalisasi.

105.4 Setelah ubah rules: deploy **firestore:rules** (bukan hanya Hosting LMS). Tanpa deploy rules, UI tetap «Missing or insufficient permissions».

## §104. Rekap TKA: nilai manual/import harus tampil

104.1 Jangan query compound `tahap` + `kelas` pada `lms_rekap_tka` kecuali composite index sudah di-deploy. Default: query satu field (`kelas` atau `tahap`), filter sisanya di klien.

104.2 Error `getDocs` (permission / failed-precondition) **wajib** dilog dan ditampilkan di UI rekap — jangan hanya `console.warn` (nilai import akan tampak «hilang»).

104.3 ID dokumen: `{KELAS}_{tahap}_{siswaId}` (`idRekapTka`). Lookup UI harus uppercase kelas yang sama dengan import.

104.4 Merge UI: nilai di dokumen `lms_rekap_tka` menang atas otomatis; terima `sumber` kosong sebagai manual.

## §103. Import rekap TKA bulk (admin)

103.1 UI `/tka/import-rekap` hanya `profil.role === 'admin'` (bukan sekadar email TKA / wali 6).

103.2 Matching: normalisasi nama + kelas exact ke koleksi `siswa`. Status ganda/tidak_ketemu tidak ditulis.

103.3 Rules: `isAdmin()` boleh create/update `lms_rekap_tka` selain jalur `tkaBolehRombelRekap`. Deploy rules bersama file utuh.

103.4 Nilai disimpan `sumber: manual` untuk `TKA Matematika` dan `TKA Bahasa Indonesia`. IPA tidak diisi dari sumber try out tahap I portal tka2026.

## §101. Reset TKA: attempt vs draf progress

101.1 `lms_jawaban` dihapus = izin mengerjakan ulang. **Tidak** menghapus draf di `localStorage` perangkat siswa.

101.2 Draf dihapus lewat marker `lms_tka_progress_reset/{kuisId}_{siswaId}` (`resetAt` / `resetAtMs`). Klien siswa wajib cek marker sebelum memakai progress lokal.

101.3 Mode CF: `attempt` | `progress` | `semua`. Default UI admin = `semua`.

101.4 Tulis marker hanya Admin SDK. Siswa hanya **read** dokumen dengan `siswaId == token.siswaId`.

101.5 Jangan mengandalkan admin dan siswa di perangkat yang sama untuk “hapus localStorage jarak jauh” tanpa marker server.

## §102. Atur kuis: tambah soal dari bank

102.1 Setelah kuis dibuat, soal hanya boleh ditambah lewat snapshot dari paket `siap` (bukan edit teks di Atur kuis).

102.2 Identitas jejak: `sumberPaketId` + `sumberSoalId`. Soal dengan `sumberSoalId` yang sudah ada di kuis tidak ditambahkan lagi.

102.3 TKA: picker hanya menampilkan/mengizinkan tipe di `TIPE_SOAL_TKA`. Mapel biasa tetap semua tipe.

102.4 `sumberPaketIds` diperbarui saat simpan bila paket baru dipakai; jangan melebihi `BATAS_PAKET_SUMBER`.

102.5 Jangan mengubah bank soal dari Atur kuis — hanya snapshot ke dokumen kuis.

## §114. CSS wajib untuk class `tka-ka-*` (dashboard kuis aktif)

114.1 Komponen `src/pages/tka/TkaKuisAktif.tsx` memakai class `tka-ka`, `tka-ka-grup`, `tka-ka-chip`, `tka-ka-item`, `tka-ka-status`, `tka-ka-buka`, dll. **Semua harus punya rule di `src/styles/tka.css`.** Tanpa CSS, teks chip + nama mapel + «N kuis» dan «Berlangsung» + «Buka →» menempel jadi satu kata.

114.2 Saat menambah class `tka-ka-*` baru di TSX, tulis style di `tka.css` dalam blok yang sama (cari «Kuis TKA aktif di dashboard»). Jangan mengandalkan utility Tailwind saja untuk elemen yang sudah memakai class khusus ini.

114.3 `.tka-rekap-controls`: panel portal sudah tab; jangan memaksa `grid-template-columns: … 1fr` dua kolom jika hanya ada toolbar filter (pakai `:has(> :only-child)` / `:has(> :nth-child(2))`).

## Lomba (modul baru)

### §Lomba.1 Menu siswa hanya untuk peserta
Menu **Lomba** di nav siswa hanya ditampilkan jika `daftarLombaSiswa(siswaId)` mengembalikan ≥1 dokumen (query `siswaIds` array-contains). Jangan hardcode tampil untuk semua kelas.

### §Lomba.2 Peserta maksimal 20
Validasi di client (`MAKS_PESERTA_LOMBA`) **dan** rules (`siswaIds.size() <= 20`, `siswaList.size() <= 20`). Selalu jaga `siswaIds` selaras dengan `siswaList`.

### §Lomba.3 Meta hanya admin; konten admin atau pengampu
Create/update/delete dokumen `lms_lomba` (nama, pengampu, peserta, mapel terkait, masa) = **admin saja**. Guru pengampu (`guruPengampuUid`) baru boleh menulis konten turunan (materi/bank/kuis dengan `lombaId`) di Tahap 2 — jangan izinkan guru mengubah meta lewat rules.

### §Lomba.4 Mapel terkait membatasi TP
Field `mapelTerkait: string[]` wajib ≥1. Pada Tahap 2, filter TP / mapel di form materi-bank-kuis lomba harus memakai daftar ini (admin boleh filter TP penuh per mapel terkait; guru pengampu mengikuti mapel lomba tanpa filter admin ekstra).

### §Lomba.5 List users hanya admin
Dropdown guru pengampu memakai `getDocs(users)` — rules `users` hanya `allow list: if isAdmin()`. Jangan panggil dari akun guru.

### §Lomba.6 Lebar & tampilan modul baru (wajib)

Regresi berulang: halaman modul baru (Lomba, dan kelak fitur lain) memakai `max-w-3xl` / `max-w-6xl` + kartu generik putih, sehingga di layar lebar muncul **strip kosong kiri-kanan** dan UI terasa template kosong.

**Aturan:**

1. Wrapper halaman daftar/dashboard/form modul **tidak** memakai `max-w-3xl`, `max-w-4xl`, atau `max-w-6xl`. Konten mengisi `.lms-content` (sudah `max-width: 1600px`).
2. Form panjang: gunakan **grid 2 kolom** di desktop (lihat `.lomba-form`), bukan kolom sempit di tengah.
3. Halaman daftar wajib punya **hero** (gradient + judul + lead) dan **kartu grid** dengan meta/badge — pola referensi: `tka-dash-*` / `lomba-*`. Jangan hanya judul + daftar border generik.
4. CSS modul baru taruh di `src/styles/{modul}.css` dan di-import di halaman; jangan mengandalkan utility Tailwind sempit untuk layout halaman.

### §Lomba.7 Konten kelas bank LB + lombaId
Materi/paket/kuis lomba disimpan dengan `kelas == "LB"` dan field **`lombaId`**. Query wajib `where lombaId` + `mapel`. Jangan campur dengan ruang kelas biasa. Rules: `lombaKontenBoleh(lombaId)`. **`lombaId` WAJIB benar-benar ditulis ke dokumen** pada setiap fungsi pembuat konten lomba (`buatPaket`, `tambahMateri`, `buatKuisDariPaket`) — lihat §Lomba.10.

### §Lomba.8 Prop opsional untuk panel bersama: jangan di-destructure bila tak dipakai
Build deploy (`tsc -b`) gagal dengan `TS6133 'tpKelas' is declared but its value is never read` di `KuisPanel`. Panel bersama (`MateriPanel`, `BankSoalPanel`, `KuisPanel`) menerima `lombaId` / `tpKelas` opsional dari `LombaDetail`, tetapi **tidak semua panel memakai kedua prop**. `KuisPanel` hanya memakai `lombaId` (TP kuis berasal dari paket sumber).

**Aturan:**
1. Prop yang tidak dipakai sebuah panel tetap dideklarasikan di tipe `Props` (agar pemanggil seragam), tetapi **jangan** dimasukkan ke destructuring parameter — `noUnusedLocals`/`noUnusedParameters` menolaknya.
2. Saat menambah prop baru ke panel bersama, periksa tiap panel: destructure hanya yang benar-benar dibaca.
3. Selalu jalankan `npx tsc -b` (atau `npm run build`) sebelum `npm run deploy`; jangan mengandalkan Vite dev server yang tidak mengecek tipe.

### §Lomba.9 Nama kelas CSS ganda & kesamaan tampilan dengan ruang kelas
Regresi: bar mapel di detail lomba tampil terhimpit (tombol mapel membulat, «TP dari kelas» terpotong per kata) karena `.lomba-mapel-bar` dipakai **dua kali** di `lomba.css` — bilah warna kartu mapel form (`width: 0.28rem; align-self: stretch`) dan baris filter mapel. Aturan CSS bergabung, lebar bilah ikut terbawa.

**Aturan:**
1. Sebelum menambah kelas CSS baru, `grep -n "nama-kelas" src/styles/*.css` — jangan memakai ulang nama yang sudah ada di file yang sama dengan arti berbeda. Filter mapel detail lomba = `.kn-bar.lomba-ruangbar`; pemilih TP = `.lomba-tp`.
2. Tab detail lomba memakai `rg-tabs`/`rg-tab` (ruang.css) dan filter mapel memakai `KnChips` (KuisNav) agar selaras dengan ruang kelas/TKA. Jangan membuat tab/pill khusus Lomba lagi.
3. `.rg-tabs` punya `--rg-a` bawaan ungu; aksen mapel wajib diset **inline pada elemen `.rg-tabs`** (bukan hanya pembungkus), seperti `KelasDetail`.
4. Aksen = `aksenMapel(mapelAktif).bar` lewat `--rg-a` pada pembungkus `lomba-dash`, agar `kn-*` di dalam panel Kuis ikut berwarna mapel.
5. Cek visual halaman baru di lebar ≤ 640 px dan ≥ 1280 px sebelum deploy; jalankan `npx tsc -b` (§Lomba.8).

### §Lomba.10 `lombaId` harus ikut ditulis ke dokumen (permission denied saat import / buat paket / tambah materi)
Regresi: **Import soal**, «+ Paket soal baru», dan tambah materi di Lomba gagal `Missing or insufficient permissions`. Penyebab: fungsi pembuat (`buatPaket` di `soal.ts`, `tambahMateri` di `materi.ts`) mendeklarasikan `lombaId?: string` di tipe input dan pemanggil (`BankSoalPanel`, `MateriPanel`) mengirimnya, tetapi objek yang ditulis ke Firestore **tidak memuat `lombaId`**. Rules `create` kelas `LB` mensyaratkan `'lombaId' in request.resource.data && lombaKontenBoleh(...)`, dan admin tidak lolos `lmsTulisMapelKelas`, jadi semua penulis ditolak. TypeScript tidak mendeteksinya (prop opsional yang diterima tapi tak dipakai tidak error).

**Aturan:**
1. Setiap fungsi pembuat konten yang menerima `lombaId` **wajib** menulisnya: `...(input.lombaId ? { lombaId: input.lombaId } : {})` (atau `payload.lombaId = …`). Mendeklarasikan di tipe saja tidak cukup. Saat menambah modul/koleksi konten lomba baru (tugas, bobot SLM, dst.), cek ketiga fungsi di atas sebagai contoh dan **grep `lombaId` pada fungsi tulisnya**.
2. Konten kelas `LB` **tanpa** `lombaId` tidak akan pernah lolos rules (tulis maupun baca). Jangan melonggarkan rules untuk menutupi field yang hilang.
3. Cabang **baca** Lomba harus ada di setiap koleksi yang dibaca pengampu: `lms_paket_soal` dan `lms_kuis` memakai `isGuru() && 'lombaId' in resource.data && lombaKontenBoleh(resource.data.lombaId)`. Tanpa itu guru pengampu non-admin gagal memuat daftar (kelas `LB` tidak ada di `penugasanKelasMapel`). Query klien wajib `where lombaId` + `mapel` (`daftarPaketLomba`, `daftarKuisLomba`, `daftarMateriLomba`); query hanya `kelas == 'LB'` ditolak untuk non-admin.
4. Uji setelah perubahan: buat paket dan import soal di dalam Lomba dengan **akun admin** dan **akun guru pengampu non-admin**, lalu muat ulang tab Bank soal. Cek di Firebase Console bahwa dokumen baru punya field `lombaId`.
5. Diketahui, belum diperbaiki: `KuisDetail` («Tambah dari bank») dan `buatKuisDariPaket` (jalur otomatis tanpa `soalSiap`) memanggil `daftarPaket`/`daftarPaketSiap` per kelas `LB` tanpa `lombaId`; aman untuk admin, tetapi ditolak untuk guru pengampu non-admin. Perbaiki (pakai `daftarPaketLomba`) sebelum pengampu non-admin menyusun kuis lomba dari jalur itu.

### §Lomba.11 Salinan `firestore.rules` di repo LMS bisa basi — basis selalu dari SDM01Penilaian
Regresi: `firestore.rules` di repo `nitoe/lms` tidak memuat rules Lomba (`lms_lomba`, `lombaKontenBoleh`, cabang `LB` pada materi/paket/kuis/tugas/bobot) walau CHANGELOG mencatatnya, sementara versi di `SDM01Penilaian` (sumber deploy `npm run deploy:rules`) memuatnya. Mengedit salinan basi lalu men-deploy akan **menghapus** rules Lomba di production.

**Aturan:**
1. Sebelum mengubah `firestore.rules`, ambil versi terbaru dari **`SDM01Penilaian`** (bukan salinan di `lms`), terapkan perubahan, lalu kirim file **utuh** untuk kedua repo dengan isi identik.
2. Pastikan keluaran tidak kehilangan blok milik repo lain: bandingkan dengan `diff` terhadap versi Penilaian — hanya baris yang memang diubah yang boleh berbeda.
3. Setelah mengubah rules di repo mana pun, salin ke repo satunya agar tidak berselisih lagi.

### §Lomba.12 Kelas bank «LB» bukan ruang kelas: navigasi balik harus ke dashboard Lomba

1. Paket/materi/kuis Lomba disimpan dengan `kelas = 'LB'` (`KELAS_LOMBA_BANK`) hanya agar rules & query seragam. «LB» **bukan** ruang kelas: tidak ada di penugasan guru, tidak tampil di `/kelas`. Jangan pernah mengarahkan pengguna Lomba ke `/kelas/LB--…`; hasilnya halaman «Kelas LB» dan daftar «Ruang Kelas» kosong (juga untuk admin).
2. `BankSoalPanel` dengan prop `lombaId` WAJIB menambahkan `?lomba=<lombaId>` pada setiap tautan/navigasi ke `/kelas/:ruangId/soal/:paketId` (`qLomba`). Tautan editor baru dari konteks Lomba harus meniru ini.
3. `SoalEditor`: tujuan kembali = `/lomba/<id>?tab=soal&mapel=<mapel>` bila ada lombaId (query `?lomba=` dahulu — tersedia sebelum paket selesai dimuat — lalu `paket.lombaId`); `/lomba` bila kelas `LB` tanpa lombaId; selain itu `/kelas/<ruangId>?tab=soal`. Jangan mengembalikan `kembaliKe` menjadi konstanta `/kelas/...`.
4. `LombaDetail` membaca `?tab=` (ringkas/materi/kuis/soal) dan `?mapel=` (harus ada di `mapelTerkait`). Jangan menghapusnya — dipakai tombol kembali editor.
5. `KelasDetail` mengalihkan kelas `LB` ke `/lomba` sebagai jaring pengaman untuk bookmark/tautan lama.
6. «Ruang Kelas» kosong di akun admin itu normal (daftar hanya dari `penugasan`/`waliKelas` profil), jangan dianggap bug dan jangan «diisi» dengan ruang LB.
7. Uji: Lomba → Bank Soal (mapel B) → Buka paket → ← mendarat di tab Bank Soal mapel B pada lomba yang sama; ruang kelas biasa & TKA tetap kembali ke tab soal ruangnya.

### §Lomba.13 Kuis gabungan lintas mapel: `mapel = 'Gabungan'`, paket se-lomba, jangan pakai `daftarPaket('LB', mapel)`

1. Kuis lintas mapel disimpan dengan `mapel = MAPEL_GABUNGAN_LOMBA` (`'Gabungan'`, `lombaAkses.ts`) dan `lombaId`. Jangan mengubah nilainya (kuis lama bergantung padanya) dan jangan menjadikan «Gabungan» mapel sungguhan di tempat lain (TP, materi, bank soal, Penilaian/rekap). Rules `lms_kuis` hanya mensyaratkan `mapel` string 1–80 karakter — jangan menambah whitelist mapel di rules tanpa mengakomodasi nilai ini.
2. Sumber paket Lomba SELALU lewat `lombaId`: `daftarPaketLomba(lombaId, mapel)` (satu mapel) atau `daftarPaketLombaSemua(lombaId)` (lintas mapel; query hanya `lombaId` agar lolos cabang rules guru pengampu). Untuk kuis yang sudah ada gunakan `daftarPaketUntukKuis(kuis)` (`kuis.ts`). **Jangan** `daftarPaket(kuis.kelas, kuis.mapel)` / `daftarPaketSiap` untuk kelas «LB»: tercampur antar-lomba dan ditolak rules bagi guru pengampu non-admin (query tidak memuat `lombaId`). Regresi lama ada di `KuisDetail` (Tambah dari bank, Perbarui TP).
3. `KuisPanel` menerima `mapelGabungan` (array) — di dalam komponen WAJIB dipakai lewat kunci string (`kunciMapelGab = join('|')`) pada dependency `useCallback`; array prop berubah identitas tiap render dan memicu `muat()` berulang tanpa henti.
4. Di `LombaDetail`, «Gabungan» hanya muncul di tab Kuis dan hanya bila lomba punya ≥ 2 mapel. Di tab Materi/Bank Soal pilihan itu dipetakan ke mapel pertama (`mapelPanel`); `BankSoalPanel`/`MateriPanel` tidak boleh menerima mapel «Gabungan» (ruangId `LB--Gabungan` tidak bermakna).
5. Daftar kuis Lomba tidak boleh menggabungkan `daftarKuisDibuatOleh()` (kelas «LB» milik pembuat dari lomba lain). `KuisPanel` melewati penggabungan itu bila `lombaId` ada.
6. Kuis gabungan tidak boleh masuk Penilaian/rekap per mapel: panel «Penilaian & TP» disembunyikan (`adalahMapelGabungan`), jenis penilaian tetap «latihan». Bila kelak ada sinkron nilai, kecualikan `mapel === 'Gabungan'`.
7. `SoalKuis.sumberMapel` diisi `snapshotSoal` bila paket membawa `mapel`; kuis lama tidak punya field ini — kode yang membacanya harus menganggapnya opsional.
8. Sisi siswa untuk kuis Lomba belum ada (`/siswa/lomba/:id` belum dirutekan; rules siswa membaca `lms_kuis` lewat `kelas == token.kelas`, bukan «LB»). Saat dibuat, tambahkan cabang rules baca siswa untuk `lombaId` (peserta: `request.auth.token.siswaId in lomba.siswaIds`) dan deploy rules.
9. Uji: lomba ≥ 2 mapel → buat paket Siap di dua mapel → Kuis → Gabungan → pilih paket kedua mapel → pratinjau memuat soal campuran → simpan → buka kuis → «Tambah soal dari bank» menampilkan paket kedua mapel (juga untuk akun guru pengampu non-admin).


### §Lomba.14 Kuis gabungan: preset jumlah soal & saring paket tidak membatasi penyusunan

1. Preset jumlah soal di wizard kuis (`PRESET_JUMLAH` di `KuisPanel.tsx`) mencakup **40** dan **50** di samping 10–30. Batas keras tetap `BATAS_SOAL_PER_KUIS` (100) di `types/kuis.ts` dan `susunOtomatis`. Jangan menghapus 40/50 tanpa alasan; lomba sering memakai 30–50 soal.
2. Saring Mapel (chip) di langkah «Pilih paket soal» mode Gabungan **hanya memfilter tampilan** (`paketTampil`). `paketIds` dan `kandidat`/`susunOtomatis` memakai **seluruh paket yang dicentang**, termasuk yang sedang disembunyikan saring. Jangan memfilter `kandidat` dengan `mapelPaketAktif`.
3. Tombol «Pilih semua yang tampil» menghormati saring; tombol **«Pilih semua paket Siap»** (Gabungan saja) mengabaikan saring dan mencentang semua `paketSiap`. Keduanya harus tetap ada.
4. Saat saring mapel aktif dan ada paket terpilih dari mapel lain, UI menampilkan ringkasan «Terpilih: …» agar pengguna tidak mengira centang hilang.
5. Uji: Lomba ≥2 mapel → Gabungan → saring ke satu mapel → centang paket → saring ke mapel lain → centang lagi → ringkasan menunjukkan kedua mapel → Susun pratinjau → soal berasal dari kedua paket; preset 40/50 tersedia dan menghasilkan jumlah sesuai stok.


### §Lomba.15 Simpan kuis Lomba / Gabungan: cabang create `lms_kuis` harus Lomba-first + deploy rules

1. Create dokumen `lms_kuis` untuk Lomba memakai `kelas == 'LB'`, field `lombaId`, dan (untuk lintas mapel) `mapel == 'Gabungan'`. Rules **wajib** punya cabang:
   `lombaKelasBank(kelas) && 'lombaId' in data && lombaKontenBoleh(lombaId)`.
2. Letakkan cabang Lomba **sebelum** `lmsTulisMapelKelas` dalam ekspresi OR create, agar mapel non-penugasan («Gabungan», mapel lomba yang tidak diampu guru di ruang biasa) tidak bergantung pada urutan evaluasi.
3. `lombaKontenBoleh` melakukan `exists` + `get` pada `lms_lomba/{lombaId}` — get harus diizinkan untuk admin dan guru pengampu (sudah diatur di match `lms_lomba`). Jika create gagal permission sementara list paket Lomba berhasil, cek apakah rules yang **ter-deploy** di proyek Firebase sudah memuat cabang Lomba pada `lms_kuis` (bukan hanya di repo).
4. Klien (`buatKuisDariPaket`) wajib menulis `lombaId` bila `input.lombaId` ada — jangan hanya mengandalkan kelas «LB». Tanpa `lombaId` di dokumen, cabang Lomba ditolak (sengaja, agar tidak ada kuis bank LB yatim).
5. Setelah mengubah `firestore.rules`, selalu `firebase deploy --only firestore:rules` (atau pipeline yang mem-deploy rules). Deploy Hosting saja tidak cukup.
6. Uji: admin atau guru pengampu → Lomba → Kuis → Gabungan → pilih paket → susun → simpan → dokumen `lms_kuis` terbentuk dengan `kelas: "LB"`, `mapel: "Gabungan"`, `lombaId` terisi.


### §Lomba.16 Admin LMS di rules = role admin ATAU email arif.nitoe@gmail.com

1. Klien (`adalahAdminLms` di `lombaAkses.ts`) mengizinkan admin lewat `peranDari === 'admin'` **atau** email `arif.nitoe@gmail.com`. Rules sebelumnya hanya `myRole() == 'admin'`. Ketidakselarasan ini menyebabkan UI admin tetapi create/update konten Lomba (`lms_kuis` / paket / materi kelas `LB`) ditolak permission.
2. **(Dikoreksi §Lomba.19)** Rules memakai `isAdminLmsEmail()` (token email lower-case == `arif.nitoe@gmail.com`, + `akunAktif()`) HANYA lewat `lombaAdmin() = isAdmin() || isAdminLmsEmail()`. `isAdmin()` global JANGAN diubah (dipakai Penilaian, Perpustakaan, Sarpras).
3. Setelah mengubah definisi `isAdmin`, deploy **firestore.rules** ke proyek `sdm01kukusan-2e735`. Jangan mengandalkan hanya deploy Hosting.
4. Idealnya dokumen `users/{uid}` untuk akun itu juga `role: "admin"` (sumber kebenaran Penilaian); email fallback melindungi bila role belum tersinkron.
5. Uji: login `arif.nitoe@gmail.com` → Lomba → Kuis → Gabungan → pilih paket → susun pratinjau → **Simpan** → dokumen `lms_kuis` terbentuk (`kelas: "LB"`, `mapel: "Gabungan"`, `lombaId` terisi).


### §Lomba.17 UPDATE dokumen Lomba (`lms_kuis`, `lms_materi`, `lms_tugas`) ditolak karena aturan `kelasList` — akar «Missing or insufficient permissions» saat menyimpan kuis Lomba

1. **Akar sebenarnya.** Pada UPDATE, `request.resource.data` adalah dokumen HASIL gabungan, bukan hanya field yang dikirim. Kuis Lomba dibuat dengan `kelasList: ['LB']` (`normalisasiKelasList('LB')`), jadi `'kelasList' in request.resource.data` SELALU true pada setiap update berikutnya (aktifkan, ubah judul/soal, atur jadwal, simpan). Aturan lama lalu mewajibkan `lmsKelasListBoleh(mapel, ['LB'])` → `lmsTulisMapelKelas` per-kelas «LB» → false untuk admin maupun guru pengampu (tidak ada penugasan «LB::mapel»). Perbaikan create-only (§Lomba.15–16) tidak menyentuh jalur ini.
2. **Rules wajib** punya `lombaKelasListSah(list)` (`list is list && size()==1 && list[0]=='LB'`) dan cabang `('lombaId' in resource.data && lombaKelasListSah(request.resource.data.kelasList))` di klausa kelasList update `lms_materi`, `lms_kuis`, `lms_tugas`. Konten Lomba TIDAK boleh dibagikan ke rombel (`aturBerbagiKuis` tidak dipakai di Lomba).
3. **Jangan** menghapus `kelasList` dari payload create Lomba sebagai «solusi»: query/rules kelas lain bergantung pada field itu; perbaiki di rules.
4. Cabang baca Lomba pada `lms_paket_soal` & `lms_kuis` TIDAK lagi bergantung pada `isGuru()`; cukup `'lombaId' in resource.data && lombaKontenBoleh(lombaId)` (admin via email tidak ber-role admin/guru di `users`). `lms_materi` read menambah `lombaAdmin()`.
5. Cabang create Lomba didahulukan (Lomba-first) di `lms_materi`, `lms_paket_soal`, `lms_kuis`, `lms_tugas`, `lms_nilai_tugas`; `lombaKontenBoleh` kini juga mensyaratkan `akunAktif()`.
6. Uji (urut, akun `arif.nitoe@gmail.com` DAN akun guru pengampu): Lomba → Kuis → Gabungan → susun → **Simpan** (create) → buka kuis → **Aktifkan** / ubah judul / hapus satu soal (update) → keduanya sukses. Akun guru lain (bukan pengampu) tetap ditolak.
7. File `firestore.rules` bersifat BERSAMA: harus disalin UTUH ke repo SDM01Penilaian lalu `npm run deploy:rules`. Mengubah rules di repo lms saja TIDAK berefek di Firebase.

### §Lomba.18 Draf lokal wizard «Susun kuis» (localStorage)

1. `src/lib/kuisDraf.ts` menyimpan kemajuan wizard (judul, deskripsi, paket, mode, filter, pilihan manual, pratinjau) di `localStorage` kunci `lms:kuis-draf:v1:{uid}:{lomba:ID|kelas:K}:{mapel}`. Murni sisi klien — TIDAK melewati firestore.rules, jadi tetap berfungsi saat simpan ke Firestore gagal.
2. Autosave debounce 500 ms saat `langkah === 'wizard'`, plus flush di `pagehide`/`beforeunload` dan di tombol «Batal dan kembali». Wizard KOSONG tidak boleh menimpa draf lama (`drafKuisKosong`).
3. Draf dihapus HANYA saat simpan sukses (`buatKuisDariPaket` resolve) atau «Buang draf» / memilih mulai kuis baru di dialog. `resetWizard()` sengaja TIDAK menghapus draf.
4. Kuota penuh → ulang tanpa `pratinjau` (hasil `tanpa-pratinjau`); gagal total → pesan di wizard. Selalu dibungkus try/catch (mode privat/diblokir).
5. Error `permission-denied` saat simpan menampilkan pesan khusus (deploy rules) dan memanggil `simpanDrafSegera()`; draf tidak boleh hilang pada jalur galat.
6. Hook draf WAJIB berada di atas `return` bersyarat `KuisPanel` (aturan hooks). Jangan memindahkannya ke dalam cabang `langkah === 'wizard'`.
7. Uji: isi wizard → hard reload (Ctrl+Shift+R) → daftar kuis menampilkan banner «Draf kuis belum disimpan» → Lanjutkan → semua isian & pratinjau kembali; simpan sukses → banner hilang.

### §Lomba.19 Email admin LMS hanya discope ke modul Lomba

1. `isAdminLmsEmail()` + `lombaAdmin()` dipakai oleh `lms_lomba`, `lombaKontenBoleh`, dan baca `lms_materi`. `isAdmin()` global TIDAK dimodifikasi agar akun itu tidak otomatis admin di Penilaian/Perpustakaan/Sarpras tanpa role di `users`.
2. Akun tetap sebaiknya ber-`role: "admin"` di `users/{uid}` agar fitur non-Lomba (mis. daftar pengampu/siswa) konsisten dengan UI.
3. Jika menambah koleksi Lomba baru, pakai `lombaAdmin()` / `lombaKontenBoleh()`, bukan `isAdmin()`.


### §Lomba.20 Menu Lomba siswa: kartu di Beranda + nav, satu sumber data, galat tidak ditelan diam

1. Dashboard siswa (`SiswaBeranda.tsx`) punya daftar kartu SENDIRI (`MENU`) terpisah dari nav (`SiswaLayout.tsx`). Menu baru siswa wajib ditambahkan di KEDUANYA; sebelumnya Lomba hanya ada di nav sehingga «tidak ada menu Lomba» di dashboard.
2. Keterdaftaran dibaca lewat satu hook `src/pages/siswa/useLombaSiswa.ts` (`daftarLombaSiswa(sesi.id)`), dipakai nav dan Beranda. Jangan menduplikasi query di komponen.
3. Kartu/nav Lomba tampil hanya bila siswa terdaftar di ≥1 lomba non-arsip. Kartu disisipkan SEBELUM kartu «Segera» (Pencapaian).
4. Hook mencatat `console.warn` saat query gagal (mis. `permission-denied`); jangan kembali ke `.catch(() => {})` kosong. Jika menu tidak muncul padahal siswa terdaftar: buka konsol browser siswa → bila `permission-denied`, deploy `firestore.rules` terbaru (SDM01Penilaian → `npm run deploy:rules`); bila tidak ada galat, periksa `siswaIds` di dokumen `lms_lomba` memuat ID siswa (ID dokumen `siswa`, sama dengan claim `siswaId`).
5. Uji: login siswa peserta → Beranda menampilkan kartu Lomba dan nav menampilkan «Lomba»; siswa non-peserta tidak melihat keduanya.


### §Lomba.21 List `lms_lomba` untuk siswa: jangan pakai predikat tipe pada `resource.data`

1. Gejala: konsol siswa `daftarLombaSiswa gagal … Missing or insufficient permissions` → menu/kartu Lomba tidak pernah muncul.
2. Akar: cabang siswa pada `allow list` memuat `resource.data.siswaIds is list`. Untuk query list, Firestore harus membuktikan aturan benar untuk SEMUA dokumen yang cocok dengan filter; predikat tipe (`is list`, `is string`) pada field tidak dapat dibuktikan dari filter `array-contains`, sehingga query ditolak walau tiap dokumen sebenarnya lolos. Pola yang terbukti jalan (kuis siswa): `request.auth.token.kelas in resource.data.kelasList` tanpa predikat tipe.
3. Aturan benar: `isSiswaLms() && request.auth.token.siswaId in resource.data.siswaIds`. Bila `siswaIds` bukan list, operator `in` gagal → ditolak, jadi keamanan tidak berkurang.
4. Berlaku umum: pada cabang `allow list` hanya pakai kondisi yang selaras dengan filter query (kesetaraan / `in` terhadap filter), bukan predikat tipe atau fungsi bantu yang membaca field lain. `allow get` boleh lebih ketat.
5. Wajib deploy `firestore.rules` (SDM01Penilaian → `npm run deploy:rules`). Uji: login siswa peserta → konsol tanpa galat → kartu Lomba muncul di Beranda dan nav.








### §Lomba.28 Multi guru pengampu

1. Dokumen `lms_lomba` menyimpan `guruPengampuUids: string[]` + `guruPengampuList: {uid,nama,email?}[]` (maks 10). Field `guruPengampuUid`/`Nama`/`Email` = elemen pertama (legacy).
2. **Hanya admin** create/update meta & daftar pengampu. Pengampu **tidak** boleh membuat lomba baru.
3. Akses konten (materi/bank/kuis/hasil/reset): admin **atau** uid ∈ `guruPengampuUids` (fallback `guruPengampuUid`).
4. List guru: query `array-contains` pada `guruPengampuUids` **dan** `guruPengampuUid == uid`, hasil digabung unik di klien. Rules list mengakui kedua predikat.
5. Form admin: multi-pilih staf (bukan radio tunggal).

### §Lomba.27 Skor kuis Lomba ke siswa hanya setelah publikasi

1. Setelah submit, UI siswa **jangan** menampilkan skor — pakai pola TKA: «Jawaban terkirim» + kotak amber «Nilai belum dipublikasikan».
2. Skor/rincian baru tampil jika `kuis.hasilDipublish === true`.
3. Guru/pengampu mempublikasikan lewat `HasilKuisPanel` (toggle sama TKA, juga aktif untuk `lombaId`).
4. Di daftar kartu kuis lomba: tanpa skor sampai dipublish («nilai belum dipublikasikan»).

### §Lomba.26 Kirim jawaban Lomba (CF) + hasil roster + reset

1. **`nilaiKuisLms`:** selain kelas==siswa / TKA bank 6, izinkan kuis `kelas=='LB'` + `lombaId` jika `siswaId ∈ lomba.siswaIds`. Tolak tetap pesan «Kuis bukan untuk kelasmu.»
2. Dokumen `lms_jawaban` untuk Lomba **wajib** menyimpan `lombaId` (denormalisasi). Field `kelas` tetap **rombel siswa**, bukan `LB`.
3. **Rules baca `lms_jawaban`:** cabang `lombaId` + `lombaKontenBoleh` (pengampu/admin). Query hasil: `where kuisId + lombaId` — **jangan** `where kelas=='LB'`.
4. **Hasil:** tabel roster dari `lomba.siswaList` (semua peserta), gabung jawaban terbaru; status «Belum mengerjakan» bila null. Reset attempt = CF `resetJawabanKuisLms` mode `semua` (hapus `lms_jawaban` + marker progress lokal).
5. Deploy functions di repo SDM01Penilaian; rules di LMS. Index Firestore: `lms_jawaban` composite `kuisId` + `lombaId` bila konsol meminta.

### §Lomba.25 Mulai kerjakan = mode pengerjaan, bukan sekadar detail

1. Tombol **Mulai kerjakan** di daftar lomba siswa wajib membawa `?mulai=1` (atau setara) sehingga detail **auto-start** kuis yang jadwalnya buka — jangan hanya `Link` ke detail tanpa aksi.
2. Info Masa/Pengampu/Peserta di detail siswa diletakkan di **hero** (`.lomba-hero-meta`), bukan `lomba-kartu` + `lomba-kartu-meta` tanpa padding atas (konten menempel border).
3. Mode pengerjaan memakai kerangka `sw-kuis-kerja` / pola TKA, bukan layout ad-hoc.

### §Lomba.24 UI siswa Lomba: CTA daftar + kartu kuis non-generik

1. Daftar lomba siswa: tombol kaki **Mulai kerjakan** jika `daftarKuisLombaAktif` menghasilkan ≥1 kuis dengan jadwal buka (aktif + dalam `waktuMulai`/`waktuSelesai`); selain itu **Lihat detail**. Jangan hardcode selalu «Lihat detail».
2. Kartu kuis di detail memakai kelas `.lomba-kuis-*` + `.lomba-cta-mulai` (aksen oranye Lomba). Jangan mengandalkan hanya `.tka-kartu` polos di halaman Lomba — terasa template generik (§Lomba.6).
3. Hint «N kuis siap dikerjakan» opsional di kartu daftar bila ada yang buka.

### §Lomba.23 Kuis Lomba untuk siswa: rules + daftar aktif + mesin TKA

1. **Rules `lms_kuis` baca siswa Lomba** wajib ada:
   ```
   isSiswaLms() && aktif == true && 'lombaId' in resource.data
   && exists(.../lms_lomba/$(lombaId))
   && request.auth.token.siswaId in get(...).data.siswaIds
   ```
   Query klien: `where('lombaId','==', id), where('aktif','==', true)` — **tanpa** filter mapel (satu query untuk semua mapel + Gabungan). Jangan mengandalkan `kelas == token.kelas` (bank LB ≠ rombel siswa).
2. Setelah ubah rules: salin **file utuh** ke SDM01Penilaian → `npm run deploy:rules`. Hosting baru ≠ rules baru.
3. UI siswa: `SiswaLombaDetail` menampilkan kartu kuis aktif + **Mulai Kerjakan**. Pengerjaan **wajib** memakai pola TKA (`tka.css`, progress lokal, ragu, tinjau, timer, `nilaiKuisLms`). Jangan membuat halaman generik baru (§Lomba.6).
4. Progress lokal prefix terpisah (`lomba_progress_v1_`) agar tidak bentrok dengan TKA/kuis biasa.
5. Uji: peserta login → detail lomba → kartu kuis tampil → Mulai → kirim → skor muncul; non-peserta ditolak rules; kuis non-aktif tidak tampil.

### §Lomba.22 Rute siswa baru wajib didaftarkan di App.tsx (jangan jatuh ke `path="*"` → login)

1. Gejala: tombol «Lihat detail» pada kartu lomba siswa melempar siswa ke halaman login. Akar: rute `/siswa/lomba/:lombaId` belum ada; `path="*"` mengarah ke `/` yang lalu mengarahkan ke login.
2. Setiap `Link`/`navigate` ke `/siswa/...` harus punya `<Route>` di dalam blok `/siswa` (di bawah `WajibSiswa` + `SiswaLayout`) di `src/App.tsx`. Cek: cari semua `to="/siswa/` dan padankan dengan rute.
3. Halaman `SiswaLombaDetail` memverifikasi `siswaIds` memuat `sesi.id` (pesan ramah); penegak sebenarnya tetap rules `get` pada `lms_lomba`. Materi & kuis lomba untuk siswa belum ada (butuh rules baca + halaman terpisah).

## §129. Template & import bank soal: «Tanpa TP» dan parser CSV

129.1 Bank soal mapel biasa (termasuk Lomba, kelas bank `LB`) **boleh tanpa TP**: `tpId/tpNomor/tpNama` opsional di `lms_paket_soal` (rules tidak mewajibkannya — jangan menambah syarat TP di rules/klien). Kuis dari paket tanpa TP tetap sah (`tpIds` dihitung hanya dari paket yang punya `tpId`).

129.2 Pilihan «Tanpa TP» di dropdown unduh/import memakai konstanta `VALUE_TANPA_TP` (`'__tanpa__'`) dari `importSoal.ts` — **jangan** mencocokkan `tpList.find(id === ...)` untuk nilai ini (menghasilkan `null` dan membuat `validasiMetadata(..., null)` meloloskan file tanpa pengecekan TP). Mode tanpa TP **wajib** lewat `validasiMetadataTanpaTp`.

129.3 Mode tanpa TP menolak file yang memuat TP; mode «pilih TP» menolak file tanpa TP. Paket yang sudah ada tanpa `tpId` divalidasi dengan `validasiMetadataTanpaTp` (bukan `validasiMetadata`). Jangan melonggarkan ke «terima semua» — tujuannya mencegah soal ber-TP tercampur ke bank gabungan tanpa disadari. (Yang boleh kosong hanya `mapel`, lihat §130.3; larangan memuat TP tetap berlaku.)

129.4 Template per-TP dan «Tanpa TP» berbagi contoh soal lewat `contohSoalMapel()`; ubah contoh di satu tempat. Struktur template per-TP (`mapel, tpId, tpNomor, tpNama, catatan, soal`) tidak boleh berubah (dipakai validasi).

129.5 **Parser CSV:** `normalisasiSoalDariImport` membaca kunci camelCase (`opsiA`, `tipeMateri`, `kompleksitas`, `waktuMenit`, `kunciJawaban`). `parseCsvImport` WAJIB menyimpan nilai sel di bawah nama header asli **dan** huruf kecil. Regresi lama: hanya huruf kecil → semua soal PG/PGK CSV ditolak («minimal 2 opsi») dan template CSV tidak pernah bisa diimpor.

129.6 CSV dipecah dengan `pecahCsv` (bukan `split(',')`): kutip ganda, koma/baris baru di dalam sel, pemisah `,`/`;` otomatis, BOM dibuang. Jangan kembali ke `split(',')` — teks soal sering memuat koma (mis. «3,5») dan Excel regional Indonesia memakai `;`.

129.7 Setelah mengubah `importSoal.ts`, uji minimal: template JSON & CSV (per-TP, Tanpa TP, TKA) → parse tanpa galat dan lolos validasi yang sesuai; CSV ber-`;` dengan koma di teks; file ber-TP ditolak di mode Tanpa TP dan sebaliknya.

## §130. Import bank soal: galat susulan palsu, JSON toleran, `mapel` kosong di mode Tanpa TP

130.1 **Jangan menjalankan validasi metadata bila isi file gagal dibaca.** `parseJsonImport`/`parseCsvImport` menandai `gagalParse: true` untuk JSON rusak, isi bukan objek/daftar, dan CSV kosong. Kedua pemanggil di `BankSoalPanel.tsx` (`prosesImport` dan `prosesImportKePaket`) WAJIB memakai `hasil.gagalParse ? [...hasil.galat] : [...galatMeta, ...hasil.galat]`. Regresi lama: JSON rusak → `mapel: ''` → muncul «File import tidak memuat mata pelajaran» di atas «File JSON tidak valid», sehingga pengguna mencari kesalahan di tempat yang salah. Setiap pemanggil baru `parse*Import` harus meniru pola ini.

130.2 **JSON diparse toleran, tidak ketat.** `parseJsonImport` mencoba `JSON.parse` apa adanya, lalu `rapikanJson` (BOM/zero-width, pagar ```` ```json ````, teks di luar kurung terluar, komentar, koma sisa, baris baru/tab mentah dalam string). Jangan menghapus langkah rapikan: file hasil salinan AI hampir selalu tidak 100% valid. `rapikanJson` bersifat sadar-string (tidak menyentuh `//`, `,` atau `]` di dalam teks soal, mis. URL) — uji dengan teks soal yang memuat `http://` dan `, ]`. Kutip miring (“ ”) **sengaja tidak** diperbaiki otomatis (tidak bisa dibedakan dari isi teks); pesan galat menunjuk ke sana.

130.3 **`mapel` boleh kosong hanya di mode «Tanpa TP»** (`validasiMetadataTanpaTp`): file tanpa TP sering berupa daftar soal polos `[...]`; mapel diwarisi dari ruang/paket tujuan. Bila diisi, harus cocok. Mode «pilih TP» (`validasiMetadata`) dan TKA (`validasiMetadataTka`) tetap mewajibkan mapel — jangan ikut dilonggarkan. File yang memuat TP tetap ditolak di mode Tanpa TP (§129.3).

130.4 **Pesan galat parse harus menunjuk lokasi** (baris/kolom + cuplikan, dari `position N` pada pesan `JSON.parse`). Jangan kembali ke pesan datar «File JSON tidak valid.» tanpa petunjuk.

130.5 Uji setelah mengubah `importSoal.ts` (tambahan atas §129.7): JSON ber-BOM, berpagar kode, koma sisa, komentar, baris baru mentah, teks pembuka; daftar polos tanpa `mapel` di mode Tanpa TP (lolos) dan di mode pilih TP (ditolak «tidak memuat mata pelajaran»); JSON rusak → **tepat satu** galat; `null`/angka → pesan «harus berupa objek… atau daftar».

## §131. Area siswa v2: shell, Beranda, font (2026-11-17)

131.1 **Kontrak DOM dengan halaman kerjakan.** `SiswaKuis`, `SiswaTka`, `SiswaLombaDetail` memakai `document.querySelector('.sw-nav')` (diberi `display:none` saat mengerjakan) dan `'.sw-main'` (+ kelas `.sw-main--kuis`). Jangan mengganti nama class itu, jangan memecah `.sw-nav` menjadi beberapa elemen (sidebar PC dan nav HP adalah **satu** elemen `.sw-nav`; yang berubah hanya CSS-nya), dan jangan memindahkan `.sw-main` ke luar `.sw-body`. Saat `.sw-nav` disembunyikan di PC, `.sw-body` (flex:1) otomatis melebar penuh.

131.2 **Beranda tidak boleh menambah koleksi/query baru.** `useBerandaSiswa` hanya memakai `daftarTugasAktifKelas`, query `lms_nilai_tugas` (siswaId+kelas), dan `daftarMateriKelas` — query yang sama dengan halaman Tugas/Materi sehingga rules siswa sudah cukup (§0, §124.3). Tiap bagian gagal-sendiri (`catch` → console.warn → bagian disembunyikan); jangan mengubah menjadi `throw`/layar error yang menghalangi menu Beranda.

131.3 **Daftar materi berat.** Dokumen `lms_materi` (jenis `halaman`) memuat seluruh halaman. Beranda memuatnya **ditunda 300 ms setelah tugas** dan **di-cache di memori 5 menit per kelas**. Jangan memanggil `daftarMateriKelas` di Beranda tanpa cache, dan jangan menjadikannya syarat tampilnya menu.

131.4 **Font Nunito di-scope `.sw-app`.** `@font-face` ada di `siswa.css`, file `public/fonts/nunito-latin-wght-normal.woff2` harus ikut ter-push (biner). Bila file hilang, tampilan jatuh ke Inter tanpa galat. Jangan menerapkan Nunito ke `body`/area guru.

131.5 **Offset sticky mode kerjakan** memakai variabel `--sw-header-h` (3.75rem) pada `.sw-app` (`.sw-kuis-kerja-head`, `.sw-kuis-nav`). Bila tinggi header diubah, ubah variabel itu — jangan mengembalikan `top: 0` / `4.25rem` literal (kepala kuis tertutup header).

131.6 **Override visual halaman siswa selalu di-scope `.sw-app`** (`.sw-app .lms-card`, `.sw-app .kelas-hero`, dst.). `.lms-card`/`.kelas-hero` juga dipakai area guru; jangan mengubah aturan globalnya untuk kebutuhan siswa.

131.7 **Kontras ubin berwarna.** Teks di ubin menu/nav aktif berwarna **putih** di atas gradien `--t-from → --t-to`. Jangan memakai warna awal terang (kuning/oranye muda) tanpa uji kontras; palet saat ini sudah disesuaikan (`.sw-tone-*`).

131.8 **Penamaan menu/aktivitas tetap polos-deskriptif** (Materi, Tugas, Kuis, Pekan ini, Tugas untukmu, Pelajaranmu). Jangan memakai tagline/julukan («Detektif…», «Petualang…», «Agen…») — preferensi pemilik proyek.

131.9 **Tanda «Pekan ini»** (titik oranye) = tenggat tugas **belum dinilai** pada hari itu; bukan jadwal pelajaran. Cincin hero = tugas berstatus `dinilai` / seluruh tugas aktif kelas.

131.10 **Halaman masuk siswa** memakai modifier `auth-shell--siswa` pada wrapper `SiswaMasuk`; semua gaya baru di-scope ke class itu. Jangan mengubah `.auth-*` global — dipakai juga oleh `Login.tsx` (staf) dan `OrangtuaMasuk.tsx`.

131.11 **Input form di HP = 16px** (`font-size: 1rem`). Ukuran <16px membuat iOS Safari zoom otomatis saat fokus dan layout bergeser. Jangan kembali ke 0.875rem pada `.auth-field input/select` siswa.

131.12 **Viewer materi di bawah nav melayang.** `.mh-viewer-nav` sticky bottom harus `calc(5.5rem + env(safe-area-inset-bottom))` pada <1024px (hanya di `.sw-app`). Bila tinggi nav HP berubah, sesuaikan angka ini. Override viewer selalu di-scope `.sw-app` agar tampilan guru (editor/pratinjau) tidak ikut berubah.

131.15 **Pencapaian = baca saja, tanpa koleksi baru.** `lib/pencapaianSiswa.ts` hanya membaca `lms_jawaban` (query `where('siswaId','==', sesi.id)` — rules mengizinkan siswa membaca dokumen miliknya; query tanpa `siswaId` akan ditolak) dan `lms_nilai_tugas` (siswaId + kelas, sama dengan halaman Tugas). Jangan menulis bintang/lencana ke Firestore dari klien (`lms_jawaban` rules `create/update/delete: false`). Bila kelak ingin menyimpan (mis. riwayat lencana lintas perangkat), itu butuh koleksi + rules baru: berikan `firestore.rules` **utuh** dan catat di sini.

131.16 **Kriteria lencana hanya di satu tempat** (`susunLencana`); teks syarat di UI berasal dari sana. Mengubah ambang (mis. `AMBANG_NILAI_BAGUS = 80`) cukup di file itu. Kegagalan memuat ditampilkan ramah (`pesanGagalPencapaian`) dengan tombol coba lagi — jangan dibiarkan layar kosong/melempar galat.

131.17 **Mode kerjakan: CSS saja, dipakai bersama.** `.sw-kuis-kerja`, `-head`, `-nav`, `-nav-btn`, `-kerja-foot` dipakai oleh `SiswaKuis`, `SiswaTka` (`.tka-kerja`) **dan** `SiswaLombaDetail`. Ubah lewat override `.sw-app …` di `siswa.css`; jangan mengubah markup/urutan elemen tanpa menguji ketiganya. Di HP `.sw-kuis-nav-grid` dibatasi `max-height: 5.4rem` + gulir; nomor soal aktif bisa berada di luar area terlihat — header «Soal X dari N» dan tombol footer tetap menjadi acuan. Footer wajib punya `padding-bottom` berbasis `env(safe-area-inset-bottom)` di HP (tombol Kirim tidak boleh tertutup home bar).

## §132. Pengumpulan tugas siswa (foto) — `lms_pengumpulan` & `lms_pengumpulan_foto` (2026-11-17)

132.1 **Dua koleksi, foto di Firestore.** Meta `lms_pengumpulan/{tugasId_siswaId}` (catatan, `fotoIds`, `jumlahFoto`, `createdAt`, `updatedAt`) dan foto `lms_pengumpulan_foto/{tugasId_siswaId_slot}` (`slot` '1'..'3', `data` = data URL ≤ 300.000 karakter). Siswa TIDAK boleh menulis ke Storage (`storage.rules` sengaja tidak mengenal token siswa); jangan memindahkan foto ke Storage tanpa mengubah kedua file rules **utuh**.

132.2 **Urutan tulis di klien:** foto dulu, meta TERAKHIR (`kirimPengumpulan`). Kirim ulang = `updateDoc` TANPA `createdAt` (rules membatasi `affectedKeys` meta ke `catatan, fotoIds, jumlahFoto, updatedAt`; foto ke `data, updatedAt`). Jangan mengganti `updateDoc` menjadi `setDoc` penuh pada dokumen yang sudah ada — `createdAt == request.time` akan melanggar rules.

132.3 **Daftar guru hanya memuat meta**; foto dimuat per baris saat dibuka (`muatFoto`). Jangan menaruh data URL di dokumen meta atau memuat semua foto kelas sekaligus (30 siswa × ±500 KB).

132.4 **Query wajib sesuai rules.** Siswa: `where('siswaId','==', sesi.id)` saja. Guru: `where tugasId + mapel + kelas` (satu query per rombel; `daftarPengumpulanTugas`). Tanpa `mapel`+`kelas`, evaluasi list ditolak permission (pola §128).

132.5 **Rules (helper `lmsSiswaBolehKumpul`, `lmsSudahDinilai`):** siswa hanya untuk tugas **aktif** rombelnya (kelas utama atau `kelasList`), `mapel` dokumen = `mapel` tugas, ID dokumen deterministik, dan **terkunci** bila `lms_nilai_tugas/{tugasId_siswaId}` ada (ID itu = `idNilai()`; bila format ID nilai diubah, kunci ini ikut tidak berfungsi — ubah bersamaan). **Tenggat TIDAK ditegakkan di rules**; «Terlambat» hanya tanda di UI guru (`updatedAt` > tenggat).

132.6 **Deploy:** `firestore.rules` harus dideploy dari SDM01Penilaian (salin file UTUH, §0). Sebelum deploy, uji dengan emulator/akun nyata: (a) siswa kumpul 1 & 3 foto, (b) kirim ulang dengan 2 foto (slot 3 terhapus), (c) setelah guru menyimpan nilai, siswa gagal kirim ulang, (d) siswa kelas lain gagal, (e) guru pengampu melihat; guru lain tidak.

132.7 **Foto hanya boleh dipasang lewat `<img src>` setelah `dataUrlGambarAman`** (awalan `data:image/`). Jangan merender `data` sebagai HTML atau tautan `href`.

132.8 **Status filter Tugas tidak berubah** (`belum | dinilai | lewat`, §124.2). «Terkumpul» hanya lencana tambahan; jangan menjadikannya status yang mengubah hitungan Beranda/Pencapaian tanpa menguji keduanya.

### §Lomba.29 Kartu peserta Lomba (cetak A4, 8 kartu/lembar) — 2026-11-18

1. **Jendela cetak dibuka SINKRON.** `cetakKartuPeserta` (`lib/kartuLomba.ts`) memanggil `window.open` sebagai pernyataan pertama dan dipanggil langsung dari handler klik di `KartuPesertaDialog` (pola §127.32). Jangan memindahkannya ke setelah `await` (popup diblokir browser). Bila gagal, jendela ditutup dan galat berbahasa Indonesia ditampilkan di dialog.
2. **NISN = kata sandi login siswa — jangan disalin ke dokumen `lms_lomba`.** Dokumen lomba dapat dibaca setiap peserta (`get` oleh `siswaIds`), sehingga menyimpan `nisn` di `siswaList` akan membuka sandi semua peserta kepada sesama peserta. NISN selalu dibaca dari `siswa/{id}` saat cetak (`muatDataKartu`). Field `PesertaLomba.nisn` tetap opsional dan hanya menjadi cadangan; `LombaForm` sengaja tidak mengisinya.
3. **Geometri kartu tetap.** `.lembar` = 210 × 296,5 mm (§127.30), padding 8 mm, grid `97mm 97mm` × 4 baris `70.1mm` → 8 kartu. Pemecahan halaman dihitung sendiri (`KARTU_PER_HALAMAN`, satu `<section class="lembar">` per 8 kartu); jangan mengandalkan `break-inside`/kolom CSS (§127.26). `@page { margin: 0 }`. Jangan menaikkan tinggi baris/padding tanpa mengecek total ≤ 296,5 mm (akibatnya lembar kosong di tengah).
4. **Logo diubah jadi data URI** dari `/logo-sdm.png` (`muatLogo`); periksa `blob.type` berawalan `image/` karena SPA fallback mengembalikan `index.html` berstatus 200 bila berkas hilang. Jangan memakai `src="/logo-sdm.png"` relatif di jendela baru (tidak ikut tersimpan saat «Simpan PDF» dan bergantung pada base URL). Logo hilang → kartu tetap tercetak tanpa logo.
5. **Alamat LMS = konstanta** `DOMAIN_LMS_PUBLIK` + `PATH_MASUK_SISWA` (`/siswa/masuk`), bukan `window.location.origin` (domain preview `*.web.app` berbeda dan «/» mengarah ke login staf). Bila domain berubah, ubah di satu tempat itu.
6. **Nomor kartu** dihitung dari urutan seluruh peserta (kelas, lalu nama; `susunPesertaBernomor`) sebelum difilter, agar mencetak ulang satu kartu tidak mengubah nomornya.
7. **Hanya admin/pengampu** (halaman `LombaDetail` sudah dibatasi `bolehKelolaKontenLomba`). Bila rules koleksi `siswa` kelak diperketat (saat ini `get`/`list` terbuka), pastikan admin LMS dan guru pengampu non-admin tetap boleh `get siswa/{id}` — jika tidak, kartu tercetak dengan «NISN belum terdaftar».
8. **CSS:** gaya dialog di `styles/kartuLomba.css` (`kp-*`); gaya kartu cetak inline di `kartuLomba.ts` (konstanta `CSS`). Jangan menambah aturan ke `lomba.css` untuk ini dan jangan memakai ulang nama kelas `kp-*`/`kartu`/`lembar` di tempat lain (§Lomba.9). State dialog di `LombaDetail` (`kartuBuka`) dideklarasikan di atas `return` bersyarat (§108.4).
9. **Uji sebelum deploy:** (a) lomba 20 peserta → 3 lembar, tidak ada lembar kosong di Chrome print preview (A4, skala 100%, margin None); (b) siswa tanpa NISN → kartu menampilkan «Belum terdaftar» + peringatan di atas pratinjau; (c) nama panjang (±40 huruf) dan nama lomba panjang tidak memotong baris «Cara masuk LMS»; (d) cetak sebagian peserta → nomor tidak bergeser; (e) pop-up diblokir → pesan jelas di dialog; (f) akun guru pengampu non-admin dapat mencetak.

## §Materi.GambarZoom (2026-11-18)

1. Zoom memakai overlay `position: fixed` + `transform: scale/translate` — **jangan** ubah `src` gambar atau unduh ulang.
2. Saat overlay terbuka: `body { overflow: hidden }`; restore saat tutup.
3. Touch: `touch-action: none` di stage; pinch dihitung dari jarak dua jari. Jangan pasang library zoom berat tanpa kebutuhan.
4. Inline tetap `object-fit: contain` + max-height viewport; detail dibaca di overlay, bukan dengan memaksa gambar inline selebar mungkin hingga merusak layout.
5. Panduan ukuran: `docs/PANDUAN_GAMBAR_MATERI.md` (1080×1350). B5 cetak ≠ kanvas LMS.

---

## §Materi.ViewerGambarBesar (2026-11-18)

1. Jangan kembalikan `max-height` tetap kecil (22–30rem) pada `.mh-blok--gambar img` — membuat poster portrait kecil di PC.
2. Di desktop **jangan** `width: auto` saja tanpa lebar kartu; pakai `width: 100%` + `object-fit: contain` agar mengisi kartu.
3. Halaman hanya gambar → class `mh-page--poster` (padding tipis). Deteksi di `MateriHalamanViewer`, bukan di data.
4. Di area siswa (`.sw-app`) cadangkan ruang nav bawah HP saat hitung `max-height` (≈14rem).
5. Tetap `object-fit: contain` — jangan `cover` (memotong isi materi).

---

## §Materi.MediaPreview (2026-11-18)

1. Pratinjau form File memakai `URL.createObjectURL` — **wajib** `URL.revokeObjectURL` saat viewer ditutup agar tidak bocor memori.
2. YouTube: hanya embed jika `ekstrakYoutubeId` berhasil; jangan iframe URL mentah.
3. PDF lokal (blob) sering gagal di iframe (Chrome); tampilkan hint + «Buka di tab baru» setelah simpan (URL Storage).
4. Jangan mengganti tombol Baca halaman/HTML; media viewer terpisah (`MateriMediaViewer`).
5. Siswa tetap boleh «Buka» eksternal di `SiswaMateri` (perubahan ini fokus panel guru); boleh diseragamkan nanti.

---

## §Materi.GambarBerurutan (2026-11-18)

1. Form File mendukung `multiple`. Jika **>1 file** dan **semua image/** → `tambahMateriGambarBerurutan` → jenis `halaman`, satu blok gambar per halaman, urutan = urutan FileList.
2. Satu file gambar tetap `tambahMateri` → jenis `gambar` (buka di tab baru), bukan dipaksa ke halaman.
3. Campuran gambar + PDF/video dalam satu pemilihan: tolak di klien dengan pesan jelas (jangan diam-diam ambil hanya gambar).
4. Batas: `BATAS_HALAMAN_PER_MATERI` (20). Kompresi lewat `unggahGambarHalaman` (target HP).
5. Viewer siswa/guru: sudah ada `MateriHalamanViewer` — tidak perlu jenis baru di rules.
6. Berlaku seragam di MateriPanel (mapel kelas, TKA `adalahMapelTka`, Lomba `lombaId`).

---

## §MateriHtml — Materi jenis HTML + gambar eksternal (2026-11-18)

1. **Jenis `'html'`** dan field **`kontenHtml`** (string, maks. 400_000 karakter). Jangan menyimpan HTML mentah tanpa `bersihHtmlLengkap`.
2. **Sanitasi terpisah** dari `bersihHtmlMateri` (blok halaman). `bersihHtmlLengkap` mengizinkan `img` (src/alt/…), `a` (href/target/rel), `figure`, heading, table, dll. — **tanpa** script, on*, style berbahaya, data: URI jahat.
3. Gambar eksternal (imgbb, postimages, drive.google.com/uc, CDN) **sengaja** diizinkan agar URL di kode HTML guru tetap ter-load. Hotlink/CORS adalah tanggung jawab sumber; LMS tidak mem-proxy.
4. Rules: `jenis` **wajib** memuat `'halaman'` **dan** `'html'`. Deploy rules setelah ubah (file utuh ke SDM01Penilaian). Tanpa itu create/update HTML & halaman ditolak permission.
5. Viewer: selalu lewat `MateriHtmlViewer` + `dangerouslySetInnerHTML` **setelah** `bersihHtmlLengkap`. Jangan render `kontenHtml` mentah.
6. Lomba: setiap create materi (file/youtube/tautan/html/**halaman**) di scope lomba **wajib** menyertakan `lombaId` di dokumen (rules `lombaKontenBoleh`).

## §Materi.TpOpsionalLombaTka (2026-11-18)

1. `MateriPanel`: `tanpaTpWajib = Boolean(lombaId) || adalahMapelTka(mapel)`. Jangan mengembalikan `disabled={tpList.length === 0}` tanpa guard ini — di Lomba daftar TP sering kosong → seluruh tombol mati.
2. Jangan mewajibkan `tpId` di `tambahMateri` / `tambahMateriHalaman` bila `lombaId` terisi. Field `tpId` opsional di rules.
3. Mapel kelas (tanpa `lombaId`, bukan TKA): tetap wajib TP — jangan longgarkan global.
4. UI: sembunyikan blok «Tujuan Pembelajaran *» saat `tanpaTpWajib`; tombol Simpan tidak bergantung `tpId`.

## §Lomba.Materi — Materi lomba hanya peserta (2026-11-18)

1. Dokumen `lms_materi` dengan field `lombaId` **tidak** boleh dibaca lewat cabang `kelas == token.kelas` / `kelasList`. Rules wajib menolak non-peserta.
2. Query siswa: `where('lombaId','==', lombaId)` saja. Jangan query kelas `LB` tanpa filter lombaId.
3. Klien `SiswaLombaDetail`: muat materi **hanya** setelah `l.siswaIds.includes(sesi.id)`.
4. `daftarMateriKelas` (halaman Materi mapel) wajib skip `m.lombaId` agar materi lomba tidak muncul di kurikulum kelas.
5. Pratinjau HTML guru: `bersihHtmlLengkap` + `MateriHtmlViewer` sebelum simpan; id lokal `pratinjau-lokal` tidak ditulis ke Firestore.

## §MateriHtml.Iframe (2026-11-18)

1. Jangan DOMPurify-kan modul interaktif (style/script/details/svg) saat **simpan** — gunakan `siapkanSimpanHtml`.
2. Tampil dokumen penuh hanya lewat **iframe srcdoc** + sandbox **tanpa** `allow-same-origin`. Jangan `dangerouslySetInnerHTML` untuk dokumen penuh.
3. `allow-scripts` boleh; jangan tambah `allow-same-origin` (bocor ke parent).
4. Cuplikan sederhana tetap `bersihHtmlLengkap` + inline.
5. Materi yang sudah ter-strip di Firestore harus diunggah ulang oleh guru.

## §19. Bank Soal / Kuis

19.1 Koleksi `lms_kuis` dan `lms_soal` harus didaftarkan di `firestore.rules` (shared). Guru hanya boleh baca/tulis kuis dan soal pada kelas + mapel yang diampu (mirip pola `lms_materi`). Admin boleh baca. **Rules belum di-deploy.**

19.2 Gambar soal diunggah ke `lms/kuis/{kuisId}/...` dengan batas 5 MB. Jangan menyimpan file besar atau non-gambar di path ini.

19.3 Saat menghapus kuis, semua dokumen `lms_soal` terkait harus ikut dihapus (sudah dilakukan di `hapusKuis`).

19.4 Jumlah soal di `lms_kuis.jumlahSoal` adalah denormalisasi. Jangan mengandalkannya sebagai sumber kebenaran; selalu hitung ulang dari `lms_soal` bila perlu.

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

18.4 Catat Menulis hanya untuk guru Tahsin (`isGuruTahsinRole`); admin memantau (§17). Setiap catatan menyimp

## §54 — Fitur Tugas: query wajib where kelas + mapel

- Koleksi `lms_tugas` mengikuti pola `lms_materi` / `lms_kuis`: baca/tulis hanya guru kelas×mapel (tulisMapelKelas / lihatMapelKelas).
- Klien WAJIB query dengan `where('kelas', '==', …)` DAN `where('mapel', '==', …)`. Tanpa kedua filter, rules menolak.
- Halaman agregat sidebar (`TugasDanKuis`) melakukan loop per ruang kelas lalu query per pasangan, bukan satu query tanpa filter.
- Jangan mengaktifkan `orderBy` di query pertama bila composite index belum dibuat; fallback sort di klien sudah ada di `daftarTugas`.

## §56. Import soal ke paket yang sudah ada

- Tombol Import pada kartu paket menambahkan soal ke array `soal` yang sudah ada (append), bukan mengganti.
- Validasi metadata (mapel + TP) tetap wajib dan harus cocok dengan paket tujuan. Jika berbeda, tampilkan pesan dan jangan simpan.
- Import untuk paket baru (form terpisah) tidak boleh dihapus; keduanya hidup berdampingan.

## §58. Batas soal per paket = 300

- Konstanta `BATAS_SOAL_PER_PAKET` di `src/types/soal.ts` adalah 300.
- Validasi di `simpanPaket` dan UI editor (tombol tambah) menggunakan konstanta ini.
- Jangan turunkan kembali ke 100 tanpa keputusan eksplisit; bank soal dirancang untuk menampung banyak soal.

## §61. Fitur Analisis stimulus hanya untuk user tertentu

- Tombol dan panel Analisis hanya muncul jika `user.uid === 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'`.
- Deteksi bersifat heuristik (kata kunci). Bukan pengganti review manual.
- Jangan mengaktifkan untuk semua user tanpa keputusan eksplisit.

## §63. Validasi impor soal harus ketat

- Import harus menolak soal yang tidak lengkap sesuai tipenya (isian tanpa kunci, jodoh tanpa pasangan, bs tanpa pernyataan, dll.).
- Deteksi duplikat berdasarkan teks yang dinormalisasi.
- Fitur analisis harus bisa menandai soal yang kurang pembahasan atau struktur.

## §64. Kuis dari bank soal (snapshot)

64.1 Kuis baru **wajib** disusun dari `lms_paket_soal` berstatus `siap`. Jangan menghidupkan lagi editor soal berdiri sendiri di tab Kuis (`KuisBuilder` / `lms_soal` create).

64.2 Field `lms_kuis.soal` adalah **snapshot** (salinan penuh). Jangan mengandalkan baca live ke paket saat siswa mengerjakan; paket bisa diubah atau dihapus.

64.3 Poin awal setiap soal snapshot = **1**. Perubahan bobot hanya di dokumen kuis, bukan di bank.

64.4 Query `lms_kuis` tetap `where kelas + mapel`. Rules menolak create tanpa `soal` list. Create ke `lms_soal` ditolak (legacy delete-only).

64.5 Mode `otomatis_ai` dan deteksi mirip hanya UI-gated lewat `bolehGenerateSoalAi` (UID+email). Logika deteksi kasar di klien; panggilan AI server untuk esensi belum ada — jangan mengaku “AI menganalisis esensi” sampai function siap.

64.6 Batas: ≤100 soal per kuis, ≤12 paket sumber. Ukuran dokumen Firestore 1 MiB — hindari menyalin gambar data-URL besar ke dalam snapshot (gambar tetap lewat `lms_gambar` id).

## §65. Pengelompokan soal kuis menurut bentuk

- Urutan bagian memakai `URUTAN_TIPE` dari `src/types/soal.ts` (pg → pgk → jodoh → bs → isian → uraian).
- Instruksi setiap bentuk ada di konstanta `INSTRUKSI_TIPE` di `KuisDetail.tsx`. Jangan mengubah teks instruksi tanpa keputusan eksplisit (berpengaruh ke siswa dan nantinya cetak).
- Tombol “Kelompokkan menurut bentuk” hanya mengubah urutan array `soal` di state. Persistensi terjadi saat guru menekan Simpan perubahan.
- Tampilan selalu mengelompokkan (meski array di dokumen belum terurut). 
- Bila `acakSoal` aktif, kebijakan acak sebaiknya tetap menghormati kelompok bentuk (acak di dalam bagian), atau sesuai keputusan sekolah nanti saat implementasi siswa.

## §66. Batas soal paket di rules = 300

- `firestore.rules` untuk `lms_paket_soal` (create & update) memakai `soal.size() <= 300`.
- Jangan turunkan kembali ke 100; kode di `src/types/soal.ts` (`BATAS_SOAL_PER_PAKET`) sudah 300.
- Setelah mengubah rules, WAJIB salin file lengkap ke repo SDM01Penilaian dan jalankan `npm run deploy:rules`. Perubahan di GitHub LMS saja tidak langsung berlaku.
- Ubah status Siap ↔ Draf hanya boleh jika dokumen tetap memenuhi semua validasi rules (kelas/mapel tidak berubah, dibuatOleh sama, dll.).

## §67. Batas prompt ilustrasi AI

- Deskripsi ilustrasi AI (petunjukGambar) minimal 3000 karakter di UI dan di server.
- Jangan turunkan kembali ke 500/600; prompt pendek sering menghasilkan ilustrasi tidak stabil atau tidak sesuai.
- Setelah mengubah `functions/generateSoalLmsAi.js`, deploy ulang Cloud Functions dari repo SDM01Penilaian.

## §68. Proporsi soal kuis otomatis

- Bila `jumlahPerTipe` tidak diisi, `susunOtomatis` memakai `hitungProporsiTipe` berdasarkan `BOBOT_TIPE` (PG terbanyak, uraian tersedikit).
- Jangan mengubah bobot tanpa keputusan eksplisit; proporsi ini mengikuti prinsip soal lebih mudah lebih banyak.
- Jika user secara eksplisit mengisi `jumlahPerTipe`, proporsi otomatis diabaikan.
- Sisa kuota setelah proporsi tetap diisi acak dari kandidat yang cocok (tidak memaksa tipe yang stoknya habis).

## §69. Pengaturan kuis Fase 1 (waktu, token, jenis, TP)

- Field baru pada `lms_kuis`: `waktuMulai`, `waktuSelesai`, `token`, `jenisPenilaian`, `tpIds`, `tpNamaList`.
- `jenisPenilaian` hanya boleh `latihan` | `slm` | `sts` | `sas`. Default `latihan` (hasil tidak masuk nilai).
- Untuk STS/SAS, `tpIds`/`tpNamaList` boleh berisi lebih dari satu TP (untuk analisis capaian per TP nanti).
- Rules harus tetap mengizinkan field ini sebagai opsional. Jangan menghapus validasi kelas/mapel/dibuatOleh.
- Setelah mengubah rules, salin file lengkap ke SDM01Penilaian dan deploy (`npm run deploy:rules`).

## §71. Skeleton penilaian kuis

- Function `nilaiKuisLms` masih skeleton. Jangan menganggap skor sudah benar sebelum logika perbandingan kunci diimplementasi.
- Kunci jawaban tidak boleh dikirim ke klien. Semua perbandingan dilakukan di Cloud Function.
- Deploy: `firebase deploy --only functions:nilaiKuisLms` dari repo SDM01Penilaian.

## §72. Koleksi lms_jawaban

- Jawaban siswa disimpan di `lms_jawaban`, terpisah dari dokumen kuis yang berisi kunci.
- Siswa hanya boleh membuat dokumen dengan `siswaUid == request.auth.uid`.
- Jangan membuka update dari klien; koreksi guru (jika perlu) dilakukan lewat jalur lain atau admin.
- Setelah mengubah rules, salin file lengkap ke SDM01Penilaian dan deploy (`npm run deploy:rules`).

## §54. Layout area siswa & halaman baru (full-width responsive)

54.1 **Konten halaman siswa memakai lebar penuh shell** (`.sw-main` max-width 1600px, padding responsif). Jangan membungkus daftar/kartu/konten utama dengan `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl`, `max-w-3xl`, atau `max-width` ≤ 48rem kecuali untuk **satu kartu pesan kosong / placeholder terpusat** (mis. `.sw-placeholder`).

54.2 **Pola yang dilarang (regresi berulang):** `className="… max-w-2xl mx-auto"` atau container sempit di tengah layar PC yang meninggalkan ruang kosong lebar di kiri-kanan. Pola ini sudah muncul di `SiswaKuis` dan beberapa halaman baru lainnya.

54.3 **Grid fluid:** daftar kartu (menu, mapel, materi, kuis) memakai CSS grid `minmax(0, 1fr)` dengan breakpoint:
- HP: 1–2 kolom
- tablet (≥768px): 2–3 kolom
- PC (≥1024/1200px): 3–5 kolom sesuai jenis kartu
Jangan memaksa satu kolom sempit di desktop.

54.4 **Navigasi siswa:** HP = bottom nav fixed; tablet/PC (≥768px) = strip horizontal di bawah header (bukan bottom fixed), agar konten tidak selalu mengosongkan ruang bawah besar.

54.5 Aturan ini berlaku untuk **semua halaman baru** di area siswa (`src/pages/siswa/*`) dan sebaiknya diikuti juga untuk halaman guru yang bukan editor khusus (bukan SoalEditor). Sebelum merge halaman baru, cek di viewport ~1280px dan ~375px apakah konten mengisi lebar secara wajar.
54.6 **Regresi 2026-11-09 (SiswaKuis):** rewrite fitur progres/timer mengembalikan `max-w-2xl mx-auto` di daftar dan `max-w-5xl mx-auto` di mode kerjakan. Checklist sebelum merge halaman siswa: (1) tidak ada `max-w-md`…`max-w-5xl` pada wrapper konten utama, (2) uji PC ~1280px konten mengisi `.sw-main`, (3) hanya placeholder/dialog boleh sempit + `mx-auto`.

## §73. Kuis siswa (pengerjaan online)

73.1 Halaman pengerjaan siswa **wajib** memakai `SoalTampil` (bukan form ad-hoc). Semua tipe (`pg`, `pgk`, `jodoh`, `bs`, `isian`, `uraian`) dan gambar (`gambarId` → `GambarSoal` / `lms_gambar`) harus tampil.

73.2 Progres jawaban disimpan di `localStorage` (`lms_kuis_progress_v1_{siswaId}_{kuisId}`). Jangan menghapus progres kecuali setelah kirim sukses (`clearProgress`).

73.3 Saat mengerjakan: pasang `beforeunload`, dialog konfirmasi Keluar, dan sembunyikan `.sw-nav` agar siswa tidak pindah halaman tanpa sengaja.

73.4 Rules `lms_kuis` read: guru lewat `lihatMapelKelas`; siswa LMS hanya kuis **aktif** kelasnya (`resource.data.kelas == request.auth.token.kelas && resource.data.aktif == true`). Snapshot memuat kunci — diterima untuk latihan; ujian berisiko tinggi harus dilayani Cloud Function yang menyaring kunci (belum diimplementasi).

73.5 Import `styles/soal.css` di rute siswa yang menampilkan `SoalTampil`, atau pastikan stylesheet sudah dimuat global.

## §74. Firestore rules — selalu dari sumber terbaru

74.1 **Setiap** perubahan `firestore.rules` wajib dimulai dari file terbaru di repo yang di-deploy (biasanya `main` LMS atau salinan di SDM01Penilaian setelah deploy terakhir). Jangan memakai salinan di zip perbaikan lama sebagai basis — itu sumber regresi berulang (batas soal 100 vs 300, akses siswa kuis, dll.).

74.2 Batas `lms_paket_soal.soal.size()` di rules **harus** sama dengan `BATAS_SOAL_PER_PAKET` di `src/types/soal.ts` (saat ini **300**). Validasi update memakai seluruh dokumen hasil; ganti status saja ikut memeriksa ukuran array `soal`.

74.3 Setelah mengubah rules: salin file **utuh** ke SDM01Penilaian, `npm run deploy:rules`, uji update status paket siap↔draf dengan paket yang soalnya >100 bila ada.

## §75. Hasil kuis siswa (`lms_jawaban`)

75.1 Setiap **Selesai & Kirim** membuat dokumen baru di `lms_jawaban` (bukan menimpa). Field wajib: `kuisId`, `siswaId`, `percobaan`, `skorOtomatis`, `totalPoin`, `jawaban`, `status`.

75.2 **Latihan** boleh diulang dari UI siswa hanya lewat konfirmasi «Kerjakan lagi dari awal» (progres lokal dihapus). SLM/STS/SAS tidak menawarkan ulang dari klien.

75.3 Tulis `lms_jawaban` hanya Cloud Function / Admin SDK. Rules klien: `create/update/delete: if false`.

75.4 Query siswa: `where siswaId == claim && where kuisId == …`. Siapkan indeks komposit bila Console meminta.

## §55. Hasil kuis (`lms_jawaban`) & analisis guru

55.1 Koleksi `lms_jawaban` wajib ada di `firestore.rules` (shared). **Tulis hanya Admin SDK** (Cloud Function `nilaiKuisLms`). Klien: siswa baca miliknya (`siswaId` == claim); guru baca lewat `lihatMapelKelas(mapel, kelas)` pada field dokumen; admin baca.

55.2 Jangan mengaitkan keberadaan analisis dengan `jenisPenilaian`. **Latihan** (`latihan`) tidak masuk nilai rapor, tetapi setiap kiriman tetap menghasilkan dokumen `lms_jawaban` dan harus bisa dilihat guru di tab **Hasil siswa**.

55.3 Jangan menulis kunci jawaban ke dokumen `lms_jawaban` di luar yang sudah dinilai server (`detail.benar` / skor). Kunci penuh tetap hanya di snapshot `lms_kuis.soal` (baca guru) dan di CF.

55.4 File `firestore.rules` di-deploy hanya dari repo SDM01Penilaian (`npm run deploy:rules`). Perubahan bagian LMS disalin sebagai file **utuh** ke SDM01Penilaian sebelum deploy.

55.5 Penilaian manual (uraian / koreksi isian) **hanya** lewat Cloud Function `nilaiManualKuisLms`. Jangan membuka `allow update` klien pada `lms_jawaban`. Skor per soal disimpan di `detail[]`; total di `skorOtomatis` dihitung ulang server.

55.6 Isian dinilai otomatis dengan normalisasi spasi/kapital dan kesetaraan angka. Tetap sediakan UI koreksi guru karena sinonim/ejaan tidak dicocokkan.

## §56. Analisis kuis AI

56.1 Fitur analisis hasil kuis dengan AI (**hanya** UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1` + email `arif.azwar79@gmail.com`). Cek di klien (`bolehAnalisisKuisAi`) dan **wajib** di CF (`bolehPemanggilAi`). Jangan memperluas daftar akun tanpa keputusan eksplisit.

56.2 Kunci Gemini hanya di secrets Cloud Functions. Jangan memanggil API AI dari browser.

56.3 Analisis membaca agregat `lms_jawaban` di server; jangan mengirim kunci jawaban atau data siswa berlebih ke model di luar yang diperlukan untuk statistik/contoh jawaban salah.

## §57. Kuis offline

57.1 `modePelaksanaan` default `online`. Offline: guru input di tab Input offline; portal siswa menyembunyikan kuis offline.

57.2 Penulisan `lms_jawaban` offline hanya lewat CF `simpanJawabanOfflineKuis` (Admin SDK). Field `sumber: 'offline'`.

57.3 Bantu AI offline memakai gate yang sama §56 (UID+email); skor diterapkan lewat `nilaiManualKuisLms`.

57.4 **Jangan menulis `undefined` ke Firestore.** Soal yang belum diisi di form offline menghasilkan `jawaban[soalId] === undefined`. CF wajib sanitasi (`undefined` → `null` / omit) sebelum `add`/`set` — tanpa itu Admin SDK melempar 500: `Cannot use "undefined" as a Firestore value`.

## §58. Sinkron kuis → nilai Penilaian

58.1 Penulisan `nilai_tp` / `nilai_sts` / `nilai_sas` dari LMS hanya lewat CF `sinkronNilaiKuisLms` (Admin SDK). Jangan tulis langsung dari klien LMS tanpa rules yang setara Penilaian.

58.2 Hanya jenis SLM/STS/SAS. Skor = (skorOtomatis/totalPoin)×100; satu nilai per TP terdaftar di kuis (atau `nilaiPerTp` bila diisi).

58.3 TP harus resolve ke `tp_kktp` (id atau nama + mapel/kelas). Gagal resolve → tolak sinkron dengan pesan jelas.

## §58. Sinkron kuis → nilai Penilaian (lanjutan)

58.4 Tombol sinkron **hanya** di tab Hasil siswa (`HasilKuisPanel`). Jangan membuat halaman rekap terpisah hanya untuk sinkron — dropdown kelas/mapel di halaman rekap sering kosong bila penugasan belum lengkap, dan alur guru lebih natural dari detail kuis.
58.5 Hapus menu sidebar «Rekap Kuis» bila sudah ada sinkron di Hasil siswa.

## §59. Import tertimpa saat menambah fitur di komponen besar

59.1 Saat menambah import baru di file besar (mis. `HasilKuisPanel.tsx`), **tambahkan** baris import baru; jangan mengganti blok import lama. Menimpa blok import menimbulkan puluhan error TS2304 + TS7006 sekaligus (error `implicit any` hanyalah turunan dari tipe yang hilang).
59.2 Sebelum push/deploy, jalankan `npx tsc -b` di lokal. Bila error muncul beruntun, periksa dulu bagian import di baris atas file sebelum menelusuri logika.
59.3 `HasilKuisPanel.tsx` memakai dua sumber import yang harus tetap ada bersamaan: `../lib/analisisKuisAi` (analisis AI & laporan) dan `../lib/sinkronNilaiKuis` (sinkron ke Penilaian).

## §76. Modul TKA (kelas 6)

76.1 **Akses TKA ditegakkan di tiga tempat yang harus sinkron:** `src/lib/tkaAkses.ts` (tampilan/rute), `firestore.rules` (`tkaAdmin`, `tkaGuruKelas6`, `tkaStaf`, `tkaSiswa`), dan Cloud Function TKA. Menyembunyikan menu saja BUKAN pengamanan. Mengubah salah satunya (mis. menambah guru, mengganti email admin) berarti mengubah ketiganya.

76.2 **Siapa:** admin TKA = UID `v4fQXsqCzYUtHrqcDM0u48sxIfn1` + email `arif.azwar79@gmail.com` (pola sama dengan §56). Guru kelas 6 = `waliKelas` memuat **6A, 6B, atau 6C** (jangan hardcode hanya 6A/6B; kelas 6C ada di `DAFTAR_KELAS_SD`), role `guru`/`guru_akademik`. Siswa = claim `kelas` diawali kelas 6 yang sama.

76.3 **Token try out tidak boleh ada di `tka_paket`** (siswa kelas 6 membaca paket aktif). Token hanya di `tka_token/{paketId}`; rules `tka_paket` menolak field `token`. Pemeriksaan token siswa dilakukan Cloud Function (Admin SDK). TKA lama menyimpan token di dokumen paket dan mengeceknya di browser — jangan dibawa kembali.

76.4 **Kunci jawaban tidak boleh terbaca siswa:** `tka_soal` hanya staf TKA. Jangan membuat koleksi «publik» berisi kunci/hash (pola `soalPublik` + hash SHA-256 di klien dari TKA lama dihapus dari desain). Soal ke siswa dikirim Cloud Function tanpa kunci; penilaian di server.

76.5 **Query vs rules:** siswa membaca `tka_paket` dengan `where('aktif', '==', true)` dan `tka_percobaan` dengan `where('siswaId', '==', <siswaId sendiri>)`. Tanpa filter itu rules menolak seluruh query ("Missing or insufficient permissions"), bukan hanya dokumen yang tidak boleh.

76.6 **Semantik `aktif`:** paket aktif hanya bila `aktif === true`. Paket TKA lama tanpa field `aktif` dianggap nonaktif (perilaku `susun-paket.html`); skrip migrasi menjaga ini.

76.7 **Pemetaan siswa migrasi:** NISN → nama+kelas (dinormalisasi). Lebih dari satu kandidat = ambigu, **tidak ditebak**. Percobaan siswa tak terpetakan **tidak ditulis** dan tercantum di laporan. Selalu dry-run dan baca `pemetaanSiswa` + `percobaanDilewati` sebelum `--apply`.

76.8 **Skrip migrasi:** project sumber/tujuan dikunci, dokumen berbeda tidak ditimpa tanpa `--overwrite`, kunci service account tidak boleh di-commit. firebase-admin dimuat dari `functions/` (jalankan `npm install` di sana).

76.9 **Rules:** mengikuti §74 — basis selalu `firestore.rules` terbaru di SDM01Penilaian. Pada 2026-11-10 salinan di repo LMS ternyata tertinggal dari SDM01Penilaian (batas soal 100 vs 300, `lms_kuis` siswa, `lms_jawaban`); kedua salinan disamakan di Tahap 1. Aturan tulis `tka_paket` sementara longgar untuk staf TKA dan akan diperketat di Tahap 3 bersama alur pengajuan try out.

76.10 **Navigasi siswa:** item TKA ditambahkan dinamis (`SiswaLayout`), bukan di array `NAV` tetap, agar siswa kelas lain tidak melihatnya. Item nav memakai `flex: 1` sehingga 5 item muat di HP; cek lebar ~375px saat menambah item lagi. Ikon baru harus ditambahkan di `SiswaIconName` DAN di `switch` `SiswaIcon` sekaligus.

## §77. Koreksi arah TKA: ruang khusus di pipeline kuis (menggantikan §76.3–76.5)

77.1 **TKA tidak punya koleksi sendiri.** §76.3–76.5 (token/kunci/query pada `tka_*`) tidak berlaku karena koleksi `tka_*` tidak dibuat. Data TKA hidup di `lms_paket_soal` / `lms_kuis` / `lms_jawaban` / `lms_gambar` dengan mapel «TKA Matematika» atau «TKA Bahasa Indonesia» dan kelas 6A/6B/6C. Jangan membuat koleksi `tka_*` baru tanpa mengubah dokumen ini.

77.2 **Akun `arif.azwar79@gmail.com` BUKAN admin** — wali kelas 5A dengan pengecualian email khusus TKA (uji sistem). Jangan menyebutnya admin di UI/dokumen, dan jangan mengandalkan role admin untuk akses TKA. Kode: `tkaAkses.ts` (`EMAIL_AKSES_KHUSUS_TKA`); rules: `tkaEmailKhusus()`. UID tidak dipakai; hanya email.

77.3 **Rules: jangan ubah `tulisMapelKelas` / `lihatMapelKelas`** (dipakai Penilaian) untuk TKA. Akses TKA ditambahkan lewat `lmsTulisMapelKelas` / `lmsLihatMapelKelas` yang HANYA dipakai koleksi `lms_*`. Koleksi `lms_*` baru wajib memakai helper `lms…` agar ruang TKA ikut bekerja. Guru kelas 6 hanya untuk kelasnya (`tkaGuruKelas6(kelas)`); akun email khusus untuk semua kelas 6.

77.4 **Daftar mapel TKA ada di tiga tempat:** `MAPEL_TKA` (`tkaAkses.ts`), `mapelTka()` (rules), dan `MAPEL_LMS` (skrip migrasi). Mengubah nama mapel berarti mengubah ketiganya dan menyalin ulang `firestore.rules` ke SDM01Penilaian.

77.5 **Menu siswa:** kuis TKA tampil hanya di `SiswaTka`; `SiswaKuis` menyaringnya (`adalahMapelTka`). Jangan menghapus filter itu, atau kuis TKA muncul ganda. Item nav TKA dinamis (kelas 6), bukan di array `NAV` tetap.

77.6 **Ruang TKA di `KelasDetail`** hanya menampilkan tab Bank Soal dan Kuis (Materi/Tugas/Pengumuman disembunyikan). Ruang TKA tidak muncul di `/kelas` (daftar berasal dari penugasan); masuknya lewat menu TKA.

77.7 **Rumus (KaTeX):** hanya untuk soal bertanda `rumus: true` (soal TKA hasil migrasi), supaya tanda `$` di konten lain tidak berubah. Rumus dirender SETELAH HTML dibersihkan, dan hasilnya tidak dibersihkan ulang (keluaran KaTeX dari teks ter-escape). Jangan memanggil KaTeX pada node yang dikelola React (mutasi DOM merusak rekonsiliasi); pakai `htmlDenganRumus`/`teksDenganRumus` + `dangerouslySetInnerHTML`. KaTeX dimuat malas (`muatKatex`), jangan diimpor statis.

77.8 **Stimulus:** gunakan `bersihHtmlStimulus` (mengizinkan tabel + colspan/rowspan/scope), bukan `bersihHtml`. Soal dengan `stimulus` menampilkan bacaan + gambar lewat `StimulusSoal`; `SoalTampil` memakai prop `tanpaStimulus` bila halaman pemanggil menampilkannya sendiri (jangan tampil dobel).

77.9 **Soal B/S kustom (`labelBenar`/`labelSalah`)** hanya mengubah tampilan; skor tetap boolean di `nilaiKuisLms`. `pgk-cat` dengan ≠ 2 kolom belum didukung dan dilewati migrasi.

77.10 **Migrasi:** `migrasi-tka-soal.mjs` dry-run bawaan, project terkunci, paket/gambar yang ada tidak ditimpa tanpa `--overwrite`, ID paket deterministik (`tka-<kelas>-<mapel>-<materi>-<n>`) sehingga aman diulang. Soal yang kuncinya tidak cocok dilewati dan dilaporkan; jangan menebak kunci.

77.11 **Pengerjaan TKA:** timer berbasis tenggat (`mulaiMs` disimpan di progres; waktu tetap jalan saat keluar) dan kirim otomatis saat habis (dijaga `kirimRef` agar tidak ganda). Jadwal dan token hanya dicek di klien — bukan keamanan sungguhan; `nilaiKuisLms` belum menegakkannya.

## §78. Rekap Nilai (sinkron ke Penilaian)

78.1 **Rekap Nilai adalah pusat agregasi**, bukan pengganti input di Tugas/Kuis. Nilai tetap diinput di modul sumber (`lms_nilai_tugas`, kuis offline/online). Halaman Rekap hanya menggabungkan dan (nanti) menulis nilai akhir TP untuk sinkron.

78.2 **Struktur UI:** kelas × mapel → tab per TP (`tp_kktp`) → sub-tab SLM | STS | SAS. Jangan meratakan semua TP ke satu tabel besar tanpa tab; guru butuh konteks per TP.

78.3 **SLM multi-sumber:** satu TP bisa punya banyak tugas + kuis (jenisPenilaian=`slm`). Bobot per sumber disimpan di `lms_bobot_slm` (ID: `{kelas}__{mapelSlug}__{tpId}`). Jangan hard-code bobot di klien tanpa dokumen.

78.4 **STS/SAS biasanya satu sumber** (satu event kuis). Tetap tampilkan sub-tab terpisah agar konsisten dengan model Penilaian (`nilai_sts` / `nilai_sas`).

78.5 **Jangan menulis langsung ke koleksi Penilaian** (`nilai_tp`, `nilai_sts`, `nilai_sas`) dari klien LMS. Sinkron hanya lewat Cloud Function (Admin SDK), sama pola `sinkronNilaiKuisLms`.

78.6 **Tahap 1 hanya shell.** Jangan menganggap nilai di tabel Rekap sudah final sampai tahap agregasi + bobot + CF selesai. Placeholder menampilkan "—" dengan sengaja.

78.7 Koleksi baru `lms_bobot_slm` (dan nanti cache nilai akhir bila ada) **wajib** didaftarkan di `firestore.rules` (helper `lmsTulisMapelKelas` / `lmsLihatMapelKelas`) sebelum dipakai tulis dari klien. Salin rules lengkap ke SDM01Penilaian.

## §79. Rekap Nilai — agregasi & bobot SLM (Tahap 2)

79.1 Sumber SLM hanya tugas yang `tpList`/`tpId` memuat `tpId` aktif dan `jenisPenilaian` bukan `latihan`/`sts`/`sas` (field kosong = SLM legacy), serta kuis dengan `jenisPenilaian == 'slm'` dan `tpIds` memuat `tpId`.

79.2 Skor kuis selalu dinormalisasi ke 0–100 lewat `skorKe100(skorOtomatis, totalPoin)`. Jangan menampilkan poin mentah di tabel rekap.

79.3 Satu siswa bisa punya beberapa `lms_jawaban` (percobaan). Pakai `ringkasPerSiswa` (percobaan/terbaru) — konsisten dengan Hasil Kuis.

79.4 Bobot default = 1 untuk sumber baru. Sumber yang hilang tidak ikut dihitung; `gabungSumberDenganBobot` hanya menggabungkan sumber yang masih terdeteksi.

79.5 `lms_bobot_slm` ditulis klien dengan `lmsTulisMapelKelas`. Rules wajib di-deploy sebelum Simpan bobot dipakai di produksi.

79.6 Jangan tulis langsung ke koleksi nilai di SDM01Penilaian dari klien LMS. Sinkron nilai akhir TP → Penilaian hanya lewat Cloud Function (Tahap 3).

79.7 Query tugas/kuis/nilai tetap `where kelas + mapel` agar lolos rules yang ada.

## §80. Firestore rules LMS harus selalu dari salinan lengkap SDM01Penilaian

80.1 Sumber kebenaran rules bersama = repo SDM01Penilaian. Setiap perubahan match `lms_*` dibuat di situ (atau disalin utuh ke situ) lalu `deploy:rules` dari situ.

80.2 Repo LMS boleh menyimpan salinan `firestore.rules` yang **identik**, hanya untuk referensi. Jangan deploy dari repo LMS jika file di sana lebih pendek / lebih lama.

80.3 Sebelum deploy rules, cek keberadaan `match /lms_tugas` dan `match /lms_nilai_tugas`. Jika hilang, UI tugas/nilai akan kosong meski data masih ada.

80.4 Jangan pernah menimpa rules produksi dengan snippet atau file partial. Selalu file **lengkap**.

## §81. Daftar tugas/kuis tidak boleh mengandalkan penugasan saja

81.1 Katalog tugas guru wajib menggabungkan query penugasan kelas×mapel DENGAN query `dibuatOleh == uid` (dan admin: opsi muat semua).

81.2 Jangan menelan error permission di `catch` kosong — tampilkan ke UI jika hasil akhir kosong.

81.3 Rules baca `lms_tugas` / `lms_kuis` harus mengizinkan pembuat (`dibuatOleh == uid`) agar data lama tidak "hilang" saat penugasan/mapel berubah.

81.4 Tugas tidak lagi di tab Ruang Kelas — hanya menu `/tugas`.

## §82. Jenis penilaian tugas (selaras kuis)

82.1 Field `jenisPenilaian` pada `lms_tugas`: `latihan` | `slm` | `sts` | `sas`. Default create = `slm`. Baca dokumen lama tanpa field → perlakukan sebagai `slm`.

82.2 Rekap Nilai memfilter sumber tugas menurut `jenisPenilaian`. Jangan memasukkan tugas `latihan` ke nilai SLM/STS/SAS.

82.3 Kuis sudah memakai field yang sama di `lms_kuis`; jangan menduplikasi konstanta label dengan teks berbeda — selaraskan makna dengan `NAMA_JENIS_PENILAIAN` / `NAMA_JENIS_PENILAIAN_TUGAS`.

## §83. Rekap Nilai & Ruang Kelas memakai sumber kelas×mapel yang sama

83.1 Jangan mengisi dropdown Rekap hanya dari `daftarRuangKelas` (penugasan murni) jika Ruang Kelas memakai `perluasDenganMapelMaster` untuk wali. Keduanya harus konsisten agar wali tidak melihat “belum ada penugasan” di Rekap padahal kartu ruang penuh.

83.2 Panel **Penugasan aktif** di `KelasList` menggantikan teks intro generik. Jangan mengembalikan copy “Setiap kartu adalah satu mata pelajaran…” sebagai konten utama di atas katalog.

## §84. Field soal TKA di editor dan pengolahan soal

84.1 **Field TKA pada `Soal`** (`stimulus`, `tipeMateri`, `rumus`, `labelBenar`, `labelSalah`) bersifat opsional dan hanya ada pada soal TKA. Kode yang membangun ulang soal (ganti tipe, impor, AI, salin) WAJIB mempertahankannya. `ubahTipe` kini membawa `stimulus`/`tipeMateri`/`rumus`; kode baru yang menyusun `Soal` bidang demi bidang harus menyalinnya. `snapshotSoal` (kuis) memakai klon JSON penuh — jangan diubah menjadi daftar putih bidang, atau bacaan dan rumus hilang di kuis siswa.

84.2 **Jangan menulis `undefined` ke Firestore.** Sertakan field TKA hanya bila ada (`...(x ? { x } : {})`), seperti di `ubahTipe`.

84.3 **Stimulus diedit lewat `<textarea>`, bukan `RichEditor`.** Editor kaya tidak mengenal tabel; menyuntingnya di sana membuang tabel. Jangan menggantinya dengan `RichEditor` sebelum ada dukungan tabel.

84.4 **Urutan pembersihan stimulus:** `stimulusKeHtml` (teks biasa → paragraf) → `bersihHtmlStimulus` → `htmlDenganRumus`. Jangan membalik urutan (rumus tidak boleh dirender sebelum pembersihan).

84.5 **`rumus: true` otomatis untuk soal baru di ruang TKA** (efek di `TkaFieldEditor`). Bila efek itu dihapus, rumus `$…$` tampil mentah di soal baru.

84.6 **`analisisSoal`:** soal dengan `stimulus` teks dianggap sudah punya stimulus. Jangan mengembalikan pemeriksaan hanya-gambar.

## §85. TKA bank bersama + 3 mapel (tanpa 6C)

85.1 **Tidak ada pemisahan bank per rombel.** Bank soal TKA memakai kelas kanonik `6` (`KELAS_TKA_BANK`). Dashboard menampilkan 3 kartu mapel saja. Jangan mengembalikan grid 6A/6B/6C × mapel.

85.2 **Kelas 6C tidak dipakai.** `KELAS_TKA` = `['6A','6B']`. Rules `tkaKelas6` menerima `6`, `6A`, `6B` saja.

85.3 **Mapel TKA** = `TKA Matematika`, `TKA Bahasa Indonesia`, `TKA IPA`. Harus sama di `tkaAkses.ts` (`MAPEL_TKA`), `firestore.rules` (`mapelTka`), dan skrip migrasi.

85.4 **Filter bank TKA ≠ filter mapel biasa.** Ganti TP dengan **Materi** (daftar tetap di `MATERI_TKA`). Sembunyikan «Kelompokkan». Bentuk soal hanya `pg` | `pgk` | `bs`.

85.5 **Akses guru:** wali 6A **atau** 6B (atau email khusus) boleh baca/tulis semua ruang TKA (kelas `6` dan sisa 6A/6B). Jangan membatasi lagi ke «hanya kelas wali» untuk mapel TKA.

85.6 **Siswa:** query kuis aktif untuk `kelas` token **dan** kelas `6` (mapel TKA). Rules `lms_kuis` read siswa harus mengizinkan keduanya.

85.7 **`ruangTka(mapel)`** hanya menerima mapel (kelas selalu `6`). Pemanggil lama yang mengirim `(kelas, mapel)` harus disesuaikan.

## §86. TKA materi paket, template, AI stimulus

86.1 **Materi di level paket.** Paket TKA menyimpan `tipeMateri`. Soal baru mewarisi nilai itu; editor soal mengunci pilihan materi bila paket sudah menetapkan. Jangan mengembalikan pemilihan materi per-soal sebagai satu-satunya cara mengelompokkan.

86.2 **Template/import TKA ≠ mapel biasa.** Gunakan `buatTemplateJsonTka` / `buatTemplateCsvTka` dan `validasiMetadataTka` (field `tipeMateri`). Jangan memaksa TP pada ruang TKA.

86.3 **AI stimulus TKA.** Untuk mapel TKA + level stimulus ≠ `tanpa`, narasi AI masuk ke `stimulus`; `teks` hanya pertanyaan singkat. Mapel non-TKA tetap menaruh narasi di `teks`.

86.4 **Navigasi.** Dari ruang TKA, tautan kembali mengarah ke `/tka`, bukan `/kelas`.

86.5 **IPA materi** mencakup Fase B dan Fase C di `MATERI_TKA['TKA IPA']`.

## §Lomba.MateriAksesSiswa (2026-11-18)

1. Kartu daftar lomba siswa **wajib** punya tautan ke detail (`/siswa/lomba/:id`) tanpa `?mulai=1` — jangan hanya «Mulai kerjakan».
2. Section «Materi lomba» di detail: tampilkan galat permission terpisah dari «belum ada materi».

## §MateriHtml.LocalStoragePolyfill (2026-11-18)

1. Iframe sandbox **tanpa** `allow-same-origin` → `localStorage` sering melempar SecurityError.
2. `siapkanHtmlDokumen` wajib menyisipkan polyfill memori di `<head>` sebelum skrip modul.
3. Jangan mengandalkan `allow-same-origin` hanya agar storage jalan (XSS ke parent).


## §Tugas.Instruksi — instruksi tugas tampil terformat (2026-11-19)

1. **Instruksi = teks polos** (textarea guru / keluaran AI) berisi baris baru, «1.», «-», dan judul berakhiran «:». Tampilan siswa WAJIB lewat `htmlInstruksiSiswa` (`lib/instruksiTugas.ts`). Jangan kembali ke `bersihHtml(detail.instruksi)` langsung: baris baru runtuh dan seluruh instruksi menjadi satu paragraf yang tak terbaca.
2. **Sanitasi tetap wajib (§9).** `bersihHtmlInstruksi` hanya menambah `h3` pada daftar tag `bersihHtml`; tanpa atribut. Jangan mengubah `lib/html.ts` bersama perubahan ini dan jangan merender hasil `instruksiKeHtml` tanpa sanitasi.
3. **Instruksi yang sudah berisi tag HTML dibiarkan** (tidak di-escape ulang) lalu disanitasi.
4. **Heuristik teks «rata»** (tanpa satu pun baris baru dan ≥ 160 karakter) hanya pemulihan data lama. Jangan memperluasnya tanpa menguji contoh tugas «peneliti cilik — detak jantung & napas» (judul bagian, langkah bernomor, poin, kalimat penutup) dan teks berbaris biasa.
5. **Pratinjau guru** (tab Isi Tugas) dan tampilan siswa memakai fungsi yang sama dan kelas `.sw-ins` (`siswa.css`, dimuat global lewat `main.tsx`). Ubah gaya di satu tempat itu.

## §Tugas.Bukti — bukti pengumpulan berlabel & kaitan rubrik (2026-11-19)

1. **Data:** `lms_tugas.buktiList[] = {id, slot, label, petunjuk?, wajib, kategoriIds?}`; rubrik `pengaturanPenilaian.kategori[].mapel?`. Maksimal 3 bukti = batas rules (`fotoIds` ≤ 3, slot `'1'..'3'`). Menaikkan batas WAJIB mengubah bersamaan: `firestore.rules` (di SDM01Penilaian, salin UTUH, §0), `BATAS_BUKTI_TUGAS`, `SLOT`/`BATAS_FOTO_PENGUMPULAN` di `pengumpulan.ts`.
2. **Slot TETAP per bukti.** ID foto berakhiran `_<slot>`; slot dibaca dari ID (`slotDariFotoId`), BUKAN dari urutan `fotoIds`. Mengurutkan ulang bukti hanya mengubah urutan tampil. Jangan memberi nomor slot dari indeks pada tugas ber-bukti: bukti opsional yang dikosongkan akan menggeser foto «sesudah» ke slot bukti lain. `rapikanBuktiList` menjamin slot sah dan unik; semua jalur baca/tulis tugas melewatinya.
3. **Mode ganda.** Tugas tanpa `buktiList` memakai mode lama (`foto: string[]`, slot berurutan). Tugas ber-bukti memakai `fotoSlot`. Jangan menggabungkan keduanya dalam satu pemanggilan `kirimPengumpulan`.
4. **Wajib dicek dua lapis:** UI (tombol Kumpulkan nonaktif) dan `kirimPengumpulan` (`buktiWajibKurang`). Aturan tenggat/kunci nilai (§132.5) dan urutan tulis foto→meta (§132.2) tidak berubah.
5. **Label tidak disimpan di dokumen pengumpulan** (rules membatasi kunci meta/foto). Label dibaca dari `tugas.buktiList` berdasarkan slot saat ditampilkan. Akibat yang diketahui: menghapus bukti lalu menambah yang baru memakai slot kosong terendah, sehingga foto lama siswa tampil di bukti baru; mengganti label mengubah keterangan foto lama. Editor sudah memberi peringatan; jangan mengandalkan pengubahan bukti setelah siswa mengumpulkan.
6. **Field baru wajib dilewatkan di SEMUA pembaca/penulis tugas:** `tugas.docKeTugas`, `tugasSiswa.docKeTugas` (`buktiList`), serta `normalisasiPengaturan` (`penilaianTugas.ts`) dan `sanitasiPengaturanPenilaian` (`tugas.ts`) untuk `kategori.mapel`. Salah satu yang membuang field → data hilang diam-diam saat guru menyimpan pengaturan (kasus nyata: `normalisasiPengaturan` membuang semua field kategori yang tak dikenal). `updateTugas` hanya menulis `buktiList` bila diberikan (undefined = tidak diubah, `[]` = dihapus).
7. **Siswa tidak menulis ke Storage;** foto tetap di Firestore (§132.1). Foto hanya dipasang lewat `<img src>` setelah `dataUrlGambarAman` (§132.7).
8. **Uji sebelum deploy:** (a) tugas 3 bukti, kumpul lengkap, guru melihat tiga foto berlabel; (b) bukti wajib kosong → tombol nonaktif + daftar yang kurang; (c) kirim ulang hanya mengganti slot 2, slot lain utuh; (d) bukti opsional dikosongkan lalu kirim → «Bukti kurang» TIDAK muncul di guru; (e) tugas lama tanpa bukti tetap 1–3 foto bebas; (f) tugas proyek: pilih mapel rubrik, simpan pengaturan, muat ulang → mapel tetap; (g) siswa melihat «Yang akan dinilai» hanya bila rubrik berisi kategori; (h) HP lebar 360 px: kartu bukti tidak meluber.

## §Tugas.Bukti (lanjutan) — tahap, sumber, dan 6 slot (2026-11-19)

9. **Batas slot = 6** (revisi §Tugas.Bukti.1; sebelumnya 3). Tiga tempat harus selalu selaras: `firestore.rules` (`fotoIds.size() <= 6`, slot `'1'..'6'`; file identik di SDM01Penilaian dan lms), `BATAS_BUKTI_TUGAS` (`types/tugas.ts`) dan `BATAS_SLOT_FOTO`/`DAFTAR_SLOT`/`SLOT`/regex `slotDariFotoId` (`pengumpulan.ts`). `BATAS_FOTO_PENGUMPULAN` (3) HANYA untuk mode lama tanpa bukti. **Urutan deploy: rules → functions → hosting**; hosting lebih dulu membuat unggahan slot 4–6 ditolak.
10. **`kategori.tahap` dan `kategori.sumber`** wajib dilewatkan di `sanitasiPengaturanPenilaian` (`tugas.ts`) DAN `normalisasiPengaturan` (`penilaianTugas.ts`); salah satu membuangnya = hilang diam-diam saat guru menyimpan rubrik (pola yang sama dengan `mapel`, §Tugas.Bukti.6). `sumber: 'observasi'` = tidak butuh bukti dan dikecualikan dari peringatan cakupan serta pilihan kaitan bukti.
11. **Cakupan:** `kategoriTanpaBukti` hanya memperingatkan (tidak memblokir simpan). Jangan menjadikannya syarat wajib: guru boleh sengaja menilai dari foto bebas.
12. **Keluaran AI** (`generateKategoriTugasLmsAi`) = `{kategori[], bukti[]}`; `bukti[].kategoriIds` merujuk id kategori buatan server. Klien memetakan id ke kategori yang sudah ada dengan nama sama (`petaId`) dan memasang saran bukti HANYA bila `buktiList` kosong. Saran AI tidak disimpan otomatis; guru memeriksa lalu menyimpan di tab Isi Tugas. Klien lama yang hanya membaca `kategori` tetap bekerja.

## §Tugas.Video — bukti video siswa (2026-11-20)

0. **Rules wajib dilengkapi.** Klien menulis field `videos` dan mengunggah ke Storage `lms/pengumpulan/…`. Tanpa match di `storage.rules` dan tanpa `videos` di `hasOnly`/`affectedKeys` firestore.rules, siswa mendapat permission-denied («Tugas belum bisa dikumpulkan…») meski tugas aktif. Deploy `firestore.rules` + `storage.rules` lengkap sebelum menguji di akun ananda. (Ditemukan 2026-11-24.)

1. **Pengecualian terarah atas §132.1:** foto tetap di Firestore, tetapi VIDEO wajib di Cloud Storage (dokumen Firestore ≤ 1 MB). Path tunggal `lms/pengumpulan/{tugasId}/{siswaId}_{slot}.{webm|mp4}` dibuat HANYA oleh `pathVideoTugas`; `storage.rules` mencocokkan nama berkas dengan claim `siswaId` token siswa, jadi jangan mengubah format nama di satu sisi saja.
2. **Slot bersama:** bukti `jenis: 'video'` memakai slot 1..6 yang sama dengan bukti foto (total ≤ 6) tetapi TIDAK membuat `lms_pengumpulan_foto`; `fotoIds` hanya berisi foto, video ada di `videos` (peta slot → `{path,tipe,ukuran,durasi}`). Maks. 2 video per tugas (`BATAS_BUKTI_VIDEO`, dipaksa `rapikanBuktiList` dan rules `videos.size() <= 2`). Pengumpulan tanpa foto (hanya video) sah: rules menerima `fotoIds` kosong bila `videos` ada.
3. **[DIGANTIKAN §Tugas.Video.Ukuran, 2026-11-25: tidak ada batas durasi; batas ukuran kini 100 MB]** ~~Durasi > 60 dtk DITOLAK sebelum konversi~~ (`periksaVideo`); jangan menambahkan konversi/pemotongan otomatis. Pemeriksaan durasi hanya di klien (rules tidak bisa); ukuran < 15 MB dan tipe `video/(webm|mp4)` dijaga `storage.rules`. Ubah batas durasi/ukuran/bitrate hanya lewat konstanta di `videoTugas.ts` + rules (15 MB) bersamaan.
4. **Konversi = MediaRecorder + kanvas (±480p, VP9/VP8 + Opus)** dan berjalan real-time (≈ durasi video). Harus tetap: suara lewat WebAudio `createMediaElementSource` → `MediaStreamDestination` (tidak disambung ke speaker), dihentikan bila `document.hidden` (kanvas beku di latar belakang), `wakeLock` bila ada, dan semua sumber daya (URL, AudioContext, track) dibersihkan di `finally`. Dimulai dari ketukan «Perkecil video» agar lolos kebijakan autoplay.
5. **Unggah saat «Kumpulkan», bukan saat memilih** (tidak ada berkas yatim bila siswa batal). Urutan `kirimPengumpulan`: video → foto → meta TERAKHIR (§132.2); berkas lama yang tak dipakai (dihapus/diganti/ekstensi berubah) dihapus best-effort setelah meta tersimpan. `videos` HANYA ditulis ke meta bila tugas berbukti-video atau sudah pernah ada video, agar alur foto-saja tetap jalan walau rules lama belum di-deploy.
6. **Privasi:** jangan menyimpan/menampilkan URL unduhan video (berisi token) di dokumen mana pun; URL diminta `urlVideoTugas` saat diputar. Baca Storage hanya pemilik + guru/admin (`guruStorage`), BUKAN `isLoggedIn()` (akun orang tua juga login). Siswa tidak bisa menulis/menghapus setelah tugas dinilai (`lms_nilai_tugas` ada) atau tugas nonaktif.
7. **Kuota:** hapus otomatis 120 hari lewat lifecycle bucket (`docs/storage-lifecycle-video.json`); perintah gcloud MENGGANTI seluruh lifecycle bucket — periksa aturan lama dulu (`docs/DEPLOY.md`). Menghapus dokumen pengumpulan/tugas tidak menghapus berkas video (hanya lifecycle).
8. **Rules lintas-layanan:** `siswaBolehKelolaVideo` memakai satu `firestore.get` (tugas, lewat `let`) + satu `firestore.exists` (nilai) — batas dua panggilan per evaluasi Storage. Jangan menambah panggilan `firestore.get/exists` lain pada jalur siswa. `storage.rules` identik di SDM01Penilaian dan lms (salin UTUH, termasuk blok audio materi).
9. **Uji sebelum dipakai siswa (belum pernah dijalankan di perangkat/emulator):** (a) HP Android Chrome: video 30 dtk dari kamera → «Perkecil video» → hasil ≤ ±8 MB, suara ada, bisa diputar; (b) video 75 dtk → ditolak dengan pesan durasi; (c) kumpulkan → guru memutar video di tab Pengumpulan; (d) ganti video lalu kirim ulang → berkas lama terhapus; (e) hapus video opsional → `videos` terbarui; (f) tugas sudah dinilai → siswa tidak bisa mengunggah/menghapus; (g) akun orang tua tidak bisa membaca URL video; (h) tutup aplikasi saat konversi → pesan «Konversi terhenti», bisa diulang; (i) video HEVC/format tak dikenal → pesan «tidak bisa dibuka» + saran foto; (j) kumpulkan hanya dengan video (tanpa foto) lolos rules.


## §Tugas.Status — status tiga tingkat draf / aktif_guru / aktif_siswa (2026-11-21)

1. **Field kanonis adalah `statusTugas`**, bukan boolean `aktif` saja. Nilai: `draf` | `aktif_guru` | `aktif_siswa`. Setiap tulis status WAJIB juga menyetel `aktif = (statusTugas === 'aktif_siswa')` agar rules siswa (`resource.data.aktif == true`) dan query `where('aktif','==',true)` tetap benar **tanpa** mengubah firestore.rules.
2. **Jangan menghidupkan kembali checkbox «Aktifkan tugas»** sebagai satu-satunya kontrol. UI guru memakai select/dropdown tiga status (dashboard + tab Pengaturan). Memakai hanya `aktif: true/false` dari UI lama akan memetakan ke `aktif_siswa` / `draf` dan **menghilangkan** `aktif_guru`.
3. **Daftar nilai hanya boleh diisi** bila `bolehInputNilaiTugas(status)` (aktif_guru atau aktif_siswa). Draf menampilkan pesan, bukan tabel skor kosong yang seolah bisa disimpan.
4. **Baca dokumen lama:** `normalisasiStatusTugas(statusTugas, aktif)` — jika `statusTugas` absen, `aktif === true` → `aktif_siswa`, selain itu → `draf`. Jangan menganggap semua `aktif: false` sebagai `aktif_guru`.
5. **Siswa hanya melihat `aktif_siswa`.** `aktif_guru` sengaja tidak tampil di katalog/pengumpulan siswa (nilai diisi guru, bisa disinkron ke Penilaian).

## §Tugas.Arsip — selesai penilaian & arsip (2026-11-21)

1. **`selesai` ≠ status publikasi.** `selesai` = penanda alur penilaian guru tuntas; independen dari `statusTugas` / `aktif`.
2. **`arsip: true` disembunyikan dari filter «Semua».** Filter «Arsip» khusus. Jangan menghapus dokumen saat arsipkan — hanya set flag (+ turunkan ke non-siswa-visible).
3. **Arsipkan dari `aktif_siswa`:** turunkan ke `aktif_guru` (atau set `aktif: false` lewat status) agar siswa tidak melihat. «Keluarkan arsip» **tidak** otomatis `aktif_siswa` — guru memilih status lagi.
4. Field `selesai` / `arsip` opsional boolean; rules update yang ada tidak menolak field ekstra (tidak memakai `hasOnly`).

## §Tugas.Sinkron — nilai tugas → koleksi rapor Penilaian (2026-11-21)

1. **Hanya Cloud Function `sinkronNilaiTugasLms`** (Admin SDK) yang menulis `nilai_tp` / `nilai_sts` / `nilai_sas`. Klien LMS **tidak** menulis langsung ke koleksi rapor.
2. **Pemetaan jenis:** `slm` → `nilai_tp` field `slm`; `sts` → `nilai_sts` field `nilai`; `sas` → `nilai_sas` field `nilai`. **`latihan` ditolak** (`failed-precondition`).
3. **Prasyarat CF:** `tugasId` valid, pengampu kelas×mapel, minimal satu TP yang resolve ke `tp_kktp`, minimal satu dokumen `lms_nilai_tugas` dengan `nilai` numerik.
4. **TP:** prefer `tpList[]`; cocokkan id atau nama ke `tp_kktp` (pola sama `sinkronNilaiKuisLms`). Proyek lintas mapel: mapel per TP bila ada.
5. **Overwrite default true** (seperti kuis). Setelah sukses, tugas mendapat `terakhirSinkronAt` / `terakhirSinkronRingkas`.
6. Deploy dari **SDM01Penilaian**: `firebase deploy --only functions:sinkronNilaiTugasLms`. Stub klien «belum diaktifkan di server» harus sudah diganti pemanggilan CF.

## §Tugas.NilaiDraft — draf daftar nilai tidak boleh hilang (2026-11-21)

1. **Jangan panggil `muatNilai()` penuh setelah `simpanSatuNilai`.** Soft-update baris yang disimpan saja. `muatNilai` tanpa `force` **menggabungkan** draf lokal yang berbeda dari server (hasil generate AI / edit belum tersimpan).
2. **«Muat ulang»** saja yang memakai `muatNilai({ force: true })` (sengaja membuang draf lokal).
3. **Generate skor dari predikat** mengisi draf **dan** menyimpan baris itu (live), tanpa memuat ulang seluruh daftar.
4. Tombol **«Simpan semua»** menyimpan semua baris yang `draftBerisiData` — jangan mengandalkan simpan per baris saja saat guru men-generate banyak siswa.

## §Tugas.BobotAi — bobot kategori dari generate AI (2026-11-21)

1. Prompt & normalisasi di **`generateTugasLmsAi.js`** (CF `generateKategoriTugasLmsAi`) wajib mengisi `bobot` per kategori dengan **total 100** (bilangan bulat ≥ 1). Jika AI tidak memberi bobot valid, CF membagi rata.
2. Klien **`tugasAi.ts`** harus memetakan `bobot` ke `KategoriPenilaian`; mengabaikan field ini membuat UI bobot kosong meski CF sudah mengirim.
3. **`hitungRataRata`** (`nilaiTugas.ts`) memakai bobot > 0; jika semua kosong/0, tiap kategori berbobot 1 (rata-rata sederhana). Jangan memaksa total 100 di klien saat hitung skor — total 100 adalah konvensi pengaturan rubrik.
4. Deploy CF setelah mengubah prompt/normalisasi: `firebase deploy --only functions:generateKategoriTugasLmsAi`.


## §TKA.Peringkat — peringkat gabungan 6A+6B harus satu sumber & jujur (2026-11-21)

1. Peringkat TKA SELALU gabungan 6A+6B (tidak ada peringkat per kelas di portal). Seluruh `lms_tka_hasil_ortu` kedua kelas dan `lms_tka_peringkat/{tahap}` dihitung dari satu panggilan `bangunRankingGabungan` dan membawa `rankingId` yang sama. Jangan menghitung peringkat di tempat lain.
2. Peringkat kompetisi: rata-rata (1 desimal, seperti yang dilihat orang tua) sama = peringkat sama; urut nama hanya urutan tampil.
3. Hanya siswa dengan rata-rata lengkap (tahap I: BI+MTK; II–V: BI+MTK+IPA) masuk ranking. Bila `jumlahPeserta < jumlahSiswaGabungan`, `sementara = true` dan portal wajib menampilkan label «sementara».
4. Rules hanya mengizinkan wali kelas menulis `lms_tka_hasil_ortu` rombelnya sendiri. Patch kelas paralel TIDAK boleh digabung ke batch utama (atomik → seluruh publish gagal). Bila gagal, portal mendeteksi ketidaksinkronan lewat `rankingId` dan menyembunyikan peringkat sampai kelas itu publish ulang.
5. Setelah data rekap berubah (impor/nilai baru), publish ulang KEDUA kelas. Snapshot tidak dihitung ulang otomatis.
6. **Tes:** publish 6B saja → kartu & tabel 10 besar cocok; ubah satu nilai lalu publish 6A → kartu 6B cocok atau tampil «sedang diperbarui», tidak pernah kontradiktif.

## §Operasional.Repo — jangan menghapus file LMS; cek repo sebelum `git rm` (2026-11-22)

1. `src/lib/kuis.ts` dan `src/pages/siswa/SiswaLombaDetail.tsx` adalah file MILIK repo ini (dipakai `App.tsx`, `KuisPanel`, `KuisDetail`, `HasilKuisPanel`, `rekapNilai`, `rekapTka`, `ringkasanRuang`, `RekapKuis`, `SiswaLomba`, `TkaKuisAktif`). Menghapusnya memutus build (`npx tsc -b` → 18 error). Salinan identik yang pernah nyasar di repo SDM01Penilaian-lah yang harus dihapus, bukan yang di sini.
2. Sebelum perintah `git rm`/`Remove-Item` yang menghapus file, pastikan repo benar: `git remote -v` harus menampilkan nama repo yang dituju, dan baca awal baris terminal (`...\GitHub\lms` vs `...\GitHub\sdm01kks`).
3. Pemulihan bila terhapus di folder kerja (belum di-commit): `git restore --source=HEAD --staged --worktree <file>`. Bila sudah di-commit: `git checkout <hash-sebelum-hapus> -- <file>` lalu commit.
4. Setelah perubahan apa pun di repo ini jalankan `npx tsc -b`; harus tanpa error sebelum push/deploy.

## §Rekap.Sumber — pencarian sumber nilai harus cocok id DAN nama, dan selaras dengan sinkron (2026-11-22)

1. TP pada tugas/kuis bisa tersimpan sebagai id (`tp_kktp`) atau nama (kadang berawalan «TP 3.»). `kuis.tpIds` dan `kuis.tpNamaList` keduanya bisa berisi nama. Pencocokan WAJIB id atau `normNamaTp(nama)`; jangan kembali ke `tpIds.includes(tpId)` saja.
2. Query `daftarTugas/daftarKuis(kelas, mapel)` hanya memuat dokumen bermapel sama. Tugas proyek lintas mapel dilengkapi lewat `daftarTugasGuru`/`daftarKuisDibuatOleh` lalu difilter kelas+TP. Query kelas-saja tanpa mapel ditolak rules (ANTIREGRESI §128), jangan dipakai.
3. Nilai tugas (`lms_nilai_tugas`) dibaca per kelas+mapel; baca mapel sumber dan mapel layar, gabungkan.
4. Rumus nilai SLM Rekap Nilai (`hitungNilaiBerbobot`: rata berbobot persen dari `lms_bobot_slm`, 1 desimal; bobot tersimpan dipakai hanya bila mencakup SEMUA sumber terdeteksi, selain itu rata) HARUS identik dengan agregator sinkron di SDM01Penilaian (`functions/agregasiSlmLms.js`: `bobotSumber`, `nilaiBerbobot`, `idBobotSlm`). Ubah keduanya sekaligus.
5. Tampilan: judul kolom sumber dan angka nilai sama-sama `text-center`.
6. **Tes:** (a) kuis dengan `tpIds` berisi nama TP muncul sebagai kolom; (b) tugas yang `tpList`-nya hanya bernama muncul; (c) bobot 70/30 menghasilkan nilai akhir sama dengan nilai SLM di aplikasi penilaian setelah sinkron.

## §Kisi-kisi — ekspor kisi-kisi (2026-11-22)

1. Kisi-kisi dibangun dari data yang ada; **indikator tidak boleh dikarang otomatis**. Sumbernya hanya `soal.indikator` (kosong = sel kosong). Untuk kuis, indikator salinan yang kosong boleh dilengkapi dari soal paket asal (`sumberPaketId`+`sumberSoalId`).
2. `indikator` HARUS ikut di semua tempat yang membangun ulang objek soal: `ubahTipe` (soal.ts), `normalisasiSoalDariImport` (importSoal.ts), `soalKeBarisImport` (gabungPaket.ts). `salinSoal` memakai JSON sehingga otomatis ikut. Jangan menulis `indikator: undefined` ke Firestore (spread bersyarat).
3. Dokumen Word memakai atribut HTML dasar (`border`, `cellpadding`, `width`, `align`) — CSS saja tidak menggambar garis tabel di semua penampil. Jangan menghapus atribut itu.
4. Kolom «Domain» hanya muncul bila ada soal ber-`domainTka`; kolom «Kunci» hanya untuk versi guru (opsi `sertakanKunci`).
5. `kisiKisiDariKuis` membaca paket asal lewat `ambilPaket`; kegagalan baca satu paket tidak boleh membatalkan ekspor (jatuh ke `tpNamaList`).
6. Uji manual: paket 3 soal (PG, B/S, uraian) → Word lanskap berisi tabel + ringkasan; XLSX 2 lembar; kuis dari paket lalu isi indikator di paket → kisi-kisi kuis ikut terisi.

## §Kuis.Status — status kuis & arsip selaras tugas (2026-11-23)

1. `statusKuis` (draf | aktif_guru | aktif_siswa) adalah sumber kebenaran; `aktif` (boolean) HARUS selalu = `statusKuis === 'aktif_siswa'`. Rules dan query siswa (`where('aktif','==',true)`, `SiswaTka`, `ringkasanRuang`) memakai `aktif`. Selalu ubah lewat `updateKuis` (menyelaraskan keduanya); jangan `updateDoc` langsung.
2. Dokumen lama tanpa `statusKuis` dinormalisasi di pemeta (`bidangStatusKuis`): aktif→aktif_siswa; tidak aktif + offline→aktif_guru; selain itu draf. Jangan mengubah aturan «offline lama → aktif_guru» (mencegah input offline lama terblokir).
3. Arsip menyembunyikan kuis dari daftar utama dan dari siswa; status aktif_siswa diturunkan ke aktif_guru saat diarsipkan. Nilai/hasil kuis arsip TETAP dihitung (rekap, sinkron SLM ke penilaian). Jangan menambah filter `arsip` pada agregasi nilai.
4. Input jawaban offline hanya untuk aktif_guru/aktif_siswa (`bolehInputHasilKuis`).
5. **Tes:** (a) kuis aktif siswa diarsipkan → siswa tidak melihat, nilai tetap muncul di Rekap Nilai; (b) kuis offline lama (tanpa statusKuis) masih bisa diinput; (c) mengubah status ke Aktif guru → siswa tidak melihat.

## §Materi.Media — blok video/audio di materi halaman (2026-11-23)

1. Blok `video` (`sumber: 'unggah' | 'youtube'`) dan `audio` hanya boleh tersimpan dengan URL **https**. `blob:`/`data:`/`http:` DITOLAK saat simpan (`normalisasiHalaman`); blok tanpa URL dibuang. Jangan menulis `undefined` ke Firestore (spread bersyarat).
2. Berkas diunggah ke `lms/materi/{KELAS}/video_*|audio_*` (rules: video < 50 MB, audio < 15 MB, `fileName` ≤ 200). `storagePath` disimpan agar ikut dibersihkan (`kumpulkanStoragePath`) saat materi dihapus. Tipe konten ditebak dari ekstensi bila `file.type` kosong (`tipeKontenMedia`).
3. YouTube memakai `youtube-nocookie.com/embed/{id}` dan `ekstrakYoutubeId`; tautan tak dikenali ditolak saat simpan.
4. Impor JSON halaman: video/audio diterima hanya dengan url https; berkas unggahan masuk sebagai tautan TANPA `storagePath` (tidak ikut terhapus; bila materi asal dihapus, tautan di salinan bisa mati).
5. Gambar tetap memakai alur lama (`gambar` tidak berubah).
6. **Tes:** unggah MP4 < 50 MB → tersimpan & terputar di tampilan siswa; hapus materi → file Storage terhapus; paste tautan YouTube salah → pesan galat saat simpan.

## §Materi.Cetak — cetak/PDF materi (2026-11-23)

1. Cetak lewat jendela `window.open` dari klik langsung (popup-blocker), CSS cetak sendiri + salinan stylesheet aplikasi (agar KaTeX tampil). Jangan membuat pustaka PDF baru.
2. Video/audio TIDAK pernah dicetak sebagai URL bertoken Storage; YouTube dicetak sebagai tautan tonton, unggahan sebagai «tersedia di LMS». Teks dibersihkan `bersihHtmlMateri` (tanpa skrip).
3. Halaman tanpa isi tidak dicetak; tiap halaman memulai lembar baru (opsi `halamanBaru`).
4. **Tes:** materi 3 halaman berisi teks+rumus+gambar+video → PDF 3 lembar, rumus terbaca, gambar muncul, kotak video tampil.

## §Materi.Cetak (tambahan 2026-11-24) — kode QR

5. QR dibuat oleh `src/lib/qrKode.ts` (tanpa dependensi; jangan menambah paket QR hanya untuk ini). Batas 106 byte UTF-8 (versi 1–6, level M); teks lebih panjang → `buatMatriksQr` melempar galat dan cetak jatuh ke keterangan «tersedia di LMS» (`kotakQr` mengembalikan kosong). Bila batas ini perlu dinaikkan, tambah tabel versi (data/EC/blok) dan pola alignment untuk versi ≥ 7 (termasuk bit informasi versi) — jangan mengubah sebagian.
6. QR hanya untuk tautan publik yang aman dicetak: YouTube (`youtu.be/{id}`) dan audio dari tautan luar tanpa `storagePath`. URL file Storage (bertoken) TIDAK dicetak dan TIDAK dijadikan QR.
7. **Tes (wajib bila `qrKode.ts` diubah):** buat matriks untuk beberapa teks (pendek, ±43, ±90, 106 byte, UTF-8) pada ke-8 mask, render ke gambar dengan zona tenang 4 modul, lalu pindai dengan pemindai QR sungguhan (mis. jsQR); hasilnya harus sama persis dengan teks. Tes manual: cetak PDF materi berisi video YouTube, pindai dari layar/kertas dengan HP.
