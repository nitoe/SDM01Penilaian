// Uji rumus laporan cetak: Rapor STS (rapor bayangan) dan Laporan Tahsin-Tahfizh.
// Jalankan: node --experimental-strip-types scripts/cek-laporan-cetak.mjs
import { readFileSync } from 'node:fs'
import { bobotUntukSts, hitungStsMapel, kalimatCapaian, muatanMapel, nilaiSasMapel } from '../src/lib/asesmenRumus.ts'
import {
  akurasiBacaan, dalamRentang, kelompokkanMenulis, kelompokkanSetoran, narasiHafalan, narasiMembaca,
  posisiMenulis, rataMenulis, rentangSemester, susunLaporanSiswa,
} from '../src/lib/tahsinLaporanRumus.ts'
import { bangunHalamanTahsin } from '../src/lib/tahsinLaporanHtml.ts'

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${n}`) }

// ── Rapor STS ──
const L = (d) => [{ min: 0, maks: 60, deskripsi: d[0] }, { min: 61, maks: 75, deskripsi: d[1] }, { min: 76, maks: 85, deskripsi: d[2] }, { min: 86, maks: 100, deskripsi: d[3] }]
const tp1 = { id: 't1', tipe: 'pengetahuan', bobotPerSemester: { 1: 60 }, levels: L(['a', 'b', 'c', 'menerapkan hukum nun sukun']) }
const tp2 = { id: 't2', tipe: 'pengetahuan', bobotPerSemester: { 1: 40 }, levels: L(['mengenal pesan pokok', 'b', 'c', 'd']) }
const tp0 = { id: 't0', tipe: 'pengetahuan', bobotPerSemester: { 1: 0 }, levels: L(['', '', '', '']) }
cek('bobot STS: pakai bobot semester', bobotUntukSts(tp1, '1') === 60)
cek('bobot STS: bobot 0 → 1', bobotUntukSts(tp0, '1') === 1)
cek('bobot STS: legacy bobotMapel', bobotUntukSts({ semester: '1', bobotMapel: 25 }, '1') === 25)
const sts = { t1: { a: { nilai: 90 } }, t2: { a: { nilai: 50 } } }
const h = hitungStsMapel([tp1, tp2], sts, 'a', '1')
cek('STS mapel tertimbang 60/40 = 74', h.nilaiAkhir === 74)
cek('capaian terbaik dari TP bernilai tertinggi', h.capaianTerbaik === 'menerapkan hukum nun sukun')
cek('capaian perlu bimbingan dari TP terendah', h.capaianPerluBimbingan === 'mengenal pesan pokok')
const h1 = hitungStsMapel([tp1], { t1: { a: { nilai: 90 } } }, 'a', '1')
cek('satu TP: tidak ada "perlu bimbingan"', h1.capaianPerluBimbingan === '' && h1.nilaiAkhir === 90)
cek('siswa tanpa nilai STS → null, tanpa capaian', hitungStsMapel([tp1, tp2], sts, 'b', '1').nilaiAkhir === null && hitungStsMapel([tp1], sts, 'b', '1').capaianTerbaik === '')
cek('tanpa TP cakupan → kosong', hitungStsMapel([], sts, 'a', '1').nilaiAkhir === null)
cek('kalimat capaian pola v1', kalimatCapaian('menerapkan hukum nun sukun', 'mengenal pesan pokok').join('|') ===
  'Mencapai kompetensi dengan sangat baik dalam menerapkan hukum nun sukun.|Perlu peningkatan dalam mengenal pesan pokok.')
cek('kalimat capaian: titik tidak ganda', kalimatCapaian('x.', '')[0] === 'Mencapai kompetensi dengan sangat baik dalam x.')
cek('kalimat capaian kosong', kalimatCapaian('', '  ').length === 0)
cek('muatan: Bahasa Arab & Kemuhammadiyahan = yayasan', muatanMapel('Bahasa Arab') === 'yayasan' && muatanMapel('Kemuhammadiyahan') === 'yayasan')
cek('muatan: Al-Islam dan lainnya = wajib', muatanMapel('Al-Islam') === 'wajib' && muatanMapel('IPAS') === 'wajib')
const slm = { t1: { a: { slm: 70 } }, t2: { a: { slm: 80 } } }
const sas = { t1: { a: { nilai: 90 } }, t2: { a: { nilai: 100 } } }
cek('SAS: gabung SLM+SAS per TP lalu bobot = 82', nilaiSasMapel([tp1, tp2], { slm, sts: {}, sas, cakupanSas: new Set(['t1', 't2']) }, 'a', '1') === 82)

// ── Tahsin ──
const kw = (detik) => ({ seconds: detik, nanoseconds: 0 })
const setoran = [
  { siswaId: 'a', jenis: 'ziyadah', statusHafalan: 'lulus', materi: { tipe: 'quran', label: 'An-Naba 1-5' }, createdAt: kw(100),
    detailAyat: [{ kataSalah: [{ jenis: 'tajwid' }, { jenis: 'makhroj' }] }, { kataSalah: [] }] },
  { siswaId: 'a', jenis: 'murojaah', statusHafalan: 'lulus', materi: { tipe: 'quran', label: 'An-Naba 1-5' }, createdAt: kw(300) },
  { siswaId: 'a', jenis: 'tahsin', statusHafalan: null, materi: { tipe: 'quran', label: 'Al-Fatihah' }, createdAt: kw(200) },
  { siswaId: 'b', jenis: 'ziyadah', statusHafalan: 'ulang', materi: { tipe: 'quran', label: 'Abasa' }, createdAt: kw(50) },
]
const grup = kelompokkanSetoran(setoran)
cek('kelompok setoran: terbaru dulu', grup.a[0].createdAt.seconds === 300 && grup.a[2].createdAt.seconds === 100)
const lap = susunLaporanSiswa({ nama: 'Ahmad Fauzi', jenjang: 'quran' }, grup.a, [])
cek('nama depan', lap.namaDepan === 'Ahmad')
cek('membaca: 2 ayat, 1 tajwid, 1 makhraj', lap.membaca.ayatDinilai === 2 && lap.membaca.tajwid === 1 && lap.membaca.makhroj === 1)
cek('membaca: log hanya sesi ber-Baca&Tandai', lap.membaca.log.length === 1)
cek('hafalan: tahsin tidak dihitung sebagai hafalan', lap.hafalan.totalSesi === 2 && lap.hafalan.ziyadahLulus === 1 && lap.hafalan.murojaah === 1)
cek('hafalan: posisi terakhir dari setoran terbaru', lap.hafalan.narasi.includes('An-Naba 1-5') && lap.hafalan.narasi.includes('1 materi hafalan baru'))
cek('menulis kosong → narasi belum ada', lap.menulis.narasi.startsWith('Belum ada catatan pemeriksaan') && lap.menulis.nilaiTerakhir === '-')
const a = akurasiBacaan(0, 0, 4)
cek('akurasi bersih = 100% Istimewa', a.pct === 100 && a.label === 'Istimewa')
cek('akurasi: galat 1/ayat = 65% Cukup', akurasiBacaan(1, 0, 1).pct === 65 && akurasiBacaan(1, 0, 1).label === 'Cukup')
cek('akurasi: tanpa ayat = null', akurasiBacaan(0, 0, 0) === null)
cek('narasi membaca tanpa data', narasiMembaca(0, 0, 0, 'Ani').startsWith('Belum ada data penilaian bacaan'))
cek('narasi hafalan iqro', narasiHafalan(true, 0, 0, 'Iqro 2 — Hal. 5', 3, 'Ani').includes('3 kali sesi bimbingan membaca Iqro'))
const mn = [{ id: 'm1', siswaId: 'a', kelas: '5A', materi: { tipe: 'quran', label: 'Al-Baqarah 1-5' }, penilaian: { hurufSambungan: 4, harakat: 3, keutuhanTeks: 4, kerapian: 3 }, tanggalPeriksa: '2026-10-10' },
  { id: 'm2', siswaId: 'a', kelas: '5A', materi: { tipe: 'quran', label: 'Al-Baqarah 1-3' }, tanggalPeriksa: '2026-09-01' }]
const km = kelompokkanMenulis(mn)
cek('menulis: terbaru dulu', km.a[0].id === 'm1')
cek('menulis: rata-rata 3.5', rataMenulis(km.a[0]) === 3.5)
cek('menulis: posisi label Al-Qur\'an', posisiMenulis(km.a[0]) === 'Al-Baqarah 1-5')
const lap2 = susunLaporanSiswa({ nama: 'Ahmad', jenjang: 'quran' }, [], km.a)
cek('menulis: narasi level sangat baik', lap2.menulis.narasi.includes('sangat baik') && lap2.menulis.narasi.includes('3.5/4') && lap2.menulis.nilaiTerakhir === '3.5/4')
cek('rentang semester ganjil', rentangSemester('2026/2027', '1').dari === '2026-07-01' && rentangSemester('2026/2027', '1').sampai === '2026-12-31')
cek('rentang semester genap pakai tahun kedua', rentangSemester('2026/2027', '2').dari === '2027-01-01' && rentangSemester('2026/2027', '2').sampai === '2027-06-30')
cek('dalam rentang: batas akhir hari termasuk', dalamRentang('2026-12-31T20:00:00', '2026-07-01', '2026-12-31') && !dalamRentang('2027-01-01T00:00:00', '2026-07-01', '2026-12-31'))
cek('dalam rentang: tanpa waktu = di luar', !dalamRentang(null, '2026-07-01', '2026-12-31'))

const html = bangunHalamanTahsin({ sekolah: 'SD <Uji>', labelPeriode: 'Ganjil 2026/2027', rentang: 'a – b', siswa: { nama: 'A & B', nomor: '1', kelas: '5A', jenjang: 'quran' },
  guruNama: 'Guru', laporan: lap, target: { judul: 'Ganjil', stat: [{ n: '1/2', l: 'Surah Tercapai' }], surah: [{ nama: 'An-Naba', persen: 100 }] },
  kota: 'Depok', tanggal: '1 Januari 2027', namaKepsek: 'Kepsek', nbmKepsek: '123' })
cek('HTML: teks di-escape', html.includes('SD &lt;Uji&gt;') && html.includes('A &amp; B') && !html.includes('<Uji>'))
cek('HTML: memuat tiga bagian, target, dan tanda tangan', ['1. Membaca', '2. Menghapal', '3. Menulis', 'Target Hafalan', 'Guru Tahsin-Tahfizh,', 'NBM. 123'].every((t) => html.includes(t)))
cek('HTML: tanpa emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html))

// ── struktur: halaman cetak hanya membaca ──
for (const f of ['src/lib/laporanTahsin.ts', 'src/lib/raporSts.ts', 'src/pages/akademik/Rapor.tsx', 'src/pages/tahsin/LaporanTahsin.tsx']) {
  const t = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
  cek(`${f}: tidak ada operasi tulis`, !/\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|saveSetoran|saveNilai|saveTP)\b/.test(t))
}

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
