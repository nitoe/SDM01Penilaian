/**
 * Generate soal bank LMS + ilustrasi fungsional via Gemini.
 * Kunci API hanya di secrets Cloud Functions (GEMINI_API_KEY) — jangan pernah ke klien.
 * Prinsip perumusan mengacu Buku Saku Panduan Menyusun Soal Tertulis SD (Arif Azwar Anas).
 */
import { bolehPemanggilAi, MODEL_GEMINI } from './generateAi.js'

export { bolehPemanggilAi }

const MODEL_ILUSTRASI = 'gemini-3.1-flash-lite-image'

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
}

function thinkingGemini(nama) {
  if (/^gemini-2\.5-/.test(nama)) return { thinkingBudget: 0 }
  if (/^gemini-3/.test(nama)) return { thinkingLevel: 'low' }
  return undefined
}

function configGeminiJson(nama, maxOut = 8192) {
  const cfg = { temperature: 0.45, responseMimeType: 'application/json', maxOutputTokens: maxOut }
  const thinking = thinkingGemini(nama)
  if (thinking) cfg.thinkingConfig = thinking
  return cfg
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

async function panggilGeminiJson(apiKey, sistem, user) {
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diatur di Cloud Functions.')
  const gagal = []
  let terakhir = 'Gemini tidak menjawab.'
  for (const nama of MODEL_GEMINI) {
    for (let percobaan = 0; percobaan < 2; percobaan++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistem }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: configGeminiJson(nama),
          }),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        terakhir = `Gemini (${nama}) ${res.status}: ${json?.error?.message || 'gagal'}`
        if (res.status === 404) {
          gagal.push(`${nama} 404`)
          break
        }
        if ([429, 500, 503].includes(res.status)) {
          if (percobaan === 0) {
            await tunggu(1500)
            continue
          }
          gagal.push(`${nama} ${res.status}`)
          break
        }
        throw new Error(terakhir)
      }
      const kandidat = json?.candidates?.[0]
      const teks = kandidat?.content?.parts?.map((p) => p.text || '').join('') || ''
      if (!teks) {
        terakhir = `Gemini (${nama}) jawaban kosong` + (kandidat?.finishReason ? ` (${kandidat.finishReason})` : '')
        gagal.push(terakhir)
        break
      }
      const bersih = teks.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      try {
        return JSON.parse(bersih)
      } catch {
        terakhir = `Gemini (${nama}) JSON tidak valid`
        gagal.push(terakhir)
        break
      }
    }
  }
  throw new Error(gagal.length ? gagal.join(' · ') : terakhir)
}

async function panggilGeminiGambar(apiKey, prompt) {
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diatur di Cloud Functions.')
  const nama = MODEL_ILUSTRASI
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '4:3', imageSize: '1K' },
        },
      }),
    },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Gemini ilustrasi (${nama}) ${res.status}: ${json?.error?.message || 'gagal'}`)
  }
  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data
    if (inline?.data) {
      const mime = inline.mimeType || inline.mime_type || 'image/png'
      return `data:${mime};base64,${inline.data}`
    }
  }
  throw new Error('Gemini tidak mengembalikan gambar ilustrasi.')
}

const TIPE_OK = new Set(['pg', 'pgk', 'jodoh', 'bs', 'isian', 'uraian'])
const KOMP_OK = new Set(['L1', 'L2', 'L3'])

/** Prompt sistem: prinsip Buku Saku (validitas, CP/TP, stimulus fungsional, bentuk soal, HOTS autentik). */
function sistemSoal() {
  return `Anda perancang soal tertulis untuk Sekolah Dasar di Indonesia.
Anda mengikuti ketat prinsip "Buku Saku Panduan Menyusun Soal Tertulis yang Berkualitas untuk SD" (Arif Azwar Anas).

FONDASI
- Soal yang baik = tepat sasaran, BUKAN yang sulit. Ukur kompetensi TP; level kognitif selaras kata kerja TP.
- Jangan melampaui kompetensi / prasyarat yang belum diajarkan di kelas tersebut.
- Stem (pertanyaan) singkat, jelas, satu fokus. Stimulus boleh lebih panjang HANYA jika FUNGSIONAL (diperlukan untuk menjawab), bukan dekorasi.

KOMPLEKSITAS (L1/L2/L3)
- L1: mengingat / mengenali fakta atau prosedur dasar.
- L2: memahami / menerapkan pada situasi familiar.
- L3: menganalisis / menalar / memecahkan masalah dengan konteks — tetap proporsional kelas.

