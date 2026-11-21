/**
 * Agregasi skor SLM dari banyak sumber LMS (tugas + kuis) per siswa × TP (v2).
 * Dipakai sinkronNilaiTugasLms & sinkronNilaiKuisLms agar nilai_tp.slm
 * = rata-rata SEMUA asesmen SLM terkait TP, bukan hanya sinkron terakhir.
 *
 * Aturan (ANTIREGRESI §SLM-Agregasi):
 * - Cocokkan TP lewat id tp_kktp yang di-resolve per dokumen dalam mapel dokumennya sendiri
 *   (bukan filter mapel tugas yang disinkron) → proyek lintas mapel tidak saling menimpa.
 * - Tugas diarsipkan TETAP dihitung (arsip hanya menyembunyikan dari dashboard).
 * - Kuis dibaca lewat tpIds/tpNamaList (+ tpList/tpId/tpNama legacy).
 * - Hanya rekaman siswa yang rombelnya sama dengan kelas target (tp_kktp per rombel).
 * - Kuis: satu jawaban terbaru per siswa. Rincian komponen disimpan (slmKomponen).
 */
import { logger } from 'firebase-functions'
import { FieldValue } from 'firebase-admin/firestore'

export function tingkatanDariKelas(kelas) {
  const m = String(kelas || '').match(/^(\d+)/)
  return m ? m[1] : String(kelas || '')
}

/** Normalisasi nama TP: huruf kecil, spasi rapat, tanpa awalan «TP 3.». */
export function normNama(s) {
  return String(s ?? '')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^tp\s*\d+\s*[.:)\-]*\s*/, '')
}

function skor100(skor, total) {
  if (total == null || Number(total) <= 0) return null
  if (skor == null || Number.isNaN(Number(skor))) return null
  return Math.round((Number(skor) / Number(total)) * 1000) / 10
}

function millisJawaban(j) {
  for (const c of [j.createdAt, j.updatedAt]) {
    if (c && typeof c.toMillis === 'function') return c.toMillis()
    if (c && typeof c._seconds === 'number') return c._seconds * 1000
    if (typeof c === 'number') return c
  }
  return 0
}

/** Satu jawaban terbaru per siswa (percobaan terbesar, lalu waktu terbaru). */
export function jawabanTerbaruPerSiswa(docs) {
  const map = new Map()
  for (const j of docs) {
    const key = j.siswaId || j.siswaUid
    if (!key) continue
    const prev = map.get(key)
    if (!prev) {
      map.set(key, j)
      continue
    }
    const perc = Number(j.percobaan) || 0
    const percP = Number(prev.percobaan) || 0
    if (perc > percP || (perc === percP && millisJawaban(j) >= millisJawaban(prev))) map.set(key, j)
  }
  return [...map.values()]
}

function clamp100(n) {
  return Math.round(Math.max(0, Math.min(100, Number(n))) * 100) / 100
}

/**
 * Penyelesai label TP (id dokumen atau nama) → {id, nama} dari tp_kktp, dengan cache.
 * Logika sama dengan resolveTpIds lama (id dulu, lalu nama dalam mapel+kelas, cadangan tingkatan).
 */
