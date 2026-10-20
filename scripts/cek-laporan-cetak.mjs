// Uji rumus laporan cetak: Rapor STS (rapor bayangan) dan Laporan Tahsin-Tahfizh.
// Jalankan: node --experimental-strip-types scripts/cek-laporan-cetak.mjs
import { readFileSync } from 'node:fs'
import { awalanCapaianTerbaik, awalanCapaianTerendah, bobotUntukSts, fragmenCapaian, hitungStsMapel, kalimatCapaian, muatanMapel, nilaiSasMapel } from '../src/lib/asesmenRumus.ts'
import {
  akurasiBacaan, dalamRentang, kelompokkanMenulis, kelompokkanSetoran, narasiHafalan, narasiMembaca,
  posisiMenulis, rataMenulis, rentangSemester, susunLaporanSiswa,
} from '../src/lib/tahsinLaporanRumus.ts'
import { bangunHalamanTahsin } from '../src/lib/tahsinLaporanHtml.ts'
import { buildBodyPrintSts, buildBodyPrintSas, dokumenPratinjauRapor } from '../src/lib/raporHtml.ts'
import { namaFileRapor, namaFileRaporKelas } from '../src/lib/raporHtml.ts'

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
cek('levelIndex terbaik 90 → 3 (Sangat Baik)', h.levelIndexTerbaik === 3)
const h1 = hitungStsMapel([tp1], { t1: { a: { nilai: 90 } } }, 'a', '1')
cek('satu TP: tidak ada "perlu bimbingan"', h1.capaianPerluBimbingan === '' && h1.nilaiAkhir === 90)
cek('siswa tanpa nilai STS → null, tanpa capaian', hitungStsMapel([tp1, tp2], sts, 'b', '1').nilaiAkhir === null && hitungStsMapel([tp1], sts, 'b', '1').capaianTerbaik === '')
cek('tanpa TP cakupan → kosong', hitungStsMapel([], sts, 'a', '1').nilaiAkhir === null)

// Nilai rendah (34): awalan BUKAN "sangat baik"
const stsRendah = { t1: { a: { nilai: 34 } }, t2: { a: { nilai: 20 } }, t3: { a: { nilai: 40 } } }
const tp3 = { id: 't3', tipe: 'pengetahuan', bobotPerSemester: { 1: 1 }, levels: L(['identifikasi lemah', 'b', 'c', 'identifikasi kuat']) }
const hR = hitungStsMapel([tp1, tp2, tp3], stsRendah, 'a', '1')
cek('3 TP terisi: ada diferensiasi terbaik vs terendah', hR.capaianTerbaik === 'identifikasi lemah' && hR.capaianPerluBimbingan === 'mengenal pesan pokok')
cek('nilai terbaik 40 → levelIndex 0 (Perlu Bimbingan)', hR.levelIndexTerbaik === 0)
cek('awalan level 0', awalanCapaianTerbaik(0) === 'Masih memerlukan bimbingan dalam')
cek('awalan level 1', awalanCapaianTerbaik(1) === 'Mencapai kompetensi dengan cukup baik dalam')
cek('awalan level 2', awalanCapaianTerbaik(2) === 'Mencapai kompetensi dengan baik dalam')
cek('awalan level 3', awalanCapaianTerbaik(3) === 'Mencapai kompetensi dengan sangat baik dalam')
cek('awalan tanpa level → netral', awalanCapaianTerbaik(null) === 'Mencapai kompetensi dalam')
const kalR = kalimatCapaian(hR.capaianTerbaik, hR.capaianPerluBimbingan, hR.levelIndexTerbaik, hR.levelIndexTerendah)
cek('nilai rendah: tidak ada frasa "sangat baik"', !kalR.some((k) => /sangat baik/i.test(k)))
cek('nilai rendah: kedua baris awalan bimbingan (level 0)', kalR[0].startsWith('Masih memerlukan bimbingan dalam') && kalR[1].startsWith('Masih memerlukan bimbingan dalam'))
cek('levelIndex terendah 20 → 0', hR.levelIndexTerendah === 0)

