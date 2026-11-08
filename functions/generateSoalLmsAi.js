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
Anda mengikuti ketat prinsip "Buku Saku Panduan Menyusun Soal Tertulis yang Berkualitas untuk SD":

FONDASI
- Soal yang baik = tepat sasaran, BUKAN yang sulit. Ukur kompetensi TP, level kognitif selaras kata kerja TP.
- Jangan melampaui kompetensi / prasyarat yang belum diajarkan di kelas tersebut.
- HOTS boleh di kelas rendah jika stimulus & bahasa disesuaikan; L3 ≠ otomatis C4–C6 tanpa dukungan TP.
- Stem (pertanyaan) singkat, jelas, satu fokus. Stimulus boleh lebih panjang hanya jika FUNGSIONAL (diperlukan untuk menjawab), bukan dekorasi.

KOMPLEKSITAS (skala sekolah — L1/L2/L3)
- L1: mengingat / mengenali fakta atau prosedur dasar (C1–C2 ringan).
- L2: memahami / menerapkan pada situasi familiar (C2–C3).
- L3: menganalisis / menalar / memecahkan masalah dengan konteks (C3–C4+), tetap proporsional kelas.

BENTUK SOAL
- pg: satu jawaban benar absolut; 4 opsi sejajar; distractor = miskonsepsi nyata; stem = pertanyaan utuh (bukan kalimat rumpang).
- pgk (MCMA): beberapa benar; instruksi jelas; JANGAN sebutkan jumlah benar; tiap opsi independen.
- jodoh: pasangan kiri–kanan yang bermakna; sisi kanan diacak saat ujian.
- bs: pernyataan yang diuji benar/salah; hindari pernyataan ambigu ganda.
- isian: satu jawaban spesifik / beberapa varian ejaan; tidak bisa ditebak dari pilihan.
- uraian: stem terarah + batasan (jumlah poin/aspek); sertakan rubrik singkat di kunciJawaban.

BAHASA
- Bahasa Indonesia baku sederhana, sesuai kelas (kelas 1–2 sangat pendek; 5–6 boleh stimulus lebih kaya).
- Hindari jebakan linguistik, soal akal-akalan, atau informasi langka yang tidak relevan dengan TP.

KELUARAN
- HANYA JSON valid sesuai skema user. Tanpa markdown, tanpa penjelasan di luar JSON.
- Teks soal/opsi/pernyataan: plain text atau HTML sangat terbatas (<p>, <strong>, <em>, <sub>, <sup>, <ul>, <ol>, <li>).
- Jangan sertakan field di luar skema.`
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
  if (jumlah > 5) jumlah = 5
  const konteks = potong(input?.konteks, 800)
  const butuhStimulus = input?.butuhStimulus === true
  const jenjang = potong(input?.jenjang || kelas.replace(/\D/g, '').slice(0, 1), 2)

  if (!mapel) return { ok: false, pesan: 'Mapel wajib diisi.' }
  if (!kelas) return { ok: false, pesan: 'Kelas wajib diisi.' }
  if (!TIPE_OK.has(tipe)) return { ok: false, pesan: 'Tipe soal tidak didukung.' }
  if (!KOMP_OK.has(kompleksitas)) return { ok: false, pesan: 'Kompleksitas harus L1, L2, atau L3.' }

  const user = `Buat tepat ${jumlah} soal untuk bank soal LMS SD.

Konteks kurikulum:
- Mapel: ${mapel}
- Kelas/rombel: ${kelas} (perkirakan jenjang kelas ${jenjang || 'sesuai rombel'})
- Tujuan Pembelajaran${tpNomor != null ? ` (TP ${tpNomor})` : ''}: ${tpNama || '(tidak dicantumkan — gunakan kompetensi umum mapel & kelas)'}
- Tipe soal: ${tipe}
- Kompleksitas: ${kompleksitas}
- Stimulus fungsional wajib: ${butuhStimulus ? 'YA — setiap soal perlu stimulus yang benar-benar dipakai menjawab' : 'opsional; hanya jika membantu mengukur kompetensi'}
${konteks ? `- Catatan guru / fokus materi: ${konteks}` : ''}

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
      "petunjukGambar": "string — hanya jika butuhGambar true: apa yang HARUS terlihat di ilustrasi agar siswa bisa menjawab (bukan hiasan)",
      "opsi": [{"teks":"...","benar":boolean}] ,
      "pasangan": [{"kiri":"...","kanan":"..."}],
      "pernyataan": [{"teks":"...","benar":boolean}],
      "kunciIsian": ["varian1","varian2"],
      "abaikanKapital": boolean,
      "kunciJawaban": "rubrik/pedoman penskoran untuk uraian",
      "nilaiParsial": boolean,
      "acakOpsi": boolean
    }
  ]
}

Aturan field per tipe:
- pg / pgk: wajib "opsi" (4–5 butir). pg: tepat satu benar:true. pgk: 2+ benar:true, nilaiParsial boleh true.
- jodoh: wajib "pasangan" (minimal 3), nilaiParsial boleh true.
- bs: wajib "pernyataan" (minimal 3), nilaiParsial boleh true.
- isian: wajib "kunciIsian" (minimal 1), abaikanKapital biasanya true.
- uraian: wajib "kunciJawaban" berisi rubrik (skor penuh / sebagian / nol).
- Field yang tidak relevan tipe boleh dihilangkan.
- butuhGambar=true HANYA jika tanpa gambar siswa tidak bisa menjawab dengan adil (mis. menghitung benda di gambar, membaca diagram). Jangan true sekadar mempercantik.`

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
- Gambar adalah ALAT BANTU menjawab soal, BUKAN hiasan/dekorasi.
- Hanya tampilkan elemen visual yang diperlukan siswa untuk menjawab.
- Gaya: ilustrasi datar (flat) yang jelas, kontras tinggi, cocok cetak/layar, tanpa teks panjang atau watermark.
- Hindari kekerasan, konten dewasa, logo merek, wajah tokoh terkenal, atau detail yang membingungkan.
- Proporsional untuk anak SD kelas ${kelas || '1-6'}${mapel ? `, mapel ${mapel}` : ''}.

Petunjuk visual dari perancang soal:
${petunjuk || '(tidak ada — infer dari teks soal)'}

Teks soal (untuk konteks; JANGAN menulis ulang seluruh soal di gambar):
${teksSoal || '(tidak ada)'}

Hasilkan SATU gambar yang langsung dapat dipasang di soal.`

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
