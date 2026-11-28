/**
 * Generate pengumuman ruang kelas LMS — bahasa Islami hangat (ayah/bunda · ananda).
 * Hanya akun AI (bolehPemanggilAi). Dipanggil dari generatePengumumanLmsAi di index.js.
 * Model selaras generateSoalLmsAi / generateMateriLmsAi: gemini-3.8-flash.
 * Gaya prompt: ANTIREGRESI §Pengumuman.AiGaya (ringkas, hanya fakta guru, tanpa frasa klise).
 */
import { logger } from 'firebase-functions'

const MODEL_TEKS = 'gemini-3.8-flash'

function potong(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return t.slice(0, n)
}

/**
 * Rapikan HTML dari model: fence, escape, markdown, paragraf tebal beruntun → daftar.
 */
function normalisasiHtmlDariAi(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''

  s = s.replace(/^```(?:html|HTML)?\s*/i, '').replace(/\s*```$/i, '').trim()

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

  // Paragraf yang isinya hanya <strong>…</strong> beruntun (≥2) → <ul><li>
  s = s.replace(
    /(?:<p>\s*(?:<strong>|<b>)([\s\S]*?)(?:<\/strong>|<\/b>)\s*<\/p>\s*){2,}/gi,
    (blok) => {
      const items = []
      const re = /<p>\s*(?:<strong>|<b>)([\s\S]*?)(?:<\/strong>|<\/b>)\s*<\/p>/gi
      let m
      while ((m = re.exec(blok))) {
        const isi = String(m[1] || '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (isi) items.push(isi)
      }
      if (items.length < 2) return blok
      return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
    },
  )

  // Baris seperti "- topik" di dalam <p>
  s = s.replace(/<p>\s*[-•]\s+([^<]+)<\/p>/gi, '<ul><li>$1</li></ul>')
  // Gabung <ul> berurutan
  s = s.replace(/<\/ul>\s*<ul>/gi, '')

  s = s.replace(/>\s+</g, '><').replace(/><(p|h2|h3|ul|ol|blockquote)\b/gi, '>\n<$1')
  return s.trim()
}

async function mintaGeminiJson(apiKey, model, systemText, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemText}\n\n${userText}` }] }],
    generationConfig: {
      temperature: 0.6,
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
    'Anda menuliskan pengumuman dari guru SD Muhammadiyah kepada ayah/bunda murid.',
    'Tujuannya satu: orang tua langsung tahu APA yang diumumkan, KAPAN, dan APA yang perlu dilakukan — tanpa harus membaca basa-basi.',
    '',
    'PRINSIP ISI (utama):',
    '- Sumber kebenaran hanya «INFORMASI DARI GURU». Jangan menambah fakta, penjelasan materi, hikmah, nasihat, atau imbauan yang tidak ada di sana.',
    '- Panjang mengikuti informasi: info singkat → pengumuman singkat. Umumnya 50–130 kata. Jangan memanjangkan dengan kalimat pengisi.',
    '- Kalimat pertama setelah salam langsung memuat inti pengumuman (apa + kapan/untuk siapa).',
    '- Judul spesifik dan informatif (mis. «Sumatif IPAS Rabu 3 Desember: materi dan perlengkapan»), bukan judul umum seperti «Pengumuman Penting».',
    '- Bila ada tanggal, jam, tempat, barang bawaan, atau batas waktu: tampilkan jelas, boleh <strong> di dalam kalimat atau item daftar.',
    '- Bila guru memberi daftar materi/langkah, salin sebagai daftar apa adanya (boleh dirapikan), JANGAN menjelaskan ulang setiap butirnya.',
    '- Ajakan kepada orang tua (mendampingi, mengingatkan, menyiapkan) hanya jika disebut guru, dan cukup satu kalimat konkret.',
    '',
    'GAYA:',
    '- Sapaan «ayah/bunda» dan sebutan «ananda» wajib. Nada sopan, hangat, bahasa Indonesia sehari-hari yang wajar.',
    "- Salam pembuka «Assalamu'alaikum warahmatullahi wabarakatuh» dan salam penutup «Wassalamu'alaikum warahmatullahi wabarakatuh» cukup sekali, singkat.",
    '- Penutup satu kalimat saja, spesifik pada isi pengumuman. Ucapan terima kasih atau doa hanya bila sesuai TUJUAN/NADA.',
    '- Variasikan pembuka antarpengumuman; jangan memakai pola yang sama berulang.',
    '- Dilarang memakai julukan, slogan, atau gelar bernuansa gimik (mis. «detektif …», «petualang …», «agen …»).',
    '',
    'FRASA KLISE YANG DILARANG (jangan dipakai, juga turunannya):',
    '«Tidak terasa…», «semakin dekat dengan…», «agar ananda lebih tenang dan terarah», «semakin bersemangat dan percaya diri»,',
    '«pendampingan hangat/santai dari ayah/bunda», «sentuhan semangat», «kerja sama yang tulus/hangat selama ini»,',
    '«kami berharap ananda dapat… dengan baik», «mari bersama-sama…», «jazakumullahu khairan» di setiap pengumuman,',
    'serta kalimat motivasi umum yang tidak membawa informasi baru.',
    '',
    'OUTPUT: HANYA JSON dengan kunci: judul (maks 120 karakter), kontenHtml (string HTML).',
    '',
    'HTML kontenHtml:',
    '- Tag boleh: p, br, strong, em, u, ul, ol, li, h2, h3, blockquote, table, thead, tbody, tr, th, td. Tanpa style/class/script/tautan.',
    '- Jadwal atau data dengan ≥3 baris dan ≥2 kolom boleh memakai tabel; selain itu pakai daftar.',
    '- BUKAN markdown. Jangan **, #, atau - tanpa tag HTML.',
    '- Daftar wajib <ul><li>…</li></ul> atau <ol><li>…</li></ol>. Jangan menulis butir hanya sebagai <p><strong>…</strong></p>.',
    '- Tulis tag dengan karakter < > langsung (jangan &lt;p&gt;).',
    '',
    'CONTOH BENTUK SAJA — topik dan kalimat di bawah JANGAN ditiru atau dipakai ulang:',
    "<p>Assalamu'alaikum warahmatullahi wabarakatuh, ayah/bunda.</p>",
    '<p>Pengumpulan proyek kelompok kelas 5A diundur menjadi <strong>Jumat, 12 Desember</strong>. Mohon ananda membawa hasil proyek dalam keadaan siap dipresentasikan.</p>',
    '<ul><li>Poster ukuran A3</li><li>Lembar refleksi yang sudah diisi</li></ul>',
    "<p>Terima kasih. Wassalamu'alaikum warahmatullahi wabarakatuh.</p>",
  ].join('\n')

  const user = [
    `KELAS: ${kelas || '(umum)'}`,
    `MATA PELAJARAN: ${mapel || '(umum)'}`,
    tujuan ? `TUJUAN/NADA: ${tujuan}` : 'TUJUAN/NADA: informatif, ringkas, sopan',
    `VARIATION_SEED: ${variasi}`,
    '',
    '=== INFORMASI DARI GURU (sumber kebenaran — jangan menambah fakta) ===',
    informasi,
    '',
    'Susun pengumuman ringkas dan spesifik dari informasi di atas. Poin-poin wajib dalam <ul>/<ol>. Tanpa klise.',
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
