// Uji aturan penghapusan akun (Cloud Function hapusAkunAuth). Jalankan: node scripts/cek-hapus-akun.mjs
import assert from 'node:assert/strict'
import { periksaPenghapusan } from '../functions/aturan.js'

const admin = { role: 'admin' }
const guru = { role: 'guru_akademik' }
const dasar = { uidPemanggil: 'A', uidTarget: 'G', pemanggil: admin, target: guru, jumlahAdminAktif: 2 }

assert.deepEqual(periksaPenghapusan(dasar), { ok: true })
assert.equal(periksaPenghapusan({ ...dasar, pemanggil: guru }).kode, 'permission-denied', 'guru tidak boleh')
assert.equal(periksaPenghapusan({ ...dasar, pemanggil: null }).kode, 'permission-denied', 'tanpa profil tidak boleh')
assert.equal(periksaPenghapusan({ ...dasar, pemanggil: { role: 'admin', aktif: false } }).kode, 'permission-denied', 'admin nonaktif tidak boleh')
assert.equal(periksaPenghapusan({ ...dasar, pemanggil: { role: 'admin', aktif: true } }).ok, true)
assert.equal(periksaPenghapusan({ ...dasar, uidTarget: 'A' }).kode, 'failed-precondition', 'tidak boleh hapus diri sendiri')
assert.equal(periksaPenghapusan({ ...dasar, target: { role: 'orangtua' } }).kode, 'failed-precondition', 'orang tua ditolak')
assert.equal(periksaPenghapusan({ ...dasar, target: admin, jumlahAdminAktif: 1 }).kode, 'failed-precondition', 'admin terakhir')
assert.equal(periksaPenghapusan({ ...dasar, target: admin, jumlahAdminAktif: 2 }).ok, true, 'admin lain boleh bila masih ada admin')
assert.equal(periksaPenghapusan({ ...dasar, target: null }).ok, true, 'profil sudah tidak ada: tetap boleh bersihkan Auth')

console.log('Semua pemeriksaan hapus akun lolos.')
