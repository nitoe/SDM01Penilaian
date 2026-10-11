/**
 * Teks Arab per ayat dari API publik equran.id (sama dengan v2). Hanya nomor surah yang dikirim; tidak ada data
 * siswa. Hasil disimpan di sessionStorage agar surah yang sama tidak diunduh ulang dalam satu sesi guru.
 * Alamat ini harus ada di `connect-src` CSP (firebase.json).
 */
const API_BASE = 'https://equran.id/api/v2/surat'
const CACHE_PREFIX = 'tt_quran_text_'
const BATAS_WAKTU_MS = 12000

export interface AyatTeks {
  nomorAyat: number
  teksArab: string
}

/** Validasi bentuk respons API → daftar ayat. Melempar Error bila tidak dikenali. */
export function parseResponsSurah(json: unknown): AyatTeks[] {
  const list = (json as { data?: { ayat?: unknown } } | null)?.data?.ayat
  if (!Array.isArray(list)) throw new Error('Format respons API tidak dikenali.')
  const hasil = list.map((a) => ({
    nomorAyat: Number((a as { nomorAyat?: unknown }).nomorAyat),
    teksArab: String((a as { teksArab?: unknown }).teksArab ?? ''),
  }))
  if (!hasil.length || hasil.some((a) => !Number.isFinite(a.nomorAyat))) {
    throw new Error('Data ayat tidak lengkap.')
  }
  return hasil
}

export async function fetchSurahText(nomorSurah: number): Promise<AyatTeks[]> {
  const kunci = CACHE_PREFIX + nomorSurah
  try {
    const cached = sessionStorage.getItem(kunci)
    if (cached) return JSON.parse(cached) as AyatTeks[]
  } catch {
    /* penyimpanan tidak tersedia atau rusak → lanjut unduh */
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), BATAS_WAKTU_MS)
  try {
    const res = await fetch(`${API_BASE}/${nomorSurah}`, { signal: ctl.signal })
    if (!res.ok) throw new Error(`Gagal mengambil teks surah (HTTP ${res.status})`)
    const ayat = parseResponsSurah(await res.json())
    try {
      sessionStorage.setItem(kunci, JSON.stringify(ayat))
    } catch {
      /* penuh → abaikan */
    }
    return ayat
  } finally {
    clearTimeout(timer)
  }
}
