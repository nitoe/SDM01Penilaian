import assert from 'node:assert/strict'
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

console.log('cek-generate-ai: lulus')
