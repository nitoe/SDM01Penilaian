/**
 * Dataset teks Iqro jilid 1–6 untuk Baca & Tandai.
 *
 * Sumber utama: dyazincahya/iqro-json (OCR) via jsDelivr.
 * Perbaikan berlapis:
 *  1. Bersih simbol OCR + rapikan Latin (bukan ALL CAPS)
 *  2. Sisip sukun yang hilang di antara konsonan (bukan alif)
 *  3. Jilid 4–6: jika baris menyerupai ayat Qur’an, pulihkan cuplikan
 *     teks Uthmani resmi dari api.alquran.cloud (pencocokan tanpa harakat)
 *
 * Cache sessionStorage v3 — hard refresh setelah deploy.
 */
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/dyazincahya/iqro-json/iqro/easyocr'
const QURAN_SEARCH = 'https://api.alquran.cloud/v1/search'
const CACHE_PREFIX = 'tt_iqro_v3_'
const BATAS_WAKTU_MS = 12000

/** Jumlah halaman per jilid (dataset easyocr). */
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
  no: number
  teksArab: string
  teksLatin: string
  kata: string[]
  /** true jika teks Arab diganti dari Qur’an resmi */
  dariQuran?: boolean
}

export interface IqroHalaman {
  buku: number
  halaman: number
  topikLatin: string
  topikArab: string
  instruksi: string
  baris: IqroBaris[]
}

/* -------------------------------------------------------------------------- */
/*  Util Arab / Latin                                                         */
/* -------------------------------------------------------------------------- */

function isHurufArab(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x0621 && c <= 0x063a) ||
    (c >= 0x0641 && c <= 0x064a) ||
    (c >= 0x0670 && c <= 0x06d3)
  )
}

function isHarakat(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x064b && c <= 0x065f) ||
    c === 0x0670 ||
    (c >= 0x06d6 && c <= 0x06ed)
  )
}

function isSkipBanding(ch: string): boolean {
  if (isHarakat(ch)) return true
  if (ch === ' ' || ch === '\u00a0') return true
  return '○◯ـ۟ۢۥۦۗۙۘۜ۝۞\u06e5\u06e6'.includes(ch)
}

function unifyHuruf(ch: string): string {
  return ch
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '')
}

const SUKUN = '\u0652'
const ALIF = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ'])

/**
 * Sisip sukun jika dua konsonan berurutan tanpa harakat (OCR sering hilang).
 * Alif tidak disisipi (madd).
 */
export function lengkapiHarakatOcr(teks: string): string {
  if (!teks) return teks
  const s = teks.normalize('NFC')
  const out: string[] = []
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    out.push(ch)
    if (!isHurufArab(ch)) continue
    let j = i + 1
    let adaHarakat = false
    while (j < s.length && isHarakat(s[j]!)) {
      out.push(s[j]!)
      adaHarakat = true
      j++
    }
    if (adaHarakat) {
      i = j - 1
      continue
    }
    if (ALIF.has(ch)) {
      i = j - 1
      continue
    }
    if (j < s.length && isHurufArab(s[j]!)) out.push(SUKUN)
    i = j - 1
  }
  return out.join('')
}

/** ALL CAPS OCR → huruf kecil dengan kapital di awal tiap segmen. */
export function rapikanLatinIqro(raw: string): string {
  const t = String(raw || '')
    .replace(/[○◯]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (!letters) return t
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.55) return t

  return t
    .split(/(\s+|-+)/)
    .map((seg) => {
      if (/^\s+$/.test(seg) || /^-+$/.test(seg)) return seg
      const low = seg.toLowerCase()
      const m = low.match(/^([^a-z]*)([a-z])([\s\S]*)$/)
      if (!m) return low
      return m[1] + m[2]!.toUpperCase() + m[3]
    })
    .join('')
}

