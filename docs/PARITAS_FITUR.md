# Paritas Fitur: v2 → situs baru

Daftar fitur penilaian-v2 dan statusnya di situs baru per 10 Okt 2026. **Ada** = kodenya ada dan sudah diperiksa
bentuk datanya; **Sebagian** = ada tetapi belum setara v2; **Belum** = halaman masih "belum tersedia".
Semua kolom "Ada" **belum diuji dengan data Firestore sungguhan** — gunakan daftar uji di bagian bawah.

## Tahsin-Tahfizh

| Fitur v2 | Status | Catatan |
|---|---|---|
| Login | Ada | |
| Input Setoran: pilih siswa, jenis, materi Iqro/Al-Qur'an, status hafalan, catatan, tamat Iqro | Ada | Tata letak PC dua kolom (daftar siswa tetap di kiri, bilah simpan selalu terlihat), tombol Lanjutkan dari setoran terakhir, Simpan & berikutnya, Ctrl+Enter. Status memakai istilah v2: **Lulus / Perlu diulang** |
| Input Setoran: **Baca & Tandai** (ketuk kata = tajwid/makhroj, ayat Lulus / Perlu diulang, ayat kritis) | Ada | Hanya satu surah per setoran (sama dengan v2). Teks Arab (font Amiri Quran), transliterasi, terjemahan Kemenag, audio per ayat dan surah penuh dari 6 qari — sumber EQuran.id |
| Input Setoran: Latihan Membaca Iqro (kartu kata) | Ada | Dikembalikan 10 Okt 2026 |
| Riwayat Siswa: tab Membaca, Hafalan, Menulis, Ringkasan | Sebagian | Ringkasan kini memuat Kualitas bacaan (5 sesi) dan progres Target Hafalan. Detail Menulis menunggu Catat Menulis |
| Riwayat: ringkasan Baca & Tandai pada kartu | Ada | Kata-kata ringkasan sama dengan v2 |
| Riwayat: ubah (jenis, status, catatan) dan hapus catatan sendiri | Ada | Dikembalikan 10 Okt 2026; butuh `deploy:rules` |
| Catat Menulis | Belum | |
| Target Hafalan (Iqro: jilid + halaman; Al-Qur'an: daftar surah, isi cepat Juz 30/29) | Ada | Ringkasan target semua kelas dalam satu daftar. Butuh `target_hafalan` dari migrasi v2 atau diisi baru |
| Cetak Laporan (per siswa, untuk orang tua; satu siswa atau seluruh kelas) | Ada | Belum diuji dengan data. Bagian Menulis menunggu Catat Menulis |
| Portal orang tua (daftar, riwayat anak, kelola akun ortu) | Belum | |
| seed-siswa, seed-kktp | Tidak perlu | Diganti impor Excel Dapodik |

## Akademik

| Fitur v2 | Status | Catatan |
|---|---|---|
| Setup TP & KKTP | Ada | Belum diuji dengan data |
| Bobot Semester TP | Ada | Belum diuji dengan data |
| Input Nilai SLM | Ada | Belum diuji dengan data |
| Nilai STS (+ cakupan), Nilai SAS (+ cakupan) | Belum | |
| Absensi | Belum | |
| Ekstrakurikuler (+ kelola) | Belum | |
| Kokurikuler: DPL, Proyek STEM, 7KAIH, deskripsi | Sebagian | DPL + STEM + nilai DPL + 7KAIH; AI rancang STEM (hanya arif.azwar79); draf deskripsi gabungan rapor belum |
| Kelengkapan rapor (identitas, pilih siswa) | Belum | Data `identitas_siswa` sudah tersedia dari impor Excel |
| Cetak rapor STS (rapor bayangan, per siswa dan seluruh kelas; wali kelas dan admin) | Ada | Belum diuji dengan data. Tanpa kokurikuler/ekskul/absensi (modulnya belum ada) |
| Cetak rapor SAS (per siswa dan seluruh kelas; wali kelas dan admin) | Ada | Belum diuji dengan data |
| Absensi, catatan wali, keputusan kenaikan | Ada | Di Kelengkapan Rapor SAS |
| Kokurikuler (deskripsi manual) | Sebagian | Input bukti STEM/7KAIH ada; draf otomatis ke kokurikuler_rapor belum |
| Ekstrakurikuler (master + penilaian per siswa) | Ada | Master di Admin |
| Mutasi siswa | Belum | |
| Beranda wali kelas (wali-hub) | Belum | |

## Administrasi

| Fitur v2 | Status | Catatan |
|---|---|---|
| Data siswa: tambah, edit, nonaktifkan, ekspor CSV | Ada | |
| Impor siswa dari Excel Dapodik (+ NISN, kapitalisasi nama) | Ada | Lihat `IMPOR_SISWA.md` |
| Pencegahan duplikat saat impor | Ada | Alat pembersih duplikat yang sudah terlanjur ada: Belum |
| Ganti NIS | Belum | |
| Kelola akun guru / generator akun | Belum | Sementara lewat Firebase Console |
| Kelola akun orang tua | Belum | |
| Profil sekolah (tahun ajaran, semester aktif) | Belum | Nilainya dibaca beranda dari `config/akademik`; mengubahnya masih lewat Console |

## Daftar uji manual (setelah `npm run deploy:rules` dan `npm run deploy`)

Gunakan akun guru Tahsin-Tahfizh yang punya `kelasAmpu`.

1. Input Setoran → pilih siswa kelas 3–6 → Ziyadah, Al-Fatihah ayat 1–5 → teks Arab muncul.
2. Ketuk satu kata: kuning (tajwid); ketuk lagi: merah (makhroj); sekali lagi: bersih. Statistik di atas ikut berubah.
3. Tandai ayat 1 lulus, ayat 2 perlu diulang. Pilih status hafalan "Perlu diulang", simpan.
4. Riwayat Siswa → Hafalan: kartu tampil "Perlu diulang" dan ringkasan "… ayat lulus • … ayat diulang • … tajwid".
5. Ubah status jadi Lulus → tersimpan. Hapus catatan uji → hilang. Pastikan catatan guru lain tidak punya tombol Ubah.
6. Siswa kelas 1–2 (Iqro): "Latihan membaca" muncul; buat kartu kata, tandai, simpan.
7. Matikan internet lalu pilih surah lain: muncul pesan teks belum dimuat, tombol ✓/✕ per ayat tetap bisa dipakai.
8. Input Setoran di PC: daftar siswa tetap di kiri saat menggulir; tombol Simpan selalu terlihat tanpa menggulir ke bawah.
9. Teks Arab tampil dengan font Al-Qur'an (tanda baca lengkap). Hidupkan Transliterasi dan Terjemahan; ganti ukuran teks (A− / A+).
10. Putar audio satu ayat, putar rentang ayat (berurutan, sorotan berpindah), dan audio surah penuh. Ganti qari lalu putar lagi. Pilihan qari dan tampilan tersimpan setelah halaman dimuat ulang.
11. Setelah menyimpan setoran, pilih siswa yang sama: muncul "Setoran terakhir" dan tombol Lanjutkan yang mengisi ayat berikutnya.
12. Target Hafalan: pilih kelas 3–6, klik Isi Juz 30, simpan. Buka Riwayat Siswa → Ringkasan: progres per surah terlihat (hanya setoran Ziyadah berstatus Lulus yang dihitung).