// Kasus Abyan: TP terendah 82 (level 2) — BUKAN "perlu bimbingan/peningkatan"
cek('awalan terendah level 0 = bimbingan', awalanCapaianTerendah(0) === 'Masih memerlukan bimbingan dalam')
cek('awalan terendah level 1 = perlu peningkatan', awalanCapaianTerendah(1) === 'Perlu peningkatan dalam')
cek('awalan terendah level 2 = baik (bukan perlu)', awalanCapaianTerendah(2) === 'Mencapai kompetensi dengan baik dalam')
cek('awalan terendah level 3 = sangat baik (bukan perlu)', awalanCapaianTerendah(3) === 'Mencapai kompetensi dengan sangat baik dalam')
const tpHigh = [
  { id: 'h1', tipe: 'pengetahuan', namaTp: 'TP A', bobotPerSemester: { 1: 1 }, levels: L(['a0', 'a1', 'a2', 'menyelesaikan semua soal dengan benar']) },
  { id: 'h2', tipe: 'pengetahuan', namaTp: 'TP B', bobotPerSemester: { 1: 1 }, levels: L(['b0', 'b1', 'menyelesaikan sebagian besar soal perkalian', 'b3']) },
]
const stsHigh = { h1: { a: { nilai: 91 } }, h2: { a: { nilai: 82 } } }
const hAbyan = hitungStsMapel(tpHigh, stsHigh, 'a', '1')
cek('Abyan: level terbaik 91 → 3, terendah 82 → 2', hAbyan.levelIndexTerbaik === 3 && hAbyan.levelIndexTerendah === 2)
const kalAbyan = kalimatCapaian(hAbyan.capaianTerbaik, hAbyan.capaianPerluBimbingan, hAbyan.levelIndexTerbaik, hAbyan.levelIndexTerendah)
cek('Abyan: baris 1 sangat baik', kalAbyan[0].startsWith('Mencapai kompetensi dengan sangat baik dalam'))
cek('Abyan: baris 2 "dengan baik" — tanpa perlu bimbingan/peningkatan', kalAbyan[1].startsWith('Mencapai kompetensi dengan baik dalam') && !/perlu (bimbingan|peningkatan)/i.test(kalAbyan[1]))


// Diferensiasi 2 baris wajib bila ≥2 TP ber-nilai (meski deskripsi level kosong → fallback nama TP)
const tpKosong = [
  { id: 'k1', tipe: 'pengetahuan', namaTp: 'Mengamati perubahan alam', bobotPerSemester: { 1: 1 }, levels: L(['', '', '', '']) },
  { id: 'k2', tipe: 'pengetahuan', namaTp: 'Menjelaskan dampak aktivitas manusia', bobotPerSemester: { 1: 1 }, levels: L(['', '', '', '']) },
  { id: 'k3', tipe: 'pengetahuan', namaTp: 'Mengusulkan solusi sederhana', bobotPerSemester: { 1: 1 }, levels: L(['', '', '', '']) },
]
const sts3 = { k1: { a: { nilai: 50 } }, k2: { a: { nilai: 30 } }, k3: { a: { nilai: 40 } } }
const hKosong = hitungStsMapel(tpKosong, sts3, 'a', '1')
cek('3 TP deskripsi kosong: tetap ada terbaik + terburuk (fallback nama)', !!hKosong.capaianTerbaik && !!hKosong.capaianPerluBimbingan)
cek('fallback terbaik dari TP nilai tertinggi (50)', hKosong.capaianTerbaik.toLowerCase().includes('mengamati perubahan alam'))
cek('fallback terburuk dari TP nilai terendah (30)', hKosong.capaianPerluBimbingan.toLowerCase().includes('menjelaskan dampak'))
const kalKosong = kalimatCapaian(hKosong.capaianTerbaik, hKosong.capaianPerluBimbingan, hKosong.levelIndexTerbaik)
cek('2 kalimat capaian tercetak', kalKosong.length === 2)

// Pool capaian di luar cakupan: nilai akhir hanya dari cakupan, capaian dari semua yang ber-nilai
const hPool = hitungStsMapel(
  [tpKosong[0]], // cakupan hanya k1
  sts3,
  'a',
  '1',
  tpKosong, // pool capaian: ketiga TP
)
cek('nilai akhir tetap dari cakupan saja (50)', hPool.nilaiAkhir === 50)
cek('capaian tetap diferensiasi dari pool 3 TP', !!hPool.capaianTerbaik && !!hPool.capaianPerluBimbingan && hPool.capaianPerluBimbingan.toLowerCase().includes('menjelaskan dampak'))

