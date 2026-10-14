/**
 * Hapus permanen akun staf: Firebase Auth + dokumen users/{uid}.
 * Hanya boleh dipanggil oleh admin yang login (token diverifikasi di server).
 *
 * Deploy: firebase deploy --only functions
 * Perlu paket Blaze (pay-as-you-go) agar Callable Functions aktif.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')

initializeApp()
setGlobalOptions({ region: 'asia-southeast2', maxInstances: 10 })

const ROLE_ADMIN = 'admin'

exports.hapusAkunPermanen = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Harus login sebagai admin.')
  }

  const callerUid = request.auth.uid
  const targetUid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : ''

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Parameter uid wajib diisi.')
  }
  if (targetUid === callerUid) {
    throw new HttpsError('invalid-argument', 'Tidak dapat menghapus akun sendiri.')
  }

  const db = getFirestore()
  const callerSnap = await db.collection('users').doc(callerUid).get()
  if (!callerSnap.exists) {
    throw new HttpsError('permission-denied', 'Profil pemanggil tidak ditemukan.')
  }
  const caller = callerSnap.data() || {}
  if (caller.role !== ROLE_ADMIN || caller.aktif === false) {
    throw new HttpsError('permission-denied', 'Hanya administrator aktif yang boleh menghapus akun.')
  }

  const auth = getAuth()
  let authDihapus = false
  let authPesan = ''
  try {
    await auth.deleteUser(targetUid)
    authDihapus = true
  } catch (err) {
    const code = err && err.code ? String(err.code) : ''
    // Sudah tidak ada di Auth — tetap lanjut hapus Firestore
    if (code === 'auth/user-not-found') {
      authPesan = 'User Auth sudah tidak ada.'
    } else {
      console.error('deleteUser gagal', targetUid, err)
      throw new HttpsError(
        'internal',
        `Gagal menghapus Firebase Auth: ${err.message || code || 'unknown'}`,
      )
    }
  }

  let profilDihapus = false
  try {
    await db.collection('users').doc(targetUid).delete()
    profilDihapus = true
  } catch (err) {
    console.error('delete profile gagal', targetUid, err)
    // Auth sudah terhapus — laporkan sebagian sukses
    throw new HttpsError(
      'internal',
      `Auth ${authDihapus ? 'terhapus' : 'skip'}, tetapi profil Firestore gagal dihapus: ${err.message || err}`,
    )
  }

  return {
    ok: true,
    uid: targetUid,
    authDihapus,
    profilDihapus,
    authPesan: authPesan || undefined,
  }
})
