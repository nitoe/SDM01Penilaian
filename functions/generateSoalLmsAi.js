/**
 * generateSoalLmsAi.js — VERSI LENGKAP
 *
 * Export (dipakai index.js):
 *   - generateSoalLmsDenganAi
 *   - generateIlustrasiSoalDenganAi
 *
 * Aturan:
 * - TANPA package @google/generative-ai (fetch REST saja).
 * - Cabang TKA (mapel diawali "TKA ") terpisah untuk ilustrasi (ANTIREGRESI §87).
 * - Non-TKA ilustrasi tetap gaya diagram/fungsional.
 * - Batas petunjukGambar 3000 (ANTIREGRESI §67).
 * - Model gambar: fallback daftar valid (bukan model preview yang sudah dihapus).
 */

import { logger } from 'firebase-functions'

const BATAS_PETUNJUK = 3000
const MODEL_TEKS = 'gemini-2.0-flash'

/** Model gambar valid (Nov 2026). Urutan = prioritas. */
const MODEL_GAMBAR_CANDIDATES = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-nano-banana-2.1',
]

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
}

function adalahMapelTka(mapel) {
  return String(mapel || '').trim().startsWith('TKA ')
}

function idSementara() {
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Gemini REST helpers
// ---------------------------------------------------------------------------

async function mintaGeminiJson(apiKey, model, systemText, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemText}\n\n${userText}` }] }],
    generationConfig: {
      temperature: 0.85,
      responseMimeType: 'application/json',
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error(`Gemini merespons non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}`)
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error?.status || `HTTP ${res.status}`
    throw new Error(`Gemini gagal: ${msg}`)
  }
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  if (!text) throw new Error('Gemini tidak mengembalikan teks.')
  try {
    return JSON.parse(text)
  } catch {
    // Kadang dibungkus markdown code fence
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (m) return JSON.parse(m[0])
    throw new Error(`Gemini JSON tidak valid: ${text.slice(0, 200)}`)
  }
}

async function mintaGambarGemini(apiKey, promptText) {
  let lastError = null
  for (const model of MODEL_GAMBAR_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    const body = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await res.text()
      let json
      try {
        json = JSON.parse(raw)
      } catch {
        lastError = new Error(`Gemini non-JSON (HTTP ${res.status}, ${model}): ${raw.slice(0, 160)}`)
        continue
      }
      if (!res.ok) {
        const msg = json?.error?.message || json?.error?.status || `HTTP ${res.status}`
        lastError = new Error(`Gemini gambar gagal [${model}]: ${msg}`)
        if (/not found|not supported|NOT_FOUND/i.test(String(msg))) continue
        throw lastError
      }
      const parts = json?.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png'
          logger.info('mintaGambarGemini ok', { model })
          return `data:${mime};base64,${part.inlineData.data}`
        }
      }
      const teks = parts.map((p) => p.text || '').join(' ').trim()
      lastError = new Error(
        teks
          ? `Gemini tidak mengembalikan gambar [${model}]: ${teks.slice(0, 200)}`
          : `Gemini tidak mengembalikan gambar [${model}]`,
      )
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (!/not found|not supported|NOT_FOUND/i.test(lastError.message)) throw lastError
    }
  }
  throw lastError || new Error('Semua model gambar Gemini gagal.')
}

// ---------------------------------------------------------------------------
// Prompt ilustrasi (TKA vs non-TKA)
// ---------------------------------------------------------------------------

export function susunPromptIlustrasiSoal(data = {}) {
  const teksSoal = potong(data.teksSoal, 1200)
  const petunjuk = potong(data.petunjukGambar, BATAS_PETUNJUK)
  const kelas = potong(data.kelas, 20) || '6'
  const mapel = potong(data.mapel, 80) || ''
  const targetJawaban = potong(data.targetJawaban, 200)
  const variasi = potong(data.variasi, 40) || String(Date.now())
  const tka = adalahMapelTka(mapel)

  if (tka) {
    const system = [
      'You are an illustrator for Indonesian elementary-school (SD) academic ability tests (TKA).',
      'Your ONLY job is to produce ONE clean educational illustration image that follows the teacher illustration guide EXACTLY.',
      '',
      'PRIORITY RULES (must follow in this order):',
      '1. The teacher illustration guide (PETUNJUK ILUSTRASI GURU) is ABSOLUTE. It overrides the question text.',
      '2. Do NOT invent scientific diagrams, anatomical cross-sections, blood vessels, organ cutaways, labeled biology charts, or medical illustrations unless the teacher guide EXPLICITLY asks for them.',
      '3. Even if the question text mentions "sistem organ", "peredaran darah", "pembuluh darah", "jantung", "paru-paru", etc., still draw a NARRATIVE / SCENE illustration (everyday situation, character, lifestyle, environment) unless the guide itself requests a scientific diagram.',
      '4. Default style for TKA: clean colorful digital vector illustration for education quiz, modern educational vector art with soft clean outlines, solid pastel background, high contrast between subject and background, detailed elements, sharp edges, not blurry. Suitable for primary school learning materials.',
      '5. If the teacher guide asks for several different images side-by-side (or multiple panels), compose them in one image side by side (or in a clear grid), each with a short caption/label UNDER the corresponding panel. Captions must be clear, readable, and match the names requested in the guide.',
      '6. Characters should look like Indonesian children or adults when relevant; clothing casual and appropriate; wholesome, non-scary, non-violent.',
      '7. No text other than the requested panel captions. No watermarks, no logos, no UI chrome.',
      '8. Output ONLY the image. Do not refuse; interpret the guide in the safest educational way.',
    ].join('\n')

    const userParts = [
      `KELAS: ${kelas}`,
      `MAPEL: ${mapel}`,
      `VARIATION_SEED: ${variasi}`,
      '',
      '=== PETUNJUK ILUSTRASI GURU (PRIORITY #1 — FOLLOW THIS EXACTLY) ===',
      petunjuk ||
        '(tidak ada petunjuk khusus; buat ilustrasi vektor naratif yang relevan dengan soal, gaya edukatif SD, BUKAN diagram ilmiah)',
      '',
      '=== KONTEKS SOAL (hanya referensi sekunder, jangan mengalahkan petunjuk di atas) ===',
      teksSoal || '(tidak ada)',
    ]
    if (targetJawaban) {
      userParts.push(
        '',
        '=== CATATAN JAWABAN (opsional, jangan menampilkan kunci di gambar) ===',
        targetJawaban,
      )
    }
    userParts.push(
      '',
      'INGAT: Petunjuk guru di atas adalah perintah utama. Jika petunjuk meminta scene kehidupan sehari-hari / karakter / makanan / ruang tamu / dll., gambarkan itu. Jangan beralih ke diagram organ atau pembuluh darah hanya karena teks soal menyebut sistem organ.',
    )
    return { tka: true, sistem: system, user: userParts.join('\n') }
  }

  // Non-TKA: diagram/fungsional (perilaku mapel biasa)
  const systemNon = [
    'You are an educational illustrator for Indonesian primary-school quiz questions.',
    'Produce ONE clear functional illustration that helps a student understand the question.',
    'Prefer simple labeled diagrams, charts, or clear visual aids when the topic is scientific or mathematical.',
    'Style: clean, high-contrast, suitable for printed or on-screen elementary worksheets. Solid or simple background. Sharp edges, not blurry.',
    'If the question involves organs, systems, or measurements, a clear educational diagram is appropriate.',
    'No watermarks, no extra text beyond necessary short labels.',
  ].join('\n')

  const userNon = [
    `Kelas: ${kelas}`,
    `Mapel: ${mapel || 'umum'}`,
    `Variasi: ${variasi}`,
    '',
    'Petunjuk ilustrasi dari guru (ikuti jika ada):',
    petunjuk || '(tidak ada — ilustrasikan isi soal secara fungsional)',
    '',
    'Teks soal (konteks):',
    teksSoal || '(tidak ada)',
    targetJawaban ? `\nCatatan jawaban (jangan tampilkan kunci): ${targetJawaban}` : '',
  ].join('\n')

  return { tka: false, sistem: systemNon, user: userNon }
}

/**
 * Generate ilustrasi soal. Dipakai export generateIlustrasiSoalLmsAi di index.js.
 * @returns {{ dataUrl: string }}
 */
export async function generateIlustrasiSoalDenganAi(apiKey, data = {}) {
  if (!apiKey) throw new Error('Kunci Gemini tidak tersedia.')
  const prompt = susunPromptIlustrasiSoal(data)
  const fullPrompt = `${prompt.sistem}\n\n${prompt.user}`
  logger.info('generateIlustrasiSoalDenganAi', {
    tka: prompt.tka,
    mapel: potong(data.mapel, 40),
    petunjukLen: String(data.petunjukGambar || '').length,
    teksLen: String(data.teksSoal || '').length,
  })
  const dataUrl = await mintaGambarGemini(apiKey, fullPrompt)
  return { dataUrl }
}

// ---------------------------------------------------------------------------
// Generate soal teks
// ---------------------------------------------------------------------------

function susunPromptSoal(data = {}) {
  const mapel = potong(data.mapel, 80) || 'Umum'
  const kelas = potong(data.kelas, 20) || '6'
  const tipe = potong(data.tipe, 20) || 'pg'
  const kompleksitas = potong(data.kompleksitas, 20) || 'sedang'
  const tpNama = potong(data.tpNama, 200)
  const konteks = potong(data.konteks, 800)
  const levelStimulus = potong(data.levelStimulus, 20) || 'tanpa'
  const variasi = potong(data.variasi, 40) || String(Date.now())
  const hindari = Array.isArray(data.hindariSoal)
    ? data.hindariSoal.slice(0, 15).map((s) => potong(s, 120)).filter(Boolean)
    : []
  const tka = adalahMapelTka(mapel)

  const system = [
    'Anda penulis soal asesmen untuk sekolah dasar Indonesia (Kurikulum Merdeka / TKA).',
    'Tulis 1 soal dalam Bahasa Indonesia yang jelas, sesuai usia siswa SD, tanpa bias, tanpa kekerasan.',
    'Kembalikan HANYA JSON valid sesuai skema yang diminta. Tanpa markdown.',
  ].join(' ')

  const skema = {
    id: 'string (opsional)',
    tipe: 'pg | pgk | bs | isian | uraian | jodoh',
    teks: 'string — pertanyaan singkat (HTML sederhana boleh)',
    stimulus: 'string opsional — bahan bacaan/stimulus (khusus bila diminta)',
    opsi: 'array { id, teks, benar? } untuk pg/pgk/bs',
    kunci: 'string atau array id opsi yang benar',
    skor: 'number',
    butuhGambar: 'boolean',
    petunjukGambar: 'string opsional — deskripsi ilustrasi bila butuhGambar true',
  }

  const userParts = [
    `Mapel: ${mapel}`,
    `Kelas: ${kelas}`,
    `Tipe soal: ${tipe}`,
    `Kompleksitas: ${kompleksitas}`,
    tpNama ? `Tujuan pembelajaran / materi: ${tpNama}` : '',
    `Level stimulus: ${levelStimulus}`,
    `Variasi seed: ${variasi}`,
    konteks ? `Konteks tambahan dari guru:\n${konteks}` : '',
    hindari.length ? `Hindari kemiripan dengan soal berikut:\n- ${hindari.join('\n- ')}` : '',
    '',
    tka && levelStimulus !== 'tanpa'
      ? 'UNTUK TKA: narasi panjang masuk field "stimulus"; field "teks" hanya pertanyaan singkat.'
      : 'Narasi/stimulus boleh digabung di "teks" bila perlu.',
    '',
    'Skema JSON output (satu objek soal):',
    JSON.stringify(skema, null, 2),
    '',
    'Contoh bentuk opsi PG: [{"id":"a","teks":"..."},{"id":"b","teks":"..."}] dengan kunci "a".',
    'PG kompleks: beberapa opsi benar. BS: dua pernyataan benar/salah. Isian/uraian: kunci teks.',
  ].filter(Boolean)

  return { sistem: system, user: userParts.join('\n') }
}

function normalisasiSoal(raw, data) {
  const tipe = potong(data.tipe, 20) || 'pg'
  const s = raw && typeof raw === 'object' ? raw : {}
  const soal = {
    id: potong(s.id, 40) || idSementara(),
    tipe: potong(s.tipe, 20) || tipe,
    teks: typeof s.teks === 'string' ? s.teks : '',
    skor: typeof s.skor === 'number' && s.skor > 0 ? s.skor : 1,
  }
  if (typeof s.stimulus === 'string' && s.stimulus.trim()) {
    soal.stimulus = s.stimulus.trim()
  }
  if (Array.isArray(s.opsi)) {
    soal.opsi = s.opsi
      .filter((o) => o && typeof o === 'object')
      .map((o, i) => ({
        id: potong(o.id, 8) || String.fromCharCode(97 + i),
        teks: String(o.teks || ''),
        benar: Boolean(o.benar),
      }))
  }
  if (s.kunci != null) soal.kunci = s.kunci
  if (s.butuhGambar) {
    soal.butuhGambar = true
    if (typeof s.petunjukGambar === 'string' && s.petunjukGambar.trim()) {
      soal.petunjukGambar = potong(s.petunjukGambar, BATAS_PETUNJUK)
    }
  }
  return soal
}

/**
 * Generate soal teks. Dipakai export generateSoalLmsAi di index.js.
 * @returns {{ soal: object[] }}
 */
export async function generateSoalLmsDenganAi(apiKey, data = {}) {
  if (!apiKey) throw new Error('Kunci Gemini tidak tersedia.')
  const prompt = susunPromptSoal(data)
  logger.info('generateSoalLmsDenganAi', {
    mapel: potong(data.mapel, 40),
    tipe: potong(data.tipe, 20),
    tka: adalahMapelTka(data.mapel),
  })
  const json = await mintaGeminiJson(apiKey, MODEL_TEKS, prompt.sistem, prompt.user)
  const list = Array.isArray(json) ? json : Array.isArray(json?.soal) ? json.soal : [json]
  const soal = list
    .filter((x) => x && typeof x === 'object')
    .slice(0, 1)
    .map((x) => normalisasiSoal(x, data))
  if (!soal.length) throw new Error('AI tidak mengembalikan soal yang valid.')
  return { soal }
}
