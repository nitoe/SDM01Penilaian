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
    `Level: 1 ${label[0]}, 2 ${label[1]}, 3 ${label[2]}, 4 ${label[3]} untuk ${tingkat}.`,
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
  return sisa.charAt(0).toUpperCase() + sisa.slice(1)
}

export function normalisasiKktp(data) {
  const list = Array.isArray(data?.deskripsi) ? data.deskripsi : []
  const keluar = list.slice(0, 4).map((d) => bersihkanSubjekKktp(potong(d, 500)))
  if (keluar.length !== 4 || keluar.some((d) => !d)) {
    throw new Error('AI harus mengembalikan tepat 4 deskripsi KKTP.')
  }
  return keluar
}

async function panggilGemini(apiKey, sistem, user) {
  const model = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
  let terakhir = 'Gemini tidak menjawab.'
  for (const nama of model) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${nama}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistem }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 4096 },
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
  const model = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
  let terakhir = 'Gemini tidak menjawab.'
  for (const nama of model) {
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
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 2048 },
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