export function buatPenyelesaiTp(db, kelas) {
  const tingkatan = tingkatanDariKelas(kelas)
  const cacheMapel = new Map()
  const cacheId = new Map()

  async function dokMapel(mapel) {
    const key = String(mapel || '').trim()
    if (cacheMapel.has(key)) return cacheMapel.get(key)
    let docs = []
    try {
      const q = await db.collection('tp_kktp').where('kelas', '==', kelas).where('mapel', '==', key).get()
      docs = q.docs
      if (docs.length === 0) {
        const q2 = await db.collection('tp_kktp').where('mapel', '==', key).get()
        docs = q2.docs.filter((d) => {
          const k = String(d.data().kelas || '')
          return k === kelas || k === tingkatan || k.startsWith(tingkatan)
        })
      }
    } catch (e) {
      logger.warn('penyelesaiTp: query tp_kktp gagal', key, e)
    }
    cacheMapel.set(key, docs)
    return docs
  }

  async function dokId(id) {
    if (cacheId.has(id)) return cacheId.get(id)
    let hasil = null
    try {
      const s = await db.doc(`tp_kktp/${id}`).get()
      if (s.exists) hasil = { id, nama: String(s.data().namaTp || s.data().nama || id) }
    } catch (e) {
      logger.warn('penyelesaiTp: get tp_kktp gagal', id, e)
    }
    cacheId.set(id, hasil)
    return hasil
  }

  async function resolve(mapel, labels) {
    const out = []
    const seen = new Set()
    const tambah = (tp) => {
      if (!tp || seen.has(tp.id)) return
      seen.add(tp.id)
      out.push(tp)
    }
    const sisa = []
    for (const label of labels) {
      const s = String(label || '').trim()
      if (!s) continue
      const byId = await dokId(s)
      if (byId) tambah(byId)
      else sisa.push(s)
    }
    if (sisa.length) {
      const docs = await dokMapel(mapel)
      for (const s of sisa) {
        const n = normNama(s)
        const found = docs.find((d) => normNama(d.data().namaTp || d.data().nama) === n)
        if (found) tambah({ id: found.id, nama: String(found.data().namaTp || found.data().nama || s) })
      }
    }
    return out
  }

  return { resolve }
}

/** Kompatibel dengan versi lama: resolve satu daftar label dalam satu mapel. */
export async function resolveTpIds(db, mapel, kelas, labels) {
  return buatPenyelesaiTp(db, kelas).resolve(mapel, labels)
}

function jenisTugas(d) {
  const j = d.jenisPenilaian
  return j === 'latihan' || j === 'sts' || j === 'sas' || j === 'slm' ? j : 'slm' // legacy = SLM
}
function jenisKuis(d) {
  const j = d.jenisPenilaian
  return j === 'latihan' || j === 'sts' || j === 'sas' || j === 'slm' ? j : 'latihan'
}

/** Label TP tugas dikelompokkan per mapel asal TP: Map<mapel, string[]>. */
function labelTugasPerMapel(d) {
  const per = new Map()
  const add = (mapel, label) => {
    const m = String(mapel || d.mapel || '').trim()
    const l = String(label || '').trim()
    if (!l) return
    if (!per.has(m)) per.set(m, [])
    per.get(m).push(l)
  }
  if (Array.isArray(d.tpList)) {
    for (const t of d.tpList) {
      if (!t) continue
      if (t.id) add(t.mapel, t.id)
      if (t.nama) add(t.mapel, t.nama)
    }
  }
  if (d.tpId) add(d.mapel, d.tpId)
  if (d.tpNama) add(d.mapel, d.tpNama)
  return per
}

function labelKuis(d) {
  const labels = []
  for (const k of ['tpIds', 'tpNamaList']) {
    if (Array.isArray(d[k])) for (const x of d[k]) if (x) labels.push(String(x))
  }
  if (Array.isArray(d.tpList)) {
    for (const t of d.tpList) {
      if (!t) continue
      if (t.id) labels.push(String(t.id))
      if (t.nama) labels.push(String(t.nama))
    }
  }
  if (d.tpId) labels.push(String(d.tpId))
  if (d.tpNama) labels.push(String(d.tpNama))
  return labels
}

function kelasCocok(kelasRekaman, kelasTarget) {
  const k = String(kelasRekaman || '').trim().toUpperCase()
  return !k || k === kelasTarget
}

/**
 * Kumpulkan skor SLM per siswa per TP dari seluruh tugas+kuis kelas ini.
 * @param {{kelas: string, tpTargets: {id: string, nama?: string}[]}} p
 * @returns {{skor: Map<string, Map<string, number[]>>, komponen: Map<string, Map<string, object[]>>, meta: object}}
 */
