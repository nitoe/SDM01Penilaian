/**
 * Analisis hasil kuis LMS dengan Gemini.
 * Hanya UID+email pemilik AI (sama generateAi / generate soal LMS).
 * Deploy: firebase deploy --only functions:analisisKuisLmsAi
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { bolehPemanggilAi, mintaModel } from './generateAi.js'

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
}

function teksPolos(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function agregat(jawabanDocs, soalIds) {
  const out = {}
  for (const id of soalIds) {
    out[id] = { benar: 0, salah: 0, kosong: 0, manual: 0, total: 0, jumlahSkor: 0 }
  }
  for (const jaw of jawabanDocs) {
    const detail = Array.isArray(jaw.detail) ? jaw.detail : []
    const byId = new Map(detail.map((d) => [d.soalId, d]))
    for (const sid of soalIds) {
      const d = byId.get(sid)
      const cell = out[sid]
      if (!cell) continue
      cell.total += 1
      if (!d) {
        cell.kosong += 1
        continue
      }
      cell.jumlahSkor += Number(d.skor) || 0
      if (d.butuhManual) cell.manual += 1
      else if (d.benar) cell.benar += 1
      else cell.salah += 1
    }
  }
  for (const sid of Object.keys(out)) {
    const c = out[sid]
    c.rataSkor = c.total > 0 ? Math.round((c.jumlahSkor / c.total) * 100) / 100 : 0
  }
  return out
}

function ringkasSkor(jawabanDocs) {
  const n = jawabanDocs.length
  if (!n) return { n: 0, rata100: 0, min100: 0, max100: 0 }
  let sum = 0
  let min = 100
  let max = 0
  for (const j of jawabanDocs) {
    const total = Number(j.totalPoin) || 0
    const skor = Number(j.skorOtomatis) || 0
    const p = total > 0 ? (skor / total) * 100 : 0
    sum += p
    if (p < min) min = p
    if (p > max) max = p
  }
  return {
    n,
    rata100: Math.round((sum / n) * 10) / 10,
    min100: Math.round(min * 10) / 10,
    max100: Math.round(max * 10) / 10,
  }
}

/** Satu percobaan terbaru per siswaId. */
function perSiswaTerbaru(docs) {
  const map = new Map()
  for (const j of docs) {
    const key = j.siswaId || j.siswaUid || j._id
    const prev = map.get(key)
    const t = j.createdAt?.toMillis?.() || j.createdAt?._seconds * 1000 || 0
    const tp = prev?.createdAt?.toMillis?.() || prev?.createdAt?._seconds * 1000 || 0
    if (!prev || t > tp || (j.percobaan || 0) > (prev.percobaan || 0)) {
      map.set(key, j)
    }
  }
  return [...map.values()]
}

