/**
 * Dataset teks Iqro jilid 1–6 untuk Baca & Tandai.
 *
 * Sumber: dyazincahya/iqro-json (hasil OCR buku Iqro KH. As'ad Humam),
 * dilayani via jsDelivr CDN. Bukan API resmi — kualitas OCR bervariasi;
 * bila halaman gagal dimuat, UI bisa jatuh ke mode teks bebas.
 *
 * Struktur normalisasi: halaman → baris → kata (suku kata Arab berharakat).
 */
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/dyazincahya/iqro-json/iqro/easyocr'
const CACHE_PREFIX = 'tt_iqro_v1_'
const BATAS_WAKTU_MS = 12000

/** Jumlah halaman per jilid (sesuai dataset easyocr). */
export const IQRO_HALAMAN_MAX: Record<number, number> = {
  1: 32,
  2: 30,
  3: 30,
  4: 30,
  5: 30,
  6: 30,
}

export function maxHalamanIqro(buku: number): number {
  return IQRO_HALAMAN_MAX[buku] ?? 30
}

export interface IqroBaris {
  /** Urutan dalam halaman (1-based) */
  no: number
  teksArab: string
  teksLatin: string
  /** Kata/suku kata hasil pecah spasi — dipakai Baca & Tandai */
  kata: string[]
}

export interface IqroHalaman {
  buku: number
  halaman: number
  topikLatin: string
  topikArab: string
  instruksi: string
  baris: IqroBaris[]
}

function pecahKataArab(teks: string): string[] {
  return teks
    .replace(/\u00a0/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
}

function parseHalamanMentah(buku: number, halaman: number, json: unknown): IqroHalaman {
  const d = json as Record<string, unknown>
  const topic = (d.topic as Record<string, unknown> | undefined) || {}
  const content = Array.isArray(d.content) ? d.content : []

  const baris: IqroBaris[] = content
    .map((c, i) => {
      const row = c as Record<string, unknown>
      const arab = typeof row.arabic === 'string' ? row.arabic.trim() : ''
      const latin = typeof row.latin === 'string' ? row.latin.trim() : ''
      if (!arab) return null
      return {
        no: Number(row.order_id) || i + 1,
        teksArab: arab,
        teksLatin: latin,
        kata: pecahKataArab(arab),
      }
    })
    .filter((b): b is IqroBaris => b != null && b.kata.length > 0)

  return {
    buku,
    halaman,
    topikLatin: typeof topic.latin === 'string' ? topic.latin : '',
    topikArab: typeof topic.arab === 'string' ? topic.arab : '',
    instruksi: typeof d.instruction_id === 'string' ? d.instruction_id : '',
    baris,
  }
}

/**
 * Ambil satu halaman Iqro. Hasil di-cache di sessionStorage per sesi.
 */
export async function fetchHalamanIqro(buku: number, halaman: number): Promise<IqroHalaman> {
  const b = Math.min(6, Math.max(1, Math.floor(buku)))
  const h = Math.min(maxHalamanIqro(b), Math.max(1, Math.floor(halaman)))
  const kunci = `${CACHE_PREFIX}${b}_${h}`

  try {
    const cached = sessionStorage.getItem(kunci)
    if (cached) return parseHalamanMentah(b, h, JSON.parse(cached))
  } catch {
    /* lanjut unduh */
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), BATAS_WAKTU_MS)
  try {
    const url = `${CDN_BASE}/${b}/${b}-${h}.json`
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`Halaman Iqro ${b}/${h} tidak tersedia (HTTP ${res.status})`)
    const json = await res.json()
    try {
      sessionStorage.setItem(kunci, JSON.stringify(json))
    } catch {
      /* kuota penuh */
    }
    return parseHalamanMentah(b, h, json)
  } finally {
    clearTimeout(timer)
  }
}

/** Muat rentang halaman (mulai…akhir). Halaman yang gagal dilewati (null di posisi itu). */
export async function fetchRentangIqro(
  buku: number,
  mulai: number,
  akhir: number,
): Promise<{ ok: IqroHalaman[]; gagal: number[] }> {
  const a = Math.min(mulai, akhir)
  const b = Math.max(mulai, akhir)
  const max = maxHalamanIqro(buku)
  const ok: IqroHalaman[] = []
  const gagal: number[] = []
  for (let h = a; h <= b && h <= max; h++) {
    try {
      ok.push(await fetchHalamanIqro(buku, h))
    } catch {
      gagal.push(h)
    }
  }
  return { ok, gagal }
}

/** Gabungkan semua kata di rentang halaman jadi satu string (untuk detailBacaanIqro.teks). */
export function gabungTeksHalaman(list: IqroHalaman[]): string {
  const kata: string[] = []
  for (const p of list) {
    for (const baris of p.baris) kata.push(...baris.kata)
  }
  return kata.join(' ')
}

/** Index global kata → { halaman, barisNo, indexDalamBaris } (untuk debug/UI). */
export function petaIndexKata(list: IqroHalaman[]): { halaman: number; baris: number; i: number }[] {
  const out: { halaman: number; baris: number; i: number }[] = []
  for (const p of list) {
    for (const baris of p.baris) {
      baris.kata.forEach((_, i) => out.push({ halaman: p.halaman, baris: baris.no, i }))
    }
  }
  return out
}
