// Uji aturan login siswa LMS (Cloud Function loginSiswaLms). Jalankan: node scripts/cek-login-siswa-lms.mjs
import assert from 'node:assert/strict'
import {
  DURASI_KUNCI_MS,
  MAKS_GAGAL,
  catatGagal,
  samaNisn,
  statusKunci,
  susunToken,
  validasiInputLogin,
} from '../functions/aturanSiswaLms.js'

// --- validasi input
assert.deepEqual(validasiInputLogin({ siswaId: ' abc123 ', nisn: ' 0123456789 ' }), {
  ok: true,
  siswaId: 'abc123',
  nisn: '0123456789',
})
for (const buruk of [null, undefined, {}, { siswaId: 5, nisn: '1' }, { siswaId: '', nisn: '1' }]) {
  assert.equal(validasiInputLogin(buruk).ok, false, 'input rusak ditolak')
}
for (const id of ['a/b', '..', '.', 'a b', 'x'.repeat(101), '../users']) {
  assert.equal(validasiInputLogin({ siswaId: id, nisn: '1' }).ok, false, `id ${id} ditolak`)
}
assert.equal(validasiInputLogin({ siswaId: 'a', nisn: '' }).ok, false, 'NISN kosong ditolak')
assert.equal(validasiInputLogin({ siswaId: 'a', nisn: '1'.repeat(33) }).ok, false, 'NISN terlalu panjang ditolak')

// --- bandingkan NISN
assert.equal(samaNisn('0123456789', '0123456789'), true)
assert.equal(samaNisn(' 0123456789 ', '0123456789'), true, 'spasi diabaikan')
assert.equal(samaNisn('0123456780', '0123456789'), false)
assert.equal(samaNisn('1', '0123456789'), false, 'panjang beda tidak error')

// --- kunci setelah gagal berulang
const t0 = 1_000_000
let catatan = null
for (let i = 1; i < MAKS_GAGAL; i++) {
  catatan = catatGagal(catatan, t0)
  assert.equal(catatan.jumlah, i)
  assert.equal(statusKunci(catatan, t0).terkunci, false, `belum terkunci pada gagal ke-${i}`)
}
catatan = catatGagal(catatan, t0)
assert.equal(statusKunci(catatan, t0).terkunci, true, 'terkunci pada gagal ke-MAKS')
assert.equal(statusKunci(catatan, t0).sisaMenit, Math.ceil(DURASI_KUNCI_MS / 60000))
assert.equal(statusKunci(catatan, t0 + DURASI_KUNCI_MS - 1).terkunci, true, 'masih terkunci sesaat sebelum habis')
assert.equal(statusKunci(catatan, t0 + DURASI_KUNCI_MS).terkunci, false, 'kunci habis')
// Setelah kunci lewat, hitungan mulai dari awal (bukan langsung terkunci lagi).
const lagi = catatGagal(catatan, t0 + DURASI_KUNCI_MS + 1)
assert.equal(lagi.jumlah, 1)
assert.equal(statusKunci(lagi, t0 + DURASI_KUNCI_MS + 1).terkunci, false)
assert.equal(statusKunci(null, t0).terkunci, false, 'tanpa catatan tidak terkunci')

// --- token
const { uid, claims } = susunToken('S1', { kelas: ' 4a ', nama: ' Ani ' })
assert.equal(uid, 'lms_siswa_S1')
assert.deepEqual(claims, { lmsSiswa: true, siswaId: 'S1', kelas: '4A', nama: 'Ani' })
assert.equal(susunToken('S1', { kelas: '4A', nama: 'x'.repeat(200) }).claims.nama.length, 80)
assert.ok(JSON.stringify(claims).length < 1000, 'claims di bawah batas 1000 byte')

console.log('Semua pemeriksaan login siswa LMS lolos.')
