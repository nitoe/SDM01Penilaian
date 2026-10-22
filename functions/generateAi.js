/** Logika murni generate TP/KKTP + generate aset dari foto (vision). */

export const UID_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
/** Email akun pemilik TP/KKTP; dicek BERSAMA UID. Harus sama dengan src/lib/generateAi.ts. */
export const EMAIL_AI = 'arif.azwar79@gmail.com'

/** Akun yang boleh generate data aset dari foto (Sarpras). UID + email harus cocok. */
export const AKUN_AI_ASET = [
  { uid: '2rAXEqFfWDRqxRTY21PV4h9tC5F2', email: 'arif.nitoe@gmail.com' },
  { uid: 'v4fQXsqCzYUtHrqcDM0u48sxIfn1', email: 'arif.azwar79@gmail.com' },
]

const LABEL = {
  pengetahuan: ['Perlu Bimbingan', 'Cukup', 'Baik', 'Sangat Baik'],
  kinerja: ['Mulai Berkembang', 'Layak', 'Cakap', 'Mahir'],
}

export function bolehUidAi(uid) {
  return uid === UID_AI
}

export function bolehPemanggilAi(auth) {
  if (!auth || typeof auth.uid !== 'string') return false
  if (!bolehUidAi(auth.uid)) return false
  const email = String(auth.token?.email ?? '').trim().toLowerCase()
  return email === EMAIL_AI
}

export function bolehPemanggilAiAset(auth) {
  if (!auth || typeof auth.uid !== 'string') return false
  const email = String(auth.token?.email ?? '').trim().toLowerCase()
  return AKUN_AI_ASET.some((a) => a.uid === auth.uid && a.email === email)
}

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
}

