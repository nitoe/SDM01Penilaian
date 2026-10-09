# Model Data — Sistem Penilaian SDM 01 Kukusan

Dokumen ini adalah **kontrak data**: satu tempat yang menyebut koleksi apa saja
yang ada, siapa pemiliknya, kuncinya apa, dan siapa yang boleh baca/tulis.
Kalau menambah koleksi atau field baru, ubah dokumen ini DAN `firestore.rules`
dalam commit yang sama.

## Keputusan yang masih terbuka

| # | Keputusan | Kenapa penting |
|---|-----------|----------------|
| 1 | **Satu project Firebase sebagai sumber kebenaran.** v2 memakai `sdm01-penilaianv2`, repo ini memakai `sdm01kukusan-2e735`. | Data nyata (siswa hasil impor Dapodik, nilai, dll.) kemungkinan ada di project v2. Selama dua project hidup berdampingan, data pasti tumpang tindih. |
| 2 | **ID siswa.** Saat ini ID dokumen = NIS. | NIS bisa berganti (v2 butuh fitur `gantiNis` yang memigrasi 8 koleksi). ID yang stabil (mis. auto-ID) + NIS sebagai field akan menghapus kebutuhan itu. |

## Koleksi yang SUDAH dipakai kode di repo ini

| Koleksi | ID dokumen | Isi | Baca | Tulis |
|---------|-----------|-----|------|-------|
| `users` | UID Firebase Auth | `email, nama, role, kelasAmpu[], status, anakIds[], penugasan[]` | diri sendiri / admin | admin; pemilik hanya `nama` |
| `siswa` | NIS | `nis, nama, kelas, jenjang ('iqro'\|'quran'), aktif, tamatIqro` | semua guru; orang tua hanya `get` anaknya | admin; guru Tahsin hanya `tamatIqro` |
| `setoran` | auto | `siswaId, siswaNama, kelas, jenjang, jenis, materi, detailAyat, detailBacaanIqro, statusHafalan, catatan, createdBy, createdByNama, createdAt` | guru kelas terkait / orang tua anaknya | `create` oleh guru kelas terkait (`createdBy == uid`); immutable; hapus admin |
| `menulis_log` | auto | `siswaId, siswaNama, kelas, materi, catatan, tanggalPeriksa, createdBy, createdAt` | sama dengan `setoran` | sama dengan `setoran` |
| `target_hafalan` | kode kelas | target per kelas per semester | semua guru | guru kelas terkait / admin |
| `kktp_tahsin_tahfizh` | jenjang | warisan v2, tidak aktif dipakai | semua guru | admin |

**Role** (`users.role`): `admin`, `guru`, `guru_tahsin_tahfizh`, `guru_akademik`, `orangtua`.
`orangtua` baru bisa mengakses data setelah `status == 'approved'`.

## Koleksi yang BELUM dimigrasi (ada di v2)

Semua ini ada di `firestore.rules` v2 dan harus diputuskan satu per satu saat modulnya dimigrasi.
Sampai itu, rules repo ini sengaja **menolak** semuanya (default deny), kecuali `mapel` dan `tp_kktp` yang
berupa placeholder.

| Modul | Koleksi v2 |
|-------|------------|
| Akademik inti | `mapel`, `tp_kktp`, `config/akademik`, `nilai_tp`, `nilai_sts`, `nilai_sas`, `asesmen_cakupan` |
| Rapor | `absensi_rapor`, `kokurikuler_rapor`, `identitas_siswa` |
| Kokurikuler | `dpl`, `kokurikuler`, `proyek_stem`, `g7kaih` |
| Ekstrakurikuler | `ekstrakurikuler`, `ekstrakurikuler_siswa` |
| Administrasi | `mutasi_siswa` |

Koleksi yang menyimpan `siswaId` (harus ikut dimigrasi bila ID siswa berubah):
`setoran`, `menulis_log`, `nilai_tp`, `nilai_sts`, `nilai_sas`, `absensi_rapor`,
`kokurikuler`, `ekstrakurikuler_siswa`, serta `users.anakIds`.

## Koleksi yang DIHAPUS dari rules

- `students` — duplikat dari `siswa`, tidak dipakai kode mana pun.
- `nilai` (generik) — bertabrakan dengan `nilai_tp` / `nilai_sts` / `nilai_sas` dari v2.

## Aturan menulis data siswa

- Impor/upsert siswa dicocokkan **murni berdasarkan NIS**. Sumber data lain (mis. Dapodik) bisa memiliki NIS berbeda untuk anak yang sama → duplikat. Sebelum impor massal, cocokkan juga dengan nama + tanggal lahir dan tampilkan pratinjau (pelajaran dari v2, antiregresi §16).
- Nama siswa disimpan dalam Title Case (data Dapodik sering HURUF BESAR).
