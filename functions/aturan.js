// Aturan murni untuk penghapusan akun staf. Dipisah dari index.js supaya bisa diuji tanpa Firebase.
// Uji: node scripts/cek-hapus-akun.mjs (dari root repo)

/**
 * @param {object} p
 * @param {string} p.uidPemanggil
 * @param {string} p.uidTarget
 * @param {object|null} p.pemanggil  data users/{uidPemanggil}, null bila tidak ada
 * @param {object|null} p.target     data users/{uidTarget}, null bila profil sudah tidak ada
 * @param {number} p.jumlahAdminAktif jumlah admin aktif saat ini (termasuk pemanggil)
 * @returns {{ok: true} | {ok: false, kode: string, pesan: string}}
 */
export function periksaPenghapusan({ uidPemanggil, uidTarget, pemanggil, target, jumlahAdminAktif }) {
  const pemanggilAdmin = Boolean(pemanggil) && pemanggil.role === 'admin' && pemanggil.aktif !== false
  if (!pemanggilAdmin) {
    return { ok: false, kode: 'permission-denied', pesan: 'Hanya administrator aktif yang boleh menghapus akun.' }
  }
  if (uidPemanggil === uidTarget) {
    return { ok: false, kode: 'failed-precondition', pesan: 'Anda tidak dapat menghapus akun sendiri.' }
  }
  if (target && target.role === 'orangtua') {
    return {
      ok: false,
      kode: 'failed-precondition',
      pesan: 'Akun orang tua tidak dihapus dari sini.',
    }
  }
  if (target && target.role === 'admin' && target.aktif !== false && jumlahAdminAktif <= 1) {
    return { ok: false, kode: 'failed-precondition', pesan: 'Administrator aktif terakhir tidak boleh dihapus.' }
  }
  return { ok: true }
}
