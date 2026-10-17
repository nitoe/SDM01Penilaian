/** Logika murni generate TP/KKTP (tanpa Firebase) + pemanggilan Gemini/OpenAI. */

export const UID_AI = 'v4fQXsqCzYUtHrqcDM0u48sxIfn1'
/** Email akun pemilik; dicek BERSAMA UID (dua-duanya harus cocok). Harus sama dengan src/lib/generateAi.ts. */
export const EMAIL_AI = 'arif.azwar79@gmail.com'

const LABEL = {
  pengetahuan: ['Perlu Bimbingan', 'Cukup', 'Baik', 'Sangat Baik'],
  kinerja: ['Mulai Berkembang', 'Layak', 'Cakap', 'Mahir'],
}

export function bolehUidAi(uid) {
  return uid === UID_AI
}

/**
 * Gerbang utama server. `auth` = request.auth dari Callable Function (uid + token terverifikasi).
 * UID DAN email di token harus sama dengan akun pemilik. Email dibaca dari token yang ditandatangani
 * Firebase, bukan dari dokumen Firestore (yang bisa diubah admin lain).
 */
export function bolehPemanggilAi(auth) {
  if (!auth || typeof auth.uid !== 'string') return false
  if (!bolehUidAi(auth.uid)) return false
  const email = String(auth.token?.email ?? '').trim().toLowerCase()
  return email === EMAIL_AI
}

function potong(s, n) {
  const t = String(s ?? '').trim()
  return t.length > n ? t.slice(0, n) : t
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

/** SD: kelas 1–2 = Fase A, 3–4 = Fase B, 5–6 = Fase C. '' bila tak dikenali. */
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
  // Panduan: Buku Saku KKTP v1 (deskriptor konkret, skala 4 level, bahasa jernih bagi guru).
  const sistem = [
    'Anda menyusun deskripsi KKTP (4 level) untuk satu Tujuan Pembelajaran SD Kurikulum Merdeka.',
    'KKTP adalah dokumen guru: bahasa formal-profesional tetapi jernih dan konkret, bukan bahasa anak-anak.',
    '',
    'BENTUK TIAP DESKRIPSI',
    '- Langsung tulis kompetensi capaian yang teramati pada level itu. DILARANG memakai subjek: jangan membuka atau menyisipkan "Peserta didik", "Siswa", "Murid", "Anak", "Ananda", atau "Mereka". Buka dengan kata kerja capaian (mis. "Menyebutkan ...", "Menyelesaikan ...", "Menyusun ...") atau dengan hasil/bukti yang tampak (mis. "Catatan pengamatan ...", "Laporan memuat ...").',
    '- 1–2 kalimat pendek, spesifik untuk TP ini, sehingga guru langsung tahu PERSIS apa yang harus diamati.',
    '- Gambarkan bukti konkret pada level itu. Untuk level rendah, sebutkan apa yang masih keliru atau belum ada, jangan hanya menulis "belum mampu".',
    '- DILARANG kata pengisi tanpa penanda nyata ("secara jelas", "dengan tepat", "dengan benar", "secara baik") dan jargon ("holistik", "komprehensif", "terintegrasi secara utuh", "optimal", "berdampak"). Hapus kata yang tidak mengubah makna.',
    '- Jangan menulis angka nilai atau rentang di deskripsi. Jangan mengubah teks CP.',
    '',
    `ISI TIAP LEVEL (ukur terhadap capaian wajar untuk ${tingkat}; jangan terlalu mudah atau terlalu sulit untuk tingkat ini)`,
    `1. ${label[0]}: bukti capaian belum tampak atau baru sangat sebagian; perlu pendampingan dari awal.`,
    `2. ${label[1]}: bukti capaian mulai tampak sebagian, masih ada yang keliru atau perlu bimbingan.`,
    `3. ${label[2]}: bukti capaian sesuai target TP untuk ${tingkat}. Inilah kompetensi yang diharapkan.`,
    `4. ${label[3]}: melampaui target, ditambah satu kemampuan lanjutan yang wajar untuk ${tingkat} (mis. memberi contoh sendiri, menjelaskan alasan, atau mengerjakan variasi bentuk soal); siap pengayaan.`,
    'Keempat level naik bertahap secara logis, bukan loncatan drastis tanpa dasar.',
    '',
    'CONTOH GAYA YANG BENAR (hanya untuk gaya; jangan menyalin isinya ke TP lain)',
    'TP pengetahuan: ["Sebagian besar langkah pengerjaan masih keliru.","Memahami sebagian langkah, tetapi masih keliru di beberapa operasi hitung.","Menyelesaikan sebagian besar soal dengan langkah dan urutan operasi yang benar.","Menyelesaikan seluruh soal, termasuk soal dengan variasi bentuk operasi."]',
    'TP kinerja: ["Catatan pengamatan tidak berurutan atau hanya memuat satu detail.","Catatan memuat beberapa detail, tetapi urutannya belum sistematis.","Laporan berurutan (awal, proses, hasil) dan memuat detail yang relevan dari pengamatan.","Laporan berurutan, detailnya lengkap, dan ditambah kesimpulan sederhana dari hasil pengamatan."]',
    'CONTOH YANG SALAH (jangan ditiru): "Peserta didik mampu menjelaskan ide pokok teks secara jelas dan komprehensif."',
    '',
    'Balas HANYA JSON: {"deskripsi":["...","...","...","..."]} berisi tepat 4 string, urut dari level 1 sampai 4.',
  ].join('\n')
  const user = [
    `Mapel: ${mapel}`,
    `Kelas: ${kelas}${fase ? ` (Fase ${fase})` : ''}`,
    `TP: ${namaTp}`,
    `Jenis: ${tipe}`,
    teks ? `CP resmi terkait:\n${teks}` : '',
  ]
    .filter(Boolean)
    .join('\n')
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
  for (const item of list.slice(0, 6)) {
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

/**
 * Pengaman terakhir bila model tetap membuka dengan subjek ("Peserta didik mampu menyebutkan ...").
 * Hanya membuang subjek di awal kalimat (dan "mampu/dapat" yang langsung mengikutinya), lalu kapitalisasi.
 * "Peserta didik belum mampu ..." menjadi "Belum mampu ..."; kalimat tanpa subjek tidak diubah sama sekali.
 */
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
  const model = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']
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
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
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
    if (!teks) {
      terakhir = 'Gemini mengembalikan jawaban kosong.'
      continue
    }
    return teks
  }
  throw new Error(terakhir)
}

async function panggilOpenAi(apiKey, sistem, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
