import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { periksaPenghapusan } from './aturan.js'

initializeApp()

/**
 * Hapus akun staf SEPENUHNYA: user Firebase Authentication + dokumen users/{uid}.
 * Hanya administrator aktif. Wilayah HARUS sama dengan REGION_FUNGSI di src/lib/akunGuruData.ts.
 * Urutan: Auth dulu, profil kemudian. Bila langkah kedua gagal, panggil ulang: user Auth yang sudah
 * tidak ada dianggap berhasil.
 */
export const hapusAkunAuth = onCall({ region: 'asia-southeast2', maxInstances: 3 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Masuk dulu sebagai administrator.')
  }
  const uidTarget = request.data?.uid
  if (typeof uidTarget !== 'string' || uidTarget.length === 0 || uidTarget.length > 128) {
    throw new HttpsError('invalid-argument', 'UID akun tidak valid.')
  }
  const uidPemanggil = request.auth.uid

  const db = getFirestore()
  const [pemanggilSnap, targetSnap, adminSnap] = await Promise.all([
    db.doc(`users/${uidPemanggil}`).get(),
    db.doc(`users/${uidTarget}`).get(),
    db.collection('users').where('role', '==', 'admin').get(),
  ])
  const jumlahAdminAktif = adminSnap.docs.filter((d) => d.data().aktif !== false).length

  const hasil = periksaPenghapusan({
    uidPemanggil,
    uidTarget,
    pemanggil: pemanggilSnap.exists ? pemanggilSnap.data() : null,
    target: targetSnap.exists ? targetSnap.data() : null,
    jumlahAdminAktif,
  })
  if (!hasil.ok) {
    throw new HttpsError(hasil.kode, hasil.pesan)
  }

  let authDihapus = true
  try {
    await getAuth().deleteUser(uidTarget)
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      authDihapus = false // sudah tidak ada (mis. dihapus manual di Console); lanjut hapus profil
    } else {
      logger.error('hapusAkunAuth: gagal menghapus user Auth', { uidTarget, kode: err?.code })
      throw new HttpsError('internal', 'Gagal menghapus user di Firebase Authentication. Coba lagi.')
    }
  }
  await db.doc(`users/${uidTarget}`).delete()

  logger.info('hapusAkunAuth: akun dihapus', { oleh: uidPemanggil, uidTarget, authDihapus })
  return { authDihapus, authSudahTidakAda: !authDihapus }
})