/** Nama mapel IPAS (singkat atau panjang). */
function adalahMapelIpas(mapel) {
  const n = String(mapel || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  if (!n) return false
  if (n === 'ipas') return true
  if (n.includes('ilmu pengetahuan alam') && n.includes('sosial')) return true
  return false
}

/**
 * Pecah teks Pemahaman IPAS yang dipisah tanda baca ;
 * Unit terakhir sering diawali "serta ".
 */
export function pisahUnitPemahamanIpas(teks) {
  const t = String(teks || '').trim()
  if (!t) return []
  return t
    .split(';')
    .map((u) => u.replace(/^\s*serta\s+/i, '').trim())
    .filter((u) => u.length > 0)
}

/** Apakah elemen CP adalah keterampilan proses IPAS (bukan sasaran isi). */
function adalahElemenKeterampilanProses(elemen) {
  const e = String(elemen || '').trim().toLowerCase()
  return e.includes('keterampilan proses')
}

/**
 * Prompt khusus IPAS.
 * - Pemahaman IPAS = sasaran isi (satu unit atau beberapa unit dipisah ;).
 * - Keterampilan Proses = cara mencapai pemahaman; tidak boleh jadi TP mandiri.
 * - Setiap TP memadukan satu unit pemahaman + tahap proses yang relevan.
 */
function susunPromptTpIpas(input, mapel, kelas, fase, elemen, teks, disiplin) {
  const proses = potong(input.keterampilanProses, 6000)
  const unitEksplisit = potong(input.pemahamanUnit, 2000)
  const elemenProses = adalahElemenKeterampilanProses(elemen)

  // Generate hanya dari elemen Keterampilan Proses → tolak (bukan sasaran isi)
  if (elemenProses && !unitEksplisit) {
    return {
      ok: false,
      pesan:
        'Untuk IPAS, Keterampilan Proses tidak digenerate sebagai TP mandiri. Pilih unit Pemahaman IPAS; proses dipakai untuk mencapai pemahaman itu.',
    }
  }

  const units = unitEksplisit ? [unitEksplisit] : pisahUnitPemahamanIpas(teks)
  const jumlahUnit = units.length
  const satuUnit = jumlahUnit <= 1

  const daftarUnit =
    jumlahUnit > 1
      ? units.map((u, i) => `${i + 1}. ${u}`).join('\n')
      : units[0] || teks

  const tahapBaku =
    fase === 'C'
      ? [
          'Mengamati — mencatat, mencari persamaan dan perbedaan',
          'Mempertanyakan dan Memprediksi — pertanyaan ilmiah + prediksi',
          'Merencanakan dan Melakukan Penyelidikan — mandiri, alat ukur sederhana',
          'Memproses serta Menganalisis Data dan Informasi — tabel/grafik, bukti',
          'Mengevaluasi dan Refleksi — saran perbaikan penyelidikan',
          'Mengomunikasikan Hasil — utuh dengan argumen',
        ].join('; ')
      : [
          'Mengamati — pengamatan sederhana + mencatat',
          'Mempertanyakan dan Memprediksi — pertanyaan mandiri + prediksi',
          'Merencanakan dan Melakukan Penyelidikan — dengan panduan pendidik',
          'Memproses, Menganalisis Data dan Informasi — turus/diagram, banding prediksi',
          'Mengevaluasi dan Refleksi — refleksi penyelidikan',
          'Mengomunikasikan Hasil — lisan dan tertulis',
        ].join('; ')

  const sistem = [
    'Anda merumuskan Tujuan Pembelajaran (TP) untuk mapel IPAS (Ilmu Pengetahuan Alam dan Sosial) SD Kurikulum Merdeka.',
    'IPAS punya dua elemen yang TIDAK setara: (1) Pemahaman IPAS = sasaran isi/materi; (2) Keterampilan Proses = cara ilmiah mencapai pemahaman itu.',
    'Jangan membuat TP yang hanya melatih keterampilan proses tanpa sasaran pemahaman isi.',
    'Pemahaman IPAS sering berupa beberapa unit materi dalam satu paragraf, dipisahkan tanda baca titik koma (;). Setiap unit materi = satu lingkup isi yang berdiri sendiri.',
    satuUnit
      ? 'Input berisi SATU unit pemahaman. Hasilkan TEPAT 1 TP untuk unit itu.'
      : `Input berisi ${jumlahUnit} unit pemahaman (sudah diurutkan). Hasilkan TEPAT satu TP per unit (total ${jumlahUnit} TP), urut sama dengan daftar unit. Jangan menggabungkan dua unit berbeda dalam satu TP.`,
    'Untuk setiap TP: pilih 1 sampai 3 tahap Keterampilan Proses yang paling sesuai untuk mencapai unit pemahaman tersebut, lalu rumuskan nama TP yang memadukan proses + isi dalam satu kalimat operasional.',
    'Contoh gaya nama TP: "Melalui pengamatan dan pencatatan, murid menjelaskan bentuk dan fungsi pancaindra." — proses tersirat di awal, pemahaman di predikat.',
    'Nama TP: bahasa Indonesia, satu kalimat, terukur, sesuai fase dan kelas. Jangan menyalin utuh teks CP sebagai nama TP. Jangan mengubah makna CP resmi.',
    'tipe: "kinerja" bila unjuk kerja/pengamatan/penyelidikan/produk dominan; "pengetahuan" bila penekanan utama pada konsep/penjelasan tanpa unjuk kerja kuat.',
    'bobotSlm dan bobotSas bilangan bulat, jumlah tepat 100. Default 60 dan 40 bila tidak ada alasan kuat.',
    'Balas HANYA JSON: {"tp":[{"namaTp":"...","tipe":"kinerja","bobotSlm":60,"bobotSas":40}]}',
    satuUnit
      ? 'Array tp berisi tepat 1 objek.'
      : `Array tp berisi tepat ${jumlahUnit} objek, urut unit 1 sampai ${jumlahUnit}.`,
  ].join(' ')

  const user = [
    `Mapel: ${mapel}`,
    disiplin ? `Disiplin seni: ${disiplin}` : '',
    `Kelas: ${kelas}`,
    `Fase: ${fase}`,
    `Elemen yang dipilih: ${elemen}`,
    '',
    satuUnit
      ? 'Unit Pemahaman IPAS (sasaran isi, jangan diubah maknanya):'
      : 'Daftar unit Pemahaman IPAS (satu TP per baris, jangan diubah maknanya):',
    daftarUnit,
    '',
    'Kerangka Keterampilan Proses fase ini (bukan sasaran TP mandiri — pilih tahap yang relevan per unit):',
    proses || tahapBaku,
  ]
    .filter((baris) => baris !== '')
    .join('\n')

  return { ok: true, sistem, user }
}

export function susunPromptTp(input) {
  const mapel = potong(input.mapel, 80)
  const kelas = potong(input.kelas, 8)
  const fase = input.fase === 'A' || input.fase === 'B' || input.fase === 'C' ? input.fase : ''
  const elemen = potong(input.elemen, 120)
  const teks = potong(input.teksCp, 6000)
  const disiplin = potong(input.disiplinSeni, 40)
  if (!mapel || !kelas || !fase || !elemen || !teks) {
    return { ok: false, pesan: 'Data capaian pembelajaran tidak lengkap.' }
  }

  if (adalahMapelIpas(mapel)) {
    return susunPromptTpIpas(input, mapel, kelas, fase, elemen, teks, disiplin)
  }

  const sistem = [
    'Anda merumuskan Tujuan Pembelajaran (TP) SD Kurikulum Merdeka untuk satu elemen Capaian Pembelajaran.',
    'Jumlah TP ditentukan oleh analisis Anda: pisahkan hanya bila CP memuat kompetensi yang berbeda, tingkat kompleksitas berbeda, atau materi yang berdiri sendiri.',
    'Jangan memotong, memperpanjang, atau mengubah teks CP. Jangan menyalin ulang teks CP sebagai nama TP.',
    'Nama TP operasional, terukur, sesuai fase dan kelas, bahasa Indonesia, satu kalimat.',
    'tipe: "pengetahuan" bila kognitif/konsep, "kinerja" bila unjuk kerja/praktik/produk.',
    'bobotSlm dan bobotSas bilangan bulat, jumlah tepat 100. Default 60 dan 40 bila tidak ada alasan kuat.',
    'Balas HANYA JSON: {"tp":[{"namaTp":"...","tipe":"pengetahuan","bobotSlm":60,"bobotSas":40}]}',
    'Minimal 1 TP, maksimal 6.',
  ].join(' ')
  const user = [
    `Mapel: ${mapel}`,
    disiplin ? `Disiplin seni: ${disiplin}` : '',
    `Kelas: ${kelas}`,
    `Fase: ${fase}`,
    `Elemen: ${elemen}`,
    'Teks CP resmi (jangan diubah):',
    teks,
  ]
    .filter(Boolean)
    .join('\n')
  return { ok: true, sistem, user }
}

export function faseDariKelas(kelas) {
  const n = parseInt(String(kelas ?? '').replace(/[^0-9]/g, ''), 10)
  if (n === 1 || n === 2) return 'A'
  if (n === 3 || n === 4) return 'B'
  if (n === 5 || n === 6) return 'C'
  return ''
}

export function susunPromptKktp(input) {
  const namaTp = potong(input.namaTp, 500)
  const tipe = input.tipe === 'kinerja' ? 'kinerja' : 'pengetahuan'
  const teks = potong(input.teksCp, 6000)
  const mapel = potong(input.mapel, 80)
  const kelas = potong(input.kelas, 8)
  if (!namaTp) return { ok: false, pesan: 'Nama TP wajib diisi sebelum menyusun KKTP.' }
  const label = LABEL[tipe]
  const fase = faseDariKelas(kelas)
  const tingkat = fase ? `kelas ${kelas} (Fase ${fase})` : kelas ? `kelas ${kelas}` : 'kelas ini'
  const sistem = [
    'Anda menyusun deskripsi KKTP (4 level) untuk satu Tujuan Pembelajaran SD Kurikulum Merdeka.',
    'KKTP adalah dokumen guru: bahasa formal-profesional tetapi jernih dan konkret, bukan bahasa anak-anak.',
    'Balas HANYA JSON: {"deskripsi":["...","...","...","..."]} berisi tepat 4 string, urut dari level 1 sampai 4.',
    `1. ${label[0]}; 2. ${label[1]}; 3. ${label[2]}; 4. ${label[3]} untuk ${tingkat}.`,
    'DILARANG memakai subjek "Peserta didik", "siswa", "murid", atau "ananda" di awal deskripsi.',
    'CONTOH YANG SALAH: "Peserta didik mampu membuat diagram batang."',
    'CONTOH YANG BENAR (fragmen, huruf awal kecil): "membuat diagram batang yang rapi dan akurat."',
    'Setiap string adalah FRAGMEN yang disambung di rapor setelah frasa "… dalam …", jadi WAJIB diawali huruf kecil; 1–2 kalimat pendek; hindari kata pengisi dan jargon; kenaikan level bukan loncatan drastis.',
    'Jangan diawali predikat level (Perlu bimbingan/Baik/Sangat baik).',
  ].join(' ')
  const user = [
    `Mapel: ${mapel}`,
    `Kelas: ${kelas}${fase ? ` (Fase ${fase})` : ''}`,
    `TP: ${namaTp}`,
    `Jenis: ${tipe}`,
    teks ? `CP resmi terkait:\n${teks}` : '',
  ].filter(Boolean).join('\n')
  return { ok: true, sistem, user, tipe }
}

function ambilJson(teks) {
  const t = String(teks ?? '').trim()
  const pagar = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  const calon = pagar ? pagar[1] : t
  const mulai = calon.indexOf('{')
  const akhir = calon.lastIndexOf('}')
  if (mulai < 0 || akhir <= mulai) throw new Error('AI tidak mengembalikan JSON.')
  return JSON.parse(calon.slice(mulai, akhir + 1))
}

export function normalisasiTp(data) {
  const list = Array.isArray(data?.tp) ? data.tp : []
  const keluar = []
  // IPAS Fase B bisa 11 unit pemahaman → longgarkan batas (mapel lain tetap jarang >6)
  for (const item of list.slice(0, 12)) {
    const namaTp = potong(item?.namaTp, 400)
    if (!namaTp) continue
    const tipe = item?.tipe === 'kinerja' ? 'kinerja' : 'pengetahuan'
    let bobotSlm = Number(item?.bobotSlm)
    let bobotSas = Number(item?.bobotSas)
    if (!Number.isFinite(bobotSlm) || !Number.isFinite(bobotSas) || bobotSlm + bobotSas !== 100) {
      bobotSlm = 60
      bobotSas = 40
    }
    keluar.push({ namaTp, tipe, bobotSlm, bobotSas })
  }
  if (!keluar.length) throw new Error('AI tidak menghasilkan TP yang valid.')
  return keluar
}

const SUBJEK_AWAL = /^(?:peserta\s+didik|siswa|murid|anak\s+didik|ananda)\b[\s,]*/i
const MODAL_AWAL = /^(?:mampu|dapat|bisa)\s+/i

export function bersihkanSubjekKktp(teks) {
  const asli = String(teks ?? '').trim()
  if (!SUBJEK_AWAL.test(asli)) return asli
  const sisa = asli.replace(SUBJEK_AWAL, '').replace(MODAL_AWAL, '').trim()
  if (!sisa) return asli
  // Huruf pertama kecil: fragmen ini disambung di rapor setelah "… dalam …"
  // (lihat kalimatCapaian / fragmenCapaian). Kapital di sini membuat kapital di tengah kalimat.
  return sisa.charAt(0).toLowerCase() + sisa.slice(1)
}

export function normalisasiKktp(data) {
  const list = Array.isArray(data?.deskripsi) ? data.deskripsi : []
  const keluar = list.slice(0, 4).map((d) => bersihkanSubjekKktp(potong(d, 500)))
  if (keluar.length !== 4 || keluar.some((d) => !d)) {
    throw new Error('AI harus mengembalikan tepat 4 deskripsi KKTP.')
  }
  return keluar
}

/**
 * Daftar model Gemini, urut prioritas. Model lama sudah dimatikan Google (404):
 * gemini-1.5-flash (lama), gemini-2.0-flash (1 Jun 2026), gemini-2.5-flash (16 Okt 2026).
 * Jangan memasukkan model yang sudah pensiun; cek https://ai.google.dev/gemini-api/docs/deprecations
 */
export const MODEL_GEMINI = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']

/** Model 2.5 dan 3.x memakai token "berpikir" yang ikut memakan maxOutputTokens → JSON bisa terpotong. Tekan untuk keluaran JSON. */
function thinkingGemini(nama) {
  if (/^gemini-2\.5-/.test(nama)) return { thinkingBudget: 0 }
  if (/^gemini-3/.test(nama)) return { thinkingLevel: 'low' }
  return undefined
}

function configGemini(nama) {
  const cfg = { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 8192 }
  const thinking = thinkingGemini(nama)
  if (thinking) cfg.thinkingConfig = thinking
  return cfg
}

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms))