BENTUK SOAL
- pg: satu jawaban benar absolut; 4 opsi; stem = pertanyaan utuh (bukan kalimat rumpang).
- pgk (MCMA): beberapa benar; instruksi jelas; JANGAN sebutkan jumlah benar; tiap opsi independen.
- jodoh / bs / isian / uraian: sesuai konvensi bank soal SD; uraian wajib rubrik di kunciJawaban.

PENGECOH (DISTRAKTOR) — WAJIB DIPATUHI untuk pg dan pgk
- Setiap opsi salah harus mewakili miskonsepsi atau kesalahan prosedur yang REAL, bukan pengisi acak.
- Daya pembeda: siswa yang menguasai kompetensi memilih kunci; yang belum menguasai cenderung memilih pengecoh yang masuk akal.
- PANJANG & BENTUK OPSI HARUS SEJAJAR:
  • Jangan membuat opsi benar secara sistematis lebih panjang, lebih rinci, atau lebih "baku" daripada pengecoh.
  • Jangan biarkan pola "narasi terpanjang = jawaban benar" — ini jebakan yang diajarkan Buku Saku untuk dihindari.
  • Samakan kira-kira jumlah kata / struktur frasa antar opsi (semua singkat atau semua setara).
- Hindari petunjuk permukaan: "semua di atas", "tidak ada yang benar", opsi yang saling tumpang tindih, atau kelucuan.
- Untuk pgk: setiap opsi dievaluasi independen; jangan mengandalkan panjang teks sebagai sinyal kebenaran.

BAHASA
- Bahasa Indonesia baku sederhana, sesuai kelas.
- Hindari jebakan linguistik dan informasi langka yang tidak relevan dengan TP.

KELUARAN
- HANYA JSON valid sesuai skema. Tanpa markdown.
- HTML terbatas saja: <p>, <strong>, <em>, <sub>, <sup>, <ul>, <ol>, <li>.
- Satu respons = tepat satu soal (array "soal" berisi 1 elemen) kecuali diminta lain.`
}

export function susunPromptSoalLms(input) {
  const mapel = potong(input?.mapel, 80)
  const kelas = potong(input?.kelas, 10)
  const tpNama = potong(input?.tpNama, 400)
  const tpNomor = typeof input?.tpNomor === 'number' ? input.tpNomor : undefined
  const tipe = String(input?.tipe || 'pg')
  const kompleksitas = String(input?.kompleksitas || 'L1')
  let jumlah = Number(input?.jumlah) || 1
  if (!Number.isFinite(jumlah) || jumlah < 1) jumlah = 1
  // Alur LMS: tinjau per nomor — selalu satu soal per permintaan.
  jumlah = 1
  const konteks = potong(input?.konteks, 800)
  const butuhStimulus = input?.butuhStimulus === true
  const jenjang = potong(input?.jenjang || kelas.replace(/\D/g, '').slice(0, 1), 2)

  if (!mapel) return { ok: false, pesan: 'Mapel wajib diisi.' }
  if (!kelas) return { ok: false, pesan: 'Kelas wajib diisi.' }
  if (!TIPE_OK.has(tipe)) return { ok: false, pesan: 'Tipe soal tidak didukung.' }
  if (!KOMP_OK.has(kompleksitas)) return { ok: false, pesan: 'Kompleksitas harus L1, L2, atau L3.' }

  const user = `Buat tepat ${jumlah} soal untuk bank soal LMS SD${jumlah === 1 ? ' (satu soal saja — guru akan meninjau per nomor)' : ''}.

Konteks kurikulum:
- Mapel: ${mapel}
- Kelas/rombel: ${kelas} (perkirakan jenjang kelas ${jenjang || 'sesuai rombel'})
- Tujuan Pembelajaran${tpNomor != null ? ` (TP ${tpNomor})` : ''}: ${tpNama || '(tidak dicantumkan — gunakan kompetensi umum mapel & kelas)'}
- Tipe soal: ${tipe}
- Kompleksitas: ${kompleksitas}
- Stimulus fungsional wajib: ${butuhStimulus ? 'YA — soal perlu stimulus yang benar-benar dipakai menjawab' : 'opsional; hanya jika membantu mengukur kompetensi'}
${konteks ? `- Catatan guru / fokus materi: ${konteks}` : ''}

