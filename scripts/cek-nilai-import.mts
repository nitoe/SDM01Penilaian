// Uji parser impor nilai Excel SLM/STS/SAS (tanpa Firebase). Jalankan: npx tsx scripts/cek-nilai-import.mts
import assert from 'node:assert/strict'
import { kolomDariTp, parseNilaiExcelRows, gabungIsiKeDraf } from '../src/lib/nilaiImportExport.ts'
import type { SiswaTahsin } from '../src/types/tahsin.ts'
import type { TujuanPembelajaran } from '../src/types/akademik.ts'

const siswa = [
  { id: 's1', nama: 'Ahmad Fauzi', nis: '1001' },
  { id: 's2', nama: 'Budi Santoso', nis: '1002' },
] as unknown as SiswaTahsin[]
const tp = [
  { id: 'tpA', nomorTp: 1, namaTp: 'Menjelaskan sifat cahaya' },
  { id: 'tpB', nomorTp: 2, namaTp: 'Merancang periskop sederhana' },
] as unknown as TujuanPembelajaran[]
const kolom = kolomDariTp(tp, 'STS')
assert.deepEqual(kolom.map((k) => k.label), ['STS 1', 'STS 2'])

// 1. Impor normal: cocok per NIS, nama cadangan, sel kosong tidak mengubah
const rows1 = [
  ['No', 'NIS', 'Nama', 'STS 1', 'STS 2'],
  ['', '', '', 'Menjelaskan sifat cahaya', 'Merancang periskop sederhana'],
  [1, '1001', 'Ahmad Fauzi', 80, null],
  [2, '', 'Budi Santoso', '87,5', 90],
]
const h1 = parseNilaiExcelRows(rows1, siswa, kolom)
assert.equal(h1.terisi, 3)
assert.equal(h1.isi.tpA!.s1, 80)
assert.equal(h1.isi.tpA!.s2, 87.5)
assert.equal(h1.isi.tpB!.s2, 90)
assert.equal(h1.isi.tpB!.s1, undefined)
assert.equal(h1.peringatan.length, 0)

// 2. Siswa tidak cocok + kolom tak dikenal: peringatan harus ADA DI DUA POSISI PERTAMA
//    (halaman input hanya menampilkan peringatan.slice(0, 2) di toast).
const rows2 = [
  ['No', 'NIS', 'Nama', 'STS 1', 'Kolom Aneh'],
  [1, '1001', 'Ahmad Fauzi', 150, 70],     // 150 di luar 0-100 -> peringatan nilai tidak valid
  [2, '9999', 'Siswa Pindahan', 80, 80],   // tidak cocok
  [3, '1002', 'Budi Santoso', 75, 60],
]
const h2 = parseNilaiExcelRows(rows2, siswa, kolom)
assert.equal(h2.terisi, 1)
assert.deepEqual(h2.tidakCocok, ['Siswa Pindahan'])
const dua = h2.peringatan.slice(0, 2).join(' | ')
assert.match(dua, /baris siswa tidak cocok/)
assert.match(dua, /Kolom tidak dikenali/)
assert.ok(h2.peringatan.some((p) => p.startsWith('Nilai tidak valid')), 'peringatan lain tetap ada')

// 3. Tanpa nilai valid sama sekali: pesan pertama tetap informatif
const h3 = parseNilaiExcelRows([['NIS', 'Nama', 'STS 1'], ['9999', 'Tidak Ada', 80]], siswa, kolom)
assert.equal(h3.terisi, 0)
assert.match(h3.peringatan[0]!, /tidak cocok/)

// 4. gabungIsiKeDraf: menimpa hanya sel yang diimpor
const draf = gabungIsiKeDraf({ tpA: { s1: '70', s2: '71' } }, { tpA: { s1: 80 } })
assert.deepEqual(draf, { tpA: { s1: '80', s2: '71' } })

console.log('SEMUA UJI LULUS (cek-nilai-import)')
