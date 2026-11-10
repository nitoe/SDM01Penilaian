/**
 * generateSoalLmsAi.js
 * Helper generate soal + ilustrasi LMS (Cloud Functions).
 *
 * PENTING:
 * - JANGAN impor @google/generative-ai (tidak ada di package.json functions).
 * - Semua panggilan Gemini lewat fetch REST (pola sama dengan generateBukuAi / generateAi).
 * - Cabang TKA (mapel diawali "TKA ") memakai prompt terpisah (ANTIREGRESI §87).
 *
 * Export yang dipakai index.js:
 *   - generateSoalLmsDenganAi
 *   - generateIlustrasiSoalDenganAi
 */

import { logger } from 'firebase-functions'

const BATAS_PETUNJUK = 3000
const MODEL_TEKS = 'gemini-2.0-flash'
/** Model native image generation Gemini (sesuaikan jika di produksi sudah beda). */
const MODEL_GAMBAR = 'gemini-2.0-flash-preview-image-generation'

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
}

/** Mapel TKA: diawali "TKA ". */
function adalahMapelTka(mapel) {
  const m = String(mapel || '').trim()
  return m.startsWith('TKA ')
}

/**
 * Susun prompt ilustrasi.
 * Cabang TKA vs non-TKA dipisah ketat (ANTIREGRESI §87).
 */
export function susunPromptIlustrasiSoal(data = {}) {
  const teksSoal = potong(data.teksSoal, 1200)
  const petunjuk = potong(data.petunjukGambar, BATAS_PETUNJUK)
  const kelas = potong(data.kelas, 20) || '6'
  const mapel = potong(data.mapel, 80) || ''
  const targetJawaban = potong(data.targetJawaban, 200)
  const variasi = potong(data.variasi, 40) || String(Date.now())
  const tka = adalahMapelTka(mapel)

  if (tka) {
    // ========== CABANG TKA ==========
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

    return {
      tka: true,
      sistem: system,
      user: userParts.join('\n'),
      model: MODEL_GAMBAR,
    }
  }

  // ========== CABANG NON-TKA (perilaku lama / diagram fungsional) ==========
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

  return {
    tka: false,
    sistem: systemNon,
    user: userNon,
    model: MODEL_GAMBAR,
  }
}

/**
 * Panggil Gemini native image generation via REST (tanpa package @google/generative-ai).
 * Mengembalikan data URL base64.
 */
async function mintaGambarGemini(apiKey, model, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
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
    const msg =
      json?.error?.message ||
      json?.error?.status ||
      `HTTP ${res.status}`
    throw new Error(`Gemini gambar gagal: ${msg}`)
  }

  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png'
      return `data:${mime};base64,${part.inlineData.data}`
    }
  }

  const teks = parts.map((p) => p.text || '').join(' ').trim()
  throw new Error(
    teks
      ? `Gemini tidak mengembalikan gambar. Respons: ${teks.slice(0, 240)}`
      : 'Gemini tidak mengembalikan gambar.',
  )
}

/**
 * Generate ilustrasi soal. Dipakai oleh export generateIlustrasiSoalLmsAi di index.js.
 * Mengembalikan { dataUrl }.
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
    model: prompt.model,
  })

  const dataUrl = await mintaGambarGemini(apiKey, prompt.model, fullPrompt)
  return { dataUrl }
}

/**
 * Generate soal teks (dipakai generateSoalLmsAi di index.js).
 *
 * CATATAN MERGE:
 * Jika file produksi Anda sudah punya implementasi generateSoalLmsDenganAi yang lengkap,
 * PERTAHANKAN implementasi teks itu dan HANYA ganti/merge:
 *   - susunPromptIlustrasiSoal
 *   - generateIlustrasiSoalDenganAi
 *   - mintaGambarGemini (helper)
 *
 * Stub di bawah hanya agar export tidak hilang saat file ini berdiri sendiri.
 * Ganti dengan logika produksi Anda bila Anda menimpa file penuh.
 */
export async function generateSoalLmsDenganAi(apiKey, data = {}) {
  // Implementasi teks soal harus diambil dari versi produksi yang sudah ada.
  // Jangan mengandalkan stub ini untuk generate soal di production.
  throw new Error(
    'generateSoalLmsDenganAi: restore implementasi teks dari git/produksi. ' +
      'Update TKA hanya menyentuh generateIlustrasiSoalDenganAi / susunPromptIlustrasiSoal.',
  )
}