export async function kumpulkanSkorSlm(db, { kelas, tpTargets }) {
  const kelasU = String(kelas || '').toUpperCase()
  const targetIds = new Set(tpTargets.map((t) => String(t.id)))
  const skor = new Map()
  const komponen = new Map()
  const meta = { nTugas: 0, nKuis: 0, tugasIds: [], kuisIds: [] }
  const penyelesai = buatPenyelesaiTp(db, kelasU)

  function push(siswaId, tpId, nilai, info) {
    if (nilai == null || Number.isNaN(Number(nilai))) return
    const sid = String(siswaId)
    const tid = String(tpId)
    const v = clamp100(nilai)
    if (!skor.has(sid)) skor.set(sid, new Map())
    if (!komponen.has(sid)) komponen.set(sid, new Map())
    if (!skor.get(sid).has(tid)) skor.get(sid).set(tid, [])
    if (!komponen.get(sid).has(tid)) komponen.get(sid).set(tid, [])
    skor.get(sid).get(tid).push(v)
    komponen.get(sid).get(tid).push({ ...info, nilai: v })
  }

  // ---- Tugas SLM (termasuk yang diarsipkan) ----
  let tugasDocs = []
  try {
    tugasDocs = (await db.collection('lms_tugas').where('kelas', '==', kelasU).get()).docs
  } catch (e) {
    logger.warn('agregasiSlm: query lms_tugas gagal', e)
  }
  const tugasRelevan = new Map() // id -> {data, tpIds:Set}
  for (const d of tugasDocs) {
    const data = d.data()
    if (jenisTugas(data) !== 'slm') continue
    const ids = new Set()
    for (const [mapel, labels] of labelTugasPerMapel(data)) {
      for (const tp of await penyelesai.resolve(mapel, labels)) {
        if (targetIds.has(tp.id)) ids.add(tp.id)
      }
    }
    if (ids.size) tugasRelevan.set(d.id, { data, ids })
  }
  meta.nTugas = tugasRelevan.size
  meta.tugasIds = [...tugasRelevan.keys()]

  const idsTugas = meta.tugasIds
  for (let i = 0; i < idsTugas.length; i += 30) {
    const batch = idsTugas.slice(i, i + 30)
    try {
      const ns = await db.collection('lms_nilai_tugas').where('tugasId', 'in', batch).get()
      for (const nd of ns.docs) {
        const n = nd.data()
        const info = tugasRelevan.get(String(n.tugasId || ''))
        if (!info || !n.siswaId) continue
        if (typeof n.nilai !== 'number' || Number.isNaN(n.nilai)) continue
        if (!kelasCocok(n.kelas, kelasU)) continue
        for (const tpId of info.ids) {
          push(n.siswaId, tpId, n.nilai, {
            jenis: 'tugas',
            id: String(n.tugasId),
            judul: String(info.data.judul || 'Tugas'),
          })
        }
      }
    } catch (e) {
      logger.warn('agregasiSlm: query lms_nilai_tugas gagal', e)
    }
  }

  // ---- Kuis SLM ----
  let kuisDocs = []
  try {
    kuisDocs = (await db.collection('lms_kuis').where('kelas', '==', kelasU).get()).docs
  } catch (e) {
    logger.warn('agregasiSlm: query lms_kuis gagal', e)
  }
  const kuisRelevan = []
  for (const d of kuisDocs) {
    const data = d.data()
    if (jenisKuis(data) !== 'slm' || data.lombaId) continue
    const resolved = await penyelesai.resolve(data.mapel, labelKuis(data))
    const tps = resolved.filter((t) => targetIds.has(t.id))
    if (tps.length) kuisRelevan.push({ id: d.id, data, tps })
  }
  meta.nKuis = kuisRelevan.length
  meta.kuisIds = kuisRelevan.map((k) => k.id)

  for (const k of kuisRelevan) {
    const npt = k.data.nilaiPerTp && typeof k.data.nilaiPerTp === 'object' ? k.data.nilaiPerTp : null
    const npMap = new Map()
    if (npt) for (const [key, v] of Object.entries(npt)) npMap.set(normNama(key), v)
    try {
      const jaw = await db.collection('lms_jawaban').where('kuisId', '==', k.id).get()
      const terbaru = jawabanTerbaruPerSiswa(jaw.docs.map((jd) => ({ ...jd.data(), _id: jd.id })))
      for (const j of terbaru) {
        const siswaId = j.siswaId || j.siswaUid
        if (!siswaId || !kelasCocok(j.kelas, kelasU)) continue
        let dasar = skor100(j.skorOtomatis, j.totalPoin)
        if (dasar == null && typeof j.skorAkhir === 'number') dasar = j.skorAkhir
        if (dasar == null && typeof j.nilai === 'number') dasar = j.nilai
        for (const tp of k.tps) {
          let nilai = dasar
          const manual = npMap.get(normNama(tp.nama)) ?? npMap.get(normNama(tp.id))
          if (typeof manual === 'number' && Number.isFinite(manual)) nilai = manual
          push(siswaId, tp.id, nilai, { jenis: 'kuis', id: k.id, judul: String(k.data.judul || 'Kuis') })
        }
      }
    } catch (e) {
      logger.warn('agregasiSlm: query lms_jawaban gagal', k.id, e)
    }
  }

  return { skor, komponen, meta }
}

