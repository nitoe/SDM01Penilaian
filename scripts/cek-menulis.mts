// Uji logika penilaian menulis Tahsin-Tahfizh (tanpa Firebase). Jalankan: npx tsx scripts/cek-menulis.mts
import assert from 'node:assert/strict'
import {
  ASPEK_INTI, bangunKesalahan, bangunPenilaian, levelDariRata, rataInti, ringkasMenulis, skorSah, urutTerbaru,
} from '../src/lib/menulis.ts'
import type { MenulisRecord } from '../src/types/tahsin.ts'

// skor sah
assert.equal(skorSah(1), true); assert.equal(skorSah(4), true)
assert.equal(skorSah(0), false); assert.equal(skorSah(5), false); assert.equal(skorSah(2.5), false); assert.equal(skorSah('3'), false); assert.equal(skorSah(null), false)

// tiga aspek inti, Kerapian tidak ikut rata-rata
assert.deepEqual(ASPEK_INTI.map((a) => a.key), ['hurufSambungan', 'harakat', 'keutuhanTeks'])
assert.equal(rataInti({ hurufSambungan: 4, harakat: 3, keutuhanTeks: 4, kerapian: 1 }), 3.7)
assert.equal(rataInti({ hurufSambungan: 3, harakat: 3, keutuhanTeks: 3 }), 3)
assert.equal(rataInti({ kerapian: 4 }), null)
assert.equal(rataInti({ hurufSambungan: 4, harakat: 9, keutuhanTeks: null }), 4) // skor tak sah dilewati
assert.equal(rataInti(undefined), null)

// level dari rata-rata
assert.equal(levelDariRata(3.5), 'Sangat baik'); assert.equal(levelDariRata(3.4), 'Baik')
assert.equal(levelDariRata(2.5), 'Baik'); assert.equal(levelDariRata(1.5), 'Cukup'); assert.equal(levelDariRata(1.4), 'Perlu bimbingan')

// bentuk simpan
assert.deepEqual(bangunPenilaian({ hurufSambungan: 3, harakat: 3, keutuhanTeks: 3, kerapian: null }),
  { hurufSambungan: 3, harakat: 3, keutuhanTeks: 3, kerapian: null })
assert.deepEqual(bangunPenilaian({ hurufSambungan: 9, harakat: 0, keutuhanTeks: 2.6, kerapian: 7 }),
  { hurufSambungan: 4, harakat: 1, keutuhanTeks: 3, kerapian: 4 })
assert.deepEqual(bangunKesalahan(['bagian-terlewat', 'huruf-mirip', 'huruf-mirip', 'ngawur']), ['huruf-mirip', 'bagian-terlewat'])

// ringkasan per periode
const m = (id: string, tgl: string, p: object, ta = '2026/2027', sem = '1', kesalahan: string[] = []): MenulisRecord =>
  ({ id, siswaId: 'a', kelas: '5A', tanggalPeriksa: tgl, tahunAjaran: ta, semester: sem, penilaian: p, kesalahan } as unknown as MenulisRecord)
const data = [
  m('1', '2026-09-01', { hurufSambungan: 2, harakat: 2, keutuhanTeks: 3 }, '2026/2027', '1', ['huruf-mirip', 'harakat-hilang']),
  m('2', '2026-10-10', { hurufSambungan: 4, harakat: 3, keutuhanTeks: 4, kerapian: 3 }, '2026/2027', '1', ['huruf-mirip']),
  m('3', '2026-02-01', { hurufSambungan: 1, harakat: 1, keutuhanTeks: 1 }, '2025/2026', '2'), // periode lain
  { id: '4', siswaId: 'a', kelas: '5A', tanggalPeriksa: '2026-10-11', penilaian: { hurufSambungan: 1, harakat: 1, keutuhanTeks: 1 } } as unknown as MenulisRecord, // tanpa periode
]
assert.deepEqual(urutTerbaru(data).map((r) => r.id), ['4', '2', '1', '3'])
const r = ringkasMenulis(data, { tahunAjaran: '2026/2027', semester: '1' })
assert.equal(r.jumlah, 2)
assert.deepEqual(r.perAspek, { hurufSambungan: 3, harakat: 2.5, keutuhanTeks: 3.5 })
assert.equal(r.rata, 3)
assert.equal(r.kerapian, 3)
assert.equal(r.tren, 'naik') // 3.7 vs 2.3
assert.deepEqual(r.kesalahanTerbanyak.map((k) => [k.kunci, k.jumlah]), [['huruf-mirip', 2], ['harakat-hilang', 1]])
const semua = ringkasMenulis(data)
assert.equal(semua.jumlah, 4)
const kosong = ringkasMenulis([], { tahunAjaran: '2026/2027', semester: '1' })
assert.equal(kosong.jumlah, 0); assert.equal(kosong.rata, null); assert.equal(kosong.tren, null)
assert.equal(ringkasMenulis([data[0]!], { tahunAjaran: '2026/2027', semester: '1' }).tren, null) // satu catatan: tak ada tren

// tren: ambang tepat 0.3 tidak boleh meleset karena floating point (3.3 vs 3.0)
const dua = (a: number, b: number) => [
  m('x', '2026-10-02', { hurufSambungan: a, harakat: a, keutuhanTeks: a }),
  m('y', '2026-10-01', { hurufSambungan: b, harakat: b, keutuhanTeks: b }),
]
assert.equal(ringkasMenulis([
  m('x', '2026-10-02', { hurufSambungan: 4, harakat: 3, keutuhanTeks: 3 }),
  m('y', '2026-10-01', { hurufSambungan: 3, harakat: 3, keutuhanTeks: 3 }),
]).tren, 'naik') // 3.3 vs 3
assert.equal(ringkasMenulis(dua(3, 3)).tren, 'tetap')
assert.equal(ringkasMenulis(dua(2, 3)).tren, 'turun')

console.log('SEMUA UJI LULUS')
