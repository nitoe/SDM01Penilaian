import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bersihkanSubjekKktp,
  bolehPemanggilAi,
  bolehUidAi,
  faseDariKelas,
  normalisasiKktp,
  normalisasiTp,
  susunPromptKktp,
  susunPromptTp,
} from '../functions/generateAi.js'

assert.equal(bolehUidAi('v4fQXsqCzYUtHrqcDM0u48sxIfn1'), true)
assert.equal(bolehUidAi('lain'), false)

// Gerbang server: UID DAN email harus cocok.
const UID = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
const EMAIL = 'arif.azwar79@gmail.com'
assert.equal(bolehPemanggilAi({ uid: UID, token: { email: EMAIL } }), true)
assert.equal(bolehPemanggilAi({ uid: UID, token: { email: 'Arif.Azwar79@Gmail.com ' } }), true)
assert.equal(bolehPemanggilAi({ uid: UID, token: { email: 'guru@sdm01.sch.id' } }), false, 'UID cocok, email beda')
assert.equal(bolehPemanggilAi({ uid: UID, token: {} }), false, 'UID cocok, tanpa email')
assert.equal(bolehPemanggilAi({ uid: UID }), false, 'tanpa token')
assert.equal(bolehPemanggilAi({ uid: 'lain', token: { email: EMAIL } }), false, 'email cocok, UID beda')
assert.equal(bolehPemanggilAi({ uid: 'lain', token: { email: 'x@y.z' } }), false)
assert.equal(bolehPemanggilAi(null), false)
assert.equal(bolehPemanggilAi(undefined), false)
assert.equal(bolehPemanggilAi({ uid: 123, token: { email: EMAIL } }), false)

const prompt = susunPromptTp({
  mapel: 'Matematika',
  kelas: '5A',
  fase: 'C',
  elemen: 'Bilangan',
  teksCp: 'Menunjukkan pemahaman bilangan cacah.',
})
assert.equal(prompt.ok, true)
assert.match(prompt.user, /jangan diubah/)

assert.equal(susunPromptTp({ mapel: 'Matematika' }).ok, false)

const tp = normalisasiTp({
  tp: [
    { namaTp: 'Menjumlahkan pecahan', tipe: 'pengetahuan', bobotSlm: 60, bobotSas: 40 },
    { namaTp: '  ', tipe: 'kinerja' },
    { namaTp: 'Mengukur sudut', tipe: 'salah', bobotSlm: 10, bobotSas: 10 },
  ],
})
assert.equal(tp.length, 2)
assert.equal(tp[0].tipe, 'pengetahuan')
assert.equal(tp[1].tipe, 'pengetahuan')
assert.equal(tp[1].bobotSlm, 60)
assert.equal(tp[1].bobotSas, 40)

const kk = normalisasiKktp({ deskripsi: ['a', 'b', 'c', 'd', 'e'] })
assert.deepEqual(kk, ['a', 'b', 'c', 'd'])
assert.throws(() => normalisasiKktp({ deskripsi: ['a', 'b'] }))

const kPrompt = susunPromptKktp({ namaTp: 'Menjumlahkan pecahan', tipe: 'kinerja', mapel: 'Matematika', kelas: '5A', teksCp: 'CP' })
assert.equal(kPrompt.ok, true)
assert.match(kPrompt.sistem, /Mulai Berkembang/)

// ---- Gaya rumusan KKTP: langsung kompetensi capaian, tanpa subjek "Peserta didik ..." ----
const sis = kPrompt.sistem
assert.doesNotMatch(sis, /bahasa rapor|orang ketiga/i, 'instruksi lama (orang ketiga) harus hilang')
assert.match(sis, /DILARANG memakai subjek/, 'larangan subjek harus tegas')
assert.match(sis, /Peserta didik/, 'contoh SALAH menyebut "Peserta didik" agar dihindari')
assert.match(sis, /CONTOH YANG SALAH/)
assert.match(sis, /1–2 kalimat pendek/); assert.match(sis, /kata pengisi/); assert.match(sis, /jargon/)
assert.match(sis, /bukan loncatan drastis/, 'level naik logis')
assert.match(sis, /1\. Mulai Berkembang[\s\S]*4\. Mahir/, 'label tipe kinerja urut level 1–4')
assert.match(susunPromptKktp({ namaTp: 'x', tipe: 'pengetahuan', kelas: '2B' }).sistem, /1\. Perlu Bimbingan[\s\S]*4\. Sangat Baik/)
// tingkat kelas/fase ikut ke prompt agar kompetensinya setara tingkatnya
assert.match(susunPromptKktp({ namaTp: 'x', kelas: '5A' }).sistem, /kelas 5A \(Fase C\)/)
assert.match(susunPromptKktp({ namaTp: 'x', kelas: '2B' }).sistem, /kelas 2B \(Fase A\)/)
assert.match(susunPromptKktp({ namaTp: 'x', kelas: '3A' }).user, /Kelas: 3A \(Fase B\)/)
assert.doesNotMatch(susunPromptKktp({ namaTp: 'x', kelas: '' }).sistem, /Fase undefined|Fase null/)
assert.equal(faseDariKelas('1A'), 'A'); assert.equal(faseDariKelas('4C'), 'B'); assert.equal(faseDariKelas('6B'), 'C')
assert.equal(faseDariKelas('9'), ''); assert.equal(faseDariKelas(''), ''); assert.equal(faseDariKelas(undefined), '')

