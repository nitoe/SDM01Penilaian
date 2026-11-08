import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import {
  PESAN_GAGAL,
  catatGagal,
  samaNisn,
  statusKunci,
  susunToken,
  validasiInputLogin,
} from './aturanSiswaLms.js'

/**
 * Login siswa LMS: verifikasi NISN di server, lalu terbitkan custom token Firebase Auth
 * (claims: lmsSiswa, siswaId, kelas, nama). Klien memakai signInWithCustomToken.
 * Wilayah HARUS sama dengan REGION_FUNGSI di repo nitoe/lms (src/lib/firebase.ts).
 *
 * Percobaan salah dicatat di lms_login_gagal/{siswaId} (hanya Admin SDK; rules menolak klien):
 * MAKS_GAGAL kali salah => dikunci DURASI_KUNCI_MS.
 *
 * Perlu peran «Service Account Token Creator» pada service account runtime agar createCustomToken
 * bisa menandatangani token (lihat ANTIREGRESI §32).
 */
export const loginSiswaLms = onCall({ region: 'asia-southeast2', maxInstances: 5 }, async (request) => {
  const input = validasiInputLogin(request.data)
  if (!input.ok) throw new HttpsError('invalid-argument', input.pesan)
  const { siswaId, nisn } = input

  const db = getFirestore()
  const refGagal = db.doc(`lms_login_gagal/${siswaId}`)
  const [siswaSnap, gagalSnap] = await Promise.all([db.doc(`siswa/${siswaId}`).get(), refGagal.get()])

  const kunci = statusKunci(gagalSnap.exists ? gagalSnap.data() : null, Date.now())
  if (kunci.terkunci) {
    throw new HttpsError(
      'resource-exhausted',
      `Terlalu banyak percobaan salah. Coba lagi sekitar ${kunci.sisaMenit} menit lagi.`,
    )
  }

  const siswa = siswaSnap.exists ? siswaSnap.data() : null
  if (!siswa || siswa.aktif === false) {
    throw new HttpsError('permission-denied', PESAN_GAGAL)
  }
  const nisnTerdaftar = String(siswa.nisn ?? '').trim()
  if (!nisnTerdaftar) {
    throw new HttpsError('failed-precondition', 'NISN siswa belum terdaftar. Hubungi guru atau admin.')
  }

  if (!samaNisn(nisn, nisnTerdaftar)) {
    await db.runTransaction(async (tx) => {
      const s = await tx.get(refGagal)
      tx.set(refGagal, catatGagal(s.exists ? s.data() : null, Date.now()))
    })
    logger.warn('loginSiswaLms: NISN salah', { siswaId })
    throw new HttpsError('permission-denied', PESAN_GAGAL)
  }

  if (gagalSnap.exists) await refGagal.delete()

  const { uid, claims } = susunToken(siswaId, siswa)
  try {
    const token = await getAuth().createCustomToken(uid, claims)
    return { token, sesi: { id: siswaId, nama: claims.nama, kelas: claims.kelas } }
  } catch (e) {
    logger.error(
      'loginSiswaLms: gagal membuat custom token. Periksa peran Service Account Token Creator ' +
        'dan API IAM Service Account Credentials (ANTIREGRESI §32).',
      { galat: String(e?.message ?? e) },
    )
    throw new HttpsError('internal', 'Layanan masuk belum siap. Hubungi admin.')
  }
})