async function panggilGemini(apiKey, sistem, user) {
  const gagal = []
  let terakhir = 'Gemini tidak menjawab.'
  for (const nama of MODEL_GEMINI) {
    // Beban/kuota sesaat (429/500/503): coba ulang sekali pada model yang sama, lalu lanjut ke model berikutnya.
    for (let percobaan = 0; percobaan < 2; percobaan++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistem }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: configGemini(nama),
          }),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        terakhir = `Gemini (${nama}) ${res.status}: ${json?.error?.message || 'gagal'}`
        if (res.status === 404) { gagal.push(`${nama} 404`); break }
        if ([429, 500, 503].includes(res.status)) {
          if (percobaan === 0) { await tunggu(1500); continue }
          gagal.push(`${nama} ${res.status}`)
          break
        }
        throw new Error(terakhir)
      }
      const kandidat = json?.candidates?.[0]
      const teks = kandidat?.content?.parts?.map((p) => p.text || '').join('') || ''
      if (!teks) {
        terakhir = `Gemini (${nama}) mengembalikan jawaban kosong` + (kandidat?.finishReason ? ` (${kandidat.finishReason}).` : '.')
        gagal.push(`${nama} kosong`)
        break
      }
      if (kandidat?.finishReason === 'MAX_TOKENS') {
        terakhir = `Gemini (${nama}) terpotong (MAX_TOKENS).`
        gagal.push(`${nama} MAX_TOKENS`)
        break
      }
      return teks
    }
  }
  // Pesan menyebut SEMUA model yang gagal, bukan hanya yang terakhir, supaya sebab sebenarnya tidak tertutup.
  throw new Error(gagal.length > 1 ? `${terakhir} (percobaan: ${gagal.join(', ')})` : terakhir)
}

