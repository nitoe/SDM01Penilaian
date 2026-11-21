/**
 * Agregasi skor SLM dari banyak sumber LMS (tugas + kuis) per siswa × TP.
 * Dipakai sinkronNilaiTugasLms & sinkronNilaiKuisLms agar nilai_tp.slm
 * = rata-rata semua asesmen SLM terkait TP, bukan hanya sinkron terakhir.
 */
import { logger } from 'firebase-functions'

function skor100(skor, total) {
  if (total == null || Number(total) <= 0) return null
  if (skor == null || Number.isNaN(Number(skor))) return null
  return Math.round((Number(skor) / Number(total)) * 1000) / 10
}

/** Timestamp kasar untuk membandingkan percobaan jawaban. */
function millisJawaban(j) {
  const c = j.createdAt
  if (c && typeof c.toMillis === 'function') return c.toMillis()
  if (c && typeof c._seconds === 'number') return c._seconds * 1000
  if (typeof c === 'number') return c
  const u = j.updatedAt
  if (u && typeof u.toMillis === 'function') return u.toMillis()
  if (u && typeof u._seconds === 'number') return u._seconds * 1000
  return 0
}

/**
 * Satu jawaban terbaru per siswa (selaras sinkronNilaiKuisLms / perSiswaTerbaru).
 * Tanpa ini, siswa yang mengulang kuis terhitung berkali-kali di rata-rata SLM.
 */
function jawabanTerbaruPerSiswa(docs) {
  const map = new Map()
  for (const j of docs) {
    const key = j.siswaId || j.siswaUid
    if (!key) continue
    const prev = map.get(key)
    if (!prev) {
      map.set(key, j)
      continue
    }
    const t = millisJawaban(j)
    const tp = millisJawaban(prev)
    const perc = Number(j.percobaan) || 0
    const percP = Number(prev.percobaan) || 0
    if (perc > percP || (perc === percP && t >= tp)) map.set(key, j)
  }
  return [...map.values()]
}

function clamp100(n) {
  return Math.round(Math.max(0, Math.min(100, Number(n))) * 100) / 100
}

function jenisPenilaianTugas(d) {
  const j = d.jenisPenilaian
  if (j === 'latihan' || j === 'sts' || j === 'sas' || j === 'slm') return j
  // Legacy tugas tanpa field = SLM (selaras normalisasi LMS)
  return 'slm'
}

function jenisPenilaianKuis(d) {
  const j = d.jenisPenilaian
  if (j === 'latihan' || j === 'sts' || j === 'sas' || j === 'slm') return j
  return 'latihan'
}

/** Label TP mentah dari dokumen tugas/kuis. */
function labelTpDariDok(d) {
  const labels = []
  if (Array.isArray(d.tpList)) {
    for (const t of d.tpList) {
      if (!t) continue
      if (t.id) labels.push(String(t.id))
      if (t.nama) labels.push(String(t.nama).trim())
    }
  }
  if (d.tpId) labels.push(String(d.tpId))
  if (d.tpNama) labels.push(String(d.tpNama).trim())
  // kuis kadang pakai array string / objek tp
  if (Array.isArray(d.tujuanPembelajaran)) {
    for (const t of d.tujuanPembelajaran) {
      if (typeof t === 'string') labels.push(t.trim())
      else if (t && typeof t === 'object') {
        if (t.id) labels.push(String(t.id))
        if (t.nama) labels.push(String(t.nama).trim())
      }
    }
  }
  return labels.filter(Boolean)
}

/**
 * Apakah dokumen tugas/kuis terkait salah satu TP target?
 * tpTargets: [{ id, nama }]
 */
function dokTerkaitTp(d, tpTargets) {
  const labels = labelTpDariDok(d).map((x) => x.toLowerCase())
  if (labels.length === 0) return false
  for (const tp of tpTargets) {
    const id = String(tp.id || '').toLowerCase()
    const nama = String(tp.nama || '').toLowerCase()
    if (id && labels.includes(id)) return true
    if (nama && labels.includes(nama)) return true
  }
  return false
}

/** TP target mana saja yang cocok dengan dokumen ini. */
function tpCocokDariDok(d, tpTargets) {
  const labels = new Set(labelTpDariDok(d).map((x) => x.toLowerCase()))
  return tpTargets.filter((tp) => {
    const id = String(tp.id || '').toLowerCase()
    const nama = String(tp.nama || '').toLowerCase()
    return ((id && labels.has(id)) || (nama && labels.has(nama)))
  })
}

/**
 * Kumpulkan skor SLM per siswa per TP dari seluruh tugas+kuis terkait.
 *
 * @returns {{
 *   skor: Map<string, Map<string, number[]>>, // siswaId -> tpId -> skor[]
 *   meta: { nTugas: number, nKuis: number, tugasIds: string[], kuisIds: string[] }
 * }}
 */