// Pola v1 untuk capaian tinggi (level 3)
cek('kalimat capaian level 3 (sangat baik)', kalimatCapaian('menerapkan hukum nun sukun', 'mengenal pesan pokok', 3).join('|') ===
  'Mencapai kompetensi dengan sangat baik dalam menerapkan hukum nun sukun.|Perlu peningkatan dalam mengenal pesan pokok.')
cek('kalimat capaian: titik tidak ganda', kalimatCapaian('x.', '', 3)[0] === 'Mencapai kompetensi dengan sangat baik dalam x.')
cek('kalimat capaian kosong', kalimatCapaian('', '  ').length === 0)
cek('fragmen: huruf pertama dipaksa kecil', fragmenCapaian('Membuat diagram batang') === 'membuat diagram batang')
cek('fragmen: kalimat kedua tetap kapital', fragmenCapaian('Membuat diagram. Menjawab soal.') === 'membuat diagram. Menjawab soal.')
cek('kalimat capaian: tidak ada kapital di tengah setelah dalam', kalimatCapaian('Membuat diagram batang', 'Menyusun tangram', 3).join('|') ===
  'Mencapai kompetensi dengan sangat baik dalam membuat diagram batang.|Perlu peningkatan dalam menyusun tangram.')
cek('muatan: Bahasa Arab & Kemuhammadiyahan = yayasan', muatanMapel('Bahasa Arab') === 'yayasan' && muatanMapel('Kemuhammadiyahan') === 'yayasan')
cek('muatan: Al-Islam dan lainnya = wajib', muatanMapel('Al-Islam') === 'wajib' && muatanMapel('IPAS') === 'wajib')
const slm = { t1: { a: { slm: 70 } }, t2: { a: { slm: 80 } } }
const sas = { t1: { a: { nilai: 90 } }, t2: { a: { nilai: 100 } } }
cek('SAS: gabung SLM+SAS per TP lalu bobot = 82', nilaiSasMapel([tp1, tp2], { slm, sts: {}, sas, cakupanSas: new Set(['t1', 't2']) }, 'a', '1') === 82)


// ── Nama file PDF cetak ──
cek('nama file STS satu siswa', namaFileRapor('sts', 'Abyan Nandana Khalif') === 'Rapor STS - Abyan Nandana Khalif')
cek('nama file SAS satu siswa', namaFileRapor('sas', 'Abdurrahman Ar Ribery') === 'Rapor SAS - Abdurrahman Ar Ribery')
cek('nama file: karakter terlarang dibersihkan', namaFileRapor('sts', 'Ahmad / Siti: Uji') === 'Rapor STS - Ahmad Siti Uji')
cek('nama file kelas', namaFileRaporKelas('sts', '5A') === 'Rapor STS - Kelas 5A')
cek('nama file tanpa nama siswa', namaFileRapor('sas', '  ') === 'Rapor SAS')

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

// ── HTML rapor ──
const mk = (mapel, n, b, w, muatan, levelIndexTerbaik = 3, levelIndexTerendah = null) => ({ mapel, labelMapel: mapel, urutan: 1, muatan, nilaiAkhir: n, capaianTerbaik: b, capaianPerluBimbingan: w, levelIndexTerbaik, levelIndexTerendah })
const dRapor = (over = {}) => ({ config: { namaSekolah: 'SD Muhammadiyah 01 Kukusan', alamatSekolah: 'Jl. Contoh', namaKepsek: 'Drs. Contoh', nbmKepsek: '123' },
  siswa: { id: 'a', nama: 'Ahmad', nisn: '999' }, kelas: '5A', fase: 'C', semester: '1', semLabel: 'Ganjil', tahunAjaran: '2026/2027',
  waliNama: 'Bu Wali', kota: 'Depok', tanggal: '16 Oktober 2026',
  daftarNilai: [mk('Al-Islam', 88, 'melafalkan QS', 'memahami pesan', 'wajib'), mk('Bahasa Arab', 79, 'kosakata', '', 'yayasan')], ...over })