async function panggilOpenAi(apiKey, sistem, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sistem },
        { role: 'user', content: user },
      ],
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `OpenAI ${res.status}`)
  const teks = json?.choices?.[0]?.message?.content || ''
  if (!teks) throw new Error('OpenAI mengembalikan jawaban kosong.')
  return teks
}

export async function mintaModel(provider, apiKey, sistem, user) {
  if (!apiKey) {
    throw new Error(provider === 'openai' ? 'OPENAI_API_KEY belum diatur di Cloud Functions.' : 'GEMINI_API_KEY belum diatur di Cloud Functions.')
  }
  const teks = provider === 'openai' ? await panggilOpenAi(apiKey, sistem, user) : await panggilGemini(apiKey, sistem, user)
  return ambilJson(teks)
}

async function panggilGeminiVision(apiKey, sistem, user, b64, mime) {
  let terakhir = 'Gemini tidak menjawab.'
  for (const nama of MODEL_GEMINI) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistem }] },
          contents: [{
            role: 'user',
            parts: [
              { text: user },
              { inlineData: { mimeType: mime, data: b64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            maxOutputTokens: 2048,
            ...(thinkingGemini(nama) ? { thinkingConfig: thinkingGemini(nama) } : {}),
          },
        }),
      },
    )
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      terakhir = json?.error?.message || `Gemini ${res.status}`
      if (res.status === 404) continue
      throw new Error(terakhir)
    }
    const teks = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
    if (!teks) { terakhir = 'Gemini mengembalikan jawaban kosong.'; continue }
    return teks
  }
  throw new Error(terakhir)
}

async function panggilOpenAiVision(apiKey, sistem, user, b64, mime) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sistem },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `OpenAI ${res.status}`)
  const teks = json?.choices?.[0]?.message?.content || ''
  if (!teks) throw new Error('OpenAI mengembalikan jawaban kosong.')
  return teks
}

export async function mintaModelVision(provider, apiKey, sistem, user, imageBase64, mimeType) {
  if (!apiKey) {
    throw new Error(provider === 'openai' ? 'OPENAI_API_KEY belum diatur di Cloud Functions.' : 'GEMINI_API_KEY belum diatur di Cloud Functions.')
  }
  const mime = mimeType && String(mimeType).startsWith('image/') ? mimeType : 'image/jpeg'
  const b64 = String(imageBase64 || '').replace(/^data:image\/[^;]+;base64,/, '')
  if (!b64 || b64.length < 100) throw new Error('Foto tidak valid atau terlalu kecil.')
  if (b64.length > 400000) throw new Error('Foto terlalu besar untuk AI. Kompres dulu.')
  const teks = provider === 'openai'
    ? await panggilOpenAiVision(apiKey, sistem, user, b64, mime)
    : await panggilGeminiVision(apiKey, sistem, user, b64, mime)
  return ambilJson(teks)
}

