/**
 * Cloud Function: reset attempt siswa pada kuis TKA.
 * Menghapus semua dokumen lms_jawaban untuk pasangan (kuisId, siswaId).
 * Hanya mapel TKA; hanya guru/wali yang berhak / admin / email khusus.
 *
 * Deploy: firebase deploy --only functions:resetJawabanKuisLms
 * (dari repo SDM01Penilaian)
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

const MAPEL_TKA = ['TKA Matematika', 'TKA Bahasa Indonesia', 'TKA IPA']
const EMAIL_AKSES_KHUSUS_TKA = 'arif.azwar79@gmail.com'
const KELAS_TKA = ['6A', '6B']

function profilGuru(db, uid) {
  return db.doc(`users/${uid}`).get()
}

/**
 * Izin reset attempt TKA:
 * - admin LMS, atau
 * - email khusus TKA, atau
 * - wali kelas 6A/6B (role guru/guru_akademik) untuk rombel jawaban siswa.
 * Tidak memakai penugasan mapel (TKA tidak ada di penugasan akademik biasa).
 */
function bolehResetTka(profil, email, kelasSiswa) {
  if (!profil || profil.aktif === false) return false
  if (profil.role === 'admin') return true
  if (String(email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA) return true
  if (!['guru', 'guru_akademik'].includes(profil.role)) return false
  const k = String(kelasSiswa || '').toUpperCase()
  if (!KELAS_TKA.includes(k)) return false
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.includes(k)
}

export const resetJawabanKuisLms = onCall(
  { region: 'asia-southeast2', maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Harus login sebagai guru.')
    }
    if (request.auth.token?.lmsSiswa === true) {
      throw new HttpsError('permission-denied', 'Akun siswa tidak boleh mereset jawaban.')
    }

    const { kuisId, siswaId } = request.data || {}
    if (typeof kuisId !== 'string' || !kuisId.trim()) {
      throw new HttpsError('invalid-argument', 'kuisId wajib.')
    }
    if (typeof siswaId !== 'string' || !siswaId.trim()) {
      throw new HttpsError('invalid-argument', 'siswaId wajib.')
    }

    const db = getFirestore()
    const uid = request.auth.uid
    const email = request.auth.token?.email || ''
    const profilSnap = await profilGuru(db, uid)
    if (!profilSnap.exists) {
      throw new HttpsError('permission-denied', 'Profil guru tidak ditemukan.')
    }
    const profil = profilSnap.data()

    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) {
      throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    }
    const kuis = kuisSnap.data()
    const mapel = String(kuis.mapel || '').trim()
    if (!MAPEL_TKA.includes(mapel)) {
      throw new HttpsError(
        'failed-precondition',
        'Reset attempt hanya untuk kuis TKA (Matematika / Bahasa Indonesia / IPA).',
      )
    }

    // Ambil semua attempt siswa pada kuis ini
    const q = await db
      .collection('lms_jawaban')
      .where('kuisId', '==', kuisId)
      .where('siswaId', '==', siswaId)
      .get()

    if (q.empty) {
      return { ok: true, dihapus: 0, siswaId, kuisId }
    }

    // Validasi izin terhadap kelas di dokumen jawaban (rombel aktual siswa)
    const kelasSet = new Set()
    for (const d of q.docs) {
      const k = String(d.data().kelas || '').toUpperCase()
      if (k) kelasSet.add(k)
    }
    for (const k of kelasSet) {
      if (!bolehResetTka(profil, email, k)) {
        throw new HttpsError(
          'permission-denied',
          `Anda tidak berhak mereset jawaban siswa kelas ${k}.`,
        )
      }
    }

    const batch = db.batch()
    for (const d of q.docs) {
      batch.delete(d.ref)
    }
    await batch.commit()

    logger.info('resetJawabanKuisLms', {
      kuisId,
      siswaId,
      dihapus: q.size,
      uid,
      mapel,
    })

    return {
      ok: true,
      dihapus: q.size,
      siswaId,
      kuisId,
    }
  },
)