// Pengaman bila model tetap memakai subjek: buang subjek (+ "mampu/dapat"), huruf awal besar.
assert.equal(bersihkanSubjekKktp('Peserta didik mampu menyebutkan ide pokok teks.'), 'Menyebutkan ide pokok teks.')
assert.equal(bersihkanSubjekKktp('peserta didik dapat menjelaskan alasan'), 'Menjelaskan alasan')
assert.equal(bersihkanSubjekKktp('Siswa bisa menghitung luas persegi.'), 'Menghitung luas persegi.')
assert.equal(bersihkanSubjekKktp('Peserta didik belum mampu menghitung.'), 'Belum mampu menghitung.', 'makna "belum" tidak boleh hilang')
assert.equal(bersihkanSubjekKktp('Murid, menyelesaikan soal cerita.'), 'Menyelesaikan soal cerita.')
assert.equal(bersihkanSubjekKktp('  PESERTA DIDIK   menyusun laporan  '), 'Menyusun laporan')
assert.equal(bersihkanSubjekKktp('Ananda sudah menuliskan laporan.'), 'Sudah menuliskan laporan.')
// yang sudah benar tidak disentuh
assert.equal(bersihkanSubjekKktp('Menyebutkan ide pokok teks.'), 'Menyebutkan ide pokok teks.')
assert.equal(bersihkanSubjekKktp('Catatan pengamatan tidak berurutan.'), 'Catatan pengamatan tidak berurutan.')
assert.equal(bersihkanSubjekKktp('a'), 'a', 'huruf kecil tanpa subjek tidak dikapitalkan')
assert.equal(bersihkanSubjekKktp('Siswanya menulis.'), 'Siswanya menulis.', 'kata lain yang diawali "siswa" tidak terpotong')
assert.equal(bersihkanSubjekKktp('Peserta didik'), 'Peserta didik', 'tanpa sisa: kembalikan apa adanya')
assert.equal(bersihkanSubjekKktp('Hasil kerja peserta didik rapi.'), 'Hasil kerja peserta didik rapi.', 'subjek di tengah kalimat tidak diubah')
assert.equal(bersihkanSubjekKktp(undefined), '')
// terpasang di normalisasiKktp
assert.deepEqual(
  normalisasiKktp({ deskripsi: ['Peserta didik belum mampu menyebutkan.', 'Peserta didik mampu menyebutkan sebagian.', 'Siswa dapat menyebutkan semuanya.', 'Menyebutkan dan memberi contoh.'] }),
  ['Belum mampu menyebutkan.', 'Menyebutkan sebagian.', 'Menyebutkan semuanya.', 'Menyebutkan dan memberi contoh.'],
)

// ---- Pagar struktural: fitur AI tidak boleh bocor ke akun lain (ANTIREGRESI §25) ----
const akar = fileURLToPath(new URL('..', import.meta.url))
const baca = (rel) => readFileSync(join(akar, rel), 'utf8')
const semuaBerkas = (dir, ekstensi, hasil = []) => {
  for (const nama of readdirSync(join(akar, dir))) {
    const rel = `${dir}/${nama}`
    if (nama === 'node_modules' || nama === 'dist') continue
    if (statSync(join(akar, rel)).isDirectory()) semuaBerkas(rel, ekstensi, hasil)
    else if (ekstensi.some((e) => nama.endsWith(e))) hasil.push(rel)
  }
  return hasil
}