const sts2 = buildBodyPrintSts(dRapor())
cek('STS: judul hanya "Sumatif Tengah Semester" (tanpa Ganjil/Genap)', sts2.includes('>Sumatif Tengah Semester</div>') && !/Sumatif Tengah Semester\s+(Ganjil|Genap)/.test(sts2))
cek('STS: semester tetap tampil di identitas', sts2.includes('I (Ganjil)') && sts2.includes('2026/2027'))
cek('STS: tanpa ketidakhadiran, catatan wali, tanggapan orang tua', !/Ketidakhadiran|Catatan Wali|Tanggapan Orang Tua/.test(sts2))
cek('STS: tanpa tanda tangan kepala sekolah', !sts2.includes('Kepala Sekolah') && !sts2.includes('Drs. Contoh') && !sts2.includes('NBM'))
const kolomWali = sts2.slice(sts2.indexOf('Wali Kelas,') - 120, sts2.indexOf('Bu Wali') + 10)
cek('tempat & tanggal di dalam kolom Wali Kelas (bukan rata kanan)', kolomWali.includes('Depok, 16 Oktober 2026') && !sts2.includes('rpr-ttd-tanda'))
cek('kolom Orang Tua punya baris kosong setinggi tempat/tanggal', /rpr-ttd-tempat">&nbsp;<\/div><div>Orang Tua\/Wali/.test(sts2))
cek('STS: tanda tangan orang tua dan wali kelas', sts2.includes('Orang Tua/Wali') && sts2.includes('Wali Kelas,') && sts2.includes('Bu Wali') && sts2.includes('rpr-ttd dua'))
cek('STS: A.1 dan A.2 serta kalimat capaian v1', sts2.includes('A.1. Muatan Wajib') && sts2.includes('A.2. Muatan Yayasan') && sts2.includes('Mencapai kompetensi dengan sangat baik dalam melafalkan QS.'))
cek('STS: tanpa kokurikuler/ekskul', !/Kokurikuler|Ekstrakurikuler/.test(sts2))
cek('STS: identitas kanan memakai kelas penggeser', sts2.includes('rpr-info-kanan'))
cek('STS Fase A: keterangan baku Muatan Yayasan', buildBodyPrintSts(dRapor({ fase: 'A', kelas: '2A', daftarNilai: [mk('Al-Islam', 80, 'x', '', 'wajib')] })).includes('Belum menjadi fokus tersendiri di Fase A'))
cek('STS: teks di-escape', buildBodyPrintSts(dRapor({ siswa: { id: 'a', nama: 'A <b> & B' } })).includes('A &lt;b&gt; &amp; B'))
const sasHtml = buildBodyPrintSas(dRapor({ semester: '2', semLabel: 'Genap', kokurikuler: 'Proyek STEM sampah', ekskul: [{ nama: 'Pramuka', ket: 'Mahir' }], absensi: { sakit: 1, izin: 2, tk: 0 }, catatanWali: 'Pertahankan' }))
cek('SAS: judul "Sumatif Akhir Semester"', sasHtml.includes('>Sumatif Akhir Semester</div>'))
cek('SAS: memuat B Kokurikuler, C Ekstrakurikuler, D Ketidakhadiran', ['B. Kokurikuler', 'Proyek STEM sampah', 'C. Ekstrakurikuler', 'Pramuka', 'D. Ketidakhadiran', '1 hari', '2 hari'].every((x) => sasHtml.includes(x)))
cek('SAS: catatan wali, tanggapan orang tua, keputusan, tiga tanda tangan', ['Catatan Wali', 'Pertahankan', 'Tanggapan Orang Tua/Wali Murid', 'Naik ke Fase', 'Kepala Sekolah,', 'Drs. Contoh', 'NBM. 123'].every((x) => sasHtml.includes(x)))
cek('SAS semester 1: tanpa keputusan kenaikan', !buildBodyPrintSas(dRapor()).includes('Naik ke Fase'))
cek('SAS keputusan tinggal: Naik dicoret', buildBodyPrintSas(dRapor({ semester: '2', keputusan: 'Tinggal' })).includes('<s>Naik ke Fase'))
cek('SAS tanpa data: absensi isian kosong', buildBodyPrintSas(dRapor()).includes('……… hari'))
cek('pratinjau: banyak siswa dipisah per halaman', (dokumenPratinjauRapor([dRapor(), dRapor()], 'sts').match(/class="rpr-page"/g) || []).length === 2)

// ── struktur: halaman cetak hanya membaca ──
for (const f of ['src/lib/laporanTahsin.ts', 'src/lib/raporSts.ts', 'src/lib/raporHtml.ts', 'src/pages/akademik/Rapor.tsx', 'src/pages/tahsin/LaporanTahsin.tsx']) {
  const t = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
  cek(`${f}: tidak ada operasi tulis`, !/\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|saveSetoran|saveNilai|saveTP)\b/.test(t))
}

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
