/**
 * Guru menyimpan jawaban kuis offline → nilai otomatis (kunci server) → lms_jawaban.
 * Berlaku untuk kuis mapel biasa, TKA, dan Lomba (pengampu).
 *
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
    // Selaras nilaiKuisLms.js: kunci pasangan = id item kanan yang cocok (p.id)
    const benarN = pasangan.filter((p) => p && j[p.id] === p.id).length
    if (pasangan.length === 0) return { benar: false, skor: 0, butuhManual: false }
    if (soal.nilaiParsial) {
      const skor = (benarN / pasangan.length) * poin
      return {
        benar: benarN === pasangan.length,
        skor: Math.round(skor * 100) / 100,
        butuhManual: false,
      }
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
    const benarN = pernyataan.filter((p) => p && j[p.id] === p.benar).length
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
  const k = String(kelas || '').toUpperCase()
  const m = String(mapel || '').trim()
  const pk = Array.isArray(profil.penugasanKelasMapel) ? profil.penugasanKelasMapel : []
  if (pk.includes(`${k}::${m}`)) return true
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.includes(k)
}

export const simpanJawabanOfflineKuis = onCall(
  { region: 'asia-southeast2', maxInstances: 10 },
  async (request) => {
    try {
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
    const email = request.auth.token?.email || ''
    const profilSnap = await db.doc(`users/${uid}`).get()
    if (!profilSnap.exists) throw new HttpsError('permission-denied', 'Profil tidak ditemukan.')
    const profil = profilSnap.data()

    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    const kuis = kuisSnap.data()
    const kelas = String(kuis.kelas || '').toUpperCase()
    const mapel = String(kuis.mapel || '').trim()
    const lombaId = typeof kuis.lombaId === 'string' ? kuis.lombaId.trim() : ''
    const isLomba = !!lombaId && kelas === 'LB'

    // Izin: mapel biasa / TKA via penugasan·wali; Lomba via pengampu
    if (isLomba) {
      const lombaSnap = await db.doc(`lms_lomba/${lombaId}`).get()
      if (!lombaSnap.exists) throw new HttpsError('not-found', 'Lomba tidak ditemukan.')
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
          'Hanya pengampu lomba atau admin yang boleh input offline.',
        )
      }
    } else {
      // Cek kelas utama + kelasList (berbagi paralel)
      const kandidat = new Set()
      if (kelas) kandidat.add(kelas)
      if (Array.isArray(kuis.kelasList)) {
        for (const k of kuis.kelasList) {
          const kk = String(k || '').toUpperCase()
          if (kk) kandidat.add(kk)
        }
      }
      let ok = profil.role === 'admin'
      if (!ok) {
        for (const k of kandidat) {
          if (bolehMapelKelas(profil, mapel, k)) {
            ok = true
            break
          }
        }
      }
      if (!ok) {
        throw new HttpsError('permission-denied', 'Bukan pengampu kelas×mapel ini.')
      }
    }

    const mode = kuis.modePelaksanaan === 'offline' ? 'offline' : 'online'
    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []
    const override =
      skorOverride && typeof skorOverride === 'object' ? skorOverride : {}

    let totalSkor = 0
    let totalPoin = 0
    let butuhManual = false
    const detail = []
    const jawabanBersih = {}

    for (const soal of soalList) {
      if (!soal || typeof soal !== 'object' || !soal.id) continue
      const sid = String(soal.id)
      let jawab = jawaban[sid]
      // skorOverride untuk isian/uraian (AI atau guru)
      if (
        (soal.tipe === 'uraian' || soal.tipe === 'isian') &&
        override[sid] != null &&
        typeof override[sid] === 'number'
      ) {
        const maks = Number(soal.poin) || 1
        const skor = Math.min(maks, Math.max(0, Math.round(Number(override[sid]) * 2) / 2))
        const teks = typeof jawab === 'string' ? jawab : ''
        jawabanBersih[sid] = teks
        totalSkor += skor
        totalPoin += maks
        detail.push({
          soalId: sid,
          tipe: soal.tipe,
          benar: skor >= maks,
          skor,
          butuhManual: false,
          dinilaiManual: true,
        })
        continue
      }

      jawabanBersih[sid] = jawab
      let hasil
      try {
        hasil = nilaiSatuSoal(soal, jawab)
      } catch (e) {
        logger.warn('nilaiSatuSoal gagal', { soalId: sid, tipe: soal.tipe, err: String(e) })
        hasil = { benar: false, skor: 0, butuhManual: true }
      }
      totalSkor += hasil.skor
      totalPoin += Number(soal.poin) || 1
      if (hasil.butuhManual) butuhManual = true
      detail.push({
        soalId: sid,
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
      kelas: kelas || String(kuis.kelas || ''),
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
    if (lombaId) payload.lombaId = lombaId

    const ref = await db.collection('lms_jawaban').add(payload)
    logger.info('simpanJawabanOfflineKuis', {
      kuisId,
      siswaId,
      skor: skorAkhir,
      mode,
      isLomba,
    })

    return {
      ok: true,
      jawabanId: ref.id,
      skor: skorAkhir,
      totalPoin,
      percobaan,
      status: payload.status,
      detail,
    }
    } catch (err) {
      if (err instanceof HttpsError) throw err
      logger.error('simpanJawabanOfflineKuis uncaught', {
        message: err && err.message,
        stack: err && err.stack,
        name: err && err.name,
      })
      const msg = err && err.message ? String(err.message) : 'Kesalahan server saat menyimpan jawaban offline.'
      throw new HttpsError('internal', msg.slice(0, 500))
    }
  },
)
