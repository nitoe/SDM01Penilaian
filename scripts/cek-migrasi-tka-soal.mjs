#!/usr/bin/env node
/** Uji logika murni migrasi bank soal TKA (tanpa Firebase): node scripts/cek-migrasi-tka-soal.mjs */
import assert from 'node:assert/strict'
import { htmlDariTeks, kompleksitasLms, konversiSoal, susunPaket, slug, BATAS_SOAL_PAKET } from './migrasi-tka-soal.mjs'

assert.equal(htmlDariTeks('a < b\nbaris dua\n\nparagraf 2'), '<p>a &lt; b<br>baris dua</p><p>paragraf 2</p>')
assert.equal(htmlDariTeks('<p>sudah html</p>'), '<p>sudah html</p>')
assert.equal(kompleksitasLms('L2-Aplikasi'), 'L2')
assert.equal(kompleksitasLms(undefined), 'L1')
assert.equal(slug('Pemahaman Tekstual'), 'pemahaman-tekstual')

// pg
const pg = konversiSoal('s1', {
  subjectId: 'matematika', tipe: 'pg', pertanyaan: 'Hasil $2+3$ adalah', skor: 2, tipeMateri: 'Bilangan',
  kompleksitas: 'L3-Penalaran', opsi: ['4', '5', '6'], kunciJawaban: ['5'], stimulus: 'Teks bacaan',
  stimulusImage: 'data:image/jpeg;base64,AAAA',
})
assert.equal(pg.masalah.length, 0)
assert.equal(pg.soal.tipe, 'pg')
assert.equal(pg.soal.kunci, 'b')
assert.equal(pg.soal.poin, 2)
assert.equal(pg.soal.kompleksitas, 'L3')
assert.equal(pg.soal.rumus, true)
assert.equal(pg.soal.stimulus, '<p>Teks bacaan</p>')
assert.equal(pg.soal.gambarId, 'tka-s1')
assert.equal(pg.gambar.id, 'tka-s1')
assert.equal(pg.mapel, 'TKA Matematika')
assert.equal(pg.soal.acakOpsi, false)

// pg kunci tidak cocok → dilewati
const bad = konversiSoal('s2', { subjectId: 'matematika', tipe: 'pg', pertanyaan: 'x', skor: 1, opsi: ['a', 'b'], kunciJawaban: ['z'] })
assert.equal(bad.soal, null)
assert.ok(bad.masalah.length > 0)

// pgk
const pgk = konversiSoal('s3', { subjectId: 'bahasa-indonesia', tipe: 'pgk', pertanyaan: 'x', skor: 1, opsi: ['A', 'B', 'C'], kunciJawaban: ['A', 'C'] })
assert.deepEqual(pgk.soal.kunci, ['a', 'c'])
assert.equal(pgk.soal.nilaiParsial, false)
assert.equal(pgk.mapel, 'TKA Bahasa Indonesia')

// pgk-cat Benar/Salah → bs tanpa label
const bs = konversiSoal('s4', { subjectId: 'matematika', tipe: 'pgk-cat', pertanyaan: 'x', skor: 1, rows: ['p1', 'p2'], cols: ['Benar', 'Salah'], kunciJawaban: ['Benar', 'Salah'] })
assert.equal(bs.soal.tipe, 'bs')
assert.deepEqual(bs.soal.pernyataan.map((p) => p.benar), [true, false])
assert.equal(bs.soal.labelBenar, undefined)

// pgk-cat kolom kustom → bs dengan label
const lb = konversiSoal('s5', { subjectId: 'bahasa-indonesia', tipe: 'pgk-cat', pertanyaan: 'x', skor: 1, rows: ['p1'], cols: ['Dapat Diverifikasi', 'Menyesatkan'], kunciJawaban: ['Menyesatkan'] })
assert.equal(lb.soal.labelBenar, 'Dapat Diverifikasi')
assert.equal(lb.soal.pernyataan[0].benar, false)

// pgk-cat 3 kolom → dilewati
const c3 = konversiSoal('s6', { subjectId: 'matematika', tipe: 'pgk-cat', pertanyaan: 'x', skor: 1, rows: ['p1'], cols: ['A', 'B', 'C'], kunciJawaban: ['A'] })
assert.equal(c3.soal, null)

// subject tak dikenal
assert.equal(konversiSoal('s7', { subjectId: 'ipa', tipe: 'pg', pertanyaan: 'x', opsi: ['a', 'b'], kunciJawaban: ['a'] }).soal, null)

// Pengelompokan & pemecahan
const banyak = Array.from({ length: BATAS_SOAL_PAKET + 5 }, (_, i) => ({
  soal: { id: `q${i}`, tipe: 'pg', poin: 1, kompleksitas: 'L1', tipeMateri: 'Bilangan' }, mapel: 'TKA Matematika', urut: i,
}))
banyak.push({ soal: { id: 'b1', tipe: 'pg', poin: 1, kompleksitas: 'L2', tipeMateri: 'Geometri' }, mapel: 'TKA Matematika', urut: 1 })
const paket = susunPaket(banyak, ['6A', '6B'])
assert.equal(paket.length, 6) // (2 bagian Bilangan + 1 Geometri) × 2 kelas
assert.equal(paket[0].data.soal.length, BATAS_SOAL_PAKET)
assert.equal(paket[0].data.judul, 'Bank TKA — Bilangan (bagian 1)')
assert.ok(paket.every((p) => p.data.status === 'siap' && p.data.soal.length <= BATAS_SOAL_PAKET))
assert.equal(new Set(paket.map((p) => p.id)).size, paket.length)

console.log('cek-migrasi-tka-soal: semua pemeriksaan lolos')
