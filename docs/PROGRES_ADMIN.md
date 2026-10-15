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

## Tahap 4 — Cetak laporan untuk admin — SELESAI (15 Okt 2026)

Rekap STS/SAS per kelas dan laporan Tahsin-Tahfizh per kelas, keduanya hanya membaca (ANTIREGRESI §20).
Berkas: `lib/asesmenRumus.ts`, `lib/rekapAsesmen.ts`, `lib/tahsinLaporanRumus.ts`, `lib/laporanTahsin.ts`, `lib/penandatangan.ts`, `pages/akademik/LaporanStsSas.tsx`, `pages/tahsin/LaporanTahsin.tsx`, `App.tsx`, `AkademikHub.tsx`, `TahsinHub.tsx`, `tahsinData.ts`, `raporSts.ts`, `scripts/cek-laporan-cetak.mjs`.
Belum diuji dengan data sungguhan: cetak satu kelas yang nilainya sudah terisi dan bandingkan beberapa angka dengan halaman Nilai STS & SAS.

## Ide lanjutan (belum dikerjakan)

- Pengingat dari admin ke guru yang belum input (memakai `notifikasi` arah admin → guru, perlu field penerima dan rules baca baru).
- Laporan mutasi yang langsung membuka form Data Siswa admin dengan data terisi.
- Tanggal input terakhir per guru; ekspor rekap guru yang belum input ke Excel.
- Cetak rekap per mapel (per TP) dan cetak laporan Tahsin satu siswa (riwayat lengkap) bila diperlukan.
- Rapor SAS (per siswa) untuk wali kelas, bila belum dibuat di v2.
- Notifikasi real-time dan pemberitahuan di luar aplikasi.