OPSI PG/PGK — CEK SEBELUM KIRIM:
1) Tepat satu kunci (pg) atau ≥2 kunci (pgk) dengan benar:true.
2) Pengecoh = miskonsepsi nyata, bukan teks acak.
3) Panjang opsi setara — DILARANG membuat jawaban benar paling panjang/rinci.
4) Tidak ada petunjuk gramatikal yang mengarahkan ke kunci.

Skema JSON wajib:
{
  "soal": [
    {
      "tipe": "${tipe}",
      "teks": "string HTML terbatas — stem + stimulus bila ada",
      "kompleksitas": "${kompleksitas}",
      "poin": number,
      "waktuMenit": number,
      "pembahasan": "string opsional HTML terbatas",
      "butuhGambar": boolean,
      "petunjukGambar": "string — hanya jika butuhGambar: data/elemen visual yang HARUS ada (tabel/grafik/diagram), bukan hiasan",
      "opsi": [{"teks":"...","benar":boolean}],
      "pasangan": [{"kiri":"...","kanan":"..."}],
      "pernyataan": [{"teks":"...","benar":boolean}],
      "kunciIsian": ["varian1","varian2"],
      "abaikanKapital": boolean,
      "kunciJawaban": "rubrik penskoran untuk uraian",
      "nilaiParsial": boolean,
      "acakOpsi": boolean
    }
  ]
}

Aturan field per tipe:
- pg / pgk: wajib "opsi" (4 butir ideal). pg: tepat satu benar:true. pgk: 2+ benar:true.
- jodoh: "pasangan" minimal 3. bs: "pernyataan" minimal 3. isian: "kunciIsian" minimal 1.
- uraian: "kunciJawaban" berisi rubrik (penuh / sebagian / nol).
- butuhGambar=true HANYA jika siswa butuh membaca data visual (tabel, grafik, diagram, gambar hitung). Bukan dekorasi.`

  return { ok: true, sistem: sistemSoal(), user, meta: { mapel, kelas, tipe, kompleksitas, jumlah } }
}

function idSementara() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`
}

/** Normalisasi keluaran AI → bentuk mendekati Soal LMS (id sementara, dilengkapi di klien). */
export function normalisasiSoalLms(data, meta) {
  const list = Array.isArray(data?.soal) ? data.soal : Array.isArray(data) ? data : []
  const tipeWajib = meta?.tipe
  const out = []
  for (const raw of list.slice(0, 5)) {
    if (!raw || typeof raw !== 'object') continue
    const tipe = TIPE_OK.has(raw.tipe) ? raw.tipe : tipeWajib
    if (!TIPE_OK.has(tipe)) continue
    const kompleksitas = KOMP_OK.has(raw.kompleksitas) ? raw.kompleksitas : meta?.kompleksitas || 'L1'
    const teks = potong(raw.teks, 8000)
    if (!teks) continue
    const poin = Math.min(100, Math.max(0.5, Number(raw.poin) || (tipe === 'uraian' ? 5 : 1)))
    const waktuMenit = Math.min(60, Math.max(0, Number(raw.waktuMenit) || (tipe === 'uraian' ? 5 : 1)))
    const pembahasan = potong(raw.pembahasan, 4000) || undefined
    const butuhGambar = raw.butuhGambar === true
    const petunjukGambar = butuhGambar ? potong(raw.petunjukGambar, 500) : undefined

    const dasar = {
      tipe,
      teks,
      kompleksitas,
      poin,
      waktuMenit,
      pembahasan,
      butuhGambar,
      petunjukGambar,
    }

    if (tipe === 'pg' || tipe === 'pgk') {
      let opsiIn = Array.isArray(raw.opsi) ? raw.opsi : []
      if (opsiIn.length < 2) continue
      opsiIn = opsiIn.slice(0, 8)
      const opsi = opsiIn.map((o) => ({
        id: idSementara(),
        teks: potong(o?.teks ?? o, 300),
      }))
      if (tipe === 'pg') {
        let idx = opsiIn.findIndex((o) => o && o.benar === true)
        if (idx < 0) idx = 0
        out.push({
          ...dasar,
          tipe: 'pg',
          opsi,
          kunci: opsi[idx].id,
          acakOpsi: raw.acakOpsi !== false,
          opsiGambar: false,
        })
      } else {
        const kunci = []
        opsiIn.forEach((o, i) => {
          if (o && o.benar === true) kunci.push(opsi[i].id)
        })
        if (kunci.length < 1) kunci.push(opsi[0].id)
        out.push({
          ...dasar,
          tipe: 'pgk',
          opsi,
          kunci,
          acakOpsi: raw.acakOpsi !== false,
          opsiGambar: false,
          nilaiParsial: raw.nilaiParsial === true,
        })
      }
    } else if (tipe === 'jodoh') {
      let pas = Array.isArray(raw.pasangan) ? raw.pasangan : []
      if (pas.length < 2) continue
      out.push({
        ...dasar,
        tipe: 'jodoh',
        pasangan: pas.slice(0, 8).map((p) => ({
          id: idSementara(),
          kiri: potong(p?.kiri, 200),
          kanan: potong(p?.kanan, 200),
        })),
        nilaiParsial: raw.nilaiParsial !== false,
      })
    } else if (tipe === 'bs') {
      let per = Array.isArray(raw.pernyataan) ? raw.pernyataan : []
      if (per.length < 1) continue
      out.push({
        ...dasar,
        tipe: 'bs',
        pernyataan: per.slice(0, 8).map((p) => ({
          id: idSementara(),
          teks: potong(p?.teks, 400),
          benar: p?.benar !== false,
        })),
        nilaiParsial: raw.nilaiParsial !== false,
      })
    } else if (tipe === 'isian') {
      const kunciIsian = Array.isArray(raw.kunciIsian)
        ? raw.kunciIsian.map((k) => potong(k, 200)).filter(Boolean)
        : []
      if (!kunciIsian.length) continue
      out.push({
        ...dasar,
        tipe: 'isian',
        kunci: kunciIsian,
        abaikanKapital: raw.abaikanKapital !== false,
      })
    } else if (tipe === 'uraian') {
      out.push({
        ...dasar,
        tipe: 'uraian',
        kunciJawaban: potong(raw.kunciJawaban, 4000) || undefined,
      })
    }
  }
  return out
}