// 1) Di server, gerbang harus dipanggil SEBELUM kunci/model disentuh, di setiap fungsi yang memakai secret AI.
const idx = baca('functions/index.js')
const handler = [...idx.matchAll(/export const (\w+) = onCall\(opsiAi, async \(request\) => \{([\s\S]*?)\n\}\)/g)]
assert.ok(handler.length >= 2, 'fungsi AI (onCall(opsiAi, ...)) tidak ditemukan')
for (const [, nama, badan] of handler) {
  const gerbang = badan.indexOf('pastikanAi(request)')
  assert.ok(gerbang >= 0, `${nama}: wajib memanggil pastikanAi(request)`)
  for (const sentuh of ['kunciProvider(', 'mintaModel(', 'process.env']) {
    const i = badan.indexOf(sentuh)
    assert.ok(i < 0 || gerbang < i, `${nama}: ${sentuh} dipakai sebelum gerbang`)
  }
}
assert.match(idx, /function pastikanAi\(request\) \{\s*if \(!request\.auth\) throw[\s\S]*?if \(!bolehPemanggilAi\(request\.auth\)\) \{[\s\S]*?permission-denied/, 'pastikanAi harus menolak tanpa login dan non-pemilik')
// secret AI hanya boleh terikat pada fungsi AI (bukan fungsi lain seperti hapusAkunAuth)
assert.equal((idx.match(/secrets:/g) || []).length, 1, 'secrets hanya boleh dideklarasikan sekali, di opsiAi')
assert.match(idx, /const opsiAi = \{[\s\S]*?secrets: \['GEMINI_API_KEY', 'OPENAI_API_KEY'\]/)
for (const m of idx.matchAll(/export const (\w+) = onCall\(([^,]+),/g)) {
  if (m[2].trim() !== 'opsiAi') assert.ok(!/GEMINI|OPENAI/.test(idx.slice(m.index, idx.indexOf('\n})', m.index))), `${m[1]} (non-AI) tidak boleh menyentuh kunci AI`)
}

// 2) Di klien: hanya SetupTp.tsx yang memakai lib/generateAi, dan tidak ada kunci/alamat penyedia model di src/.
const berkasSrc = semuaBerkas('src', ['.ts', '.tsx'])
const pemakai = berkasSrc.filter((f) => /lib\/generateAi'/.test(baca(f)) || /from '\.\/generateAi'/.test(baca(f)))
assert.deepEqual(pemakai.sort(), ['src/pages/akademik/SetupTp.tsx'], `pemakai lib/generateAi tak terduga: ${pemakai}`)
for (const f of berkasSrc) {
  const isi = baca(f)
  assert.doesNotMatch(isi, /GEMINI_API_KEY|OPENAI_API_KEY/, `${f}: nama secret AI tidak boleh ada di kode klien`)
  assert.doesNotMatch(isi, /generativelanguage\.googleapis\.com|api\.openai\.com/, `${f}: alamat penyedia model hanya boleh di functions/`)
  assert.doesNotMatch(isi, /VITE_(?!FIREBASE_)\w*(GEMINI|OPENAI|API_KEY|SECRET)\w*/, `${f}: variabel VITE_* terbundel ke JS publik; jangan taruh kunci AI di sini (VITE_FIREBASE_* memang publik)`)
  assert.doesNotMatch(isi, /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/, `${f}: tampak seperti kunci API`)
}
// 3) Dan UI-nya di SetupTp tidak boleh menampilkan AI tanpa lewat akunAi
const setup = baca('src/pages/akademik/SetupTp.tsx')
assert.match(setup, /const akunAi = bolehGenerateAi\(profile\.uid\)/)
assert.equal((setup.match(/bolehGenerateAi\(/g) || []).length, 1, 'gerbang UI harus satu pintu (akunAi), jangan dibuat gerbang tandingan')
for (const penanda of ['Generate KKTP · Gemini', 'Susun dari Capaian Pembelajaran']) {
  const i = setup.indexOf(penanda)
  assert.ok(i > 0 && /akunAi/.test(setup.slice(Math.max(0, i - 900), i)), `"${penanda}" harus berada di belakang akunAi`)
}
// Tombol Gemini/OpenAI pada daftar CP: berada di cabang `akunAi && tabKanan === 'cp'` (jaraknya jauh, jadi diperiksa per cabang).
{
  const i = setup.indexOf("jalankanGenerateTp('gemini'")
  const g = setup.lastIndexOf("{akunAi && tabKanan === 'cp' ? (", i) // gerbang JSX yang persis, bukan sekadar potongan teks
  assert.ok(i > 0 && g > 0, 'tombol Gemini pada daftar CP harus di dalam cabang akunAi && tabKanan === "cp"')
  assert.ok(!setup.slice(g, i).includes(') : !form ? ('), 'tombol Gemini keluar dari cabang akunAi (sudah di cabang editor)')
  assert.match(setup, /function tampilkanTabCp\(\) \{\s+if \(!akunAi\) return/, 'tab CP tidak boleh bisa dibuka non-akun-AI')
}

console.log('cek-generate-ai: lulus')