export const analisisKuisLmsAi = onCall(
  {
    region: 'asia-southeast2',
    maxInstances: 5,
    timeoutSeconds: 120,
    secrets: ['GEMINI_API_KEY'],
  },
  async (request) => {
    if (!bolehPemanggilAi(request.auth)) {
      throw new HttpsError(
        'permission-denied',
        'Analisis AI kuis hanya tersedia untuk akun yang diizinkan.',
      )
    }

    const kuisId = request.data?.kuisId
    if (typeof kuisId !== 'string' || !kuisId || kuisId.length > 80) {
      throw new HttpsError('invalid-argument', 'kuisId wajib.')
    }

    const db = getFirestore()
    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) {
      throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    }
    const kuis = kuisSnap.data()
    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []
    const soalIds = soalList.map((s) => s.id).filter(Boolean)

    const jawSnap = await db.collection('lms_jawaban').where('kuisId', '==', kuisId).get()
    const semua = jawSnap.docs.map((d) => ({ _id: d.id, ...d.data() }))
    const terbaru = perSiswaTerbaru(semua)
    const stats = agregat(terbaru, soalIds)
    const ringkas = ringkasSkor(terbaru)

    const barisSoal = soalList.slice(0, 40).map((s, i) => {
      const st = stats[s.id] || {}
      return {
        no: i + 1,
        tipe: s.tipe,
        poin: s.poin,
        kompleksitas: s.kompleksitas || 'L1',
        cuplikan: potong(teksPolos(s.teks), 160),
        benar: st.benar || 0,
        salah: st.salah || 0,
        kosong: st.kosong || 0,
        manual: st.manual || 0,
        n: st.total || 0,
        rataPoin: st.rataSkor || 0,
      }
    })

    // Contoh jawaban isian yang salah (maks 8 soal × 3 jawaban)
    const contohSalah = []
    for (const s of soalList) {
      if (s.tipe !== 'isian' && s.tipe !== 'uraian') continue
      if (contohSalah.length >= 8) break
      const contoh = []
      for (const j of terbaru) {
        if (contoh.length >= 3) break
        const d = (j.detail || []).find((x) => x.soalId === s.id)
        if (!d || d.benar || d.butuhManual) continue
        const ans = j.jawaban?.[s.id]
        if (typeof ans === 'string' && ans.trim()) {
          contoh.push(potong(ans, 80))
        }
      }
      if (contoh.length) {
        contohSalah.push({
          no: soalList.indexOf(s) + 1,
          tipe: s.tipe,
          cuplikan: potong(teksPolos(s.teks), 100),
          kunci: s.tipe === 'isian' ? (s.kunci || []).slice(0, 3) : undefined,
          jawabanSalah: contoh,
        })
      }
    }

    const sistem = `Anda konsultan asesmen sekolah dasar di Indonesia (Kurikulum Merdeka).
Tugas: menganalisis hasil kuis berdasarkan data statistik yang diberikan.
Bahasa: Indonesia baku, jelas, praktis untuk guru SD.
Jangan mengarang angka yang tidak ada di data.
Fokus: interpretasi hasil, kualitas butir soal, miskonsepsi siswa, saran tindak lanjut pembelajaran dan perbaikan soal.
Format keluaran JSON dengan kunci:
{
  "ringkas": "2-4 kalimat kesimpulan utama",
  "kekuatan": ["..."],
  "kelemahan": ["..."],
  "butirBermasalah": [{"no": 1, "alasan": "...", "saran": "..."}],
  "miskonsepsi": ["..."],
  "tindakLanjutGuru": ["..."],
  "perbaikanSoal": ["..."]
}`

    const user = `Data kuis:
Judul: ${potong(kuis.judul, 200)}
Mapel: ${potong(kuis.mapel, 80)}
Kelas: ${potong(kuis.kelas, 10)}
Jenis penilaian: ${potong(kuis.jenisPenilaian || 'latihan', 40)}
Jumlah soal: ${soalList.length}
Total poin kuis: ${kuis.totalPoin ?? '—'}

Ringkasan skor (percobaan terbaru per siswa, skala 100):
Jumlah siswa: ${ringkas.n}
Rata-rata: ${ringkas.rata100}
Terendah: ${ringkas.min100}
Tertinggi: ${ringkas.max100}
Total kiriman (semua percobaan): ${semua.length}

Statistik per soal:
${JSON.stringify(barisSoal)}

Contoh jawaban kurang tepat (isian/uraian):
${JSON.stringify(contohSalah)}

Buat analisis JSON sesuai format.`

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY belum diatur.')
    }

    let json
    try {
      json = await mintaModel('gemini', apiKey, sistem, user)
    } catch (err) {
      logger.error('analisisKuisLmsAi model', { pesan: err?.message })
      throw new HttpsError('internal', err?.message || 'Gagal memanggil model AI.')
    }

    const hasil = {
      ringkas: potong(json?.ringkas, 1200),
      kekuatan: Array.isArray(json?.kekuatan) ? json.kekuatan.map((x) => potong(x, 300)).slice(0, 8) : [],
      kelemahan: Array.isArray(json?.kelemahan) ? json.kelemahan.map((x) => potong(x, 300)).slice(0, 8) : [],
      butirBermasalah: Array.isArray(json?.butirBermasalah)
        ? json.butirBermasalah.slice(0, 12).map((b) => ({
            no: Number(b?.no) || 0,
            alasan: potong(b?.alasan, 400),
            saran: potong(b?.saran, 400),
          }))
        : [],
      miskonsepsi: Array.isArray(json?.miskonsepsi)
        ? json.miskonsepsi.map((x) => potong(x, 300)).slice(0, 8)
        : [],
      tindakLanjutGuru: Array.isArray(json?.tindakLanjutGuru)
        ? json.tindakLanjutGuru.map((x) => potong(x, 300)).slice(0, 8)
        : [],
      perbaikanSoal: Array.isArray(json?.perbaikanSoal)
        ? json.perbaikanSoal.map((x) => potong(x, 300)).slice(0, 8)
        : [],
      meta: {
        nSiswa: ringkas.n,
        rata100: ringkas.rata100,
        nSoal: soalList.length,
      },
    }

    logger.info('analisisKuisLmsAi ok', { uid: request.auth.uid, kuisId, n: ringkas.n })
    return hasil
  },
)
