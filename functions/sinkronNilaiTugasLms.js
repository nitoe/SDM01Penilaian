/**
 * Sinkron nilai tugas LMS → koleksi nilai Penilaian (rapor).
 * - latihan: ditolak
 * - slm → nilai_tp.slm  (AGREGAT rata-rata semua tugas+kuis SLM terkait TP yang sama)
 * - sts → nilai_sts.nilai (nilai tugas ini; last-write bila overwrite)
 * - sas → nilai_sas.nilai
 *
 * Sumber skor tugas: lms_nilai_tugas.nilai (0–100). TP dari lms_tugas.tpList.
 * Deploy: firebase deploy --only functions:sinkronNilaiTugasLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { kumpulkanSkorSlm, nilaiAgregat } from './agregasiSlmLms.js'

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
  {
    region: 'asia-southeast2',
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Harus masuk.')
    }
    const uid = request.auth.uid
    const tugasId = String(request.data?.tugasId || '').trim()
    const overwrite = request.data?.overwrite !== false
    if (!tugasId) throw new HttpsError('invalid-argument', 'tugasId wajib.')

    const db = getFirestore()
    const profilSnap = await db.doc(`users/${uid}`).get()
    const profil = profilSnap.exists ? profilSnap.data() : null
    if (!profil || profil.aktif === false) {
      throw new HttpsError('permission-denied', 'Akun tidak aktif.')
    }
    if (profil.role === 'siswa' || profil.role === 'siswa_lms') {
      throw new HttpsError('permission-denied', 'Akun siswa tidak boleh sinkron nilai.')
    }

    const tugasSnap = await db.doc(`lms_tugas/${tugasId}`).get()
    if (!tugasSnap.exists) throw new HttpsError('not-found', 'Tugas tidak ditemukan.')
    const tugas = tugasSnap.data()
    const kelas = String(tugas.kelas || '').toUpperCase()
    const mapelUtama = String(tugas.mapel || '').trim()
    const jenis = String(tugas.jenisPenilaian || 'slm')
    if (jenis === 'latihan') {
      throw new HttpsError(
        'failed-precondition',
        'Tugas latihan tidak masuk nilai rapor. Ubah jenis penilaian ke SLM/STS/SAS dulu.',
      )
    }
    if (!['slm', 'sts', 'sas'].includes(jenis)) {
      throw new HttpsError('failed-precondition', `Jenis penilaian tidak dikenal: ${jenis}`)
    }
    if (!bolehMapelKelas(profil, mapelUtama, kelas)) {
      throw new HttpsError('permission-denied', 'Bukan pengampu kelas×mapel ini.')
    }

    // Kumpulkan label TP
    const labels = []
    if (Array.isArray(tugas.tpList) && tugas.tpList.length > 0) {
      for (const t of tugas.tpList) {
        if (t?.id) labels.push(String(t.id))
        else if (t?.nama) labels.push(String(t.nama))
      }
    } else if (tugas.tpId) {
      labels.push(String(tugas.tpId))
    } else if (tugas.tpNama) {
      labels.push(String(tugas.tpNama))
    }

    const resolved = await resolveTpIds(db, mapelUtama, kelas, labels)
    // Lampirkan mapel per TP (proyek)
    const tpList = []
    if (Array.isArray(tugas.tpList) && tugas.tpList.length > 0) {
      for (const t of tugas.tpList) {
        const idOrNama = t?.id || t?.nama
        const tp = resolved.find(
          (r) =>
            r.id === t?.id ||
            r.nama === t?.nama ||
            (idOrNama && (r.id === idOrNama || r.nama === idOrNama)),
        )
        if (tp) {
          const m = (t?.mapel && String(t.mapel).trim()) || mapelUtama
          if (!tpList.some((x) => x.id === tp.id && x.mapel === m)) {
            tpList.push({ ...tp, mapel: m })
          }
        }
      }
    }
    if (tpList.length === 0) {
      for (const tp of resolved) {
        tpList.push({ ...tp, mapel: mapelUtama })
      }
    }
    if (tpList.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'TP di tugas tidak cocok dengan data tp_kktp (nama/mapel/kelas). Lampirkan TP yang valid.',
      )
    }

    const confSnap = await db.doc('config/akademik').get()
    const conf = confSnap.exists ? confSnap.data() : {}
    const semester = String(conf.semesterAktif || conf.semester || '1')
    const tahunAjaran = String(conf.tahunAjaran || conf.tahun || '')
    if (!tahunAjaran) {
      throw new HttpsError('failed-precondition', 'config/akademik.tahunAjaran belum diisi.')
    }
    const tingkatan = tingkatanDariKelas(kelas)

    const nilaiSnap = await db.collection('lms_nilai_tugas').where('tugasId', '==', tugasId).get()
    const nilaiDocs = nilaiSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    if (nilaiDocs.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Belum ada nilai tersimpan untuk tugas ini. Simpan nilai dulu.',
      )
    }

    let ditulis = 0
    let dilewati = 0
    const koleksi = jenis === 'slm' ? 'nilai_tp' : jenis === 'sts' ? 'nilai_sts' : 'nilai_sas'

    // --- SLM: agregasi lintas tugas+kuis ---
    let agregatMeta = null
    let skorAgregat = null
    if (jenis === 'slm') {
      const { skor, meta } = await kumpulkanSkorSlm(db, {
        kelas,
        mapel: mapelUtama,
        tpTargets: tpList,
      })
      skorAgregat = skor
      agregatMeta = meta
      logger.info('sinkronNilaiTugasLms agregasi SLM', meta)
    }

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

      // Siswa yang punya nilai di tugas ini (STS/SAS) ATAU di agregat SLM
      const siswaIds = new Set(nilaiDocs.map((n) => String(n.siswaId)).filter(Boolean))
      if (jenis === 'slm' && skorAgregat) {
        for (const sid of skorAgregat.keys()) siswaIds.add(sid)
      }

      const namaBySiswa = new Map()
      for (const n of nilaiDocs) {
        if (n.siswaId && n.siswaNama) namaBySiswa.set(String(n.siswaId), String(n.siswaNama))
      }

      for (const siswaId of siswaIds) {
        const foundId = existingBySiswa.get(siswaId)
        if (foundId && !overwrite) {
          dilewati++
          continue
        }

        let nilai = null
        if (jenis === 'slm') {
          nilai = nilaiAgregat(skorAgregat, siswaId, tp.id)
          // fallback: skor tugas ini saja bila agregat kosong (seharusnya sudah termasuk)
          if (nilai == null) {
            const n = nilaiDocs.find((x) => String(x.siswaId) === siswaId)
            if (n && typeof n.nilai === 'number') {
              nilai = Math.round(Math.max(0, Math.min(100, Number(n.nilai))) * 100) / 100
            }
          }
        } else {
          const n = nilaiDocs.find((x) => String(x.siswaId) === siswaId)
          if (!n || typeof n.nilai !== 'number') {
            dilewati++
            continue
          }
          nilai = Math.round(Math.max(0, Math.min(100, Number(n.nilai))) * 100) / 100
        }

        if (nilai == null) {
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
        const nm = namaBySiswa.get(siswaId)
        if (nm) base.siswaNama = nm

        if (jenis === 'slm') {
          base.slm = nilai
          if (agregatMeta) {
            base.slmAgregat = {
              metode: 'rata',
              nTugas: agregatMeta.nTugas,
              nKuis: agregatMeta.nKuis,
              nKomponen:
                (skorAgregat?.get(siswaId)?.get(tp.id)?.length) || 1,
            }
          }
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

    const ringkas = {
      jenis,
      nSiswa: nilaiDocs.length,
      nTp: tpList.length,
      ditulis,
      dilewati,
      semester,
      tahunAjaran,
      koleksi,
    }
    if (agregatMeta) {
      ringkas.agregat = {
        metode: 'rata',
        nTugas: agregatMeta.nTugas,
        nKuis: agregatMeta.nKuis,
      }
    }

    await tugasSnap.ref.update({
      terakhirSinkronAt: FieldValue.serverTimestamp(),
      terakhirSinkronOleh: uid,
      terakhirSinkronRingkas: ringkas,
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info('sinkronNilaiTugasLms', { tugasId, jenis, ditulis, dilewati, uid, agregatMeta })

    return {
      ok: true,
      ...ringkas,
      tp: tpList.map((t) => t.nama),
    }
  },
)
