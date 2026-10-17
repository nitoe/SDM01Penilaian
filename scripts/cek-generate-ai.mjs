import assert from 'node:assert/strict'
import {
  bolehPemanggilAi,
  bolehUidAi,
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

console.log('cek-generate-ai: lulus')
