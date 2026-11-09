#!/usr/bin/env node
/** Uji logika murni migrasi TKA (tanpa Firebase): node scripts/cek-migrasi-tka.mjs */
import assert from 'node:assert/strict'
import { normNama, petakanSiswa, ubahPaket, ubahPercobaan, ubahSoal, periksaSoal } from './migrasi-tka.mjs'

assert.equal(normNama('  Ahmad  Fauzi, S. '), 'ahmad fauzi s')

const lms = [
  { id: '1001', nama: 'Ahmad Fauzi', kelas: '6A', nisn: '0123456789' },
  { id: '1002', nama: 'Siti Aisyah', kelas: '6A', nisn: '' },
  { id: '1003', nama: 'Budi', kelas: '6B', nisn: '' },
  { id: '1004', nama: 'Budi', kelas: '6B', nisn: '' },
]
const tka = [
  { uid: 'u1', nama: 'Ahmad F.', kelas: '6A', nisn: '0123456789' }, // cocok NISN, nama beda
  { uid: 'u2', nama: 'siti  aisyah', kelas: '6a', nisn: '999' }, // cocok nama+kelas
  { uid: 'u3', nama: 'Budi', kelas: '6B', nisn: '' }, // ambigu
  { uid: 'u4', nama: 'Tidak Ada', kelas: '6A', nisn: '' }, // tidak cocok
]
const r = petakanSiswa(lms, tka)
assert.equal(r.peta.get('u1').siswaId, '1001')
assert.equal(r.peta.get('u1').cara, 'nisn')
assert.equal(r.peta.get('u2').siswaId, '1002')
assert.equal(r.peta.get('u2').cara, 'nama-kelas')
assert.equal(r.ambigu.length, 1)
assert.equal(r.tidakCocok.length, 1)
assert.equal(r.namaBeda.length, 1)

// Paket: token dipisah, aktif hanya bila true
const p = ubahPaket({ nama: 'TO 1', jenis: 'tryout', token: ' ABC12 ', sekolahId: 'x', questionIds: ['a'], aktif: true })
assert.equal(p.paket.token, undefined)
assert.equal(p.paket.sekolahId, undefined)
assert.equal(p.paket.butuhToken, true)
assert.deepEqual(p.token, { token: 'ABC12' })
const p2 = ubahPaket({ nama: 'Lat', jenis: 'latihan', token: 'JANGAN' })
assert.equal(p2.paket.butuhToken, false)
assert.equal(p2.token, null)
assert.equal(p2.paket.aktif, false)

// Soal: kunciHash & sekolahId dibuang
const s = ubahSoal({ subjectId: 'matematika', tipe: 'pg', pertanyaan: 'x', skor: 1, sekolahId: 's', kunciHash: 'h', kunciJawaban: ['a'] })
assert.equal(s.sekolahId, undefined)
assert.equal(s.kunciHash, undefined)
assert.deepEqual(s.kunciJawaban, ['a'])
assert.deepEqual(periksaSoal({ subjectId: 'ipa', tipe: 'pg', pertanyaan: 'x', skor: 1 }).length, 1)

// Percobaan: rename & siswa tak terpetakan dilewati
const a = ubahPercobaan({ studentId: 'u1', namaSiswa: 'Ahmad F.', kelasSiswa: '6A', packageId: 'pk', packageNama: 'TO 1', subjectId: 'matematika', jenisPaket: 'tryout', skorAkhir: 8, skorMaksimal: 10, sekolahId: 'x' }, r.peta)
assert.equal(a.siswaId, '1001')
assert.equal(a.namaSiswa, 'Ahmad Fauzi')
assert.equal(a.paketId, 'pk')
assert.equal(a.studentId, undefined)
assert.equal(a.studentIdLama, 'u1')
assert.equal(ubahPercobaan({ studentId: 'u4' }, r.peta), null)

console.log('cek-migrasi-tka: semua pemeriksaan lolos')
