/**
 * Cloud Function: reset attempt / draf progress siswa pada kuis LMS
 * (mapel biasa, TKA, dan Lomba).
 *
 * mode:
 *   - 'attempt'  → hapus lms_jawaban (boleh mengerjakan ulang)
 *   - 'progress' → tandai reset draf (klien hapus localStorage saat buka kuis)
 *   - 'semua'    → keduanya (default)
 *
 * Akses:
 *   - Mapel biasa : admin atau guru dengan penugasanKelasMapel / waliKelas
 *   - TKA         : admin / email khusus / wali 6A·6B
 *   - Lomba       : admin LMS atau guruPengampu (guruPengampuUid / guruPengampuUids)
 *
 * ANTIREGRESI §126: reset berlaku untuk SEMUA kuis, bukan hanya TKA.
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

/** Penugasan kelas×mapel atau wali kelas (sama pola nilaiManual / offline). */
function bolehMapelKelas(profil, mapel, kelas) {
  if (!profil || profil.aktif === false) return false
  if (profil.role === 'admin') return true
  if (!['guru', 'guru_akademik', 'guru_tahsin_tahfizh'].includes(profil.role)) return false
  const k = String(kelas || '').toUpperCase()
  const m = String(mapel || '').trim()
  const pk = Array.isArray(profil.penugasanKelasMapel) ? profil.penugasanKelasMapel : []
  if (pk.includes(`${k}::${m}`)) return true
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.includes(k)
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
    const lombaId = typeof kuis.lombaId === 'string' ? kuis.lombaId.trim() : ''
    const isTka = MAPEL_TKA.includes(mapel)
    const isLomba = !!lombaId && String(kuis.kelas || '').toUpperCase() === 'LB'

    // ---- Otorisasi ----
    if (isLomba) {
      const lombaSnap = await db.doc(`lms_lomba/${lombaId}`).get()
      if (!lombaSnap.exists) {
        throw new HttpsError('not-found', 'Lomba tidak ditemukan.')
      }
      const lomba = lombaSnap.data()
      const uids = Array.isArray(lomba.guruPengampuUids)
        ? lomba.guruPengampuUids.map(String)
        : []
      const pengampu =
        lomba.guruPengampuUid === uid || uids.includes(uid)
      const adminOk =
        profil.role === 'admin' ||
        String(email || '').toLowerCase() === 'arif.nitoe@gmail.com'
      if (!pengampu && !adminOk) {
        throw new HttpsError(
          'permission-denied',
          'Hanya pengampu lomba atau admin yang boleh mereset.',
        )
      }
    } else if (isTka) {
      // TKA: cek setelah kita tahu kelas dari jawaban / argumen
      // (dilakukan di bawah setelah query jawaban)
    } else {
      // Mapel biasa: admin atau pengampu kelas×mapel (atau wali)
      // Ambil kelas dari argumen, dari dokumen jawaban nanti, atau dari kuis.kelas / kelasList
      // Cek awal dengan kuis.kelas; refine setelah query jawaban.
      const kelasUtama = String(kuis.kelas || '').toUpperCase()
      const kelasListKuis = Array.isArray(kuis.kelasList)
        ? kuis.kelasList.map((x) => String(x).toUpperCase())
        : []
      const kandidatAwal = new Set()
      if (kelasUtama) kandidatAwal.add(kelasUtama)
      for (const k of kelasListKuis) if (k) kandidatAwal.add(k)
      const kelasArg = String(kelasSiswaArg || '').trim().toUpperCase()
      if (kelasArg) kandidatAwal.add(kelasArg)

      if (profil.role !== 'admin') {
        let adaAkses = false
        for (const k of kandidatAwal) {
          if (bolehMapelKelas(profil, mapel, k)) {
            adaAkses = true
            break
          }
        }
        // Jika belum ada kandidat (kuis tanpa kelas?) biarkan lewat ke query; cek lagi di bawah
        if (kandidatAwal.size > 0 && !adaAkses) {
          throw new HttpsError(
            'permission-denied',
            'Anda bukan pengampu kelas×mapel kuis ini.',
          )
        }
      }
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
    // Fallback: kelas utama kuis bila belum ada data jawaban
    if (kelasSet.size === 0) {
      const k = String(kuis.kelas || '').toUpperCase()
      if (k) kelasSet.add(k)
    }

    // TKA: wali/admin (setelah tahu kelas)
    if (isTka && !bolehResetTkaGlobal(profil, email)) {
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

    // Mapel biasa (bukan TKA/Lomba): pastikan masih berhak terhadap kelas yang benar-benar ada di jawaban
    if (!isTka && !isLomba && profil.role !== 'admin' && kelasSet.size > 0) {
      for (const k of kelasSet) {
        if (!bolehMapelKelas(profil, mapel, k)) {
          throw new HttpsError(
            'permission-denied',
            `Anda bukan pengampu kelas ${k} × mapel ${mapel}.`,
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
      isTka,
      isLomba,
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
