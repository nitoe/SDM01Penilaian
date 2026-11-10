/**
 * Generate AI untuk fitur Tugas LMS:
 * - kategori rubrik asesmen kinerja (4–6 aspek) dari isi tugas
 * - draf instruksi / isi tugas dari pengaturan (judul, mapel, TP, …)
 *
 * Kunci Gemini hanya di secret Cloud Functions. Deploy dari SDM01Penilaian.
 */
import { bolehPemanggilAi, MODEL_GEMINI } from './generateAi.js'

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
}

function thinkingGemini(nama) {
  if (/^gemini-2\.5-/.test(nama)) return { thinkingBudget: 0 }
  if (/^gemini-3/.test(nama)) return { thinkingLevel: 'low' }
  return undefined
}

function configGeminiJson(nama, maxOut = 4096) {
  const cfg = {
    temperature: 0.7,
    responseMimeType: 'application/json',
    maxOutputTokens: maxOut,
  }
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
        terakhir = `Gemini (${nama}) jawaban kosong.`
        if (percobaan === 0) {
          await tunggu(800)
          continue
        }
        gagal.push(`${nama} kosong`)
        break
      }
      const bersih = teks.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      try {
        return JSON.parse(bersih)
      } catch {
        terakhir = `Gemini (${nama}) JSON tidak valid.`
        if (percobaan === 0) continue
        gagal.push(`${nama} json`)
        break
      }
    }
  }
  throw new Error(
    gagal.length
      ? `Gagal memanggil Gemini (${gagal.join('; ')}). ${terakhir}`
      : terakhir,
  )
}

