// Uji logika daftar Setup TP. Jalankan: node --experimental-strip-types scripts/cek-setup-tp.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  JUMLAH_LEVEL_KKTP,
  jumlahKktpTerisi,
  kktpLengkap,
  nomorTpBerikut,
  saringTp,
  tetanggaTp,
} from '../src/lib/setupTpRumus.ts'

const lv = (...d) => d.map((deskripsi, i) => ({ min: i * 25, maks: i * 25 + 24, deskripsi }))
const tp = (id, nomorTp, namaTp, levels) => ({ id, nomorTp, namaTp, levels })

const A = tp('a', 1, 'Menjumlahkan pecahan', lv('a', 'b', 'c', 'd'))
const B = tp('b', 2, 'Mengukur Sudut', lv('a', '', 'c', '  '))
const C = tp('c', 10, 'Menyelesaikan soal cerita', lv('', '', '', ''))
const D = tp('d', 12, 'Membaca denah', undefined)
const semua = [A, B, C, D]

// kelengkapan KKTP
assert.equal(JUMLAH_LEVEL_KKTP, 4)
assert.equal(jumlahKktpTerisi(A), 4)
assert.equal(jumlahKktpTerisi(B), 2, 'spasi saja dianggap kosong')
assert.equal(jumlahKktpTerisi(C), 0)
assert.equal(jumlahKktpTerisi(D), 0, 'tanpa levels tidak error')
assert.equal(kktpLengkap(A), true)
assert.equal(kktpLengkap(B), false)

// saringan
assert.deepEqual(saringTp(semua, { cari: '', filter: 'semua' }), semua, 'tanpa saringan = semua, urutan tetap')
assert.deepEqual(saringTp(semua, { cari: '  ', filter: 'semua' }), semua, 'spasi saja = tanpa pencarian')
assert.deepEqual(saringTp(semua, { cari: 'sudut', filter: 'semua' }).map((t) => t.id), ['b'], 'cari nama, abaikan huruf besar')
assert.deepEqual(saringTp(semua, { cari: 'SUDUT', filter: 'semua' }).map((t) => t.id), ['b'])
assert.deepEqual(saringTp(semua, { cari: '12', filter: 'semua' }).map((t) => t.id), ['d'], 'cari nomor')
assert.deepEqual(saringTp(semua, { cari: 'tp 12', filter: 'semua' }).map((t) => t.id), ['d'], 'awalan "TP" boleh diketik')
assert.deepEqual(saringTp(semua, { cari: 'tp12', filter: 'semua' }).map((t) => t.id), ['d'])
assert.deepEqual(saringTp(semua, { cari: 'tidak ada', filter: 'semua' }), [])
assert.deepEqual(saringTp(semua, { cari: '', filter: 'kktp-kurang' }).map((t) => t.id), ['b', 'c', 'd'], 'hanya KKTP belum lengkap')
assert.deepEqual(saringTp(semua, { cari: 'soal', filter: 'kktp-kurang' }).map((t) => t.id), ['c'], 'pencarian + saringan digabung')
assert.deepEqual(saringTp(semua, { cari: 'pecahan', filter: 'kktp-kurang' }), [], 'TP lengkap tersaring keluar')
assert.deepEqual(saringTp([], { cari: 'x', filter: 'semua' }), [])

// tetangga (prev/next)
assert.deepEqual(tetanggaTp(semua, 'b'), { indeks: 1, sebelumnya: A, berikutnya: C })
assert.deepEqual(tetanggaTp(semua, 'a'), { indeks: 0, sebelumnya: undefined, berikutnya: B }, 'TP pertama: tanpa sebelumnya')
assert.deepEqual(tetanggaTp(semua, 'd'), { indeks: 3, sebelumnya: C, berikutnya: undefined }, 'TP terakhir: tanpa berikutnya')
assert.deepEqual(tetanggaTp(semua, 'zzz'), { indeks: -1 })
assert.deepEqual(tetanggaTp(semua, undefined), { indeks: -1 })
assert.deepEqual(tetanggaTp(null, 'a'), { indeks: -1 })
assert.deepEqual(tetanggaTp([A], 'a'), { indeks: 0, sebelumnya: undefined, berikutnya: undefined })

// nomor baru
assert.equal(nomorTpBerikut([]), 1)
assert.equal(nomorTpBerikut(null), 1)
assert.equal(nomorTpBerikut(semua), 13, 'nomor terbesar + 1, bukan jumlah TP (4 + 1)')
assert.equal(nomorTpBerikut([{ nomorTp: 1 }, { nomorTp: 3 }]), 4, 'nomor bolong tidak bentrok')
assert.equal(nomorTpBerikut([{}, { nomorTp: undefined }]), 1)

// Pengaman regresi: SetupTp.tsx pernah tertimpa salinan lama sehingga fitur generate AI hilang diam-diam
// (ANTIREGRESI §25). Uji ini gagal bila bagian-bagian AI-nya hilang atau tidak lagi di belakang `akunAi`.
const src = readFileSync(new URL('../src/pages/akademik/SetupTp.tsx', import.meta.url), 'utf8')
for (const [nama, pola] of [
  ['impor lib/generateAi', /from '\.\.\/\.\.\/lib\/generateAi'/],
  ['gerbang bolehGenerateAi(profile.uid)', /const akunAi = bolehGenerateAi\(profile\.uid\)/],
  ['panggilan generateTpAi', /await generateTpAi\(/],
  ['panggilan generateKktpAi', /await generateKktpAi\(/],
  ['tombol Generate KKTP', /Generate KKTP · Gemini/],
  ['tombol Gemini/OpenAI pada daftar CP', /jalankanGenerateTp\('openai', cp\)/],
  ['antrean TP hasil AI', /setAntrianAi\(/],
  ['tata letak daftar ⇄ editor', /xl:grid-cols-\[22rem_minmax\(0,1fr\)\]/],
  ['muat ulang senyap', /await muat\(true\)/],
  ['mode baca: sembunyikan/tampilkan editor', /Sembunyikan editor/],
  ['mode baca: buka semua rincian', /Buka semua rincian/],
]) assert.match(src, pola, `SetupTp.tsx kehilangan: ${nama}`)
assert.match(src, /if \(!akunAi\) return\n\s+if \(sibuk \|\| !konfirmasiBuang\(\)\) return\n\s+setBusyAi\('tp'\)/, 'jalankanGenerateTp harus menolak non-akun-AI')
assert.match(src, /async function jalankanGenerateKktp\(provider: ProviderAi\) \{\n\s+if \(!akunAi\) return/, 'jalankanGenerateKktp harus menolak non-akun-AI')
assert.match(src, /\{akunAi && \(\n\s+<div className="flex flex-wrap gap-2">\n\s+<button\n\s+type="button"\n\s+className=\{btnGhost\}\n\s+disabled=\{busyAi !== null\}\n\s+onClick=\{\(\) => void jalankanGenerateKktp/, 'tombol Generate KKTP harus di belakang akunAi')
assert.match(src, /const daftarCp = akunAi &&/, 'daftar CP hanya untuk akun AI')

console.log('cek-setup-tp: lulus')