export function susunPromptAset(input) {
  const kategori = Array.isArray(input.kategori) ? input.kategori.slice(0, 40) : []
  const sumber = Array.isArray(input.sumber) ? input.sumber.slice(0, 20) : []
  const ruang = Array.isArray(input.ruang) ? input.ruang.slice(0, 80) : []
  const daftarKat = kategori.map((k) => `${k.kode}:${k.nama}`).join(', ')
    || 'MBL:Mebel, ELK:Elektronik, OLR:Alat olahraga, PRG:Alat peraga, BUK:Buku, KND:Kendaraan, BGN:Bangunan, LNY:Lainnya'
  const daftarSum = sumber.map((s) => s.kode || s).join(', ') || 'BOS, Yayasan, Hibah, Wakaf, Lainnya'
  const daftarRuang = ruang.map((r) => `${r.id}|${r.kode}|${r.nama}`).join('\n') || '(tidak ada daftar ruang)'
  const sistem = [
    'Anda asisten inventaris sarana prasarana SD Muhammadiyah 01 Kukusan.',
    'Amati foto barang/peralatan sekolah dan isi data aset dalam bahasa Indonesia.',
    'Balas HANYA JSON objek dengan kunci: nama, kategori, kondisi, jumlah, tahun, sumber, catatan.',
    'nama: nama barang singkat jelas (contoh: "Meja siswa kayu", "Proyektor Epson").',
    `kategori: salah satu KODE dari daftar: ${daftarKat}. Pilih yang paling dekat.`,
    'kondisi: "baik" | "rusak_ringan" | "rusak_berat" sesuai tampak di foto.',
    'jumlah: bilangan bulat unit yang terlihat (minimal 1).',
    'tahun: tahun perolehan jika terbaca di label/barang, atau null.',
    `sumber: salah satu dari [${daftarSum}] atau null jika tidak diketahui.`,
    'catatan: detail tambahan singkat (merek, warna, kondisi khusus) atau string kosong.',
    'Jangan mengarang merek/tahun yang tidak terlihat. Jika ragu, pakai null atau string kosong.',
  ].join(' ')
  const user = [
    'Isi data inventaris dari foto ini.',
    'Daftar ruang (id|kode|nama) bila relevan untuk konteks saja — jangan wajib isi ruangId:',
    daftarRuang,
  ].join('\n')
  return { ok: true, sistem, user }
}

export function normalisasiAset(data, daftarKategori, daftarSumber) {
  const nama = potong(data?.nama, 120)
  if (!nama) throw new Error('AI tidak mengenali nama barang.')
  const kodeKat = potong(data?.kategori, 12).toUpperCase()
  const katValid = Array.isArray(daftarKategori) && daftarKategori.length
    ? daftarKategori.map((k) => String(k.kode || k).toUpperCase())
    : ['MBL', 'ELK', 'OLR', 'PRG', 'BUK', 'KND', 'BGN', 'LNY']
  const kategori = katValid.includes(kodeKat) ? kodeKat : (katValid.includes('LNY') ? 'LNY' : katValid[0])
  let kondisi = String(data?.kondisi || 'baik')
  if (!['baik', 'rusak_ringan', 'rusak_berat'].includes(kondisi)) kondisi = 'baik'
  let jumlah = parseInt(data?.jumlah, 10)
  if (!Number.isFinite(jumlah) || jumlah < 1) jumlah = 1
  if (jumlah > 999) jumlah = 999
  let tahun = data?.tahun == null || data?.tahun === '' ? null : parseInt(data?.tahun, 10)
  if (tahun !== null && (!Number.isFinite(tahun) || tahun < 1950 || tahun > new Date().getFullYear() + 1)) tahun = null
  const sumValid = Array.isArray(daftarSumber) && daftarSumber.length
    ? daftarSumber.map((s) => String(s.kode || s))
    : ['BOS', 'Yayasan', 'Hibah', 'Wakaf', 'Lainnya']
  let sumber = potong(data?.sumber, 24)
  if (sumber && !sumValid.some((s) => s.toLowerCase() === sumber.toLowerCase())) {
    const hit = sumValid.find((s) => s.toLowerCase().includes(sumber.toLowerCase()) || sumber.toLowerCase().includes(s.toLowerCase()))
    sumber = hit || ''
  }
  const catatan = potong(data?.catatan, 300)
  return { nama, kategori, kondisi, jumlah, tahun, sumber: sumber || '', catatan }
}


