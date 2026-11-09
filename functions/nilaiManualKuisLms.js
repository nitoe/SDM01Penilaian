/**
 * Cloud Function: guru menilai manual satu soal pada dokumen lms_jawaban
 * (utama: uraian; boleh koreksi isian otomatis yang keliru).
 *
 * Tulis hanya Admin SDK — klien tidak boleh update lms_jawaban (rules).
 * Deploy: firebase deploy --only functions:nilaiManualKuisLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

function profilGuru(db, uid) {
  return db.doc(`users/${uid}`).get()
}

function bolehMapelKelas(profil, mapel, kelas) {
  if (!profil) return false
  if (profil.aktif === false) return false
  const role = profil.role
  if (role === 'admin') return true
  if (!['guru', 'guru_akademik', 'guru_tahsin_tahfizh'].includes(role)) return false
  const pk = Array.isArray(profil.penugasanKelasMapel) ? profil.penugasanKelasMapel : []
  if (pk.includes(`${kelas}::${mapel}`)) return true
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.includes(kelas)
}

export const nilaiManualKuisLms = onCall(
  { region: 'asia-southeast2', maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Harus login sebagai guru.')
    }
    if (request.auth.token?.lmsSiswa === true) {
      throw new HttpsError('permission-denied', 'Akun siswa tidak boleh menilai.')
    }

    const { jawabanId, soalId, skor } = request.data || {}
    if (typeof jawabanId !== 'string' || !jawabanId) {
      throw new HttpsError('invalid-argument', 'jawabanId wajib.')
    }
    if (typeof soalId !== 'string' || !soalId) {
      throw new HttpsError('invalid-argument', 'soalId wajib.')
    }
    if (typeof skor !== 'number' || Number.isNaN(skor) || skor < 0) {
      throw new HttpsError('invalid-argument', 'skor harus angka ≥ 0.')
    }

    const db = getFirestore()
    const uid = request.auth.uid
    const profilSnap = await profilGuru(db, uid)
    if (!profilSnap.exists) {
      throw new HttpsError('permission-denied', 'Profil guru tidak ditemukan.')
    }
    const profil = profilSnap.data()

    const jawRef = db.doc(`lms_jawaban/${jawabanId}`)
    const jawSnap = await jawRef.get()
    if (!jawSnap.exists) {
      throw new HttpsError('not-found', 'Dokumen jawaban tidak ditemukan.')
    }
    const jaw = jawSnap.data()
    const kelas = String(jaw.kelas || '')
    const mapel = String(jaw.mapel || '')
    if (!bolehMapelKelas(profil, mapel, kelas)) {
      throw new HttpsError('permission-denied', 'Anda bukan pengampu kelas×mapel ini.')
    }

    const kuisSnap = await db.doc(`lms_kuis/${jaw.kuisId}`).get()
    if (!kuisSnap.exists) {
      throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    }
    const kuis = kuisSnap.data()
    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []
    const soal = soalList.find((s) => s && s.id === soalId)
    if (!soal) {
      throw new HttpsError('not-found', 'Soal tidak ada di snapshot kuis.')
    }
    const maks = Number(soal.poin) || 1
    const skorAkhir = Math.min(maks, Math.round(Number(skor) * 100) / 100)

    const detail = Array.isArray(jaw.detail) ? jaw.detail.map((d) => ({ ...d })) : []
    let found = false
    for (let i = 0; i < detail.length; i++) {
      if (detail[i].soalId === soalId) {
        detail[i] = {
          ...detail[i],
          skor: skorAkhir,
          benar: skorAkhir >= maks,
          butuhManual: false,
          dinilaiManual: true,
        }
        found = true
        break
      }
    }
    if (!found) {
      detail.push({
        soalId,
        tipe: soal.tipe,
        skor: skorAkhir,
        benar: skorAkhir >= maks,
        butuhManual: false,
        dinilaiManual: true,
      })
    }

    let totalSkor = 0
    let masihManual = false
    for (const d of detail) {
      totalSkor += Number(d.skor) || 0
      if (d.butuhManual) masihManual = true
    }
    totalSkor = Math.round(totalSkor * 100) / 100

    await jawRef.update({
      detail,
      skorOtomatis: totalSkor,
      status: masihManual ? 'sebagian_manual' : 'selesai',
      dinilaiOleh: uid,
      dinilaiOlehNama: typeof profil.nama === 'string' ? profil.nama : '',
      dinilaiAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info('nilaiManualKuisLms', { jawabanId, soalId, skor: skorAkhir, uid })

    return {
      ok: true,
      skorSoal: skorAkhir,
      skorTotal: totalSkor,
      totalPoin: Number(jaw.totalPoin) || 0,
      status: masihManual ? 'sebagian_manual' : 'selesai',
    }
  },
)