export function rataSkor(arr) {
  if (!arr || arr.length === 0) return null
  return clamp100(arr.reduce((a, b) => a + b, 0) / arr.length)
}

export function nilaiAgregat(skorMap, siswaId, tpId) {
  const m = skorMap.get(String(siswaId))
  return m ? rataSkor(m.get(String(tpId))) : null
}

/**
 * Tulis nilai_tp.slm (rata-rata komponen) + slmKomponen untuk semua siswa yang punya skor pada TP.
 * Dipakai bersama oleh kedua CF sinkron (satu implementasi — jangan duplikasi).
 */
export async function tulisNilaiTpSlm(
  db,
  { tpList, mapelUtama, hasil, kelas, semester, tahunAjaran, uid, overwrite, sumber, namaBySiswa },
) {
  const kelasU = String(kelas).toUpperCase()
  const tingkatan = tingkatanDariKelas(kelasU)
  let ditulis = 0
  let dilewati = 0
  for (const tp of tpList) {
    const mapel = tp.mapel || mapelUtama
    const snap = await db
      .collection('nilai_tp')
      .where('tpId', '==', tp.id)
      .where('mapel', '==', mapel)
      .where('kelas', '==', kelasU)
      .where('semester', '==', semester)
      .where('tahunAjaran', '==', tahunAjaran)
      .get()
    const ada = new Map()
    snap.docs.forEach((d) => {
      const sid = d.data().siswaId
      if (sid) ada.set(String(sid), d.id)
    })
    let batch = db.batch()
    let ops = 0
    for (const [siswaId, perTp] of hasil.skor) {
      const arr = perTp.get(String(tp.id))
      if (!arr || !arr.length) continue
      const foundId = ada.get(siswaId)
      if (foundId && !overwrite) {
        dilewati++
        continue
      }
      const komp = hasil.komponen.get(siswaId)?.get(String(tp.id)) || []
      const base = {
        tpId: tp.id,
        siswaId,
        mapel,
        kelas: kelasU,
        tingkatan,
        semester,
        tahunAjaran,
        slm: rataSkor(arr),
        slmAgregat: {
          metode: 'rata',
          nTugas: komp.filter((x) => x.jenis === 'tugas').length,
          nKuis: komp.filter((x) => x.jenis === 'kuis').length,
          nKomponen: arr.length,
        },
        slmKomponen: komp.map((x) => ({ jenis: x.jenis, id: x.id, judul: x.judul, nilai: x.nilai })),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        ...sumber,
      }
      const nm = namaBySiswa?.get(siswaId)
      if (nm) base.siswaNama = nm
      if (foundId) batch.update(db.doc(`nilai_tp/${foundId}`), base)
      else batch.set(db.collection('nilai_tp').doc(), { ...base, createdAt: FieldValue.serverTimestamp(), createdBy: uid })
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
  return { ditulis, dilewati }
}
