/**
 * Skeleton Cloud Function: penilaian kuis LMS.
 * Kunci jawaban hanya dibaca di server. Jangan pernah mengirim kunci ke klien.
 *
 * Deploy: firebase deploy --only functions:nilaiKuisLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

const db = getFirestore()

export const nilaiKuisLms = onCall(
  { region: 'asia-southeast2', maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Harus login.')
    }

    const { kuisId, jawaban } = request.data || {}
    if (!kuisId || typeof jawaban !== 'object') {
      throw new HttpsError('invalid-argument', 'kuisId dan jawaban wajib diisi.')
    }

    // TODO: validasi bahwa pemanggil adalah siswa yang berhak (claim lmsSiswa)
    // TODO: baca dokumen lms_kuis/{kuisId}, ambil soal + kunci
    // TODO: bandingkan jawaban siswa dengan kunci (PG, PGK, BS, isian sederhana)
    // TODO: simpan hasil ke lms_jawaban
    // TODO: kembalikan skor + detail per soal (tanpa kunci mentah)

    logger.info('nilaiKuisLms dipanggil', { kuisId, uid: request.auth.uid })

    // Placeholder response
    return {
      ok: true,
      pesan: 'Skeleton — logika penilaian belum diimplementasi.',
      skor: 0,
      detail: [],
    }
  },
)
