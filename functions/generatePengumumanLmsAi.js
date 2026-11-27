/**
 * Generate pengumuman ruang kelas LMS — bahasa Islami hangat (ayah/bunda · ananda).
 * Hanya akun AI (bolehPemanggilAi). Dipanggil dari generatePengumumanLmsAi di index.js.
 * Model selaras generateSoalLmsAi / generateMateriLmsAi: gemini-3.8-flash.
 */
import { logger } from 'firebase-functions'

const MODEL_TEKS = 'gemini-3.8-flash'

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
}

/**
 * Rapikan HTML dari model: fence, escape, markdown ringan → HTML terstruktur.
 * Sanitasi penuh tetap di klien (bersihHtmlMateri / normalisasiHtmlPengumuman).
 */
function normalisasiHtmlDariAi(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''

  s = s.replace(/^```(?:html|HTML)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // HTML ter-escape penuh
  if ((s.match(/&lt;/g) || []).length >= 2 && !/<[a-zA-Z]/.test(s)) {
    s = s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
  }

  const punyaTag = /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(s)
  if (!punyaTag) {
    const esc = (x) =>
      String(x)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    const inline = (x) => {
      let y = esc(x)
      y = y.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      y = y.replace(/__(.+?)__/g, '<strong>$1</strong>')
      y = y.replace(/(^|[^*])\*([^*]+)\*(?![*])/g, '$1<em>$2</em>')
      return y
    }
    const baris = s.replace(/\r\n?/g, '\n').split('\n')
    const out = []
    let list = []
    let listOrdered = false
    const flushList = () => {
      if (!list.length) return
      const tag = listOrdered ? 'ol' : 'ul'
      out.push(`<${tag}>${list.map((li) => `<li>${li}</li>`).join('')}</${tag}>`)
      list = []
    }
    for (const line of baris) {
      const bullet = line.match(/^\s*[-*•]\s+(.+)$/)
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/)
      if (bullet) {
        if (list.length && listOrdered) flushList()
        listOrdered = false
        list.push(inline(bullet[1]))
        continue
      }
      if (numbered) {
        if (list.length && !listOrdered) flushList()
        listOrdered = true
        list.push(inline(numbered[1]))
        continue
      }
      flushList()
      const t = line.trim()
      if (!t) continue
      out.push(`<p>${inline(t)}</p>`)
    }
    flushList()
    s = out.join('') || `<p>${inline(s)}</p>`
  } else if (!/<\s*(p|ul|ol|h2|h3|h4|blockquote|div)\b/i.test(s)) {
    s = `<p>${s}</p>`
  }

  s = s.replace(/>\s+</g, '><').replace(/><(p|h2|h3|ul|ol|blockquote)\b/gi, '>\n<$1')
  return s.trim()
}

async function mintaGeminiJson(apiKey, model, systemText, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemText}\n\n${userText}` }] }],
    generationConfig: {
      temperature: 0.65,
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
    'Gaya bahasa: Islami, hangat, sopan, jelas, dan profesional.',
    'WAJIB memakai sebutan «ayah/bunda» untuk orang tua dan «ananda» untuk siswa.',
    'Boleh membuka dengan salam Islami singkat dan menutup dengan doa/terima kasih singkat.',
    'Jangan berlebihan, jangan menghakimi. Hanya fakta dari guru.',
    '',
    'OUTPUT: HANYA JSON valid dengan kunci tepat: judul (string, maks 120 karakter), kontenHtml (string HTML).',
    '',
    'ATURAN kontenHtml (sangat ketat):',
    '1. Harus HTML valid, BUKAN markdown. Dilarang: **, __, # heading, list markdown dengan tanda minus, dan fence kode.',
    '2. Tag yang diizinkan: p, br, strong, em, u, ul, ol, li, h2, h3, blockquote. Tidak ada style/class/script/a/img.',
    '3. Setiap paragraf dibungkus <p>...</p>. Daftar memakai <ul><li> atau <ol><li>.',
    '4. Fakta penting (tanggal, jam, tempat, yang dibawa) boleh ditandai <strong>.',
    '5. Struktur tipikal: paragraf salam + 1–3 paragraf isi + opsional daftar poin + paragraf penutup/doa.',
    '6. Jangan escape tag (jangan tulis &lt;p&gt;). Tulis karakter < dan > secara langsung di dalam string JSON.',
    '',
    'Contoh bentuk kontenHtml (ilustrasi struktur saja):',
    "<p>Assalamu'alaikum warahmatullahi wabarakatuh.</p><p>Ayah/bunda yang dirahmati Allah, kami sampaikan informasi untuk ananda kelas terkait.</p><ul><li><strong>Hari:</strong> Rabu</li><li><strong>Yang dibawa:</strong> alat tulis</li></ul><p>Jazakumullahu khairan. Wassalamu'alaikum warahmatullahi wabarakatuh.</p>",
  ].join('\n')

  const user = [
    `KELAS: ${kelas || '(umum)'}`,
    `MATA PELAJARAN: ${mapel || '(umum)'}`,
    tujuan ? `TUJUAN/NADA: ${tujuan}` : '',
    `VARIATION_SEED: ${variasi}`,
    '',
    '=== INFORMASI DARI GURU (sumber kebenaran) ===',
    informasi,
    '',
    'Susun pengumuman HTML berdasarkan informasi di atas. Jangan menambah fakta yang tidak disebutkan.',
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
  let kontenHtml = normalisasiHtmlDariAi(out?.kontenHtml)
  if (!judul) throw new Error('AI tidak mengembalikan judul.')
  if (!kontenHtml || kontenHtml.length < 20) throw new Error('AI tidak mengembalikan isi pengumuman.')
  if (kontenHtml.length > 20000) kontenHtml = kontenHtml.slice(0, 20000)
  return { judul, kontenHtml }
}