export async function kumpulkanSkorSlm(db, { kelas, mapel, tpTargets }) {
  const skor = new Map() // siswaId -> Map(tpId -> number[])
  const meta = { nTugas: 0, nKuis: 0, tugasIds: [], kuisIds: [] }

  function pushSkor(siswaId, tpId, nilai) {
    if (nilai == null || Number.isNaN(Number(nilai))) return
    const sid = String(siswaId)
    const tid = String(tpId)
    if (!skor.has(sid)) skor.set(sid, new Map())
    const m = skor.get(sid)
    if (!m.has(tid)) m.set(tid, [])
    m.get(tid).push(clamp100(nilai))
  }

  // ---- Tugas SLM ----
  let tugasDocs = []
  try {
    const snap = await db
      .collection('lms_tugas')
      .where('kelas', '==', kelas)
      .where('mapel', '==', mapel)
      .get()
    tugasDocs = snap.docs
  } catch (e) {
    logger.warn('agregasiSlm: query lms_tugas gagal', e)
  }

  const tugasRelevan = []
  for (const d of tugasDocs) {
    const data = d.data()
    if (data.arsip === true) continue
    if (jenisPenilaianTugas(data) !== 'slm') continue
    if (!dokTerkaitTp(data, tpTargets)) continue
    tugasRelevan.push({ id: d.id, data, tps: tpCocokDariDok(data, tpTargets) })
  }
  meta.nTugas = tugasRelevan.length
  meta.tugasIds = tugasRelevan.map((t) => t.id)

  // nilai tugas: batch 'in' max 30
  for (let i = 0; i < tugasRelevan.length; i += 30) {
    const batch = tugasRelevan.slice(i, i + 30)
    const ids = batch.map((t) => t.id)
    const byId = new Map(batch.map((t) => [t.id, t]))
    try {
      const ns = await db.collection('lms_nilai_tugas').where('tugasId', 'in', ids).get()
      for (const nd of ns.docs) {
        const n = nd.data()
        const tugasId = String(n.tugasId || '')
        const info = byId.get(tugasId)
        if (!info) continue
        if (typeof n.nilai !== 'number' || Number.isNaN(n.nilai)) continue
        const siswaId = n.siswaId
        if (!siswaId) continue
        for (const tp of info.tps) {
          pushSkor(siswaId, tp.id, n.nilai)
        }
      }
    } catch (e) {
      logger.warn('agregasiSlm: query lms_nilai_tugas gagal', e)
    }
  }

  // ---- Kuis SLM ----
  let kuisDocs = []
  try {
    const snap = await db
      .collection('lms_kuis')
      .where('kelas', '==', kelas)
      .where('mapel', '==', mapel)
      .get()
    kuisDocs = snap.docs
  } catch (e) {
    logger.warn('agregasiSlm: query lms_kuis gagal', e)
  }

  const kuisRelevan = []
  for (const d of kuisDocs) {
    const data = d.data()
    if (jenisPenilaianKuis(data) !== 'slm') continue
    // hanya kuis yang sudah punya jawaban / aktif boleh — ikutkan semua yang SLM+TP cocok
    if (!dokTerkaitTp(data, tpTargets)) continue
    kuisRelevan.push({ id: d.id, data, tps: tpCocokDariDok(data, tpTargets) })
  }
  meta.nKuis = kuisRelevan.length
  meta.kuisIds = kuisRelevan.map((k) => k.id)

  for (const k of kuisRelevan) {
    const nilaiPerTp =
      k.data.nilaiPerTp && typeof k.data.nilaiPerTp === 'object' ? k.data.nilaiPerTp : null
    try {
      const jaw = await db.collection('lms_jawaban').where('kuisId', '==', k.id).get()
      const terbaru = jawabanTerbaruPerSiswa(jaw.docs.map((jd) => ({ ...jd.data(), _id: jd.id })))
      for (const j of terbaru) {
        const siswaId = j.siswaId || j.siswaUid
        if (!siswaId) continue
        // hanya skor percobaan terakhir (bukan rata semua percobaan)
        let nilaiDasar = skor100(j.skorOtomatis, j.totalPoin)
        if (nilaiDasar == null && typeof j.skorAkhir === 'number') nilaiDasar = j.skorAkhir
        if (nilaiDasar == null && typeof j.nilai === 'number') nilaiDasar = j.nilai
        for (const tp of k.tps) {
          let nilai = nilaiDasar
          if (nilaiPerTp) {
            const byNama = nilaiPerTp[tp.nama]
            if (typeof byNama === 'number' && Number.isFinite(byNama)) nilai = byNama
          }
          if (nilai == null) continue
          pushSkor(siswaId, tp.id, nilai)
        }
      }
    } catch (e) {
      logger.warn('agregasiSlm: query lms_jawaban gagal', k.id, e)
    }
  }

  return { skor, meta }
}

/** Rata-rata sederhana komponen; null jika tidak ada skor. */
export function rataSkor(arr) {
  if (!arr || arr.length === 0) return null
  const sum = arr.reduce((a, b) => a + b, 0)
  return clamp100(sum / arr.length)
}

/**
 * Ambil nilai agregat untuk satu siswa × TP dari hasil kumpulkanSkorSlm.
 */
export function nilaiAgregat(skorMap, siswaId, tpId) {
  const m = skorMap.get(String(siswaId))
  if (!m) return null
  return rataSkor(m.get(String(tpId)))
}
