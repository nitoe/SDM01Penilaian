// Uji Rapor SAS dan data pelengkapnya. Jalankan: node --experimental-strip-types scripts/cek-rapor-sas.mjs
import { readFileSync } from 'node:fs'
import { hitungSasMapel, nilaiSasMapel } from '../src/lib/asesmenRumus.ts'
import { bersihkanAbsensi, ekskulUntukRapor, idAbsensi, idEkskulSiswa, keputusanRapor, slugEkskul } from '../src/lib/raporDataRumus.ts'
import { buildBodyPrintSas, buildBodyPrintSts } from '../src/lib/raporHtml.ts'

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${n}`) }

// ── nilai SAS mapel ──
const L = (d) => [{ min: 0, maks: 60, deskripsi: d[0] }, { min: 61, maks: 75, deskripsi: d[1] }, { min: 76, maks: 85, deskripsi: d[2] }, { min: 86, maks: 100, deskripsi: d[3] }]
const tp1 = { id: 't1', tipe: 'pengetahuan', bobotPerSemester: { 2: 60 }, levels: L(['a1', 'b1', 'c1', 'menerapkan hukum nun sukun']) }
const tp2 = { id: 't2', tipe: 'pengetahuan', bobotPerSemester: { 2: 40 }, levels: L(['mengenal pesan pokok', 'b2', 'c2', 'd2']) }
const tp0 = { id: 't0', tipe: 'pengetahuan', bobotPerSemester: { 2: 0 }, levels: L(['', '', '', '']) }
const data = {
  slm: { t1: { a: { slm: 70 }, b: { slm: 90 } }, t2: { a: { slm: 80 }, b: { slm: 40 } } },
  sts: {},
  sas: { t1: { a: { nilai: 90 }, b: { nilai: 92 } }, t2: { a: { nilai: 100 }, b: { nilai: 30 } } },
  cakupanSas: new Set(['t1', 't2']),
}
const a = hitungSasMapel([tp1, tp2], data, 'a', '2')
cek('SAS a: TP1 78, TP2 88 → mapel 82', a.nilaiAkhir === 82)
cek('SAS a: capaian terbaik dari TP bernilai akhir tertinggi (TP2 = 88)', a.capaianTerbaik === 'd2')
cek('SAS a: perlu peningkatan dari TP bernilai akhir terendah (TP1 = 78)', a.capaianPerluBimbingan === 'c1')
cek('SAS: selaras dengan nilaiSasMapel', nilaiSasMapel([tp1, tp2], data, 'a', '2') === a.nilaiAkhir)
const b = hitungSasMapel([tp1, tp2], data, 'b', '2')
cek('SAS b: nilai akhir mapel hanya dari yang terisi (91×0,6 + 34×0,4 = 68)', b.nilaiAkhir === Math.round(0.6 * ((90 * 0.6) + (92 * 0.4)) + 0.4 * ((40 * 0.6) + (30 * 0.4))))
cek('SAS: siswa tanpa nilai → null dan tanpa capaian', hitungSasMapel([tp1], { ...data, slm: {}, sas: {} }, 'a', '2').nilaiAkhir === null)
cek('SAS: TP tanpa cakupan SAS hanya memakai SLM', hitungSasMapel([tp1], { ...data, cakupanSas: new Set() }, 'a', '2').nilaiAkhir === 70)
cek('SAS: STS lebih tinggi menggantikan SLM', hitungSasMapel([tp1], { ...data, cakupanSas: new Set(), sts: { t1: { a: { nilai: 95 } } } }, 'a', '2').nilaiAkhir === 95)
cek('SAS: TP berbobot 0 tidak dihitung', hitungSasMapel([tp0, tp1], { ...data, slm: { t0: { a: { slm: 5 } }, t1: { a: { slm: 70 } } }, sas: {}, cakupanSas: new Set() }, 'a', '2').nilaiAkhir === 70)
cek('SAS: tanpa TP → kosong', hitungSasMapel([], data, 'a', '2').nilaiAkhir === null)

// ── data pelengkap ──
cek('slug ekskul', slugEkskul('  Pramuka (Hizbul Wathan) ') === 'pramuka-hizbul-wathan' && slugEkskul('!!!') === '')
cek('ID dokumen deterministik', idAbsensi('s1', '2026/2027', '2') === 's1_2026-2027-2' && idEkskulSiswa('s1', 'pramuka', '2026/2027', '1') === 's1__pramuka__2026-2027-1')
const bersih = bersihkanAbsensi({ siswaId: 's', kelas: '5A', semester: '2', tahunAjaran: '2026/2027', sakit: -3, izin: '4.9', tanpaKeterangan: 9999, catatanWali: '  x'.repeat(800), keputusan: 'Lulus' })
cek('absensi: hari dibatasi 0..366 dan dibulatkan', bersih.sakit === 0 && bersih.izin === 4 && bersih.tanpaKeterangan === 366)
cek('absensi: catatan dipotong 1000 dan keputusan tak dikenal → Belum diputuskan', bersih.catatanWali.length <= 1000 && bersih.keputusan === 'Belum diputuskan')
cek('absensi: NaN → 0', bersihkanAbsensi({ siswaId: 's', kelas: '5A', semester: '1', tahunAjaran: 'x', sakit: 'abc' }).sakit === 0)
cek('keputusan rapor', keputusanRapor('Naik Kelas') === 'Naik' && keputusanRapor('Tinggal Kelas') === 'Tinggal' && keputusanRapor('Belum diputuskan') === null && keputusanRapor(undefined) === null)
const ek = ekskulUntukRapor([{ nama: 'Renang', level: 4, deskripsi: '' }, { nama: 'Pramuka', level: 3, deskripsi: 'a' }, { nama: 'Futsal', level: 1, deskripsi: '' }])
cek('ekskul rapor: level 4 (tidak ikut) disaring dan urut nama', ek.length === 2 && ek[0].nama === 'Futsal' && ek[1].nama === 'Pramuka')

// ── HTML SAS ──
const mk = (mapel, n, bt, w, muatan) => ({ mapel, labelMapel: mapel, urutan: 1, muatan, nilaiAkhir: n, capaianTerbaik: bt, capaianPerluBimbingan: w })
const dR = (o = {}) => ({ config: { namaSekolah: 'SD', alamatSekolah: 'Jl', namaKepsek: 'Drs. Contoh', nbmKepsek: '1' }, siswa: { id: 'a', nama: 'Ahmad', nisn: '9' },
  kelas: '5A', fase: 'C', semester: '2', semLabel: 'Genap', tahunAjaran: '2026/2027', waliNama: 'Bu Wali', kota: 'Depok', tanggal: '20 Juni 2027',
  daftarNilai: [mk('Al-Islam', 88, 'melafalkan', 'memahami', 'wajib'), mk('Bahasa Arab', 79, 'kosakata', '', 'yayasan')], ...o })
const html = buildBodyPrintSas(dR({ ekskul: [{ nama: 'Pramuka', predikat: 'Mahir', ket: 'Aktif' }], kokurikuler: 'Proyek STEM', absensi: { sakit: 1, izin: 0, tk: 2 }, catatanWali: 'Baik', keputusan: 'Naik' }))
cek('SAS html: kolom predikat ekskul', html.includes('Predikat') && html.includes('>Mahir<') && html.includes('Pramuka'))
cek('SAS html: absensi dan catatan wali terisi', html.includes('1 hari') && html.includes('2 hari') && html.includes('>Baik<'))
cek('SAS html: keputusan Naik → Tinggal dicoret', html.includes('<strong>Naik ke Fase') && html.includes('<s>Tinggal di kelas 5</s>'))
cek('SAS html: Tinggal → Naik dicoret', buildBodyPrintSas(dR({ keputusan: 'Tinggal' })).includes('<s>Naik ke Fase'))
const belum = buildBodyPrintSas(dR({ keputusan: null }))
cek('SAS html: belum diputuskan → tidak ada coretan (dicoret tangan)', belum.includes('Naik ke Fase') && !belum.includes('<s>') && belum.includes('coret yang tidak perlu'))
cek('SAS html: tanpa ekskul → keterangan tidak mengikuti', buildBodyPrintSas(dR()).includes('tidak mengikuti kegiatan ekstrakurikuler'))
cek('SAS html: tempat/tanggal di kolom wali kelas, tiga tanda tangan', html.includes('Depok, 20 Juni 2027') && html.includes('Kepala Sekolah,') && html.includes('Orang Tua/Wali'))
cek('STS tetap minimal (tanpa bagian SAS)', !/Kokurikuler|Ekstrakurikuler|Ketidakhadiran|Kepala Sekolah|Keputusan|Naik ke/.test(buildBodyPrintSts(dR())))

// ── rules ──
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const blok = (n) => { const i = rules.indexOf(`match /${n}/`); return i === -1 ? '' : rules.slice(i, rules.indexOf('\n    match /', i + 10)) }
for (const kol of ['absensi_rapor', 'kokurikuler_rapor', 'ekstrakurikuler_siswa']) {
  const t = blok(kol)
  cek(`rules ${kol}: ada`, t.length > 0)
  const tulis = t.split('\n').filter((l) => /allow (create|update|delete)/.test(l))
  cek(`rules ${kol}: tulis hanya wali kelas (tanpa admin)`, tulis.length === 3 && !tulis.some((l) => l.includes('isAdmin')) && /waliKelasSendiri/.test(t))
  cek(`rules ${kol}: baca admin atau wali`, /allow read: if isAdmin\(\) \|\| waliKelasSendiri/.test(t))
}
cek('rules absensi_rapor: hapus ditolak', /allow delete: if false/.test(blok('absensi_rapor')))
cek('rules absensi_rapor: validasi hari dan keputusan', /<= 366/.test(blok('absensi_rapor')) && /'Naik Kelas'/.test(blok('absensi_rapor')))
cek('rules ekstrakurikuler master: admin menulis, guru membaca', /allow read: if isGuru\(\)/.test(blok('ekstrakurikuler')) && /allow write: if isAdmin\(\)/.test(blok('ekstrakurikuler')))

// ── struktur: loader SAS hanya membaca ──
for (const f of ['src/lib/raporSas.ts']) {
  const t = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
  cek(`${f}: tidak ada operasi tulis`, !/\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch)\b/.test(t))
}

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
