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
/** v2: normalisasi Latin + pelengkapan harakat OCR */
const CACHE_PREFIX = 'tt_iqro_v2_'
const BATAS_WAKTU_MS = 12000

/* -------------------------------------------------------------------------- */
/*  Normalisasi Latin & Arab (OCR sering ALL CAPS / harakat hilang)            */
/* -------------------------------------------------------------------------- */

/** Huruf Arab dasar (bukan tanda baca / harakat). */
function isHurufArab(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x0621 && c <= 0x063a) ||
    (c >= 0x0641 && c <= 0x064a) ||
    c === 0x0671 || // اً variants start
    (c >= 0x0670 && c <= 0x06d3)
  )
}

/** Tanda harakat / tajwid combining yang umum. */
function isHarakat(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x064b && c <= 0x065f) || // fathatan … superscript alef
    c === 0x0670 || // dagger alef
    (c >= 0x06d6 && c <= 0x06ed) ||
    c === 0x08f0 ||
    c === 0x08f1 ||
    c === 0x08f2
  )
}

const SUKUN = '\u0652'
/** Alif (termasuk hamzah di atas/bawah) — jangan disisipi sukun otomatis (sering madd). */
const ALIF = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ'])

/**
 * OCR Iqro (terutama jilid 5–6) sering menghilangkan sukun di antara dua huruf
 * konsonan. Jika dua huruf Arab berurutan tanpa harakat di antaranya, sisipkan
 * sukun pada huruf pertama — kecuali alif (madd). Tidak mengubah teks yang
 * sudah punya harakat lengkap.
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
    // Alif tanpa harakat diikuti huruf lain biasanya madd — jangan sukun
    if (ALIF.has(ch)) {
      i = j - 1
      continue
    }
    if (j < s.length && isHurufArab(s[j]!)) {
      out.push(SUKUN)
    }
    i = j - 1
  }
  return out.join('')
}

/**
 * Latin dari OCR hampir selalu HURUF BESAR SEMUA.
 * Ubah menjadi bentuk wajar: huruf kecil, huruf pertama tiap segmen (pisah spasi / -) kapital.
 * Contoh: "HABBAN WANABAATAN" → "Habban wanabaatan"
 *          "A BA" → "A ba" — untuk suku pendek Iqro 1, tetap terbaca.
 */
export function rapikanLatinIqro(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  // Hanya rapikan jika dominan kapital (OCR)
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (!letters) return t
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.6) return t // sudah campuran / normal

  return t
    .split(/(\s+|-+)/)
    .map((seg) => {
      if (/^\s+$/.test(seg) || /^-+$/.test(seg)) return seg
      const low = seg.toLowerCase()
      // Kapital hanya huruf pertama yang alfabet
      const m = low.match(/^([^a-z]*)([a-z])([\s\S]*)$/)
      if (!m) return low
      return m[1] + m[2]!.toUpperCase() + m[3]
    })
    .join('')
}

/** Bersihkan artefak OCR (simbol akhir baris, spasi aneh) tanpa menghapus isi. */
function bersihkanArab(teks: string): string {
  return teks
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[○◯ㅇ]/g, '') // penanda akhir baris OCR
    .replace(/\s+/g, ' ')
    .trim()
}

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

/**
 * Normalisasi satu baris dari OCR: bersihkan simbol, lengkapi sukun yang hilang,
 * rapikan Latin (bukan ALL CAPS).
 */
export function normalisasiBarisIqro(arabMentah: string, latinMentah: string): {
  teksArab: string
  teksLatin: string
  kata: string[]
} {
  const arab = lengkapiHarakatOcr(bersihkanArab(arabMentah))
  const latin = rapikanLatinIqro(latinMentah)
  return { teksArab: arab, teksLatin: latin, kata: pecahKataArab(arab) }
}

function parseHalamanMentah(buku: number, halaman: number, json: unknown): IqroHalaman {
  const d = json as Record<string, unknown>
  const topic = (d.topic as Record<string, unknown> | undefined) || {}
  const content = Array.isArray(d.content) ? d.content : []

  const baris: IqroBaris[] = content
    .map((c, i) => {
      const row = c as Record<string, unknown>
      const arabRaw = typeof row.arabic === 'string' ? row.arabic : ''
      const latinRaw = typeof row.latin === 'string' ? row.latin : ''
      if (!arabRaw.trim()) return null
      const n = normalisasiBarisIqro(arabRaw, latinRaw)
      if (!n.kata.length) return null
      return {
        no: Number(row.order_id) || i + 1,
        teksArab: n.teksArab,
        teksLatin: n.teksLatin,
        kata: n.kata,
      }
    })
    .filter((b): b is IqroBaris => b != null)

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
