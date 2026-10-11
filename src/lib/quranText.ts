/**
 * Data Al-Qur'an per surah dari API publik EQuran.id (https://equran.id/apidev): teks Arab (Uthmani),
 * transliterasi Latin, terjemahan Indonesia, dan audio per ayat dari enam qari. Hanya nomor surah yang dikirim;
 * tidak ada data siswa. Alamat API dan audio harus ada di CSP (`connect-src` / `media-src`, lihat firebase.json).
 * Hasil disimpan di sessionStorage agar surah yang sama tidak diunduh ulang dalam satu sesi.
 */
const API_BASE = 'https://equran.id/api/v2/surat'
/** Versi 2: bentuk data berubah (ada latin/terjemahan/audio), jadi kunci cache lama (tt_quran_text_) diabaikan. */
const CACHE_PREFIX = 'tt_quran_v2_'
const BATAS_WAKTU_MS = 15000

export interface Qari {
  id: string
  nama: string
}

/** Daftar qari resmi EQuran.id. ID tak dikenal dari API tetap ditampilkan sebagai "Qari {id}". */
export const QARI: Qari[] = [
  { id: '01', nama: 'Abdullah Al-Juhany' },
  { id: '02', nama: 'Abdul Muhsin Al-Qasim' },
  { id: '03', nama: 'Abdurrahman as-Sudais' },
  { id: '04', nama: 'Ibrahim Al-Dossari' },
  { id: '05', nama: 'Misyari Rasyid Al-Afasi' },
  { id: '06', nama: 'Yasser Al-Dosari' },
]
export const QARI_BAWAAN = '05'

export interface AyatTeks {
  nomorAyat: number
  teksArab: string
  teksLatin: string
  teksIndonesia: string
  /** id qari → URL audio ayat */
  audio: Record<string, string>
}

export interface SurahDetail {
  nomor: number
  nama: string
  namaLatin: string
  arti: string
  tempatTurun: string
  jumlahAyat: number
  /** id qari → URL audio satu surah penuh */
  audioFull: Record<string, string>
  ayat: AyatTeks[]
}

/**
 * Hanya URL https di domain equran.id yang diterima sebagai sumber audio, agar respons API yang berubah/dibajak
 * tidak bisa menyuruh browser memutar dari alamat lain.
 */
export function audioAman(u: unknown): string | null {
  if (typeof u !== 'string') return null
  try {
    const url = new URL(u)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'equran.id' || host.endsWith('.equran.id')) ? url.href : null
  } catch {
    return null
  }
}

function peta(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const aman = audioAman(val)
      if (aman) out[k] = aman
    }
  }
  return out
}

const teks = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Validasi bentuk respons API → SurahDetail. Melempar Error bila tidak dikenali. */
export function parseResponsSurah(json: unknown): SurahDetail {
  const d = (json as { data?: Record<string, unknown> } | null)?.data
  const list = d?.ayat
  if (!d || !Array.isArray(list)) throw new Error('Format respons API tidak dikenali.')
  const ayat: AyatTeks[] = list.map((a) => {
    const x = a as Record<string, unknown>
    return {
      nomorAyat: Number(x.nomorAyat),
      teksArab: teks(x.teksArab),
      teksLatin: teks(x.teksLatin),
      teksIndonesia: teks(x.teksIndonesia),
      audio: peta(x.audio),
    }
  })
  if (!ayat.length || ayat.some((a) => !Number.isFinite(a.nomorAyat) || !a.teksArab)) {
    throw new Error('Data ayat tidak lengkap.')
  }
  return {
    nomor: Number(d.nomor) || 0,
    nama: teks(d.nama),
    namaLatin: teks(d.namaLatin),
    arti: teks(d.arti),
    tempatTurun: teks(d.tempatTurun),
    jumlahAyat: Number(d.jumlahAyat) || ayat.length,
    audioFull: peta(d.audioFull),
    ayat,
  }
}

/** Daftar qari yang benar-benar tersedia di surah ini (urut sesuai QARI; ID baru di akhir). */
export function qariTersedia(s: SurahDetail): Qari[] {
  const ids = new Set<string>(Object.keys(s.audioFull))
  for (const a of s.ayat) for (const k of Object.keys(a.audio)) ids.add(k)
  const dikenal = QARI.filter((q) => ids.has(q.id))
  const baru = [...ids].filter((id) => !QARI.some((q) => q.id === id)).sort().map((id) => ({ id, nama: `Qari ${id}` }))
  return [...dikenal, ...baru]
}

export async function fetchSurah(nomorSurah: number): Promise<SurahDetail> {
  const kunci = CACHE_PREFIX + nomorSurah
  try {
    const cached = sessionStorage.getItem(kunci)
    if (cached) return parseResponsSurah({ data: JSON.parse(cached) })
  } catch {
    /* penyimpanan tidak tersedia atau rusak → lanjut unduh */
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), BATAS_WAKTU_MS)
  try {
    const res = await fetch(`${API_BASE}/${nomorSurah}`, { signal: ctl.signal })
    if (!res.ok) throw new Error(`Gagal mengambil data surah (HTTP ${res.status})`)
    const json = await res.json()
    const surah = parseResponsSurah(json)
    try {
      sessionStorage.setItem(kunci, JSON.stringify((json as { data: unknown }).data))
    } catch {
      /* penuh → abaikan */
    }
    return surah
  } finally {
    clearTimeout(timer)
  }
}