/** Prompt usulan aktivitas & deskripsi capaian ekstrakurikuler (C/B/A). */
export function susunPromptEkskul(input) {
  const nama = potong(input.namaEkskul, 80)
  if (!nama) return { ok: false, pesan: 'Nama kegiatan ekstrakurikuler wajib.' }
  const mode = String(input.mode || 'keduanya')
  if (!['deskripsi', 'aktivitas', 'keduanya'].includes(mode)) {
    return { ok: false, pesan: 'Mode harus deskripsi, aktivitas, atau keduanya.' }
  }
  const catatan = potong(input.catatan, 500)
  const aktivitasAda = Array.isArray(input.aktivitasAda)
    ? input.aktivitasAda.map((s) => potong(s, 120)).filter(Boolean).slice(0, 12)
    : []

  const sistem = [
    'Anda asisten kurikulum SD Muhammadiyah di Indonesia.',
    'Tugas: menyusun aktivitas (konteks) dan deskripsi capaian ekstrakurikuler untuk rapor SAS.',
    'Bahasa Indonesia baku, singkat, positif, cocok siswa SD.',
    'PENTING:',
    '- Daftar aktivitas = KONTEKS kegiatan saja (bukan nilai per siswa).',
    '- Deskripsi C/B/A HARUS selaras dengan aktivitas tersebut: menggambarkan ketercapaian siswa terkait aktivitas itu, beda level (C=Layak, B=Cakap, A=Mahir).',
    '- Jangan sebut huruf predikat di dalam teks deskripsi.',
    '- Predikat tidak dicetak di rapor - hanya deskripsi.',
    'Jawab HANYA JSON valid tanpa markdown.',
  ].join('\n')

  let user = 'Kegiatan ekstrakurikuler: "' + nama + '".\n'
  if (catatan) user += 'Catatan admin: ' + catatan + '\n'
  if (aktivitasAda.length) {
    user += 'Aktivitas yang sudah ditetapkan admin (pakai sebagai konteks deskripsi):\n- '
    user += aktivitasAda.join('\n- ') + '\n'
  }
  user += 'Mode: ' + mode + '.\n'
  if (mode === 'aktivitas' || mode === 'keduanya') {
    if (aktivitasAda.length) {
      user += 'Boleh menyempurnakan/menambah aktivitas (4-8 item, frasa 3-10 kata) yang konsisten dengan konteks di atas.\n'
    } else {
      user += 'Hasilkan 4-8 aktivitas/kegiatan singkat (frasa 3-10 kata) yang umum di ekskul ini.\n'
    }
  }
  if (mode === 'deskripsi' || mode === 'keduanya') {
    user += [
      'Hasilkan tepat 3 deskripsi capaian (C, B, A).',
      'Setiap deskripsi 1-2 kalimat (maks ~400 karakter), menggambarkan sikap/keterampilan terkait aktivitas di atas.',
      'Contoh gaya: "Menunjukkan antusiasme dan menguasai teknik dasar serta aktif bekerja sama dalam tim."',
      'Pastikan C < B < A dalam kualitas ketercapaian, dan ketiganya mengacu ke aktivitas yang sama.',
    ].join('\n') + '\n'
  }
  user += [
    'Format JSON:',
    '{',
    '  "aktivitas": ["...", "..."],',
    '  "deskripsi": [',
    '    { "predikat": "C", "teks": "..." },',
    '    { "predikat": "B", "teks": "..." },',
    '    { "predikat": "A", "teks": "..." }',
    '  ]',
    '}',
    'Jika mode=aktivitas, deskripsi boleh []. Jika mode=deskripsi, aktivitas boleh [] atau ulang aktivitas konteks.',
  ].join('\n')

  return { ok: true, sistem, user, mode }
}

