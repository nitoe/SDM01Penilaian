/**
 * Cloud Function: penilaian kuis LMS.
 * Kunci jawaban hanya dibaca di server. Jangan pernah mengirim kunci ke klien.
 *
 * Deploy: firebase deploy --only functions:nilaiKuisLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

function normalisasi(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function nilaiSatuSoal(soal, jawabanSiswa) {
  const poin = Number(soal.poin) || 1
  const tipe = soal.tipe

  if (tipe === 'pg') {
    const benar = jawabanSiswa === soal.kunci
    return { benar, skor: benar ? poin : 0, butuhManual: false }
  }

  if (tipe === 'pgk') {
    const kunci = Array.isArray(soal.kunci) ? soal.kunci : []
    const jawab = Array.isArray(jawabanSiswa) ? jawabanSiswa : []
    const setK = new Set(kunci)
    const setJ = new Set(jawab)
    const benarSemua = kunci.length === jawab.length && kunci.every((k) => setJ.has(k))
    if (soal.nilaiParsial) {
      const benar = jawab.filter((j) => setK.has(j)).length
      const salah = jawab.filter((j) => !setK.has(j)).length
      const skor = Math.max(0, (benar - salah) / Math.max(kunci.length, 1)) * poin
      return { benar: benarSemua, skor: Math.round(skor * 100) / 100, butuhManual: false }
    }
    return { benar: benarSemua, skor: benarSemua ? poin : 0, butuhManual: false }
  }

  if (tipe === 'isian') {
    const kunci = Array.isArray(soal.kunci) ? soal.kunci : []
    const j = soal.abaikanKapital !== false ? normalisasi(jawabanSiswa) : String(jawabanSiswa ?? '').trim()
    const cocok = kunci.some((k) => {
      const kk = soal.abaikanKapital !== false ? normalisasi(k) : String(k).trim()
      return kk === j
    })
    return { benar: cocok, skor: cocok ? poin : 0, butuhManual: false }
  }

  // bs, jodoh, uraian → butuh penilaian manual (atau logika lebih lanjut)
  return { benar: false, skor: 0, butuhManual: true }
}

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

    const db = getFirestore()
    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) {
      throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    }
    const kuis = kuisSnap.data()
    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []

    let totalSkor = 0
    let totalPoin = 0
    const detail = []

    for (const soal of soalList) {
      const jawab = jawaban[soal.id]
      const hasil = nilaiSatuSoal(soal, jawab)
      totalSkor += hasil.skor
      totalPoin += Number(soal.poin) || 1
      detail.push({
        soalId: soal.id,
        tipe: soal.tipe,
        benar: hasil.benar,
        skor: hasil.skor,
        butuhManual: hasil.butuhManual,
      })
    }

    const skorAkhir = Math.round(totalSkor * 100) / 100

    // Simpan hasil (sederhana)
    const jawabanRef = db.collection('lms_jawaban').doc()
    await jawabanRef.set({
      kuisId,
      siswaUid: request.auth.uid,
      jawaban,
      skorOtomatis: skorAkhir,
      totalPoin,
      detail,
      status: 'selesai',
      createdAt: FieldValue.serverTimestamp(),
    })

    logger.info('nilaiKuisLms selesai', { kuisId, uid: request.auth.uid, skor: skorAkhir })

    return {
      ok: true,
      skor: skorAkhir,
      totalPoin,
      detail,
      pesan: 'Penilaian selesai.',
    }
  },
)
