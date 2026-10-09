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
