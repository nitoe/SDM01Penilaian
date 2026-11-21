/**
 * Sinkron skor kuis LMS (online/offline) → nilai Penilaian.
 * - latihan: ditolak
 * - slm → nilai_tp.slm  (AGREGAT rata-rata semua tugas+kuis SLM terkait TP yang sama; rincian di
 *         slmKomponen — lihat agregasiSlmLms.js v2)
 * - sts → nilai_sts.nilai
 * - sas → nilai_sas.nilai
 *
 * Deploy: firebase deploy --only functions:sinkronNilaiKuisLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import {
  jawabanTerbaruPerSiswa,
  kumpulkanSkorSlm,
  normNama,
  resolveTpIds,
  tingkatanDariKelas,
  tulisNilaiTpSlm,
} from './agregasiSlmLms.js'

function bolehMapelKelas(profil, mapel, kelas) {
  if (!profil || profil.aktif === false) return false
  if (profil.role === 'admin') return true
  if (!['guru', 'guru_akademik', 'guru_tahsin_tahfizh'].includes(profil.role)) return false
  const pk = Array.isArray(profil.penugasanKelasMapel) ? profil.penugasanKelasMapel : []
  if (pk.includes(`${kelas}::${mapel}`)) return true
  const wali = Array.isArray(profil.waliKelas) ? profil.waliKelas : []
  return wali.includes(kelas)
}

function skor100(skor, total) {
  if (!total || total <= 0) return 0
  return Math.round((Number(skor) / Number(total)) * 1000) / 10
}

export const sinkronNilaiKuisLms = onCall(
  { region: 'asia-southeast2', maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Harus login.')
    if (request.auth.token?.lmsSiswa === true) {
      throw new HttpsError('permission-denied', 'Akun siswa tidak boleh sinkron nilai.')
    }

    const kuisId = request.data?.kuisId
    if (typeof kuisId !== 'string' || !kuisId) {
      throw new HttpsError('invalid-argument', 'kuisId wajib.')
    }
    const overwrite = request.data?.overwrite !== false

    const db = getFirestore()
    const uid = request.auth.uid
    const profilSnap = await db.doc(`users/${uid}`).get()
    if (!profilSnap.exists) throw new HttpsError('permission-denied', 'Profil tidak ditemukan.')
    const profil = profilSnap.data()

    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    const kuis = kuisSnap.data()
    const kelas = String(kuis.kelas || '').toUpperCase()
    const mapel = String(kuis.mapel || '').trim()
    const jenis = String(kuis.jenisPenilaian || 'latihan')

    if (!bolehMapelKelas(profil, mapel, kelas)) {
      throw new HttpsError('permission-denied', 'Bukan pengampu kelas×mapel ini.')
    }
    if (jenis === 'latihan') {
      throw new HttpsError(
        'failed-precondition',
        'Kuis latihan tidak masuk nilai rapor. Ubah jenis penilaian ke SLM/STS/SAS dulu.',
      )
    }
    if (!['slm', 'sts', 'sas'].includes(jenis)) {
      throw new HttpsError('failed-precondition', `Jenis penilaian tidak dikenal: ${jenis}`)
    }

    const labels = [
      ...(Array.isArray(kuis.tpIds) ? kuis.tpIds : []),
      ...(Array.isArray(kuis.tpNamaList) ? kuis.tpNamaList : []),
    ]
    const uniqueLabels = [...new Set(labels.map(String).filter(Boolean))]
    if (uniqueLabels.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Kuis belum punya daftar TP. Isi TP di Atur kuis sebelum sinkron.',
      )
    }

    const tpList = await resolveTpIds(db, mapel, kelas, uniqueLabels)
    if (tpList.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'TP di kuis tidak cocok dengan data tp_kktp (nama/mapel/kelas). Periksa penamaan TP.',
      )
    }

    const cfgSnap = await db.doc('config/akademik').get()
    const cfg = cfgSnap.exists ? cfgSnap.data() : {}
    const semester = request.data?.semester === '2' ? '2' : cfg.semesterAktif === '2' ? '2' : '1'
    const tahunAjaran =
      typeof request.data?.tahunAjaran === 'string' && request.data.tahunAjaran.trim()
        ? request.data.tahunAjaran.trim()
        : String(cfg.tahunAjaran || '2026/2027')
    const tingkatan = tingkatanDariKelas(kelas)

    const jawSnap = await db.collection('lms_jawaban').where('kuisId', '==', kuisId).get()
    const semua = jawSnap.docs.map((d) => ({ _id: d.id, ...d.data() }))
    const terbaru = jawabanTerbaruPerSiswa(semua).filter((j) => j.siswaId)

    if (terbaru.length === 0) {
      throw new HttpsError('failed-precondition', 'Belum ada jawaban siswa untuk disinkronkan.')
    }

    const nilaiPerTpKuis =
      kuis.nilaiPerTp && typeof kuis.nilaiPerTp === 'object' ? kuis.nilaiPerTp : null

    let ditulis = 0
    let dilewati = 0
    const koleksi = jenis === 'slm' ? 'nilai_tp' : jenis === 'sts' ? 'nilai_sts' : 'nilai_sas'
    const namaBySiswa = new Map()
    for (const j of terbaru) {
      if (j.siswaId && j.siswaNama) namaBySiswa.set(String(j.siswaId), String(j.siswaNama))
    }

    let agregatMeta = null
    if (jenis === 'slm') {
      // SLM: rata-rata semua tugas+kuis SLM kelas ini yang terkait TP (bukan skor kuis ini saja)
      const hasil = await kumpulkanSkorSlm(db, { kelas, tpTargets: tpList })
      agregatMeta = hasil.meta
      logger.info('sinkronNilaiKuisLms agregasi SLM', hasil.meta)
      const r = await tulisNilaiTpSlm(db, {
        tpList,
        mapelUtama: mapel,
        hasil,
        kelas,
        semester,
        tahunAjaran,
        uid,
        overwrite,
        sumber: { sumberKuisId: kuisId },
        namaBySiswa,
      })
      ditulis = r.ditulis
      dilewati = r.dilewati
    } else {
      const npMap = new Map()
      if (nilaiPerTpKuis) for (const [key, v] of Object.entries(nilaiPerTpKuis)) npMap.set(normNama(key), v)
      for (const tp of tpList) {
        const existingSnap = await db
          .collection(koleksi)
          .where('tpId', '==', tp.id)
          .where('mapel', '==', mapel)
          .where('kelas', '==', kelas)
          .where('semester', '==', semester)
          .where('tahunAjaran', '==', tahunAjaran)
          .get()
        const existingBySiswa = new Map()
        existingSnap.docs.forEach((d) => {
          const sid = d.data().siswaId
          if (sid) existingBySiswa.set(String(sid), d.id)
        })
        let batch = db.batch()
        let ops = 0
        for (const j of terbaru) {
          const siswaId = String(j.siswaId)
          const kj = String(j.kelas || '').toUpperCase()
          if (kj && kj !== kelas) {
            dilewati++ // rombel lain (kuis dibagikan)
            continue
          }
          const foundId = existingBySiswa.get(siswaId)
          if (foundId && !overwrite) {
            dilewati++
            continue
          }
          let nilai = skor100(j.skorOtomatis, j.totalPoin)
          const manual = npMap.get(normNama(tp.nama)) ?? npMap.get(normNama(tp.id))
          if (typeof manual === 'number' && Number.isFinite(manual)) nilai = manual
          nilai = Math.round(Math.max(0, Math.min(100, Number(nilai) || 0)) * 100) / 100
          const base = {
            tpId: tp.id,
            siswaId,
            mapel,
            kelas,
            tingkatan,
            semester,
            tahunAjaran,
            nilai,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: uid,
            sumberKuisId: kuisId,
          }
          if (j.siswaNama) base.siswaNama = String(j.siswaNama)
          if (foundId) {
            batch.update(db.doc(`${koleksi}/${foundId}`), base)
          } else {
            batch.set(db.collection(koleksi).doc(), { ...base, createdAt: FieldValue.serverTimestamp(), createdBy: uid })
          }
          ditulis++
          ops++
          if (ops >= 400) {
            await batch.commit()
            batch = db.batch()
            ops = 0
          }
        }
        if (ops > 0) await batch.commit()
      }
    }

    // tandai kuis
    await kuisSnap.ref.update({
      terakhirSinkronAt: FieldValue.serverTimestamp(),
      terakhirSinkronOleh: uid,
      terakhirSinkronRingkas: {
        jenis,
        nSiswa: terbaru.length,
        nTp: tpList.length,
        ditulis,
        dilewati,
        ...(agregatMeta
          ? { agregat: { metode: 'rata', nTugas: agregatMeta.nTugas, nKuis: agregatMeta.nKuis } }
          : {}),
        semester,
        tahunAjaran,
      },
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info('sinkronNilaiKuisLms', { kuisId, jenis, ditulis, dilewati, uid })

    return {
      ok: true,
      jenis,
      semester,
      tahunAjaran,
      nSiswa: terbaru.length,
      nTp: tpList.length,
      tp: tpList.map((t) => t.nama),
      ditulis,
      dilewati,
      koleksi,
    }
  },
)
