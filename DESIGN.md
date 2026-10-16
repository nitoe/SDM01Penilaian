---
version: 1
name: SDM01-Penilaian
description: Sistem desain aplikasi penilaian SD Muhammadiyah 01 Kukusan. Alat kerja harian guru, bukan situs pemasaran. Satu warna merek (biru lambang sekolah), permukaan datar bergaris tipis, huruf Inter berbobot 400-600, dan warna tambahan hanya untuk arti status.

colors:
  brand: "#313083"
  brand-hover: "#282768"
  brand-sidebar: "#1f1f50"
  brand-tint: "#eff0fa"
  brand-line: "#bfc3e8"
  ink: "#1a1d33"
  ink-mute: "#5b6275"
  canvas: "#ffffff"
  canvas-app: "#f4f5f9"
  hairline: "#e2e4ee"
  ok: "#047857"
  ok-tint: "#ecfdf5"
  attention: "#b45309"
  attention-tint: "#fffbeb"
  danger: "#b91c1c"
  danger-tint: "#fef2f2"

typography:
  family: "Inter (dihosting sendiri, public/fonts), lalu system-ui"
  base: "14px / 1.5, bobot 400"
  heading: "600, letter-spacing -0.01 sampai -0.02em"
  numerals: "tabular-nums untuk tabel dan isian nilai"
  forbidden: "bobot 300 (font-light)"

rounded:
  card: 12px
  control: 8px
  pill: "hanya untuk lencana kecil dan avatar"
---

# Prinsip

Aplikasi ini dipakai guru setiap hari untuk menginput dan memeriksa nilai. Tampilan yang baik di sini berarti: cepat dibaca, urutan kerja jelas, dan tidak ada yang berkedip minta perhatian tanpa alasan.

1. **Satu warna merek.** Biru lambang sekolah (`#313083`) untuk tombol utama, pilihan aktif, tautan, dan sidebar. Tidak ada warna merek kedua.
2. **Warna membawa arti, bukan hiasan.** Hijau (`emerald`, bukan biru merek) = sukses/lulus/lengkap/aktif/level tertinggi. Skala 4 level: merah, ambar, sky, hijau. Ambar = perlu perhatian atau perlu diulang. Merah = gagal/galat. Biru = merek dan pilihan. Kartu tidak diberi warna sendiri-sendiri.
3. **Datar.** Permukaan putih dengan garis tipis (`hairline`) dan bayangan hampir tak terlihat. Tanpa gradient, mesh, glow, atau kaca.
4. **Isi mengalahkan hiasan.** Layar awal menjawab "apa yang harus saya kerjakan sekarang", bukan mendaftar semua fitur.
5. **Teks mudah dibaca.** Bobot minimal 400, kontras teks kecil minimal 4,5:1, angka rata di tabel.

# Bentuk dan tata letak

- **Shell:** sidebar kiri biru tua (`brand-sidebar`) berisi lambang sekolah, menu, dan profil; konten di atas `canvas-app`. Di layar kecil: header dengan lambang dan navigasi bawah. Tanpa bingkai melayang.
- **Kartu:** `card-soft` (putih, garis 1px, radius 12px). Ringkasan angka memakai `StatStrip`, bukan beberapa kartu berwarna.
- **Daftar kerja:** langkah berurutan memakai `FlowRow` (nomor, judul, keterangan, status). Hijau bercentang = selesai, ambar = perlu perhatian, biru = siap, abu = belum bisa.
- **Tombol utama:** biru penuh, radius 8px, teks putih bobot 600. Satu tombol utama per area.
- **Formulir:** isian radius 8px, garis `#cdd1e0`, fokus biru dengan cincin lembut. Label di atas isian.
- **Halaman masuk:** panel kiri biru tua dengan lambang sekolah sebagai watermark samar; panel kanan putih berisi formulir. Tanpa slogan pemasaran.

# Halaman admin

Halaman admin (Kelola Akun, Kelola Periode, dan seterusnya) memakai token bersama di `src/pages/akademik/shared.tsx`: `inputCls`, `btnPrimary`/`btnGhost`, `btnDanger*`, `Field`, `ChipToggle`, `Segmented`, `Notice`. Pola umum: judul + aksi utama di kepala halaman; daftar di kiri, detail atau formulir di kanan pada layar lebar (di bawahnya pada layar kecil); aksi merusak dipisahkan di bawah label "Tindakan lain" dan selalu lewat konfirmasi inline. Merah hanya untuk hapus permanen dan galat. Tombol simpan berada di dalam alur halaman, tidak pernah `fixed bottom-0` (tertutup navigasi bawah, ANTIREGRESI §21.2). Daftar yang tumbuh tiap tahun (mis. periode) dikelompokkan per tahun ajaran. `.card-soft` mengalahkan utilitas border/shadow/background Tailwind (ANTIREGRESI §20.2).

# Komponen (src/components/ui.tsx)

`PageHeader`, `HubPanel` + `HubRow`, `StatStrip`, `StatCard`, `FlowRow`, `Badge` (`neutral`, `brand`, `green`/`ok`, `peach`), `IconTile`, `SectionTitle`. Halaman baru memakai komponen ini dan ikon dari `Icon.tsx`; jangan membuat gaya kartu atau tombol sendiri (ANTIREGRESI §5.1, §19).

# Jangan

- Memakai gradient, mesh, atau bayangan besar.
- Memakai biru untuk status "Lulus" atau hijau sebagai warna merek.
- Memakai `font-light`, huruf kapital berlebih, atau tombol berbentuk pil.
- Menampilkan catatan internal pengembang ("pratinjau", "naskah awal") di layar guru.
- Memuat font, ikon, atau skrip dari CDN (CSP hanya `'self'`).
- Mengubah warna atau bentuk lambang sekolah.

# Aset

Lambang: `public/logo-sdm.png` (transparan), `favicon-sdm-32.png`, `apple-touch-icon-sdm.png`, `favicon.svg`. Ganti nama berkas bila lambang diperbarui (cache `immutable`, ANTIREGRESI §19.8).
