# Progres: peran admin, dashboard admin, dan notifikasi

Dokumen kerja bertahap. Setiap tahap berdiri sendiri; tandai selesai di sini lalu lanjutkan dari tahap berikutnya tanpa mengulang.

## Keputusan yang berlaku

- Admin = pemantau + pengelola master data. Tidak menulis TP, bobot, nilai, setoran, target (ANTIREGRESI §17).
- Tanggung jawab input per pasangan mapel×kelas: guru bidang studi yang ditugaskan (`penugasan`); bila tidak ada, wali kelas.
- Tanggung jawab Tahsin-Tahfizh: guru dengan `kelasAmpu`; dihitung dari setoran dengan `createdBy` guru itu pada periode aktif.
- Pemantauan hanya membaca; hitungan memakai `getCountFromServer`; query nilai selalu memakai `mapel` + `kelas`.

## Tahap 1 — Batasan peran dan nama menu admin — SELESAI (15 Okt 2026)

Berkas: `roles.ts`, `App.tsx`, `Layout.tsx`, `AkademikHub.tsx`, `TahsinHub.tsx`, halaman akademik (judul admin), `RiwayatSiswa.tsx`, `TargetHafalan.tsx`, `InputSetoran.tsx`, `firestore.rules`, `scripts/cek-peran-admin.mjs`.
Sisa untuk dijalankan pemilik: `npm run deploy:rules`, `npm run deploy`, uji dengan akun admin.

## Tahap 2 — Dashboard beranda admin bertab — SELESAI (15 Okt 2026)

Tab: Ringkasan, Tujuan Pembelajaran, Bobot, Nilai, Tahsin-Tahfizh. Tiap tab menampilkan guru yang sudah dan belum, bisa disaring ("Perlu perhatian" / "Semua guru"), dicari, dibuka per mapel×kelas dengan tautan "Lihat" ke halaman mode lihat. Ringkasan juga menampilkan akun menunggu persetujuan dan mapel×kelas tanpa penanggung jawab.
Berkas: `src/lib/monitoringAdminRumus.ts` (logika murni, diuji), `src/lib/monitoringAdmin.ts` (pemuat Firestore, hanya baca), `src/components/Tabs.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/Home.tsx` (admin), `scripts/cek-monitoring-admin.mjs`.
Aturan yang dipakai: lihat ANTIREGRESI §18. Belum diuji terhadap data Firestore sungguhan; uji setelah rules Tahap 1 di-deploy.
Ide lanjutan (belum dikerjakan): tanggal input terakhir per guru, ekspor rekap guru yang belum input, pengingat ke guru (memakai fondasi Tahap 3).

## Tahap 3 — Fondasi notifikasi — SELESAI (15 Okt 2026)

Koleksi `notifikasi` (satu koleksi, tiga jenis), rules, indeks, lonceng di header, halaman `/notifikasi` (admin: kotak masuk bertab; guru: formulir lapor + riwayat). Tambahan dari permintaan: dropdown guru di dashboard admin, grafik jumlah siswa diganti Kelengkapan per kelas.
Berkas: `types/notifikasi.ts`, `lib/notifikasiRumus.ts`, `lib/notifikasi.ts`, `pages/Notifikasi.tsx`, `components/Layout.tsx`, `components/Icon.tsx`, `App.tsx`, `pages/AdminDashboard.tsx`, `lib/monitoringAdminRumus.ts`, `lib/monitoringAdmin.ts`, `pages/Home.tsx`, `firestore.rules`, `firestore.indexes.json`, `scripts/cek-notifikasi.mjs`.
Sisa untuk dijalankan pemilik: deploy rules DAN indeks, lalu uji kirim laporan dengan akun guru dan ubah status dengan akun admin.

## Tahap 4–5 — Cetak untuk admin — SELESAI (16 Okt 2026)

Tahap 4 (15 Okt) salah menafsirkan "laporan STS" sebagai rekap nilai; dikoreksi di Tahap 5 setelah pemilik menyerahkan repo v1 dan v2 sebagai referensi.
- Rapor STS (rapor bayangan, format v1) untuk wali kelas dan admin, per siswa dan seluruh kelas. Lihat ANTIREGRESI §21.
- Laporan Tahsin-Tahfizh per siswa untuk orang tua (format v2). Lihat ANTIREGRESI §22.
Belum diuji dengan data Firestore sungguhan. Uji: cetak rapor satu kelas yang cakupan dan nilai STS-nya sudah terisi, bandingkan angka dengan halaman Nilai STS & SAS; cetak laporan Tahsin satu kelas yang sudah punya setoran.

## Tahap 6 — Rapor SAS — SELESAI (16 Okt 2026)

Rapor SAS (form penuh v1), data pelengkap yang diisi wali kelas (absensi, catatan wali, keputusan, kokurikuler manual, ekskul), master ekskul oleh admin. ANTIREGRESI §23.
Belum diuji dengan data sungguhan. Uji: deploy rules; admin isi master ekskul; wali kelas isi Kelengkapan satu kelas; cetak Rapor SAS dan cocokkan nilai dengan halaman Nilai STS & SAS.

## Tahap 7 — Pantauan kelengkapan rapor — SELESAI (16 Okt 2026)

Tab Kelengkapan Rapor + kartu Ringkasan + peringatan tanggal rapor belum diatur. ANTIREGRESI §24.

## Tahap 8 — Kokurikuler penuh seperti v2 — BELUM (menunggu keputusan pemilik)

Sekarang deskripsi kokurikuler ditulis manual per siswa. Di v2 alurnya: (1) master Dimensi Profil Lulusan (`dpl`) per kelas, (2) Proyek STEM per kelas/semester yang memilih DPL, (3) penilaian per siswa × DPL × proyek (level 1–4 + deskripsi), (4) observasi 7 Kebiasaan (G7KAIH) per siswa, (5) `susunDraftDeskripsiKokurikuler` menyusun draf dari (3) dan (4) yang tetap diedit wali kelas, hasilnya mengisi `kokurikuler_rapor`.
Rencana bertahap: 8a master DPL + Proyek STEM; 8b penilaian per siswa; 8c 7KAIH; 8d tombol "Susun draf" di Kelengkapan Rapor. Perlu dari pemilik: daftar DPL yang dipakai sekolah dan apakah 7KAIH ikut dipakai.

## Ide lanjutan (belum dikerjakan)

- Pengingat dari admin ke guru yang belum input (memakai `notifikasi` arah admin → guru, perlu field penerima dan rules baca baru).
- Laporan mutasi yang langsung membuka form Data Siswa admin dengan data terisi.
- Tanggal input terakhir per guru; ekspor rekap guru yang belum input ke Excel.
- Deskripsi otomatis predikat ekstrakurikuler (v2: empat kalimat tetap per predikat di master ekskul, mengisi keterangan saat predikat dipilih).
- Rapor SAS untuk kelas 6: teks kelulusan (v1 tetap "Naik ke Fase D | Kelas 7").
- Catat Menulis (sumber data bagian 3 laporan Tahsin) dan Absensi (mengisi Ketidakhadiran di rapor STS).
- Notifikasi real-time dan pemberitahuan di luar aplikasi.