function idSementara() {
  return `kat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Kategori rubrik: WAJIB ada isi tugas (instruksi atau deskripsi substansial).
 */
export function susunPromptKategoriTugas(input) {
  const judul = potong(input?.judul, 200)
  const mapel = potong(input?.mapel, 80)
  const kelas = potong(input?.kelas, 10)
  const deskripsi = potong(input?.deskripsi, 1500)
  const instruksi = potong(input?.instruksi, 8000)
  const tpTeks = Array.isArray(input?.tpList)
    ? input.tpList
        .map((t) => `TP ${t.nomor || ''}: ${t.nama || ''}`.trim())
        .filter(Boolean)
        .join('\n')
    : ''

  const isi = [instruksi, deskripsi].filter((s) => s && s.length >= 20).join('\n\n')
  if (!isi || isi.length < 40) {
    return {
      ok: false,
      pesan:
        'Isi tugas belum ada atau terlalu pendek. Simpan instruksi/deskripsi di tab Isi Tugas dulu, lalu generate kategori.',
    }
  }

  const sistem = `Anda ahli asesmen kinerja Kurikulum Merdeka untuk SD di Indonesia.
Tugas Anda: merumuskan kategori/aspek RUBRIK penilaian kinerja berdasarkan ISI TUGAS yang diberikan guru.
Keluarkan HANYA JSON valid tanpa markdown.`

  const user = `Buat 4 sampai 6 kategori penilaian (aspek rubrik) yang RELEVAN dan SPESIFIK terhadap isi tugas berikut.

Aturan:
- Jumlah kategori: minimal 4, maksimal 6.
- Setiap kategori: nama singkat (2–6 kata) + deskripsi indikator 1 kalimat.
- Jangan kategori generik kosong seperti hanya "Kerapian" tanpa kaitan isi, kecuali memang inti tugas.
- Cocok untuk siswa SD kelas ${kelas || '1–6'}.
- Bahasa Indonesia.

Konteks:
- Judul: ${judul || '(tanpa judul)'}
- Mapel: ${mapel || '(umum)'}
- Kelas: ${kelas || '-'}
${tpTeks ? `- Tujuan pembelajaran:\n${tpTeks}` : ''}

ISI TUGAS (sumber utama analisis):
${isi}

Format JSON:
{"kategori":[{"nama":"...","deskripsi":"..."}, ...]}`

  return { ok: true, sistem, user }
}

export function normalisasiKategoriTugas(data) {
  const raw = Array.isArray(data?.kategori) ? data.kategori : []
  const out = []
  const seen = new Set()
  for (const k of raw) {
    const nama = potong(k?.nama, 80)
    if (!nama) continue
    const key = nama.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: idSementara(),
      nama,
      deskripsi: potong(k?.deskripsi, 300) || undefined,
    })
    if (out.length >= 6) break
  }
  if (out.length < 4) {
    throw new Error(
      `AI hanya menghasilkan ${out.length} kategori valid (minimal 4). Coba lagi atau perjelas isi tugas.`,
    )
  }
  return out
}

export async function generateKategoriTugasDenganAi(apiKey, input) {
  const prompt = susunPromptKategoriTugas(input)
  if (!prompt.ok) {
    const err = new Error(prompt.pesan)
    err.code = 'invalid-argument'
    throw err
  }
  const data = await panggilGeminiJson(apiKey, prompt.sistem, prompt.user)
  const kategori = normalisasiKategoriTugas(data)
  return { kategori }
}

/**
 * Isi tugas: WAJIB ada judul tersimpan + konteks mapel/kelas.
 */
export function susunPromptIsiTugas(input) {
  const judul = potong(input?.judul, 200)
  if (!judul || judul.length < 3) {
    return {
      ok: false,
      pesan: 'Judul tugas belum disimpan. Simpan pengaturan tugas dulu, lalu generate isi.',
    }
  }
  const mapel = potong(input?.mapel, 80)
  const mapelLain = Array.isArray(input?.mapelLain)
    ? input.mapelLain.map((m) => potong(m, 80)).filter(Boolean)
    : []
  const kelas = potong(input?.kelas, 10)
  const jenis = input?.jenis === 'proyek' ? 'proyek' : 'mapel'
  const deskripsi = potong(input?.deskripsi, 800)
  const tpTeks = Array.isArray(input?.tpList)
    ? input.tpList
        .map((t) => {
          const m = t.mapel ? ` [${t.mapel}]` : ''
          return `TP ${t.nomor || ''}${m}: ${t.nama || ''}`.trim()
        })
        .filter(Boolean)
        .join('\n')
    : ''

  const sistem = `Anda guru SD berpengalaman di Indonesia (Kurikulum Merdeka).
Tulis instruksi tugas yang jelas, ramah anak, dan operasional untuk siswa SD.
Keluarkan HANYA JSON valid.`

  const user = `Susun ISI TUGAS (instruksi lengkap) berdasarkan pengaturan berikut.

Judul (wajib diikuti): ${judul}
Jenis: ${jenis === 'proyek' ? 'proyek lintas mapel' : 'tugas satu mapel'}
Kelas: ${kelas || '-'}
Mapel utama: ${mapel || '-'}
${mapelLain.length ? `Mapel lain: ${mapelLain.join(', ')}` : ''}
${deskripsi ? `Deskripsi singkat guru: ${deskripsi}` : ''}
${tpTeks ? `Tujuan pembelajaran:\n${tpTeks}` : ''}

Instruksi harus memuat:
1. Apa yang dikerjakan siswa
2. Langkah-langkah singkat
3. Bahan/alat bila relevan
4. Cara mengumpulkan / format hasil
5. Kriteria yang dinilai (selaras TP bila ada)
Bahasa sederhana untuk SD. Panjang 120–400 kata.

Format JSON:
{"deskripsi":"ringkasan 1–2 kalimat untuk katalog","instruksi":"teks instruksi lengkap multi-paragraf"}`

  return { ok: true, sistem, user }
}

export function normalisasiIsiTugas(data) {
  const deskripsi = potong(data?.deskripsi, 500)
  const instruksi = potong(data?.instruksi, 12000)
  if (!instruksi || instruksi.length < 40) {
    throw new Error('AI tidak menghasilkan instruksi yang memadai. Coba lagi.')
  }
  return { deskripsi: deskripsi || undefined, instruksi }
}

export async function generateIsiTugasDenganAi(apiKey, input) {
  const prompt = susunPromptIsiTugas(input)
  if (!prompt.ok) {
    const err = new Error(prompt.pesan)
    err.code = 'invalid-argument'
    throw err
  }
  const data = await panggilGeminiJson(apiKey, prompt.sistem, prompt.user)
  return normalisasiIsiTugas(data)
}

export { bolehPemanggilAi }
