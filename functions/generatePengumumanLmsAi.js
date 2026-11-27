/**
 * Generate pengumuman ruang kelas LMS — bahasa Islami hangat (ayah/bunda · ananda).
 * Hanya akun AI (bolehPemanggilAi). Dipanggil dari generatePengumumanLmsAi di index.js.
 */
import { logger } from 'firebase-functions'

const MODEL_TEKS = 'gemini-2.5-flash'

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
}

async function mintaGeminiJson(apiKey, model, systemText, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemText}\n\n${userText}` }] }],
    generationConfig: {
      temperature: 0.7,
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
 * @param {string} apiKey
 * @param {object} data
 * @returns {Promise<{ judul: string, kontenHtml: string }>}
 */
export async function generatePengumumanDenganAi(apiKey, data = {}) {
  if (!apiKey) throw new Error('Kunci Gemini tidak tersedia.')
  const informasi = potong(data.informasi, 4000)
  if (informasi.length < 8) {
    throw Object.assign(new Error('Informasi pengumuman terlalu singkat.'), { code: 'invalid-argument' })
  }
  const kelas = potong(data.kelas, 20) || ''
  const mapel = potong(data.mapel, 80) || ''
  const tujuan = potong(data.tujuan, 200)
  const variasi = potong(data.variasi, 40) || String(Date.now())

  const system = [
    'Anda adalah guru SD Muhammadiyah yang menulis pengumuman untuk orang tua dan siswa.',
    'Gaya bahasa: Islami, hangat, sopan, jelas, dan profesional — seperti komunikasi sekolah kepada keluarga.',
    'WAJIB memakai sebutan «ayah/bunda» untuk orang tua dan «ananda» untuk siswa (jangan «Bapak/Ibu» atau «anak Anda» kecuali dalam kutipan).',
    'Boleh membuka dengan salam Islami singkat (Assalamu\'alaikum warahmatullahi wabarakatuh) bila cocok, dan menutup dengan doa singkat atau ucapan terima kasih yang tulus.',
    'Jangan berlebihan, jangan menghakimi, jangan menakut-nakuti. Fokus pada informasi yang diberikan guru.',
    'Keluarkan HANYA JSON dengan kunci: judul (string singkat, maks 120 karakter), kontenHtml (string HTML).',
    'kontenHtml boleh memakai tag: p, br, strong, em, u, ul, ol, li, h2, h3, blockquote. Tanpa style, class, script, atau tautan.',
    'Struktur kontenHtml profesional: 2–5 paragraf pendek, boleh daftar poin jika membantu. Jangan markdown.',
    'Bahasa Indonesia baku yang ramah; fakta penting (tanggal, jam, tempat, yang dibawa) harus jelas.',
  ].join(' ')

  const user = [
    `KELAS: ${kelas || '(umum)'}`,
    `MATA PELAJARAN: ${mapel || '(umum)'}`,
    tujuan ? `TUJUAN/NADA: ${tujuan}` : '',
    `VARIATION_SEED: ${variasi}`,
    '',
    '=== INFORMASI DARI GURU (sumber kebenaran) ===',
    informasi,
    '',
    'Susun pengumuman berdasarkan informasi di atas. Jangan menambah fakta yang tidak disebutkan.',
  ]
    .filter(Boolean)
    .join('\n')

  logger.info('generatePengumumanDenganAi', {
    mapel: mapel.slice(0, 40),
    kelas,
    infoLen: informasi.length,
  })

  const out = await mintaGeminiJson(apiKey, MODEL_TEKS, system, user)
  const judul = potong(out?.judul, 160)
  let kontenHtml = String(out?.kontenHtml || '').trim()
  if (!judul) throw new Error('AI tidak mengembalikan judul.')
  if (!kontenHtml || kontenHtml.length < 20) throw new Error('AI tidak mengembalikan isi pengumuman.')
  // Batasi ukuran
  if (kontenHtml.length > 20000) kontenHtml = kontenHtml.slice(0, 20000)
  return { judul, kontenHtml }
}