export async function generateSoalLmsDenganAi(apiKey, input) {
  const prompt = susunPromptSoalLms(input)
  if (!prompt.ok) {
    const err = new Error(prompt.pesan)
    err.code = 'invalid-argument'
    throw err
  }
  const data = await panggilGeminiJson(apiKey, prompt.sistem, prompt.user)
  const soal = normalisasiSoalLms(data, prompt.meta)
  if (!soal.length) throw new Error('AI tidak menghasilkan soal yang valid. Coba lagi atau sederhanakan permintaan.')
  return { soal }
}

export function susunPromptIlustrasiSoal(input) {
  const teksSoal = potong(input?.teksSoal, 2000)
  const petunjuk = potong(input?.petunjukGambar, 500)
  const kelas = potong(input?.kelas, 10)
  const mapel = potong(input?.mapel, 80)
  if (teksSoal.length < 8 && petunjuk.length < 8) {
    return { ok: false, pesan: 'Sertakan teks soal atau petunjuk gambar.' }
  }

  const prompt = `Buat ilustrasi edukatif untuk soal sekolah dasar (Indonesia).

Syarat WAJIB:
- Gambar = ALAT BANTU menjawab, BUKAN hiasan.
- Jika diminta tabel: gambar tabel dengan garis jelas, header, dan ANGKA/LABEL persis seperti petunjuk (dapat dibaca siswa).
- Jika diminta grafik/chart/diagram batang/garis/lingkaran: sumbu berlabel, nilai terbaca, legenda sederhana bila perlu.
- Hanya elemen yang dibutuhkan untuk menjawab; hindari dekorasi, watermark, logo, tokoh terkenal.
- Gaya flat, kontras tinggi, cocok layar/cetak SD.
- Kelas ${kelas || '1-6'}${mapel ? `, mapel ${mapel}` : ''}.

Petunjuk visual (utama — patuhi angka & struktur ini):
${petunjuk || '(tidak ada petunjuk terpisah — infer dari teks soal; utamakan data yang disebut di soal)'}

Teks soal (konteks; jangan menuliskan seluruh soal sebagai paragraf di gambar):
${teksSoal || '(tidak ada)'}

Hasilkan SATU gambar siap pakai di soal.`

  return { ok: true, prompt }
}

export async function generateIlustrasiSoalDenganAi(apiKey, input) {
  const p = susunPromptIlustrasiSoal(input)
  if (!p.ok) {
    const err = new Error(p.pesan)
    err.code = 'invalid-argument'
    throw err
  }
  const dataUrl = await panggilGeminiGambar(apiKey, p.prompt)
  return { dataUrl }
}
