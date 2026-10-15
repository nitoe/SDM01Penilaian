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

## Tahap 3 — Fondasi notifikasi — BELUM

Koleksi baru (daftarkan di rules dan `DATA_MODEL.md`): `notifikasi`, `laporan_guru` (jenis: tugas, kendala), `mutasi_siswa` (masuk/keluar). Lonceng di header, kotak masuk admin bertab, formulir lapor untuk guru. Status baca per penerima.
