/**
 * generateMateriLmsAi.js — VERSI LENGKAP
 *
 * Export (dipakai index.js):
 *   - generateMateriHalamanDenganAi
 *   - generateIlustrasiMateriDenganAi
 *
 * Generate teks **satu halaman** materi LMS (HTML aman + opsi petunjuk gambar).
 * Konteks halaman sebelumnya WAJIB dipakai agar kelanjutan, bukan pengulangan.
 * Gate akun: bolehPemanggilAi di index.js (UID + email arif.azwar79@gmail.com).
 *
 * Wire di index.js (setelah import generateSoalLmsAi):
 *
 *   import { generateMateriHalamanDenganAi } from './generateMateriLmsAi.js'
 *
 *   export const generateMateriLmsAi = onCall(opsiAi, async (request) => {
 *     const provider = pastikanAi(request)
 *     if (provider !== 'gemini') {
 *       throw new HttpsError('invalid-argument', 'Generate materi LMS saat ini hanya mendukung Gemini.')
 *     }
 *     try {
 *       const apiKey = kunciProvider('gemini')
 *       const hasil = await generateMateriHalamanDenganAi(apiKey, request.data || {})
 *       logger.info('generateMateriLmsAi', {
 *         uid: request.auth.uid,
 *         mapel: String(request.data?.mapel || '').slice(0, 40),
 *         indeks: request.data?.indeksHalaman,
 *       })
 *       return hasil
 *     } catch (err) {
 *       if (err?.code === 'invalid-argument') throw new HttpsError('invalid-argument', err.message)
 *       logger.error('generateMateriLmsAi gagal', { pesan: err?.message })
 *       throw new HttpsError('internal', err?.message || 'Gagal membuat materi AI.')
 *     }
 *   })
 */

import { logger } from 'firebase-functions'

const MODEL_TEKS = 'gemini-3.8-flash'
const BATAS_KONTEKS_HALAMAN = 8
const BATAS_RINGKASAN = 400

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
}

