/**
 * generateSoalLmsAi.js — Cloud Functions helper untuk generate soal + ilustrasi LMS.
 * Dipakai oleh generateSoalLmsAi & generateIlustrasiSoalLmsAi (index.js).
 *
 * ANTIREGRESI §67, §87:
 * - Batas petunjukGambar ≥ 3000 karakter.
 * - Cabang TKA (mapel diawali "TKA ") memakai prompt terpisah:
 *   petunjuk guru prioritas mutlak, gaya vektor naratif/scene, larangan diagram ilmiah/anatomi
 *   kecuali petunjuk eksplisit meminta, dukungan multi-panel + caption.
 * - Cabang non-TKA tidak diubah perilakunya.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from 'firebase-functions'

const BATAS_PETUNJUK = 3000
const MODEL_TEKS = 'gemini-2.0-flash'
const MODEL_GAMBAR = 'gemini-2.0-flash-preview-image-generation'

/** Mapel TKA: diawali "TKA " (TKA Matematika, TKA Bahasa Indonesia, TKA IPA). */
function adalahMapelTka(mapel) {
  const m = String(mapel || '').trim()
  return m.startsWith('TKA ') || m === 'TKA IPA' || m === 'TKA Matematika' || m === 'TKA Bahasa Indonesia'
}

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
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
    // Petunjuk guru = prioritas mutlak. teksSoal hanya konteks sekunder.
    // Gaya: ilustrasi vektor naratif/scene edukatif SD, BUKAN diagram ilmiah.
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
      petunjuk || '(tidak ada petunjuk khusus; buat ilustrasi vektor naratif yang relevan dengan soal, gaya edukatif SD, BUKAN diagram ilmiah)',
      '',
      '=== KONTEKS SOAL (hanya referensi sekunder, jangan mengalahkan petunjuk di atas) ===',
      teksSoal || '(tidak ada)',
    ]
    if (targetJawaban) {
      userParts.push('', '=== CATATAN JAWABAN (opsional, jangan menampilkan kunci di gambar) ===', targetJawaban)
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

  // ========== CABANG NON-TKA (perilaku lama dipertahankan) ==========
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
 * Generate ilustrasi soal via Gemini native image generation.
 * Mengembalikan { dataUrl: 'data:image/png;base64,...' } atau melempar.
 */
export async function generateIlustrasiSoalDenganAi(apiKey, data = {}) {
  if (!apiKey) throw new Error('Kunci Gemini tidak tersedia.')

  const prompt = susunPromptIlustrasiSoal(data)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: prompt.model,
    generationConfig: {
      // Native image generation
      responseModalities: ['TEXT', 'IMAGE'],
    },
  })

  const contents = [
    { role: 'user', parts: [{ text: prompt.sistem + '\n\n' + prompt.user }] },
  ]

  logger.info('generateIlustrasiSoalDenganAi', {
    tka: prompt.tka,
    mapel: potong(data.mapel, 40),
    petunjukLen: String(data.petunjukGambar || '').length,
    teksLen: String(data.teksSoal || '').length,
  })

  const result = await model.generateContent({ contents })
  const response = result.response
  if (!response || !response.candidates || !response.candidates[0]) {
    throw new Error('Gemini tidak mengembalikan kandidat gambar.')
  }

  const parts = response.candidates[0].content?.parts || []
  let dataUrl = null
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      const mime = part.inlineData.mimeType || 'image/png'
      dataUrl = `data:${mime};base64,${part.inlineData.data}`
      break
    }
  }
  if (!dataUrl) {
    // Beberapa respons hanya teks (penolakan / deskripsi). Ambil pesan bila ada.
    const teks = parts.map((p) => p.text || '').join(' ').trim()
    throw new Error(
      teks
        ? `Gemini tidak mengembalikan gambar. Respons: ${teks.slice(0, 200)}`
        : 'Gemini tidak mengembalikan gambar.',
    )
  }
  return { dataUrl }
}

/**
 * Generate soal teks (tetap dipakai generateSoalLmsAi).
 * Implementasi minimal yang kompatibel; logika lengkap soal tetap di file ini
 * sesuai versi yang sudah ada di produksi. Bagian ini tidak diubah perilakunya
 * untuk mapel non-TKA. Untuk TKA, stimulus ditangani di sisi klien (ANTIREGRESI §86).
 *
 * Catatan: fungsi ini harus mengekspor generateSoalLmsDenganAi yang sudah dipakai
 * index.js. Jika versi produksi Anda lebih lengkap, merge hanya bagian
 * susunPromptIlustrasiSoal + generateIlustrasiSoalDenganAi di atas ke file Anda.
 */
export async function generateSoalLmsDenganAi(apiKey, data = {}) {
  // Placeholder aman: lempar agar pemanggil tahu bila generate soal dipanggil
  // tanpa implementasi teks lengkap. Di produksi, ganti dengan implementasi
  // generateSoalLmsDenganAi yang sudah ada sebelumnya.
  // (Update ini hanya menyentuh cabang ilustrasi TKA.)
  throw new Error(
    'generateSoalLmsDenganAi: gunakan implementasi teks yang sudah ada di produksi. ' +
      'Update ini hanya memperbaiki generateIlustrasiSoalDenganAi / susunPromptIlustrasiSoal untuk TKA.',
  )
}
