/**
 * Guru menyimpan jawaban kuis offline → nilai otomatis (kunci server) → lms_jawaban.
 * Deploy: firebase deploy --only functions:simpanJawabanOfflineKuis
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

function normalisasi(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function sebagaiAngka(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
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
    const mentah = String(jawabanSiswa ?? '').trim()
    const j = soal.abaikanKapital !== false ? normalisasi(mentah) : mentah
    const angkaJ = sebagaiAngka(mentah)
    const cocok = kunci.some((k) => {
      if (k == null || String(k).trim() === '') return false
      const kk = soal.abaikanKapital !== false ? normalisasi(k) : String(k).trim()
      if (kk === j) return true
      const angkaK = sebagaiAngka(k)
      return angkaJ !== null && angkaK !== null && angkaJ === angkaK
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
  if (tipe === 'uraian') {
    const ada = typeof jawabanSiswa === 'string' && jawabanSiswa.trim().length > 0
    // skor opsional dari guru/AI
    if (typeof jawabanSiswa === 'object' && jawabanSiswa && 'teks' in jawabanSiswa) {
      const teks = String(jawabanSiswa.teks || '')
      const skorManual = Number(jawabanSiswa.skor)
      if (!Number.isNaN(skorManual) && skorManual >= 0) {
        const skor = Math.min(poin, Math.round(skorManual * 2) / 2)
        return { benar: skor >= poin, skor, butuhManual: false, dinilaiManual: true }
      }
      return { benar: false, skor: 0, butuhManual: teks.trim().length > 0 }
    }
    return { benar: false, skor: 0, butuhManual: ada }
  }
  return { benar: false, skor: 0, butuhManual: true }
}

function bolehMapelKelas(profil, mapel, kelas) {
  if (!profil || profil.aktif === false) return false
  if (profil.role === 'admin') return true
  if (!['guru', 'guru_akademik', 'guru_tahsin_tahfizh'].includes(profil.role)) return false
  const pk = Array.isArray(profil.penugasanKelasMapel) ? profil.penugasanKelasMapel : []
  if (pk.includes(`${kelas}::${mapel}`)) return true
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.includes(kelas)
}

export const simpanJawabanOfflineKuis = onCall(
  { region: 'asia-southeast2', maxInstances: 10 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Harus login sebagai guru.')
    if (request.auth.token?.lmsSiswa === true) {
      throw new HttpsError('permission-denied', 'Akun siswa tidak boleh input offline.')
    }

    const { kuisId, siswaId, siswaNama, jawaban, skorOverride } = request.data || {}
    if (typeof kuisId !== 'string' || !kuisId) throw new HttpsError('invalid-argument', 'kuisId wajib.')
    if (typeof siswaId !== 'string' || !siswaId) throw new HttpsError('invalid-argument', 'siswaId wajib.')
    if (!jawaban || typeof jawaban !== 'object') throw new HttpsError('invalid-argument', 'jawaban wajib.')

    const db = getFirestore()
    const uid = request.auth.uid
    const profilSnap = await db.doc(`users/${uid}`).get()
    if (!profilSnap.exists) throw new HttpsError('permission-denied', 'Profil tidak ditemukan.')
    const profil = profilSnap.data()

    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    const kuis = kuisSnap.data()
    const kelas = String(kuis.kelas || '')
    const mapel = String(kuis.mapel || '')
    if (!bolehMapelKelas(profil, mapel, kelas)) {
      throw new HttpsError('permission-denied', 'Bukan pengampu kelas×mapel ini.')
    }

    const mode = kuis.modePelaksanaan === 'offline' ? 'offline' : 'online'
    // Izinkan input offline juga jika guru memaksa (mis. cadangan), tapi sarankan mode offline
    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []
    const override =
      skorOverride && typeof skorOverride === 'object' ? skorOverride : {}

    let totalSkor = 0
    let totalPoin = 0
    let butuhManual = false
    const detail = []
    const jawabanBersih = {}

    for (const soal of soalList) {
      let jawab = jawaban[soal.id]
      // skorOverride untuk isian/uraian (AI atau guru)
      if (
        (soal.tipe === 'uraian' || soal.tipe === 'isian') &&
        override[soal.id] != null &&
        typeof override[soal.id] === 'number'
      ) {
        const maks = Number(soal.poin) || 1
        const skor = Math.min(maks, Math.max(0, Math.round(Number(override[soal.id]) * 2) / 2))
        const teks = typeof jawab === 'string' ? jawab : ''
        jawabanBersih[soal.id] = teks
        totalSkor += skor
        totalPoin += maks
        detail.push({
          soalId: soal.id,
          tipe: soal.tipe,
          benar: skor >= maks,
          skor,
          butuhManual: false,
          dinilaiManual: true,
        })
        continue
      }

      if (soal.tipe === 'uraian' && typeof jawab === 'string') {
        // plain text
      }
      jawabanBersih[soal.id] = jawab
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
        dinilaiManual: !!hasil.dinilaiManual,
      })
    }

    const skorAkhir = Math.round(totalSkor * 100) / 100
    const prev = await db
      .collection('lms_jawaban')
      .where('kuisId', '==', kuisId)
      .where('siswaId', '==', siswaId)
      .get()
    const percobaan = prev.size + 1

    const payload = {
      kuisId,
      siswaUid: null,
      siswaId,
      siswaNama: typeof siswaNama === 'string' ? siswaNama : '',
      kelas,
      mapel,
      judulKuis: kuis.judul || '',
      jenisPenilaian: kuis.jenisPenilaian || 'latihan',
      jawaban: jawabanBersih,
      skorOtomatis: skorAkhir,
      totalPoin,
      detail,
      percobaan,
      status: butuhManual ? 'sebagian_manual' : 'selesai',
      sumber: 'offline',
      diinputOleh: uid,
      diinputOlehNama: typeof profil.nama === 'string' ? profil.nama : '',
      createdAt: FieldValue.serverTimestamp(),
    }

    const ref = await db.collection('lms_jawaban').add(payload)
    logger.info('simpanJawabanOfflineKuis', { kuisId, siswaId, skor: skorAkhir, mode })

    return {
      ok: true,
      jawabanId: ref.id,
      skor: skorAkhir,
      totalPoin,
      percobaan,
      status: payload.status,
      detail,
    }
  },
)
