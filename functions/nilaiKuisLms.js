/**
 * Cloud Function: penilaian kuis LMS.
 * Kunci jawaban hanya dibaca di server. Jangan pernah mengirim kunci ke klien.
 *
 * Setiap kirim = satu dokumen baru di lms_jawaban (percobaan terpisah).
 * Latihan boleh berulang; SLM/STS/SAS tetap mencatat tiap kirim (UI membatasi ulang).
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

  if (tipe === 'jodoh') {
    const pasangan = Array.isArray(soal.pasangan) ? soal.pasangan : []
    if (!jawabanSiswa || typeof jawabanSiswa !== 'object' || Array.isArray(jawabanSiswa)) {
      return { benar: false, skor: 0, butuhManual: false }
    }
    const j = jawabanSiswa
    const benarN = pasangan.filter((p) => j[p.id] === p.id).length
    if (pasangan.length === 0) return { benar: false, skor: 0, butuhManual: false }
    if (soal.nilaiParsial) {
      const skor = (benarN / pasangan.length) * poin
      return { benar: benarN === pasangan.length, skor: Math.round(skor * 100) / 100, butuhManual: false }
    }
    const ok = benarN === pasangan.length
    return { benar: ok, skor: ok ? poin : 0, butuhManual: false }
  }

  if (tipe === 'bs') {
    const pernyataan = Array.isArray(soal.pernyataan) ? soal.pernyataan : []
    if (!jawabanSiswa || typeof jawabanSiswa !== 'object' || Array.isArray(jawabanSiswa)) {
      return { benar: false, skor: 0, butuhManual: false }
    }
    const j = jawabanSiswa
    const benarN = pernyataan.filter((p) => j[p.id] === p.benar).length
    if (pernyataan.length === 0) return { benar: false, skor: 0, butuhManual: false }
    if (soal.nilaiParsial) {
      const skor = (benarN / pernyataan.length) * poin
      return { benar: benarN === pernyataan.length, skor: Math.round(skor * 100) / 100, butuhManual: false }
    }
    const ok = benarN === pernyataan.length
    return { benar: ok, skor: ok ? poin : 0, butuhManual: false }
  }

  // uraian → penilaian manual guru
  if (tipe === 'uraian') {
    const ada = typeof jawabanSiswa === 'string' && jawabanSiswa.trim().length > 0
    return { benar: false, skor: 0, butuhManual: ada }
  }

  return { benar: false, skor: 0, butuhManual: true }
}

export const nilaiKuisLms = onCall(
  { region: 'asia-southeast2', maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Harus login.')
    }

    const token = request.auth.token || {}
    const isSiswa = token.lmsSiswa === true
    const siswaId = isSiswa && typeof token.siswaId === 'string' ? token.siswaId : null
    if (isSiswa && !siswaId) {
      throw new HttpsError('permission-denied', 'Sesi siswa tidak valid.')
    }

    const { kuisId, jawaban } = request.data || {}
    if (!kuisId || typeof jawaban !== 'object' || jawaban == null) {
      throw new HttpsError('invalid-argument', 'kuisId dan jawaban wajib diisi.')
    }

    const db = getFirestore()
    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) {
      throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    }
    const kuis = kuisSnap.data()
    if (kuis.aktif !== true) {
      throw new HttpsError('failed-precondition', 'Kuis ini tidak aktif.')
    }
    if (isSiswa && token.kelas && kuis.kelas !== token.kelas) {
      throw new HttpsError('permission-denied', 'Kuis bukan untuk kelasmu.')
    }

    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []

    let totalSkor = 0
    let totalPoin = 0
    let butuhManual = false
    const detail = []

    for (const soal of soalList) {
      const jawab = jawaban[soal.id]
      const hasil = nilaiSatuSoal(soal, jawab)
      totalSkor += hasil.skor
      totalPoin += Number(soal.poin) || 1
      if (hasil.butuhManual) butuhManual = true
      detail.push({
        soalId: soal.id,
        tipe: soal.tipe,
        benar: hasil.benar,
        skor: hasil.skor,
        butuhManual: hasil.butuhManual,
      })
    }

    const skorAkhir = Math.round(totalSkor * 100) / 100

    // Hitung nomor percobaan (1, 2, 3, …) untuk siswa ini
    let percobaan = 1
    if (siswaId) {
      const prev = await db
        .collection('lms_jawaban')
        .where('kuisId', '==', kuisId)
        .where('siswaId', '==', siswaId)
        .get()
      percobaan = prev.size + 1
    }

    const payload = {
      kuisId,
      siswaUid: request.auth.uid,
      siswaId: siswaId || null,
      siswaNama: typeof token.nama === 'string' ? token.nama : '',
      kelas: kuis.kelas || '',
      mapel: kuis.mapel || '',
      judulKuis: kuis.judul || '',
      jenisPenilaian: kuis.jenisPenilaian || 'latihan',
      jawaban,
      skorOtomatis: skorAkhir,
      totalPoin,
      detail,
      percobaan,
      status: butuhManual ? 'sebagian_manual' : 'selesai',
      createdAt: FieldValue.serverTimestamp(),
    }

    const jawabanRef = db.collection('lms_jawaban').doc()
    await jawabanRef.set(payload)

    logger.info('nilaiKuisLms selesai', {
      kuisId,
      uid: request.auth.uid,
      siswaId,
      percobaan,
      skor: skorAkhir,
    })

    return {
      ok: true,
      id: jawabanRef.id,
      skor: skorAkhir,
      totalPoin,
      percobaan,
      status: payload.status,
      detail,
      pesan: 'Penilaian selesai.',
    }
  },
)
