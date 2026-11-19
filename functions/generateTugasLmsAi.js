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
Tugas Anda: merumuskan kategori/aspek RUBRIK penilaian kinerja DAN daftar BUKTI foto yang perlu dikumpulkan siswa, berdasarkan ISI TUGAS dari guru.
Penilaian harus melihat PROSES, bukan hanya laporan akhir: persiapan, pelaksanaan, dan hasil akhir.
Keluarkan HANYA JSON valid tanpa markdown.`

  const user = `Buat 4 sampai 6 kategori penilaian (aspek rubrik) yang RELEVAN dan SPESIFIK terhadap isi tugas berikut, lalu susun bukti foto yang mendukungnya.

Aturan kategori:
- Jumlah kategori: minimal 4, maksimal 6. Nama singkat (2–6 kata) + deskripsi indikator 1 kalimat.
- Sebar kategori pada tiga tahap: "persiapan" (mis. menyiapkan alat/bahan, memahami langkah), "pelaksanaan" (proses mengerjakan/mengukur/mengamati) dan "hasil" (produk/laporan/refleksi). Bila tugas memang tidak punya salah satu tahap, boleh dilewati, tetapi JANGAN semua kategori berada di tahap "hasil".
- Jangan kategori generik kosong seperti hanya "Kerapian" tanpa kaitan isi, kecuali memang inti tugas.
- Cocok untuk siswa SD kelas ${kelas || '1–6'}. Bahasa Indonesia.
- Setiap kategori punya "sumber": "bukti" bila dapat dilihat dari foto/hasil tulisan siswa; "observasi" bila hanya tampak saat guru mengamati atau bertanya langsung (mis. sikap, kerja sama, penjelasan lisan).

Aturan bukti:
- Maksimal 6 bukti; satu bukti = satu foto. Gabungkan kategori yang buktinya sama ke satu bukti (mis. laporan akhir untuk struktur laporan, bahasa, dan refleksi) — jangan membuat bukti duplikat.
- Utamakan bukti PROSES yang sulit dipalsukan: foto catatan data mentah tulisan tangan saat kegiatan, foto saat siswa melakukan kegiatan (cukup tangan/alat, tidak wajib memperlihatkan wajah anak), selain foto laporan akhir.
- Label bukti ≤ 8 kata. Petunjuk 1 kalimat: apa yang harus terlihat jelas di foto.
- Setiap kategori bersumber "bukti" harus tertaut ke tepat satu bukti lewat "buktiKey". Kategori "observasi" tidak punya buktiKey.
- Setiap bukti punya "tahap" (persiapan/pelaksanaan/hasil) dan "wajib" (true/false).

Konteks:
- Judul: ${judul || '(tanpa judul)'}
- Mapel: ${mapel || '(umum)'}
- Kelas: ${kelas || '-'}
${tpTeks ? `- Tujuan pembelajaran:\n${tpTeks}` : ''}

ISI TUGAS (sumber utama analisis):
${isi}

Format JSON:
{"kategori":[{"nama":"...","deskripsi":"...","tahap":"persiapan|pelaksanaan|hasil","sumber":"bukti|observasi","buktiKey":"b1"}],
 "bukti":[{"key":"b1","label":"...","petunjuk":"...","tahap":"persiapan|pelaksanaan|hasil","wajib":true}]}`

  return { ok: true, sistem, user }
}

const TAHAP_VALID = new Set(['persiapan', 'pelaksanaan', 'hasil'])

function tahapValid(t) {
  const x = typeof t === 'string' ? t.trim().toLowerCase() : ''
  return TAHAP_VALID.has(x) ? x : undefined
}

/**
 * Hasil: { kategori: [{id,nama,deskripsi,tahap?,sumber}], bukti: [{label,petunjuk?,tahap?,wajib,kategoriIds}] }.
 * `kategori` minimal 4 (aturan lama). `bukti` boleh kosong; maksimal 6 (batas slot foto rules LMS).
 * Kategori «bukti» tanpa buktiKey valid tetap dikembalikan (klien memperingatkan guru).
 */
export function normalisasiKategoriTugas(data) {
  const raw = Array.isArray(data?.kategori) ? data.kategori : []
  const rawBukti = Array.isArray(data?.bukti) ? data.bukti : []

  const bukti = []
  const petaKey = new Map()
  const seenBukti = new Set()
  for (const b of rawBukti) {
    const label = potong(b?.label, 120)
    const key = potong(b?.key, 40)
    if (!label || !key) continue
    const lk = label.toLowerCase()
    if (seenBukti.has(lk) || petaKey.has(key)) continue
    seenBukti.add(lk)
    const item = {
      label,
      wajib: b?.wajib !== false,
      kategoriIds: [],
    }
    const petunjuk = potong(b?.petunjuk, 300)
    if (petunjuk) item.petunjuk = petunjuk
    const tahap = tahapValid(b?.tahap)
    if (tahap) item.tahap = tahap
    petaKey.set(key, item)
    bukti.push(item)
    if (bukti.length >= 6) break
  }

  const out = []
  const seen = new Set()
  for (const k of raw) {
    const nama = potong(k?.nama, 80)
    if (!nama) continue
    const keyNama = nama.toLowerCase()
    if (seen.has(keyNama)) continue
    seen.add(keyNama)
    const sumber = k?.sumber === 'observasi' ? 'observasi' : 'bukti'
    const kat = {
      id: idSementara(),
      nama,
      deskripsi: potong(k?.deskripsi, 300) || undefined,
      sumber,
    }
    const tahap = tahapValid(k?.tahap)
    if (tahap) kat.tahap = tahap
    if (sumber === 'bukti') {
      const tertaut = petaKey.get(potong(k?.buktiKey, 40))
      if (tertaut) tertaut.kategoriIds.push(kat.id)
    }
    out.push(kat)
    if (out.length >= 6) break
  }
  if (out.length < 4) {
    throw new Error(
      `AI hanya menghasilkan ${out.length} kategori valid (minimal 4). Coba lagi atau perjelas isi tugas.`,
    )
  }
  // Bukti tanpa kategori tertaut tidak berguna bagi penilaian: buang.
  return { kategori: out, bukti: bukti.filter((b) => b.kategoriIds.length > 0) }
}

export async function generateKategoriTugasDenganAi(apiKey, input) {
  const prompt = susunPromptKategoriTugas(input)
  if (!prompt.ok) {
    const err = new Error(prompt.pesan)
    err.code = 'invalid-argument'
    throw err
  }
  const data = await panggilGeminiJson(apiKey, prompt.sistem, prompt.user)
  const { kategori, bukti } = normalisasiKategoriTugas(data)
  return { kategori, bukti }
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
