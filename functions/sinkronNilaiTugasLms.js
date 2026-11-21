/**
 * Sinkron nilai tugas LMS → koleksi nilai Penilaian (rapor).
 * - latihan: ditolak
 * - slm → nilai_tp.slm
 * - sts → nilai_sts.nilai
 * - sas → nilai_sas.nilai
 *
 * Sumber skor: lms_nilai_tugas.nilai (0–100). TP dari lms_tugas.tpList.
 * Deploy: firebase deploy --only functions:sinkronNilaiTugasLms
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

function tingkatanDariKelas(kelas) {
  const m = String(kelas || '').match(/^(\d+)/)
  return m ? m[1] : String(kelas || '')
}

/**
 * Resolve label (id dokumen atau nama TP) → { id, nama } dari tp_kktp.
 */
async function resolveTpIds(db, mapel, kelas, labels) {
  const out = []
  const seen = new Set()
  const tingkatan = tingkatanDariKelas(kelas)

  for (const label of labels) {
    const s = String(label || '').trim()
    if (!s || seen.has(s)) continue
    const byId = await db.doc(`tp_kktp/${s}`).get()
    if (byId.exists) {
      seen.add(s)
      out.push({ id: s, nama: String(byId.data().namaTp || byId.data().nama || s) })
      continue
    }
  }

  const q = await db.collection('tp_kktp').where('kelas', '==', kelas).where('mapel', '==', mapel).get()
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

export const sinkronNilaiTugasLms = onCall(
  { region: 'asia-southeast2', maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Harus login.')
    if (request.auth.token?.lmsSiswa === true) {
      throw new HttpsError('permission-denied', 'Akun siswa tidak boleh sinkron nilai.')
    }

    const tugasId = request.data?.tugasId
    if (typeof tugasId !== 'string' || !tugasId) {
      throw new HttpsError('invalid-argument', 'tugasId wajib.')
    }
    const overwrite = request.data?.overwrite !== false

    const db = getFirestore()
    const uid = request.auth.uid
    const profilSnap = await db.doc(`users/${uid}`).get()
    if (!profilSnap.exists) throw new HttpsError('permission-denied', 'Profil tidak ditemukan.')
    const profil = profilSnap.data()

    const tugasSnap = await db.doc(`lms_tugas/${tugasId}`).get()
    if (!tugasSnap.exists) throw new HttpsError('not-found', 'Tugas tidak ditemukan.')
    const tugas = tugasSnap.data()
    const kelas = String(tugas.kelas || '').toUpperCase()
    const mapelUtama = String(tugas.mapel || '').trim()
    const jenis = String(tugas.jenisPenilaian || 'latihan')

    if (!bolehMapelKelas(profil, mapelUtama, kelas)) {
      throw new HttpsError('permission-denied', 'Bukan pengampu kelas×mapel ini.')
    }
    if (jenis === 'latihan') {
      throw new HttpsError(
        'failed-precondition',
        'Tugas latihan tidak masuk nilai rapor. Ubah jenis penilaian ke SLM/STS/SAS dulu.',
      )
    }
    if (!['slm', 'sts', 'sas'].includes(jenis)) {
      throw new HttpsError('failed-precondition', `Jenis penilaian tidak dikenal: ${jenis}`)
    }

    // Kumpulkan label TP: prefer tpList, fallback field lama
    const labels = []
    const mapelPerLabel = new Map()
    if (Array.isArray(tugas.tpList) && tugas.tpList.length > 0) {
      for (const t of tugas.tpList) {
        const id = t?.id ? String(t.id).trim() : ''
        const nama = t?.nama ? String(t.nama).trim() : ''
        const m = t?.mapel ? String(t.mapel).trim() : mapelUtama
        if (id) {
          labels.push(id)
          if (!mapelPerLabel.has(id)) mapelPerLabel.set(id, m || mapelUtama)
        }
        if (nama) {
          labels.push(nama)
          if (!mapelPerLabel.has(nama)) mapelPerLabel.set(nama, m || mapelUtama)
        }
      }
    } else if (tugas.tpId || tugas.tpNama) {
      if (tugas.tpId) labels.push(String(tugas.tpId))
      if (tugas.tpNama) labels.push(String(tugas.tpNama))
    }

    const uniqueLabels = [...new Set(labels.map(String).filter(Boolean))]
    if (uniqueLabels.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Tugas belum punya daftar TP. Lampirkan TP di pengaturan tugas sebelum sinkron.',
      )
    }

    // Resolve per mapel (proyek lintas mapel)
    const mapelSet = new Set(
      uniqueLabels.map((l) => mapelPerLabel.get(l) || mapelUtama).filter(Boolean),
    )
    if (mapelSet.size === 0) mapelSet.add(mapelUtama)

    const tpList = []
    const seenTpId = new Set()
    for (const m of mapelSet) {
      const labelsForMapel = uniqueLabels.filter(
        (l) => (mapelPerLabel.get(l) || mapelUtama) === m,
      )
      const resolved = await resolveTpIds(db, m, kelas, labelsForMapel.length ? labelsForMapel : uniqueLabels)
      for (const tp of resolved) {
        if (seenTpId.has(tp.id)) continue
        seenTpId.add(tp.id)
        tpList.push({ ...tp, mapel: m })
      }
    }

    // Fallback: resolve semua label terhadap mapel utama bila belum ketemu
    if (tpList.length === 0) {
      const resolved = await resolveTpIds(db, mapelUtama, kelas, uniqueLabels)
      for (const tp of resolved) {
        tpList.push({ ...tp, mapel: mapelUtama })
      }
    }

    if (tpList.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'TP di tugas tidak cocok dengan data tp_kktp (nama/mapel/kelas). Periksa penamaan TP.',
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

    const nilaiSnap = await db.collection('lms_nilai_tugas').where('tugasId', '==', tugasId).get()
    const nilaiDocs = nilaiSnap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .filter((n) => n.siswaId && typeof n.nilai === 'number' && Number.isFinite(n.nilai))

    if (nilaiDocs.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Belum ada nilai siswa yang disimpan untuk tugas ini. Isi & simpan nilai dulu.',
      )
    }

    let ditulis = 0
    let dilewati = 0
    const koleksi = jenis === 'slm' ? 'nilai_tp' : jenis === 'sts' ? 'nilai_sts' : 'nilai_sas'

    for (const tp of tpList) {
      const mapel = tp.mapel || mapelUtama
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

      for (const n of nilaiDocs) {
        const siswaId = String(n.siswaId)
        let nilai = Math.round(Math.max(0, Math.min(100, Number(n.nilai))) * 100) / 100

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
          sumberTugasId: tugasId,
        }
        if (n.siswaNama) base.siswaNama = String(n.siswaNama)

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

    await tugasSnap.ref.update({
      terakhirSinkronAt: FieldValue.serverTimestamp(),
      terakhirSinkronOleh: uid,
      terakhirSinkronRingkas: {
        jenis,
        nSiswa: nilaiDocs.length,
        nTp: tpList.length,
        ditulis,
        dilewati,
        semester,
        tahunAjaran,
        koleksi,
      },
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info('sinkronNilaiTugasLms', { tugasId, jenis, ditulis, dilewati, uid })

    return {
      ok: true,
      jenis,
      semester,
      tahunAjaran,
      nSiswa: nilaiDocs.length,
      nTp: tpList.length,
      tp: tpList.map((t) => t.nama),
      ditulis,
      dilewati,
      koleksi,
    }
  },
)