export function normalisasiEkskul(json, mode) {
  let data = json
  if (typeof json === 'string') {
    let raw = json.trim()
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fence) raw = fence[1].trim()
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
    try {
      data = JSON.parse(raw)
    } catch {
      try {
        data = JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'))
      } catch {
        data = {}
      }
    }
  }
  if (!data || typeof data !== 'object') data = {}

  const predikatSah = new Set(['C', 'B', 'A'])
  let aktivitas = []
  if (Array.isArray(data.aktivitas)) {
    aktivitas = data.aktivitas.map((s) => potong(s, 120)).filter(Boolean).slice(0, 12)
  }

  let deskripsi = []
  if (Array.isArray(data.deskripsi)) {
    const seen = new Set()
    for (const item of data.deskripsi) {
      if (!item || typeof item !== 'object') continue
      const predikat = String(item.predikat || '').trim().toUpperCase()
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


/**
 * Prompt rancang Proyek STEM dari ide aktivitas saja.
 * AI menentukan sendiri: mapel+TP (dari katalog kelas), 3 DPL (dari SEMUA DPL kelas, aktif atau belum),
 * judul, deskripsi, scaffolding, dan rubrik penilaian lengkap dengan deskripsi 4 rentang nilai.
 * Untuk DPL terpilih yang bank deskripsi levelnya masih kosong, AI juga mengusulkan 4 deskripsi level.
 */
export function susunPromptStem(input) {
  const ide = potong(input.ide, 1500)
  if (!ide || ide.length < 10) {
    return { ok: false, pesan: 'Tulis keterangan aktivitas proyek (minimal ~10 karakter).' }
  }
  const kelas = potong(input.kelas, 10)
  if (!kelas) return { ok: false, pesan: 'Kelas wajib.' }

  const katalogTp = Array.isArray(input.katalogTp) ? input.katalogTp : []
  const katalogDpl = Array.isArray(input.katalogDpl) ? input.katalogDpl : []

  // Batasi payload agar token aman
  const tpRingkas = katalogTp.slice(0, 200).map((t) => ({
    id: potong(t.id, 80),
    mapel: potong(t.mapel, 60),
    namaTp: potong(t.namaTp, 140),
  })).filter((t) => t.id && t.mapel)

  if (tpRingkas.length < 2 || new Set(tpRingkas.map((t) => t.mapel)).size < 2) {
    return {
      ok: false,
      pesan: 'Katalog TP kelas kurang: dibutuhkan TP dari minimal 2 mata pelajaran berbeda. Susun TP di Setup TP dulu.',
    }
  }

  const dplRingkas = katalogDpl.slice(0, 12).map((d) => {
    const lv = Array.isArray(d.levelDeskripsi) ? d.levelDeskripsi : []
    const level = [0, 1, 2, 3].map((i) => potong(lv[i], 300))
    return { id: potong(d.id, 80), nama: potong(d.nama, 80), level, punyaBank: level.some(Boolean) }
  }).filter((d) => d.id && d.nama)

  if (dplRingkas.length < 3) {
    return { ok: false, pesan: 'Kelas ini memiliki kurang dari 3 DPL. Tambahkan DPL di panel Dimensi Profil Lulusan.' }
  }

  const daftarTp = tpRingkas
    .map((t) => `- id="${t.id}" | mapel="${t.mapel}" | ${t.namaTp}`)
    .join('\n')
  const daftarDpl = dplRingkas
    .map((d) => {
      const baris = [`- id="${d.id}" | ${d.nama}`]
      if (d.punyaBank) {
        d.level.forEach((t, i) => { if (t) baris.push(`    level ${i + 1}: ${t}`) })
      }
      return baris.join('\n')
    })
    .join('\n')
  const dplKosong = dplRingkas.filter((d) => !d.punyaBank)

  const sistem = [
    'Anda asisten kurikulum SD Muhammadiyah (Kurikulum Merdeka) untuk merancang Proyek STEM kokurikuler.',
    'STEM = Science, Technology, Engineering, Mathematics terintegrasi; proyek nyata, kontekstual, cocok siswa SD.',
    'Guru HANYA memberi keterangan aktivitas. Semua keputusan lain ditentukan Anda dari keterangan itu.',
    'ATURAN KERAS:',
    '1) Pilih TP HANYA dari katalog yang diberikan (pakai id persis). Minimal 2 mapel berbeda, satu TP per mapel, maksimal 5 mapel.',
    '2) Pilih tepat 3 DPL dari katalog (pakai id persis) yang paling relevan dengan aktivitas. Semua DPL di katalog boleh dipilih.',
    '3) Jangan menulis atau mengubah nilai mapel/SLM — TP hanya dokumentasi keterkaitan proyek.',
    '4) Judul proyek lugas dan deskriptif (apa yang dikerjakan siswa). DILARANG memakai julukan, slogan, tagline, atau persona seperti "detektif", "petualang", "agen", "pahlawan", "penjelajah".',
    '5) Bahasa Indonesia baku, jelas untuk wali kelas SD. Hindari jargon kosong.',
    '6) Jawab HANYA JSON valid tanpa markdown dan tanpa komentar.',
  ].join('\n')

  const user = [
    'Kelas: ' + kelas + '.',
    'Keterangan aktivitas dari guru:',
    ide,
    '',
    'Katalog TP kelas (pilih yang paling cocok, ≥2 mapel berbeda):',
    daftarTp,
    '',
    'Katalog DPL kelas (pilih tepat 3; deskripsi level, bila ada, adalah acuan kelas):',
    daftarDpl,
    '',
    dplKosong.length
      ? 'DPL tanpa deskripsi level (isi dplLevel BILA terpilih): ' + dplKosong.map((d) => d.id).join(', ')
      : 'Semua DPL sudah punya deskripsi level: dplLevel dikosongkan ([]).',
    '',
    'Hasilkan JSON dengan bentuk:',
    '{',
    '  "judul": "judul proyek lugas (maks 120 karakter)",',
    '  "deskripsi": "1-3 paragraf tujuan, konteks, dan hasil yang diharapkan (maks 1200 karakter)",',
    '  "jumlahPertemuan": 4,',
    '  "scaffolding": ["pertemuan 1: ...", "pertemuan 2: ..."],',
    '  "mapelTerlibat": [',
    '    { "tpId": "id-dari-katalog", "mapel": "nama mapel", "namaTp": "ringkas", "jenisNilai": "SLM" }',
    '  ],',
    '  "dplId": ["id-dpl-1", "id-dpl-2", "id-dpl-3"],',
    '  "rubrik": [',
    '    { "nama": "aspek penilaian", "mapel": "mapel terkait atau kosong", "rentang": ["...", "...", "...", "..."] }',
    '  ],',
    '  "dplLevel": [',
    '    { "dplId": "id-dpl", "levelDeskripsi": ["...", "...", "...", "..."] }',
    '  ]',
    '}',
    '',
    'Catatan:',
    '- jumlahPertemuan bilangan bulat 3–12 (sesuaikan kompleksitas).',
    '- scaffolding: satu langkah per pertemuan, urut, konkret (apa yang siswa kerjakan).',
    '- jenisNilai hanya "SLM" atau "SAS" (pilih yang paling masuk akal untuk TP itu).',
    '- rubrik: 4–6 aspek yang dapat diamati guru (proses dan produk, mis. ketepatan pengukuran, kerja sama, presentasi), bukan angka.',
    '  "mapel" di rubrik harus salah satu mapel di mapelTerlibat, atau string kosong untuk aspek lintas mapel.',
    '  "rentang" berisi TEPAT 4 deskripsi capaian berurutan untuk skor 0–60 (Perlu Bimbingan), 61–75 (Cukup), 76–85 (Baik), 86–100 (Sangat Baik).',
    '  Tiap deskripsi 1 kalimat singkat (maks 200 karakter), konkret dan teramati, tanpa subjek "siswa/murid", tanpa awalan angka atau label rentang, naik bertahap antar level (bukan loncatan).',
    '- dplLevel: hanya untuk DPL TERPILIH yang ada dalam daftar "DPL tanpa deskripsi level". Isi 4 kalimat berurutan: Belum Terlihat, Mulai Terlihat, Berkembang Sesuai Harapan, Sangat Berkembang.',
    '  Deskripsi ini disimpan sebagai bank kelas dan dipakai ulang di proyek lain, jadi harus umum (perilaku DPL itu), JANGAN menyebut topik proyek ini.',
    '- Jangan mengarang tpId atau dplId di luar katalog.',
  ].join('\n')

  return {
    ok: true,
    sistem,
    user,
    tpIdsSah: new Set(tpRingkas.map((t) => t.id)),
    dplIdsSah: new Set(dplRingkas.map((d) => d.id)),
    dplKosongIds: new Set(dplKosong.map((d) => d.id)),
    tpById: Object.fromEntries(tpRingkas.map((t) => [t.id, t])),
  }
}

export function normalisasiStem(json, meta) {
  let data = json
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json)
    } catch {
      data = {}
    }
  }
  if (!data || typeof data !== 'object') data = {}

  const judul = potong(data.judul, 200)
  const deskripsi = potong(data.deskripsi, 2000)
  let jumlahPertemuan = Math.floor(Number(data.jumlahPertemuan) || 0)
  if (jumlahPertemuan < 3) jumlahPertemuan = 3
  if (jumlahPertemuan > 12) jumlahPertemuan = 12

  let scaffolding = []
  if (Array.isArray(data.scaffolding)) {
    scaffolding = data.scaffolding
      .map((s) => potong(s, 300))
      .filter(Boolean)
      .slice(0, 12)
  }

  const tpIdsSah = meta?.tpIdsSah instanceof Set ? meta.tpIdsSah : new Set()
  const dplIdsSah = meta?.dplIdsSah instanceof Set ? meta.dplIdsSah : new Set()
  const dplKosongIds = meta?.dplKosongIds instanceof Set ? meta.dplKosongIds : new Set()
  const tpById = meta?.tpById || {}

  const mapelTerlibat = []
  const mapelSeen = new Set()
  if (Array.isArray(data.mapelTerlibat)) {
    for (const item of data.mapelTerlibat) {
      if (!item || typeof item !== 'object') continue
      const tpId = potong(item.tpId, 80)
      if (!tpId || !tpIdsSah.has(tpId)) continue
      const dariKatalog = tpById[tpId] || {}
      const mapel = potong(item.mapel || dariKatalog.mapel, 80)
      if (!mapel) continue
      // Satu TP per mapel
      if (mapelSeen.has(mapel)) continue
      mapelSeen.add(mapel)
      const jenis = String(item.jenisNilai || 'SLM').toUpperCase() === 'SAS' ? 'SAS' : 'SLM'
      mapelTerlibat.push({
        tpId,
        mapel,
        namaTp: potong(item.namaTp || dariKatalog.namaTp, 200) || undefined,
        jenisNilai: jenis,
      })
      if (mapelTerlibat.length >= 6) break
    }
  }

  const dplId = []
  if (Array.isArray(data.dplId)) {
    for (const id of data.dplId) {
      const clean = potong(id, 80)
      if (clean && dplIdsSah.has(clean) && !dplId.includes(clean)) dplId.push(clean)
      if (dplId.length >= 3) break
    }
  }

  // Rubrik: aspek + 4 deskripsi rentang (0–60, 61–75, 76–85, 86–100).
  const mapelSah = new Set(mapelTerlibat.map((m) => m.mapel))
  let rubrik = []
  if (Array.isArray(data.rubrik)) {
    for (const item of data.rubrik) {
      if (!item || typeof item !== 'object') continue
      const nama = potong(item.nama, 120)
      if (!nama) continue
      const r = Array.isArray(item.rentang)
        ? item.rentang
        : Array.isArray(item.deskripsiRentang)
          ? item.deskripsiRentang
          : []
      const deskripsiRentang = [0, 1, 2, 3].map((i) => potong(r[i], 400))
      const mapelItem = potong(item.mapel, 80)
      rubrik.push({
        nama,
        mapel: mapelSah.has(mapelItem) ? mapelItem : undefined,
        deskripsiRentang,
      })
      if (rubrik.length >= 8) break
    }
  }
  // Cadangan: model hanya mengirim daftar nama aspek (format lama).
  if (!rubrik.length && Array.isArray(data.daftarNilai)) {
    rubrik = data.daftarNilai
      .map((s) => potong(s, 120))
      .filter(Boolean)
      .slice(0, 8)
      .map((nama) => ({ nama, mapel: undefined, deskripsiRentang: ['', '', '', ''] }))
  }
  const daftarNilai = rubrik.map((a) => a.nama)

  // Deskripsi level hanya untuk DPL terpilih yang bank-nya masih kosong.
  const dplLevel = []
  if (Array.isArray(data.dplLevel)) {
    for (const item of data.dplLevel) {
      if (!item || typeof item !== 'object') continue
      const id = potong(item.dplId, 80)
      if (!id || !dplId.includes(id) || !dplKosongIds.has(id)) continue
      if (dplLevel.some((x) => x.dplId === id)) continue
      const lv = Array.isArray(item.levelDeskripsi) ? item.levelDeskripsi : []
      const levelDeskripsi = [0, 1, 2, 3].map((i) => potong(lv[i], 500))
      if (!levelDeskripsi.some(Boolean)) continue
      dplLevel.push({ dplId: id, levelDeskripsi })
    }
  }

  return {
    judul,
    deskripsi,
    jumlahPertemuan,
    scaffolding,
    mapelTerlibat,
    dplId,
    daftarNilai,
    rubrik,
    dplLevel,
  }
}