function bersihkanArab(teks: string): string {
  return teks
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[○◯ㅇ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function pecahKataArab(teks: string): string[] {
  return teks
    .replace(/\u00a0/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
}

/** Rantai huruf tanpa harakat/spasi — untuk pencocokan. */
export function rantaiTanpaHarakat(teks: string): string {
  let out = ''
  for (const ch of teks.normalize('NFC')) {
    if (isSkipBanding(ch)) continue
    const u = unifyHuruf(ch)
    if (u) out += u
  }
  return out
}

function petaIndeksHuruf(teks: string): number[] {
  const idx: number[] = []
  for (let i = 0; i < teks.length; i++) {
    const ch = teks[i]!
    if (isSkipBanding(ch)) continue
    if (!unifyHuruf(ch)) continue
    idx.push(i)
  }
  return idx
}

/**
 * Ambil cuplikan Uthmani dari ayat penuh yang sejajar dengan OCR (tanpa harakat).
 */
export function ekstrakCuplikanUthmani(ayatUthmani: string, ocrArab: string): string | null {
  const nAyat = rantaiTanpaHarakat(ayatUthmani)
  const nOcr = rantaiTanpaHarakat(ocrArab)
  if (nOcr.length < 8 || nAyat.length < 8) return null

  let pos = nAyat.indexOf(nOcr)
  let len = nOcr.length
  if (pos < 0) {
    const minLen = Math.max(12, Math.floor(nOcr.length * 0.7))
    let best = -1
    for (let L = nOcr.length; L >= minLen; L--) {
      for (let i = 0; i + L <= nOcr.length; i++) {
        const sub = nOcr.slice(i, i + L)
        const p = nAyat.indexOf(sub)
        if (p >= 0) {
          pos = p
          len = L
          best = L
          break
        }
      }
      if (best >= 0) break
    }
    if (best < 0) return null
  }

  const mp = petaIndeksHuruf(ayatUthmani)
  if (pos + len - 1 >= mp.length) return null
  const start = mp[pos]!
  let end = mp[pos + len - 1]! + 1
  while (end < ayatUthmani.length && isHarakat(ayatUthmani[end]!)) end++
  const cuplikan = ayatUthmani.slice(start, end).trim()
  return cuplikan.length >= 5 ? cuplikan : null
}

/* -------------------------------------------------------------------------- */
/*  Pulihkan dari Qur’an (api.alquran.cloud)                                   */
/* -------------------------------------------------------------------------- */

const cacheCari = new Map<string, string[]>()

async function cariAyatUthmani(query: string): Promise<string[]> {
  const q = query.trim()
  if (q.length < 3) return []
  if (cacheCari.has(q)) return cacheCari.get(q)!
  try {
    const cached = sessionStorage.getItem('tt_qsearch_' + q)
    if (cached) {
      const arr = JSON.parse(cached) as string[]
      cacheCari.set(q, arr)
      return arr
    }
  } catch {
    /* ignore */
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), BATAS_WAKTU_MS)
  try {
    const url = `${QURAN_SEARCH}/${encodeURIComponent(q)}/all/quran-uthmani`
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { matches?: { text?: string }[] }
    }
    const teks = (json.data?.matches ?? []).map((m) => m.text || '').filter(Boolean)
    cacheCari.set(q, teks)
    try {
      sessionStorage.setItem('tt_qsearch_' + q, JSON.stringify(teks))
    } catch {
      /* full */
    }
    return teks
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

function queryDariOcr(arab: string): string {
  const rantai = rantaiTanpaHarakat(arab)
  if (rantai.length <= 12) return rantai
  const start = Math.max(0, Math.floor(rantai.length * 0.35))
  return rantai.slice(start, start + 14)
}

export async function cobaPulihkanQuran(arabOcr: string): Promise<string | null> {
  const bersih = bersihkanArab(arabOcr)
  const rantai = rantaiTanpaHarakat(bersih)
  if (rantai.length < 10) return null

  const query = queryDariOcr(bersih)
  let kandidat = await cariAyatUthmani(query)
  if (!kandidat.length) {
    kandidat = await cariAyatUthmani(rantai.slice(0, 12))
  }

  let terbaik: string | null = null
  let skor = 0
  for (const ayat of kandidat) {
    const cup = ekstrakCuplikanUthmani(ayat, bersih)
    if (!cup) continue
    const s = rantaiTanpaHarakat(cup).length
    if (s > skor) {
      skor = s
      terbaik = cup
    }
  }
  if (terbaik && skor >= Math.floor(rantai.length * 0.7)) return terbaik
  return null
}

/* -------------------------------------------------------------------------- */
/*  Parse & fetch halaman                                                     */
/* -------------------------------------------------------------------------- */

async function normalisasiBarisAsync(
  arabMentah: string,
  latinMentah: string,
  buku: number,
): Promise<Omit<IqroBaris, 'no'>> {
  const latin = rapikanLatinIqro(latinMentah)
  let arab = lengkapiHarakatOcr(bersihkanArab(arabMentah))
  let dariQuran = false

  if (buku >= 4 && rantaiTanpaHarakat(arab).length >= 10) {
    const pulih = await cobaPulihkanQuran(arabMentah)
    if (pulih) {
      arab = pulih
      dariQuran = true
    }
  }

  return { teksArab: arab, teksLatin: latin, kata: pecahKataArab(arab), dariQuran }
}

async function parseHalamanAsync(
  buku: number,
  halaman: number,
  json: unknown,
): Promise<IqroHalaman> {
  const d = json as Record<string, unknown>
  const topic = (d.topic as Record<string, unknown> | undefined) || {}
  const content = Array.isArray(d.content) ? d.content : []

  const baris: IqroBaris[] = []
  for (let i = 0; i < content.length; i++) {
    const row = content[i] as Record<string, unknown>
    const arabRaw = typeof row.arabic === 'string' ? row.arabic : ''
    const latinRaw = typeof row.latin === 'string' ? row.latin : ''
    if (!arabRaw.trim()) continue
    const n = await normalisasiBarisAsync(arabRaw, latinRaw, buku)
    if (!n.kata.length) continue
    baris.push({ no: Number(row.order_id) || i + 1, ...n })
  }

  const topikArab =
    typeof topic.arab === 'string' ? lengkapiHarakatOcr(bersihkanArab(topic.arab)) : ''
  const topikLatin = typeof topic.latin === 'string' ? rapikanLatinIqro(topic.latin) : ''

  return {
    buku,
    halaman,
    topikLatin,
    topikArab,
    instruksi: typeof d.instruction_id === 'string' ? d.instruction_id : '',
    baris,
  }
}

export async function fetchHalamanIqro(buku: number, halaman: number): Promise<IqroHalaman> {
  const b = Math.min(6, Math.max(1, Math.floor(buku)))
  const h = Math.min(maxHalamanIqro(b), Math.max(1, Math.floor(halaman)))
  const kunci = `${CACHE_PREFIX}${b}_${h}`

  try {
    const cached = sessionStorage.getItem(kunci)
    if (cached) {
      const parsed = JSON.parse(cached) as { hasil?: IqroHalaman }
      if (parsed.hasil?.baris) return parsed.hasil
    }
  } catch {
    /* lanjut */
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), BATAS_WAKTU_MS)
  try {
    const url = `${CDN_BASE}/${b}/${b}-${h}.json`
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`Halaman Iqro ${b}/${h} tidak tersedia (HTTP ${res.status})`)
    const json = await res.json()
    const hasil = await parseHalamanAsync(b, h, json)
    try {
      sessionStorage.setItem(kunci, JSON.stringify({ hasil }))
    } catch {
      /* kuota */
    }
    return hasil
  } finally {
    clearTimeout(timer)
  }
}

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

export function gabungTeksHalaman(list: IqroHalaman[]): string {
  const kata: string[] = []
  for (const p of list) {
    for (const baris of p.baris) kata.push(...baris.kata)
  }
  return kata.join(' ')
}
