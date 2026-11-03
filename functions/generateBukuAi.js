/**
 * Generate metadata buku + sampul untuk aplikasi Perpustakaan.
 * Dipanggil dari Cloud Functions (GEMINI_API_KEY di secrets, tidak di frontend).
 */

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
}

export const MODEL_BUKU = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']
export const MODEL_SAMPUL = 'gemini-3.1-flash-lite-image'

function thinkingGemini(nama) {
  if (/^gemini-2\.5-/.test(nama)) return { thinkingBudget: 0 }
  if (/^gemini-3/.test(nama)) return { thinkingLevel: 'low' }
  return undefined
}

function ambilJson(teks) {
  const t = String(teks || '').trim()
  const mulai = t.indexOf('{')
  const akhir = t.lastIndexOf('}')
  if (mulai < 0 || akhir <= mulai) throw new Error('Jawaban AI bukan JSON yang valid.')
  return JSON.parse(t.slice(mulai, akhir + 1))
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {string} apiKey
 * @param {string} sistem
 * @param {string} user
 */
export async function mintaModelBuku(apiKey, sistem, user) {
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diatur di Cloud Functions.')
  const gagal = []
  let terakhir = 'Gemini tidak menjawab.'

  for (const nama of MODEL_BUKU) {
    for (let percobaan = 0; percobaan < 2; percobaan++) {
      const generationConfig = {
        temperature: 0.3,
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
      }
      const thinking = thinkingGemini(nama)
      if (thinking) generationConfig.thinkingConfig = thinking

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistem }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig,
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
        terakhir =
          `Gemini (${nama}) mengembalikan jawaban kosong` +
          (kandidat?.finishReason ? ` (${kandidat.finishReason}).` : '.')
        gagal.push(`${nama} kosong`)
        break
      }
      return ambilJson(teks)
    }
  }
  throw new Error(gagal.length > 1 ? `${terakhir} (percobaan: ${gagal.join(', ')})` : terakhir)
}

/**
 * Generate gambar sampul. Mengembalikan data URL JPEG/PNG.
 * @param {string} apiKey
 * @param {string} prompt
 */
export async function mintaSampulBuku(apiKey, prompt) {
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diatur di Cloud Functions.')
  const nama = MODEL_SAMPUL
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          // 3:4 mirip sampul buku; 1K didukung lite-image
          imageConfig: { aspectRatio: '3:4', imageSize: '1K' },
        },
      }),
    },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Gemini sampul (${nama}) ${res.status}: ${json?.error?.message || 'gagal'}`)
  }
  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data
    if (inline?.data) {
      const mime = inline.mimeType || inline.mime_type || 'image/png'
      return `data:${mime};base64,${inline.data}`
    }
  }
  throw new Error('Gemini tidak mengembalikan gambar sampul.')
}

/** Validasi + susun prompt metadata dari judul (dan opsional ISBN). */
export function susunPromptBukuMeta(input) {
  const judul = potong(input?.judul, 300)
  if (judul.length < 2) return { ok: false, pesan: 'Judul minimal 2 huruf.' }
  const isbn = potong(input?.isbn, 20).replace(/[^0-9Xx-]/g, '')

  const sistem = `Anda asisten katalog perpustakaan sekolah dasar di Indonesia.
Tugas: isi metadata bibliografi sebaik mungkin dari judul (dan ISBN bila ada).
Aturan ketat:
- Jawab HANYA JSON valid tanpa markdown dan tanpa penjelasan.
- Jangan mengarang ISBN. Jika tidak yakin, biarkan isbn string kosong.
- Sinopsis singkat (2–4 kalimat), netral, cocok untuk katalog sekolah.
- Bahasa: "Indonesia" atau "Inggris" atau nama bahasa lain yang relevan.
- Jenjang baca contoh: "Kelas 1-2", "Kelas 3-4", "Kelas 5-6", "Guru", atau kosong.
- Tahun hanya angka 4 digit bila diketahui; jika tidak yakin null.
- Pengarang dan penerbit: isi bila umum diketahui; jika tidak yakin string kosong.
- Jangan menambah field di luar skema.`

  const user = `Judul buku: ${judul}
${isbn ? `ISBN (petunjuk, boleh dikoreksi jika salah): ${isbn}` : 'ISBN: (tidak ada)'}

Format JSON wajib:
{"judul":"...","pengarang":"...","penerbit":"...","tahun":null,"isbn":"","sinopsis":"...","bahasa":"Indonesia","jenjangBaca":""}`

  return { ok: true, sistem, user, judul }
}

export function normalisasiBukuMeta(data, judulFallback) {
  const src = data && typeof data === 'object' ? data : {}
  const judulOut =
    typeof src.judul === 'string' && src.judul.trim() ? potong(src.judul, 300) : potong(judulFallback, 300)
  const pengarang =
    typeof src.pengarang === 'string' && src.pengarang.trim() ? potong(src.pengarang, 200) : undefined
  const penerbit =
    typeof src.penerbit === 'string' && src.penerbit.trim() ? potong(src.penerbit, 200) : undefined
  let tahun
  if (typeof src.tahun === 'number' && src.tahun >= 1000 && src.tahun <= 2100) tahun = src.tahun
  else if (typeof src.tahun === 'string') {
    const y = Number(String(src.tahun).replace(/\D/g, '').slice(0, 4))
    if (y >= 1000 && y <= 2100) tahun = y
  }
  const isbnRaw = typeof src.isbn === 'string' ? src.isbn.replace(/[^0-9Xx]/g, '') : ''
  const isbn = isbnRaw.length >= 10 ? isbnRaw : undefined
  const sinopsis =
    typeof src.sinopsis === 'string' && src.sinopsis.trim() ? potong(src.sinopsis, 2000) : undefined
  const bahasa =
    typeof src.bahasa === 'string' && src.bahasa.trim() ? potong(src.bahasa, 40) : 'Indonesia'
  const jenjangBaca =
    typeof src.jenjangBaca === 'string' && src.jenjangBaca.trim()
      ? potong(src.jenjangBaca, 40)
      : undefined

  return {
    judul: judulOut,
    pengarang,
    penerbit,
    tahun,
    isbn,
    sinopsis,
    bahasa,
    jenjangBaca,
    sumber: 'gemini',
  }
}

/** Prompt sampul buku anak / sekolah. */
export function susunPromptSampul(input) {
  const judul = potong(input?.judul, 200)
  if (judul.length < 2) return { ok: false, pesan: 'Judul minimal 2 huruf untuk membuat sampul.' }
  const pengarang = potong(input?.pengarang, 100)
  const prompt = `Buat sampul buku anak sekolah Indonesia yang rapi dan profesional.
Judul: "${judul}"${pengarang ? `\nPengarang: ${pengarang}` : ''}
Gaya: ilustrasi cerah, ramah anak, komposisi vertikal (portrait), teks judul terbaca jelas di bagian atas, tanpa logo merek, tanpa watermark teks tambahan, tanpa QR code.
Latar sederhana, fokus pada tema judul.`
  return { ok: true, prompt }
}
