/**
 * Analisis kuis LMS dengan Gemini.
 * mode "kuis"  → laporan kualitatif kelas
 * mode "siswa" → nilai isian/uraian (skor boleh pecahan) + catatan kualitatif per siswa
 *
 * Hanya UID+email AI (bolehPemanggilAi).
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

function perSiswaTerbaru(docs) {
  const map = new Map()
  for (const j of docs) {
    const key = j.siswaId || j.siswaUid || j._id
    const prev = map.get(key)
    const t = j.createdAt?.toMillis?.() || (j.createdAt?._seconds || 0) * 1000 || 0
    const tp = prev?.createdAt?.toMillis?.() || (prev?.createdAt?._seconds || 0) * 1000 || 0
    if (!prev || t > tp || (j.percobaan || 0) > (prev.percobaan || 0)) map.set(key, j)
  }
  return [...map.values()]
}

function normalisasiSkor(saran, maks) {
  let n = Number(saran)
  if (Number.isNaN(n) || n < 0) n = 0
  if (n > maks) n = maks
  // setengah poin: 0, 0.5, 1, 1.5, …
  n = Math.round(n * 2) / 2
  return n
}

async function analisisKelas(db, kuisId, kuis, soalList) {
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
      if (typeof ans === 'string' && ans.trim()) contoh.push(potong(ans, 80))
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

  const sistem = `Anda konsultan asesmen sekolah dasar (Kurikulum Merdeka).
Bahasa Indonesia baku, praktis untuk guru SD.
Jangan mengarang angka di luar data.
Format JSON:
{
  "ringkas": "2-4 kalimat",
  "kekuatan": ["..."],
  "kelemahan": ["..."],
  "butirBermasalah": [{"no": 1, "alasan": "...", "saran": "..."}],
  "miskonsepsi": ["..."],
  "tindakLanjutGuru": ["..."],
  "perbaikanSoal": ["..."]
}`

  const user = `Kuis: ${potong(kuis.judul, 200)} | ${potong(kuis.mapel, 80)} | kelas ${potong(kuis.kelas, 10)} | ${potong(kuis.jenisPenilaian || 'latihan', 40)}
Siswa (percobaan terbaru): ${ringkas.n}, rata-rata ${ringkas.rata100}/100, min ${ringkas.min100}, max ${ringkas.max100}, total kiriman ${semua.length}
Soal: ${JSON.stringify(barisSoal)}
Contoh salah: ${JSON.stringify(contohSalah)}`

  return { sistem, user, meta: { nSiswa: ringkas.n, rata100: ringkas.rata100, nSoal: soalList.length } }
}

async function analisisSiswa(db, kuisId, jawabanId, kuis, soalList) {
  const jawSnap = await db.doc(`lms_jawaban/${jawabanId}`).get()
  if (!jawSnap.exists) throw new HttpsError('not-found', 'Jawaban siswa tidak ditemukan.')
  const jaw = jawSnap.data()
  if (jaw.kuisId !== kuisId) throw new HttpsError('invalid-argument', 'Jawaban bukan milik kuis ini.')

  const butir = []
  for (let i = 0; i < soalList.length; i++) {
    const s = soalList[i]
    if (s.tipe !== 'isian' && s.tipe !== 'uraian') continue
    const ans = jaw.jawaban?.[s.id]
    const teksJawab = typeof ans === 'string' ? ans : ans == null ? '' : JSON.stringify(ans)
    butir.push({
      soalId: s.id,
      no: i + 1,
      tipe: s.tipe,
      poinMaks: Number(s.poin) || 1,
      pertanyaan: potong(teksPolos(s.teks), 400),
      kunci:
        s.tipe === 'isian'
          ? Array.isArray(s.kunci)
            ? s.kunci.map((k) => potong(k, 120)).slice(0, 8)
            : []
          : potong(teksPolos(s.kunciJawaban || ''), 600),
      jawabanSiswa: potong(teksJawab, 1500),
      skorSaatIni: (() => {
        const d = (jaw.detail || []).find((x) => x.soalId === s.id)
        return d ? Number(d.skor) || 0 : 0
      })(),
    })
  }

  const sistem = `Anda guru SD yang menilai isian singkat dan uraian.
Tugas: bandingkan jawaban siswa dengan kunci/pedoman, berikan skor.
Aturan skor:
- Skor boleh pecahan kelipatan 0,5 (contoh 0, 0,5, 1, 1,5, 2, 2,5, …).
- Tidak boleh melebihi poinMaks soal.
- Jawaban kosong / tidak relevan → 0.
- Isian: cocok penuh = penuh; sinonim/ejaan dekat bisa skor sebagian; salah konsep = 0 atau rendah.
- Uraian: nilai proporsional kelengkapan & ketepatan terhadap pedoman.
- sertakan alasan singkat (1-2 kalimat) per butir.
Bahasa Indonesia.
Format JSON:
{
  "penilaian": [
    { "soalId": "...", "skor": 1.5, "alasan": "..." }
  ],
  "ringkasSiswa": "2-3 kalimat kekuatan dan yang perlu diperbaiki",
  "catatanOrangTua": "1-2 kalimat ramah untuk orang tua",
  "saranBelajar": ["..."]
}`

  const user = `Kuis: ${potong(kuis.judul, 200)} | ${potong(kuis.mapel, 80)} | kelas ${potong(kuis.kelas, 10)}
Siswa: ${potong(jaw.siswaNama || jaw.siswaId || '', 80)}
Percobaan: ${jaw.percobaan || 1}
Skor otomatis saat ini: ${jaw.skorOtomatis}/${jaw.totalPoin}

Butir yang dinilai (hanya isian & uraian):
${JSON.stringify(butir)}

Isi penilaian untuk SETIAP butir di atas (soalId harus sama).`

  return {
    sistem,
    user,
    meta: {
      jawabanId,
      siswaNama: jaw.siswaNama || '',
      percobaan: jaw.percobaan || 1,
      skorOtomatis: Number(jaw.skorOtomatis) || 0,
      totalPoin: Number(jaw.totalPoin) || 0,
    },
    butirRef: butir,
  }
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
    const mode = request.data?.mode === 'siswa' ? 'siswa' : 'kuis'
    const jawabanId = request.data?.jawabanId

    if (typeof kuisId !== 'string' || !kuisId || kuisId.length > 80) {
      throw new HttpsError('invalid-argument', 'kuisId wajib.')
    }
    if (mode === 'siswa' && (typeof jawabanId !== 'string' || !jawabanId)) {
      throw new HttpsError('invalid-argument', 'jawabanId wajib untuk mode siswa.')
    }

    const db = getFirestore()
    const kuisSnap = await db.doc(`lms_kuis/${kuisId}`).get()
    if (!kuisSnap.exists) throw new HttpsError('not-found', 'Kuis tidak ditemukan.')
    const kuis = kuisSnap.data()
    const soalList = Array.isArray(kuis.soal) ? kuis.soal : []

    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY belum diatur.')

    if (mode === 'kuis') {
      const { sistem, user, meta } = await analisisKelas(db, kuisId, kuis, soalList)
      let json
      try {
        json = await mintaModel('gemini', apiKey, sistem, user)
      } catch (err) {
        logger.error('analisisKuisLmsAi kelas', { pesan: err?.message })
        throw new HttpsError('internal', err?.message || 'Gagal memanggil model AI.')
      }
      const hasil = {
        mode: 'kuis',
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
          ...meta,
          judul: potong(kuis.judul, 200),
          mapel: potong(kuis.mapel, 80),
          kelas: potong(kuis.kelas, 10),
        },
      }
      logger.info('analisisKuisLmsAi kuis', { uid: request.auth.uid, kuisId })
      return hasil
    }

    // mode siswa
    const { sistem, user, meta, butirRef } = await analisisSiswa(
      db,
      kuisId,
      jawabanId,
      kuis,
      soalList,
    )
    let json
    try {
      json = await mintaModel('gemini', apiKey, sistem, user)
    } catch (err) {
      logger.error('analisisKuisLmsAi siswa', { pesan: err?.message })
      throw new HttpsError('internal', err?.message || 'Gagal memanggil model AI.')
    }

    const byId = new Map(butirRef.map((b) => [b.soalId, b]))
    const penilaian = []
    const mentah = Array.isArray(json?.penilaian) ? json.penilaian : []
    for (const p of mentah) {
      const soalId = String(p?.soalId || '')
      const ref = byId.get(soalId)
      if (!ref) continue
      const skor = normalisasiSkor(p?.skor, ref.poinMaks)
      penilaian.push({
        soalId,
        no: ref.no,
        tipe: ref.tipe,
        skor,
        poinMaks: ref.poinMaks,
        alasan: potong(p?.alasan, 400),
        pertanyaan: ref.pertanyaan,
        jawabanSiswa: ref.jawabanSiswa,
      })
    }
    // pastikan semua butir ada (jika model melewatkan)
    for (const ref of butirRef) {
      if (penilaian.some((x) => x.soalId === ref.soalId)) continue
      penilaian.push({
        soalId: ref.soalId,
        no: ref.no,
        tipe: ref.tipe,
        skor: 0,
        poinMaks: ref.poinMaks,
        alasan: 'Model tidak mengembalikan skor; default 0 — tinjau manual.',
        pertanyaan: ref.pertanyaan,
        jawabanSiswa: ref.jawabanSiswa,
      })
    }
    penilaian.sort((a, b) => a.no - b.no)

    const hasil = {
      mode: 'siswa',
      penilaian,
      ringkasSiswa: potong(json?.ringkasSiswa, 800),
      catatanOrangTua: potong(json?.catatanOrangTua, 500),
      saranBelajar: Array.isArray(json?.saranBelajar)
        ? json.saranBelajar.map((x) => potong(x, 300)).slice(0, 6)
        : [],
      meta: {
        ...meta,
        judul: potong(kuis.judul, 200),
        mapel: potong(kuis.mapel, 80),
        kelas: potong(kuis.kelas, 10),
      },
    }
    logger.info('analisisKuisLmsAi siswa', {
      uid: request.auth.uid,
      kuisId,
      jawabanId,
      n: penilaian.length,
    })
    return hasil
  },
)
