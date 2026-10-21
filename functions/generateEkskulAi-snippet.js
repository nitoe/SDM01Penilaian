/**
 * Tambahan untuk functions/generateAi.js + functions/index.js
 *
 * 1) Di generateAi.js, tambahkan susunPromptEkskul + normalisasiEkskul (di bawah).
 * 2) Di index.js, import keduanya dan export generateEkskulAi.
 */

// ─── functions/generateAi.js ───────────────────────────────────────────────

export function susunPromptEkskul(input) {
  const nama = potong(input.namaEkskul, 80)
  if (!nama) return { ok: false, pesan: 'Nama kegiatan ekstrakurikuler wajib.' }
  const mode = String(input.mode || 'keduanya')
  if (!['deskripsi', 'aktivitas', 'keduanya'].includes(mode)) {
    return { ok: false, pesan: 'Mode harus deskripsi, aktivitas, atau keduanya.' }
  }
  const catatan = potong(input.catatan, 500)
  const sistem = `Anda asisten kurikulum SD Muhammadiyah di Indonesia.
Tugas: menyusun usulan aktivitas dan/atau deskripsi capaian ekstrakurikuler untuk rapor SAS Kurikulum Merdeka.
Bahasa Indonesia baku, singkat, positif, cocok untuk siswa SD.
Predikat internal: C = Layak, B = Cakap, A = Mahir. Predikat TIDAK dicetak di rapor — hanya deskripsi.
Jawab HANYA JSON valid tanpa markdown.`

  let user = `Kegiatan ekstrakurikuler: "${nama}".\n`
  if (catatan) user += `Catatan tambahan dari admin: ${catatan}\n`
  user += `Mode: ${mode}.\n`
  if (mode === 'aktivitas' || mode === 'keduanya') {
    user += `Hasilkan 4–8 aktivitas/kegiatan singkat (frasa 3–10 kata) yang umum dilakukan di ekskul ini.\n`
  }
  if (mode === 'deskripsi' || mode === 'keduanya') {
    user += `Hasilkan tepat 3 deskripsi capaian (satu untuk predikat C, B, dan A).
Setiap deskripsi 1–2 kalimat (maks ~400 karakter), menggambarkan sikap/keterampilan siswa.
Contoh gaya: "Menunjukkan antusiasme dan keterampilan dasar dalam …"\n`
  }
  user += `Format JSON:
{
  "aktivitas": ["...", "..."],
  "deskripsi": [
    { "predikat": "C", "teks": "..." },
    { "predikat": "B", "teks": "..." },
    { "predikat": "A", "teks": "..." }
  ]
}
Jika mode=aktivitas, field deskripsi boleh array kosong. Jika mode=deskripsi, aktivitas boleh [].`

  return { ok: true, sistem, user, mode }
}

export function normalisasiEkskul(json, mode) {
  let data = json
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json)
    } catch {
      data = {}
    }
  }
  if (!data || typeof data !== 'object') data = {}

  const predikatSah = new Set(['C', 'B', 'A'])
  let aktivitas = []
  if (Array.isArray(data.aktivitas)) {
    aktivitas = data.aktivitas
      .map((s) => potong(s, 120))
      .filter(Boolean)
      .slice(0, 12)
  }

  let deskripsi = []
  if (Array.isArray(data.deskripsi)) {
    const seen = new Set()
    for (const item of data.deskripsi) {
      if (!item || typeof item !== 'object') continue
      const predikat = String(item.predikat || '')
        .trim()
        .toUpperCase()
      if (!predikatSah.has(predikat) || seen.has(predikat)) continue
      const teks = potong(item.teks, 500)
      if (!teks) continue
      seen.add(predikat)
      deskripsi.push({ predikat, teks })
    }
    deskripsi.sort((a, b) => 'CBA'.indexOf(a.predikat) - 'CBA'.indexOf(b.predikat))
  }

  if (mode === 'aktivitas') deskripsi = []
  if (mode === 'deskripsi') aktivitas = []

  return { aktivitas, deskripsi }
}

// ─── functions/index.js (tambah import + export) ───────────────────────────
/*
import {
  ...
  susunPromptEkskul,
  normalisasiEkskul,
} from './generateAi.js'

export const generateEkskulAi = onCall(opsiAi, async (request) => {
  const provider = pastikanAi(request)
  const prompt = susunPromptEkskul(request.data || {})
  if (!prompt.ok) throw new HttpsError('invalid-argument', prompt.pesan)
  try {
    const json = await mintaModel(provider, kunciProvider(provider), prompt.sistem, prompt.user)
    const hasil = normalisasiEkskul(json, prompt.mode)
    logger.info('generateEkskulAi', {
      uid: request.auth.uid,
      provider,
      mode: prompt.mode,
      aktivitas: hasil.aktivitas.length,
      deskripsi: hasil.deskripsi.length,
    })
    return hasil
  } catch (err) {
    logger.error('generateEkskulAi gagal', { pesan: err?.message })
    throw new HttpsError('internal', err?.message || 'Gagal menyusun usulan ekstrakurikuler.')
  }
})
*/
