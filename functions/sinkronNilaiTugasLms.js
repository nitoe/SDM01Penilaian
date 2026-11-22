/**
 * Sinkron nilai tugas LMS → koleksi nilai Penilaian (rapor).
 * - latihan: ditolak
 * - slm → nilai_tp.slm  (AGREGAT rata-rata semua tugas+kuis SLM terkait TP yang sama, termasuk
 *         tugas diarsipkan; rincian komponen di slmKomponen — lihat agregasiSlmLms.js v2)
 * - sts → nilai_sts.nilai (nilai tugas ini; last-write bila overwrite)
 * - sas → nilai_sas.nilai
 *
 * Sumber skor tugas: lms_nilai_tugas.nilai (0–100). TP dari lms_tugas.tpList.
 * Deploy: firebase deploy --only functions:sinkronNilaiTugasLms
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import {
  kumpulkanSkorSlm,
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

    const namaBySiswa = new Map()
    for (const n of nilaiDocs) {
      if (n.siswaId && n.siswaNama) namaBySiswa.set(String(n.siswaId), String(n.siswaNama))
    }

    // Rombel tujuan: induk + rombel paralel yang diberi tugas ini dan boleh ditulis pengguna.
    const { tujuan, tanpaTp, tidakBerhak } = await petakanRombelTujuan(db, {
      kelas,
      kelasList: tugas.kelasList,
      tpList,
      mapelUtama,
      boleh: (m, k) => bolehMapelKelas(profil, m, k),
    })
    const rombel = []
    let agregatMeta = null

    for (const tj of tujuan) {
      const kelasT = tj.kelas
      const tpListT = tj.tpList
      const tinggiT = tingkatanDariKelas(kelasT)
      const ditulisAwal = ditulis

      if (jenis === 'slm') {
        // SLM: rata-rata semua tugas+kuis SLM rombel ini yang terkait TP (satu implementasi bersama)
        const hasil = await kumpulkanSkorSlm(db, {
          kelas: kelasT,
          tpTargets: tpListT,
          semester,
          tahunAjaran,
        })
        if (kelasT === kelas) agregatMeta = hasil.meta
        logger.info('sinkronNilaiTugasLms agregasi SLM', { kelas: kelasT, ...hasil.meta })
        const r = await tulisNilaiTpSlm(db, {
          tpList: tpListT,
          mapelUtama,
          hasil,
          kelas: kelasT,
          semester,
          tahunAjaran,
          uid,
          overwrite,
          sumber: { sumberTugasId: tugasId },
          namaBySiswa,
        })
        ditulis += r.ditulis
        dilewati += r.dilewati
      } else {
        for (const tp of tpListT) {
          const mapel = tp.mapel || mapelUtama
          const existingSnap = await db
            .collection(koleksi)
            .where('tpId', '==', tp.id)
            .where('mapel', '==', mapel)
            .where('kelas', '==', kelasT)
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
            const siswaId = String(n.siswaId || '')
            // Hanya rekaman siswa rombel tujuan (rekaman tanpa kelas = rombel induk tugas).
            const kn = String(n.kelas || kelas).toUpperCase()
            if (!siswaId || kn !== kelasT || typeof n.nilai !== 'number') {
              if (kelasT === kelas) dilewati++
              continue
            }
            const foundId = existingBySiswa.get(siswaId)
            if (foundId && !overwrite) {
              dilewati++
              continue
            }
            const nilai = Math.round(Math.max(0, Math.min(100, Number(n.nilai))) * 100) / 100
            const base = {
              tpId: tp.id,
              siswaId,
              mapel,
              kelas: kelasT,
              tingkatan: tinggiT,
              semester,
              tahunAjaran,
              nilai,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: uid,
              sumberTugasId: tugasId,
            }
            if (n.siswaNama) base.siswaNama = String(n.siswaNama)
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
      }
      rombel.push({ kelas: kelasT, nTp: tpListT.length, ditulis: ditulis - ditulisAwal })
    }

    if (jenis === 'slm') await capPeriodeSlm(tugasSnap.ref, tugas, semester, tahunAjaran)

    const ringkas = {
      jenis,
      nSiswa: nilaiDocs.length,
      nTp: tpList.length,
      ditulis,
      dilewati,
      semester,
      tahunAjaran,
      koleksi,
      rombel,
      rombelTanpaTp: tanpaTp,
      rombelTidakBerhak: tidakBerhak,
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
