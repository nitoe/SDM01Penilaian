/**
 * Cloud Function: reset attempt / draf progress siswa pada kuis TKA.
 *
 * mode:
 *   - 'attempt'  → hapus lms_jawaban (boleh mengerjakan ulang)
 *   - 'progress' → tandai reset draf (klien hapus localStorage saat buka kuis)
 *   - 'semua'    → keduanya (default)
 *
 * Deploy: firebase deploy --only functions:resetJawabanKuisLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

const MAPEL_TKA = ['TKA Matematika', 'TKA Bahasa Indonesia', 'TKA IPA']
const EMAIL_AKSES_KHUSUS_TKA = 'arif.azwar79@gmail.com'
const KELAS_TKA = ['6A', '6B']

function profilGuru(db, uid) {
  return db.doc(`users/${uid}`).get()
}

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

/** Admin / email khusus TKA: boleh tanpa cek rombel. */
function bolehResetTkaGlobal(profil, email) {
  if (!profil || profil.aktif === false) return false
  if (profil.role === 'admin') return true
  if (String(email || '').toLowerCase() === EMAIL_AKSES_KHUSUS_TKA) return true
  return false
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

    const { kuisId, siswaId, kelasSiswa: kelasSiswaArg } = request.data || {}
    let mode = request.data?.mode
    if (mode !== 'attempt' && mode !== 'progress' && mode !== 'semua') {
      mode = 'semua'
    }

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
        'Reset hanya untuk kuis TKA (Matematika / Bahasa Indonesia / IPA).',
      )
    }

    const q = await db
      .collection('lms_jawaban')
      .where('kuisId', '==', kuisId)
      .where('siswaId', '==', siswaId)
      .get()

    const kelasSet = new Set()
    for (const d of q.docs) {
      const k = String(d.data().kelas || '').toUpperCase()
      if (k) kelasSet.add(k)
    }
    const kelasArg = String(kelasSiswaArg || '').trim().toUpperCase()
    if (kelasArg) kelasSet.add(kelasArg)

    if (!bolehResetTkaGlobal(profil, email)) {
      if (kelasSet.size === 0) {
        throw new HttpsError(
          'permission-denied',
          'Tidak ada data kelas siswa. Sertakan kelasSiswa atau gunakan akun admin TKA.',
        )
      }
      for (const k of kelasSet) {
        if (!bolehResetTka(profil, email, k)) {
          throw new HttpsError(
            'permission-denied',
            `Anda tidak berhak mereset jawaban siswa kelas ${k}.`,
          )
        }
      }
    }

    let dihapus = 0
    if (mode === 'attempt' || mode === 'semua') {
      if (!q.empty) {
        const batch = db.batch()
        for (const d of q.docs) {
          batch.delete(d.ref)
        }
        await batch.commit()
        dihapus = q.size
      }
    }

    let progressDitandai = false
    if (mode === 'progress' || mode === 'semua') {
      const resetId = `${kuisId}_${siswaId}`.slice(0, 150)
      await db.doc(`lms_tka_progress_reset/${resetId}`).set({
        kuisId,
        siswaId,
        resetAt: FieldValue.serverTimestamp(),
        resetAtMs: Date.now(),
        by: uid,
        mode,
      })
      progressDitandai = true
    }

    logger.info('resetJawabanKuisLms', {
      kuisId,
      siswaId,
      mode,
      dihapus,
      progressDitandai,
      uid,
      mapel,
    })

    return {
      ok: true,
      dihapus,
      progressDitandai,
      mode,
      siswaId,
      kuisId,
    }
  },
)
