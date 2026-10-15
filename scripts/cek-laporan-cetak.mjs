// Uji rumus laporan cetak STS/SAS dan Tahsin-Tahfizh.
// Jalankan: node --experimental-strip-types scripts/cek-laporan-cetak.mjs
import { readFileSync } from 'node:fs'
import { bobotUntukSts, nilaiStsMapel, nilaiSasMapel, rataNilai, susunRekap } from '../src/lib/asesmenRumus.ts'
import { kelompokkanSetoran, ringkasSetoranSiswa, ringkasKelasTahsin } from '../src/lib/tahsinLaporanRumus.ts'

let gagal = 0
const cek = (n, ok) => { if (!ok) gagal++; console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${n}`) }

// --- STS ---
const tp1 = { id: 't1', bobotPerSemester: { 1: 60 } }
const tp2 = { id: 't2', bobotPerSemester: { 1: 40 } }
const tp0 = { id: 't0', bobotPerSemester: { 1: 0 } }
cek('bobot STS: pakai bobot semester', bobotUntukSts(tp1, '1') === 60)
cek('bobot STS: bobot 0 → 1 (tetap dihitung di STS)', bobotUntukSts(tp0, '1') === 1)
cek('bobot STS: legacy bobotMapel', bobotUntukSts({ semester: '1', bobotMapel: 25 }, '1') === 25)
const sts = { t1: { a: { nilai: 80 } }, t2: { a: { nilai: 90 } } }
cek('STS mapel tertimbang 60/40 = 84', nilaiStsMapel([tp1, tp2], sts, 'a', '1') === 84)
cek('STS: siswa tanpa nilai → null', nilaiStsMapel([tp1, tp2], sts, 'b', '1') === null)
cek('STS: sebagian terisi dinormalisasi', nilaiStsMapel([tp1, tp2], { t1: { a: { nilai: 70 } } }, 'a', '1') === 70)

// --- SAS ---
const slm = { t1: { a: { slm: 70 } }, t2: { a: { slm: 80 } } }
const sas = { t1: { a: { nilai: 90 } }, t2: { a: { nilai: 100 } } }
const semua = new Set(['t1', 't2'])
// per TP: 70*0.6+90*0.4=78 ; 80*0.6+100*0.4=88 ; mapel 78*0.6+88*0.4=82
cek('SAS: gabung SLM+SAS per TP lalu bobot = 82', nilaiSasMapel([tp1, tp2], { slm, sts: {}, sas, cakupanSas: semua }, 'a', '1') === 82)
cek('SAS: TP di luar cakupan hanya SLM', nilaiSasMapel([tp1, tp2], { slm, sts: {}, sas, cakupanSas: new Set(['t1']) }, 'a', '1') === Math.round(78 * 0.6 + 80 * 0.4))
cek('SAS: STS lebih tinggi menggantikan SLM', nilaiSasMapel([tp1], { slm: { t1: { a: { slm: 70 } } }, sts: { t1: { a: { nilai: 95 } } }, sas: {}, cakupanSas: new Set() }, 'a', '1') === 95)
cek('SAS: tanpa SLM → null', nilaiSasMapel([tp1], { slm: {}, sts: {}, sas, cakupanSas: semua }, 'a', '1') === null)
cek('SAS: TP berbobot 0 tidak dihitung', nilaiSasMapel([tp0, tp1], { slm: { t0: { a: { slm: 10 } }, t1: { a: { slm: 70 } } }, sts: {}, sas: {}, cakupanSas: new Set() }, 'a', '1') === 70)

// --- rekap ---
cek('rataNilai membulatkan dan abaikan kosong', rataNilai([80, null, 85, undefined]) === 83 && rataNilai([null]) === null)
const rk = susunRekap([{ nama: 'M1', label: 'M1' }, { nama: 'M2', label: 'M2' }], [{ id: 'a', nama: 'A' }, { id: 'b', nama: 'B' }],
  { a: { M1: 80, M2: 90 }, b: { M1: 70, M2: null } })
cek('rekap: rata mapel', rk.rataMapel.M1 === 75 && rk.rataMapel.M2 === 90)
cek('rekap: rata siswa hanya mapel bernilai', rk.rataSiswa.a === 85 && rk.rataSiswa.b === 70)

// --- Tahsin ---
const s = (siswaId, jenis, status, detik) => ({ siswaId, jenis, statusHafalan: status, createdAt: { seconds: detik, nanoseconds: 0 } })
const setoran = [s('a', 'ziyadah', 'lulus', 100), s('a', 'murojaah', 'ulang', 300), s('a', 'tahsin', null, 200), s('b', 'ziyadah', 'lulus', 50)]
const grup = kelompokkanSetoran(setoran)
cek('kelompok: terbaru dulu', grup.a[0].createdAt.seconds === 300 && grup.a[2].createdAt.seconds === 100)
const ra = ringkasSetoranSiswa(grup.a)
cek('ringkas siswa: hitung jenis dan status', ra.total === 3 && ra.ziyadah === 1 && ra.murojaah === 1 && ra.tahsin === 1 && ra.lulus === 1 && ra.ulang === 1)
cek('ringkas siswa: terakhir ms', ra.terakhir === 300000)
cek('ringkas siswa kosong aman', ringkasSetoranSiswa(undefined).total === 0)
const rkls = ringkasKelasTahsin(['a', 'b', 'c'], { a: ra, b: ringkasSetoranSiswa(grup.b) }, { a: true, b: false, c: null })
cek('ringkas kelas: sudah/belum setor', rkls.sudahSetor === 2 && rkls.belumSetor === 1 && rkls.totalSetoran === 4)
cek('ringkas kelas: target hanya yang dapat dinilai', rkls.dinilai === 2 && rkls.tercapai === 1)

// --- struktur: laporan tidak boleh menulis ---
for (const f of ['src/lib/rekapAsesmen.ts', 'src/lib/laporanTahsin.ts', 'src/pages/akademik/LaporanStsSas.tsx', 'src/pages/tahsin/LaporanTahsin.tsx']) {
  const t = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
  cek(`${f}: tidak ada operasi tulis`, !/\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|saveSetoran|saveNilai|saveTP)\b/.test(t))
}

if (gagal) { console.log(`\n${gagal} uji GAGAL`); process.exit(1) }
console.log('\nSEMUA UJI LULUS')
