/**
 * Sinkron skor kuis LMS (online/offline) → nilai Penilaian.
 * - latihan: ditolak
 * - slm → nilai_tp.slm
 * - sts → nilai_sts.nilai
 * - sas → nilai_sas.nilai
 *
 * Deploy: firebase deploy --only functions:sinkronNilaiKuisLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'

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

function tingkatanDariKelas(kelas) {
  const m = String(kelas || '').match(/^(\d+)/)
  return m ? m[1] : String(kelas || '')
}

function perSiswaTerbaru(docs) {
  const map = new Map()
  for (const j of docs) {
    const key = j.siswaId || j.siswaUid || j._id
    if (!key) continue
    const prev = map.get(key)
    const t = j.createdAt?.toMillis?.() || (j.createdAt?._seconds || 0) * 1000 || 0
    const tp = prev?.createdAt?.toMillis?.() || (prev?.createdAt?._seconds || 0) * 1000 || 0
    if (!prev || t > tp || (j.percobaan || 0) > (prev.percobaan || 0)) map.set(key, j)
  }
  return [...map.values()]
}

async function resolveTpIds(db, mapel, kelas, labels) {
  const out = []
  const seen = new Set()
  const tingkatan = tingkatanDariKelas(kelas)
  // labels bisa id dokumen atau nama TP
  for (const label of labels) {
    const s = String(label || '').trim()
    if (!s || seen.has(s)) continue
    // coba sebagai id
    const byId = await db.doc(`tp_kktp/${s}`).get()
    if (byId.exists) {
      seen.add(s)
      out.push({ id: s, nama: String(byId.data().namaTp || byId.data().nama || s) })
      continue
    }
  }
  // query by kelas + mapel, match nama
  const q = await db
    .collection('tp_kktp')
    .where('kelas', '==', kelas)
    .where('mapel', '==', mapel)
    .get()
  // juga coba tingkatan-only if empty
  let docs = q.docs
  if (docs.length === 0) {
    const q2 = await db.collection('tp_kktp').where('mapel', '==', mapel).get()
    docs = q2.docs.filter((d) => {
      const k = String(d.data().kelas || '')
      return k === kelas || k === tingkatan || k.startsWith(tingkatan)
    })
  }
  for (const label of labels) {
    const s = String(label || '').trim()
    if (!s || seen.has(s)) continue
    const found = docs.find((d) => {
      const nama = String(d.data().namaTp || d.data().nama || '').trim()
      return nama === s || nama.toLowerCase() === s.toLowerCase()
    })
    if (found) {
      seen.add(s)
      seen.add(found.id)
      out.push({ id: found.id, nama: String(found.data().namaTp || found.data().nama || s) })
    }
  }
  return out
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
    const terbaru = perSiswaTerbaru(semua).filter((j) => j.siswaId)

    if (terbaru.length === 0) {
      throw new HttpsError('failed-precondition', 'Belum ada jawaban siswa untuk disinkronkan.')
    }

    const nilaiPerTpKuis =
      kuis.nilaiPerTp && typeof kuis.nilaiPerTp === 'object' ? kuis.nilaiPerTp : null

    let ditulis = 0
    let dilewati = 0
    const koleksi = jenis === 'slm' ? 'nilai_tp' : jenis === 'sts' ? 'nilai_sts' : 'nilai_sas'

    for (const tp of tpList) {
      // existing docs for this tp
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
        if (sid) existingBySiswa.set(sid, d.id)
      })

      let batch = db.batch()
      let ops = 0

      for (const j of terbaru) {
        const siswaId = String(j.siswaId)
        let nilai = skor100(j.skorOtomatis, j.totalPoin)
        if (nilaiPerTpKuis) {
          const byNama = nilaiPerTpKuis[tp.nama]
          if (typeof byNama === 'number' && Number.isFinite(byNama)) nilai = byNama
        }
        nilai = Math.round(Math.max(0, Math.min(100, nilai)) * 100) / 100

        const foundId = existingBySiswa.get(siswaId)
        if (foundId && !overwrite) {
          dilewati++
          continue
        }

        const base = {
          tpId: tp.id,
          siswaId,
          mapel,
          kelas,
          tingkatan,
          semester,
          tahunAjaran,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
          sumberKuisId: kuisId,
        }

        if (jenis === 'slm') {
          base.slm = nilai
        } else {
          base.nilai = nilai
        }

        if (foundId) {
          batch.update(db.doc(`${koleksi}/${foundId}`), base)
        } else {
          batch.set(db.collection(koleksi).doc(), {
            ...base,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: uid,
          })
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