function teksPolosKasar(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

async function mintaGeminiJson(apiKey, model, systemText, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemText}\n\n${userText}` }] }],
    generationConfig: {
      temperature: 0.75,
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
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error(`Gemini JSON tidak valid: ${text.slice(0, 200)}`)
  }
}

/**
 * @param {object} data
 * @param {string} data.mapel
 * @param {string} data.kelas
 * @param {string} [data.tpNama]
 * @param {number} [data.tpNomor]
 * @param {string} [data.judulMateri]
 * @param {string} [data.deskripsiMateri]
 * @param {number} [data.indeksHalaman] 0-based
 * @param {number} [data.totalHalaman]
 * @param {string} [data.judulHalamanSaatIni]
 * @param {string} [data.petunjukGuru]
 * @param {string} [data.variasi]
 * @param {Array<{ judul?: string, ringkasan?: string }>} [data.halamanSebelumnya]
 * @param {boolean} [data.isiMeta] — boleh usulkan judul/deskripsi materi jika masih kosong
 */
function susunPromptMateriHalaman(data = {}) {
  const mapel = potong(data.mapel, 80) || 'Umum'
  const kelas = potong(data.kelas, 20) || '4'
  const tpNama = potong(data.tpNama, 240)
  const tpNomor = typeof data.tpNomor === 'number' ? data.tpNomor : null
  const judulMateri = potong(data.judulMateri, 120)
  const deskripsiMateri = potong(data.deskripsiMateri, 300)
  const indeks =
    typeof data.indeksHalaman === 'number' && data.indeksHalaman >= 0
      ? Math.floor(data.indeksHalaman)
      : 0
  const total =
    typeof data.totalHalaman === 'number' && data.totalHalaman > 0
      ? Math.floor(data.totalHalaman)
      : indeks + 1
  const judulHalamanSaatIni = potong(data.judulHalamanSaatIni, 80)
  const petunjukGuru = potong(data.petunjukGuru, 600)
  const variasi = potong(data.variasi, 40) || String(Date.now())
  const isiMeta = data.isiMeta === true && indeks === 0 && !judulMateri

  const sebelumnya = Array.isArray(data.halamanSebelumnya)
    ? data.halamanSebelumnya.slice(-BATAS_KONTEKS_HALAMAN).map((h, i) => ({
        no: i + 1,
        judul: potong(h?.judul, 80),
        ringkasan: potong(h?.ringkasan, BATAS_RINGKASAN),
      }))
    : []

  const mapelMatematika = /matematika/i.test(mapel)

  const system = [
    'Anda penulis materi ajar untuk siswa sekolah dasar Indonesia (Kurikulum Merdeka).',
    'Tulis SATU halaman materi dalam Bahasa Indonesia yang jelas, ramah anak, akurat, tanpa kekerasan.',
    'Tampilan harus menarik, informatif, dan jelas: paragraf pendek, strong/em pada istilah penting, daftar berpoin bila membantu.',
    'Gunakan HTML terbatas saja: p, br, strong, em, u, sub, sup, ul, ol, li, h2, h3, table, thead, tbody, tr, th, td, caption.',
    'Atribut hanya boleh colspan, rowspan, scope pada sel tabel. JANGAN style, class, script, atau tautan.',
    mapelMatematika
      ? 'Untuk Matematika: gunakan rumus KaTeX inline $...$ atau blok $$...$$ bila perlu (contoh $a^2+b^2=c^2$).'
      : 'Rumus matematika opsional dengan notasi $...$ bila relevan.',
    'Struktur halaman: judulHalaman wajib singkat; isi pakai h2/h3 bila perlu, paragraf pendek, daftar bila membantu, tabel hanya jika data numerik/perbandingan jelas.',
    'Halaman harus saling berkaitan: JANGAN mengulang isi halaman sebelumnya. Lanjutkan konsep, naikkan kedalaman, atau berikan contoh/latihan baru yang menyambung.',
    'Sisipkan blok gambar (tipe gambar atau butuhGambar pada teks) di posisi yang tepat — setelah konsep yang perlu divisualkan, bukan di awal/akhir sembarangan. petunjukGambar harus spesifik (ilustrasi/infografis/diagram untuk SD).',
    'Jika butuh ilustrasi (diagram, infografis sederhana, benda konkret), set butuhGambar true dan tulis petunjukGambar deskriptif (bukan teks soal).',
    'Kembalikan HANYA JSON valid sesuai skema. Tanpa markdown.',
  ].join(' ')

  const skema = {
    judulHalaman: 'string singkat (opsional tapi disarankan)',
    blok: [
      {
        tipe: 'teks | gambar',
        html: 'string HTML (wajib jika tipe teks)',
        butuhGambar: 'boolean (jika tipe gambar atau teks yang butuh visual)',
        petunjukGambar: 'string — deskripsi ilustrasi untuk generator gambar terpisah',
        caption: 'string opsional untuk gambar',
      },
    ],
    judulMateri: 'string opsional — hanya jika diminta mengisi meta materi',
    deskripsiMateri: 'string opsional — ringkas untuk siswa',
  }

  const userParts = [
    `Mapel: ${mapel}`,
    `Kelas: ${kelas}`,
    tpNomor != null || tpNama
      ? `Tujuan Pembelajaran${tpNomor != null ? ` ${tpNomor}` : ''}: ${tpNama || '—'}`
      : '',
    judulMateri ? `Judul materi: ${judulMateri}` : 'Judul materi: (belum diisi)',
    deskripsiMateri ? `Deskripsi materi: ${deskripsiMateri}` : '',
    `Halaman ke-${indeks + 1} dari ${total} (indeks 0-based: ${indeks}).`,
    judulHalamanSaatIni ? `Judul halaman saat ini (boleh diperbaiki): ${judulHalamanSaatIni}` : '',
    petunjukGuru ? `Petunjuk guru untuk halaman ini:\n${petunjukGuru}` : '',
    `Variasi seed: ${variasi}`,
    '',
    sebelumnya.length
      ? [
          'Ringkasan halaman SEBELUMNYA (wajib dilanjutkan, jangan diulang):',
          ...sebelumnya.map(
            (h) =>
              `- Halaman ${h.no}${h.judul ? ` «${h.judul}»` : ''}: ${h.ringkasan || '(kosong)'}`,
          ),
        ].join('\n')
      : 'Ini halaman pertama — perkenalkan konsep dengan lembut sesuai usia siswa.',
    '',
    isiMeta
      ? 'Meta materi masih kosong: boleh mengisi judulMateri dan deskripsiMateri di JSON.'
      : 'Jangan mengubah judulMateri/deskripsiMateri kecuali field dikosongkan di skema (biarkan null).',
    '',
    'Skema JSON output (satu objek):',
    JSON.stringify(skema, null, 2),
    '',
    'Minimal 1 blok teks. Maksimal 6 blok. Hindari halaman yang hanya satu kalimat.',
  ].filter((x) => x !== '')

  return { sistem: system, user: userParts.join('\n'), isiMeta }
}

function normalisasiHasil(raw, data) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const blokIn = Array.isArray(s.blok) ? s.blok : []
  const blok = []
  for (const b of blokIn.slice(0, 8)) {
    if (!b || typeof b !== 'object') continue
    const tipe = String(b.tipe || '').toLowerCase() === 'gambar' ? 'gambar' : 'teks'
    if (tipe === 'teks') {
      const html = typeof b.html === 'string' ? b.html.trim() : ''
      if (!html) continue
      const item = { tipe: 'teks', html: potong(html, 12000) }
      if (b.butuhGambar === true) {
        item.butuhGambar = true
        if (typeof b.petunjukGambar === 'string' && b.petunjukGambar.trim()) {
          item.petunjukGambar = potong(b.petunjukGambar, 2000)
        }
      }
      blok.push(item)
    } else {
      const petunjuk =
        typeof b.petunjukGambar === 'string' && b.petunjukGambar.trim()
          ? potong(b.petunjukGambar, 2000)
          : typeof b.html === 'string' && b.html.trim()
            ? potong(teksPolosKasar(b.html), 500)
            : ''
      if (!petunjuk) continue
      blok.push({
        tipe: 'gambar',
        butuhGambar: true,
        petunjukGambar: petunjuk,
        caption: typeof b.caption === 'string' ? potong(b.caption, 160) : undefined,
      })
    }
  }
  if (blok.length === 0) {
    throw Object.assign(new Error('AI tidak menghasilkan blok materi yang valid.'), {
      code: 'invalid-argument',
    })
  }

  const out = {
    judulHalaman:
      typeof s.judulHalaman === 'string' && s.judulHalaman.trim()
        ? potong(s.judulHalaman, 80)
        : undefined,
    blok,
  }

  const bolehMeta = data.isiMeta === true || (!data.judulMateri && (data.indeksHalaman === 0 || data.indeksHalaman == null))
  if (bolehMeta) {
    if (typeof s.judulMateri === 'string' && s.judulMateri.trim()) {
      out.judulMateri = potong(s.judulMateri, 120)
    }
    if (typeof s.deskripsiMateri === 'string' && s.deskripsiMateri.trim()) {
      out.deskripsiMateri = potong(s.deskripsiMateri, 300)
    }
  }
  return out
}

/**
 * Generate satu halaman materi.
 * @returns {{ judulHalaman?: string, blok: object[], judulMateri?: string, deskripsiMateri?: string }}
 */
export async function generateMateriHalamanDenganAi(apiKey, data = {}) {
  if (!apiKey) throw new Error('Kunci Gemini tidak tersedia.')
  if (!potong(data.mapel, 80)) {
    throw Object.assign(new Error('Mapel wajib diisi.'), { code: 'invalid-argument' })
  }
  const prompt = susunPromptMateriHalaman(data)
  logger.info('generateMateriHalamanDenganAi', {
    mapel: potong(data.mapel, 40),
    indeks: data.indeksHalaman,
    nSebelum: Array.isArray(data.halamanSebelumnya) ? data.halamanSebelumnya.length : 0,
  })
  const json = await mintaGeminiJson(apiKey, MODEL_TEKS, prompt.sistem, prompt.user)
  return normalisasiHasil(json, { ...data, isiMeta: prompt.isiMeta })
}


// ---------------------------------------------------------------------------
// Generate ilustrasi materi (TERPISAH dari teks — Fase C)
// ---------------------------------------------------------------------------

const MODEL_GAMBAR_CANDIDATES = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-nano-banana-2.1',
]

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
        lastError = `HTTP ${res.status} non-JSON`
        continue
      }
      if (!res.ok) {
        lastError = json?.error?.message || `HTTP ${res.status}`
        if (res.status === 404) continue
        if ([429, 500, 503].includes(res.status)) continue
        throw new Error(`Gemini gambar gagal: ${lastError}`)
      }
      const parts = json?.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        const inline = part.inlineData || part.inline_data
        if (inline?.data) {
          const mime = inline.mimeType || inline.mime_type || 'image/png'
          return `data:${mime};base64,${inline.data}`
        }
      }
      lastError = 'Tidak ada data gambar di respons'
    } catch (e) {
      lastError = e?.message || String(e)
    }
  }
  throw new Error(lastError || 'Gagal generate gambar materi.')
}

function susunPromptIlustrasiMateri(data = {}) {
  const petunjuk = potong(data.petunjukGambar, 2000)
  const konteks = potong(data.konteksHalaman, 800)
  const kelas = potong(data.kelas, 20) || '4'
  const mapel = potong(data.mapel, 80) || ''
  const variasi = potong(data.variasi, 40) || String(Date.now())

  const system = [
    'You are an educational illustrator for Indonesian primary-school (SD) learning materials.',
    'Produce ONE clear illustration or simple infographic that supports the lesson content.',
    'Style: clean colorful educational vector illustration, soft outlines, solid or soft pastel background, high contrast, sharp (not blurry), wholesome, age-appropriate.',
    'Prefer concrete objects, scenes, or simple labeled diagrams suitable for children.',
    'No watermarks, no logos, no UI chrome. Minimal text labels only if essential and readable.',
    'Follow the teacher illustration guide as the primary instruction.',
  ].join(' ')

  const user = [
    `KELAS: ${kelas}`,
    `MAPEL: ${mapel || 'umum'}`,
    `VARIATION_SEED: ${variasi}`,
    '',
    '=== PETUNJUK ILUSTRASI (UTAMA) ===',
    petunjuk || '(tidak ada — buat ilustrasi generik mendukung konteks halaman)',
    '',
    konteks ? `Konteks teks halaman (jangan tulis ulang sebagai teks di gambar):\n${konteks}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `${system}\n\n${user}`
}

/**
 * Generate satu ilustrasi untuk blok gambar materi.
 * @returns {{ dataUrl: string }}
 */
export async function generateIlustrasiMateriDenganAi(apiKey, data = {}) {
  if (!apiKey) throw new Error('Kunci Gemini tidak tersedia.')
  if (!potong(data.petunjukGambar, 2000)) {
    throw Object.assign(new Error('Petunjuk gambar wajib diisi.'), { code: 'invalid-argument' })
  }
  const fullPrompt = susunPromptIlustrasiMateri(data)
  logger.info('generateIlustrasiMateriDenganAi', {
    mapel: potong(data.mapel, 40),
    petunjukLen: String(data.petunjukGambar || '').length,
  })
  const dataUrl = await mintaGambarGemini(apiKey, fullPrompt)
  return { dataUrl }
}
