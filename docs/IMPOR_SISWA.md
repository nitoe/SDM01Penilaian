# Impor Data Siswa dari Dapodik

Dipakai untuk memuat atau memperbarui data siswa (awal tahun ajaran, siswa baru, perubahan rombel).

## Langkah

1. Ekspor dari Dapodik: **Daftar Peserta Didik** (.xlsx). Susunan kolom harus sama dengan ekspor standar
   (No, Rombel Saat Ini, Nama, NIPD, JK, NISN, …, Data Ayah, Data Ibu, Sekolah Asal, Berat Badan, Tinggi Badan).
   Kalau berbeda, aplikasi menolak dan menyebut kolom yang tidak cocok.
2. Masuk sebagai **admin** → Administrasi → Data Siswa → **Impor** → *Pilih file…*.
3. Baca pratinjau: jumlah **baru**, **diperbarui**, **bermasalah**, dan jumlah per kelas (harus cocok dengan rombel di Dapodik).
4. Periksa daftar baris bermasalah (kelas tidak dikenal, NIPD/NISN ganda, NISN yang sudah dipakai siswa lain).
   Baris itu dilewati, sisanya tetap bisa disimpan.
5. Klik **Simpan**. Aman diulang: yang sudah ada hanya diperbarui.

## Yang terjadi pada data

| Hal | Perilaku |
|---|---|
| Pencocokan | Berdasarkan NIPD (ID dokumen). NISN yang sudah dipakai NIPD lain ditandai kemungkinan duplikat dan tidak disimpan. |
| Siswa yang sudah ada | `nama`, `kelas`, `nisn`, tempat/tanggal lahir, dan biodata diperbarui dari file. **`aktif`, `tamatIqro`, `jenjang` tidak diubah.** |
| Siswa baru | `aktif = true`, `tamatIqro = false`, `jenjang` dari kelas (1–2 Iqro, 3–6 Al-Qur'an). |
| Biodata | Ditulis ke `identitas_siswa`; sisa biodata lama di `siswa` otomatis dihapus. |
| Nama HURUF BESAR | Dirapikan menjadi Title Case (nama siswa, ayah, ibu). Nama yang sudah campuran tidak diubah. |
| Tanggal lahir | Disimpan sebagai `YYYY-MM-DD`. |

## Data pribadi anak: aturan

- File Excel dibaca di browser dan **tidak diunggah**. Jangan memasukkan file ini ke repo, chat, atau email.
  `.gitignore` menolak `*.xlsx`/`*.xls`.
- Jangan menaruh data siswa di `src/` atau `public/` (ikut terbundel dan terbaca publik).
- Setelah impor, hapus file dari folder unduhan bersama.

## Verifikasi setelah impor pertama

- Jumlah per kelas di pratinjau sama dengan Dapodik; total siswa di beranda sama.
- Buka satu siswa di Data Siswa: biodata tampil lengkap.
- Di Firebase Console → Firestore: dokumen `siswa/{id}` tidak lagi memuat `alamat`, `hp`, `ayahNama`, dst.;
  semuanya ada di `identitas_siswa/{id}`.
- Masuk sebagai guru biasa (bukan wali kelas): daftar siswa tampil, tetapi biodata tidak bisa dibaca.
