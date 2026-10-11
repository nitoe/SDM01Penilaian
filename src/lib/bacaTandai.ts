import type {
  DetailAyatItem,
  DetailBacaanIqro,
  JenisKata,
  KataSalah,
  SetoranRecord,
  StatusAyat,
  StatusHafalan,
} from '../types/tahsin'

/**
 * Logika murni fitur "Baca & Tandai" (tanpa React/Firebase agar bisa diuji).
 * Aturan mengikuti v2 (tahsin-tahfizh/input-setoran.html): ketuk kata 1× = tajwid, 2× = makhroj,
 * 3× = bersih lagi; tiap ayat bisa ditandai Lulus / Perlu diulang; ayat dengan ≥ 3 kata salah = "kritis".
 */

export interface TandaAyat {
  status: StatusAyat | null
  /** index kata (mulai 0) → jenis kesalahan */
  kata: Record<number, JenisKata>
}
export type TandaPerAyat = Record<number, TandaAyat>

export const AYAT_KRITIS_MIN = 3

export const tandaKosong = (): TandaAyat => ({ status: null, kata: {} })

export function siklusKata(sekarang: JenisKata | undefined): JenisKata | undefined {
  if (sekarang === undefined) return 'tajwid'
  if (sekarang === 'tajwid') return 'makhroj'
  return undefined
}

export function ketukKata(t: TandaAyat, index: number): TandaAyat {
  const kata = { ...t.kata }
  const next = siklusKata(kata[index])
  if (next === undefined) delete kata[index]
  else kata[index] = next
  return { ...t, kata }
}

/** Ketuk tombol status: ketuk yang sama dua kali = batal (null). */
export function setStatusAyat(t: TandaAyat, status: StatusAyat): TandaAyat {
  return { ...t, status: t.status === status ? null : status }
}

export const ayatKritis = (t: TandaAyat): boolean => Object.keys(t.kata).length >= AYAT_KRITIS_MIN

/**
 * Samakan daftar tanda dengan rentang ayat [mulai, akhir]. Tanda ayat yang masih dalam rentang DIPERTAHANKAN
 * (lebih aman daripada v2 yang mengosongkan semuanya saat rentang digeser); ayat di luar rentang dibuang.
 */
export function selaraskanRentang(prev: TandaPerAyat, mulai: number, akhir: number): TandaPerAyat {
  const out: TandaPerAyat = {}
  for (let n = mulai; n <= akhir; n++) out[n] = prev[n] ?? tandaKosong()
  return out
}

export function hitungStat(tanda: TandaPerAyat): {
  tajwid: number
  makhroj: number
  lulus: number
  gagal: number
} {
  let tajwid = 0
  let makhroj = 0
  let lulus = 0
  let gagal = 0
  for (const t of Object.values(tanda)) {
    for (const j of Object.values(t.kata)) {
      if (j === 'tajwid') tajwid++
      else if (j === 'makhroj') makhroj++
    }
    if (t.status === 'lulus') lulus++
    else if (t.status === 'gagal') gagal++
  }
  return { tajwid, makhroj, lulus, gagal }
}

const kataSalahDari = (kata: Record<number, JenisKata>): KataSalah[] =>
  Object.entries(kata)
    .map(([index, jenis]) => ({ index: Number(index), jenis }))
    .sort((a, b) => a.index - b.index)

/** Bentuk yang disimpan ke setoran.detailAyat: hanya ayat yang diberi status atau tanda kata. */
export function bangunDetailAyat(tanda: TandaPerAyat): DetailAyatItem[] {
  return Object.entries(tanda)
    .filter(([, t]) => t.status || Object.keys(t.kata).length)
    .map(([n, t]) => ({ ayat: Number(n), status: t.status, kataSalah: kataSalahDari(t.kata) }))
    .sort((a, b) => a.ayat - b.ayat)
}

/** Latihan membaca Iqro: null bila teks kosong. */
export function bangunDetailIqro(teks: string, kata: Record<number, JenisKata>): DetailBacaanIqro | null {
  const t = teks.trim()
  return t ? { teks: t, kataSalah: kataSalahDari(kata) } : null
}

/** Pecah teks bebas menjadi kata (pisah spasi), sama dengan v2. */
export const pecahKata = (teks: string): string[] => teks.split(/\s+/).filter(Boolean)

const hitungJenis = (kataSalah: KataSalah[] | undefined) => {
  let tajwid = 0
  let makhroj = 0
  for (const k of kataSalah ?? []) {
    if (k.jenis === 'tajwid') tajwid++
    else if (k.jenis === 'makhroj') makhroj++
  }
  return { tajwid, makhroj }
}

/** Ringkasan satu baris untuk kartu riwayat, kata-katanya sama dengan v2. */
export function ringkasDetailAyat(detail: DetailAyatItem[] | undefined): string {
  if (!detail?.length) return ''
  let lulus = 0
  let gagal = 0
  let tajwid = 0
  let makhroj = 0
  for (const a of detail) {
    if (a.status === 'lulus') lulus++
    if (a.status === 'gagal') gagal++
    const h = hitungJenis(a.kataSalah)
    tajwid += h.tajwid
    makhroj += h.makhroj
  }
  const parts: string[] = []
  if (lulus) parts.push(`${lulus} ayat lulus`)
  if (gagal) parts.push(`${gagal} ayat diulang`)
  if (tajwid) parts.push(`${tajwid} tajwid`)
  if (makhroj) parts.push(`${makhroj} makhroj`)
  return parts.join(' • ')
}

export function ringkasDetailIqro(d: DetailBacaanIqro | null | undefined): string {
  if (!d?.kataSalah?.length) return 'Bersih (tanpa catatan)'
  const { tajwid, makhroj } = hitungJenis(d.kataSalah)
  if (!tajwid && !makhroj) return 'Bersih (tanpa catatan)'
  const parts: string[] = []
  if (tajwid) parts.push(`${tajwid} tajwid`)
  if (makhroj) parts.push(`${makhroj} makhroj`)
  return parts.join(' • ')
}

/**
 * Samakan istilah status dari data lama. v2 memakai 'lulus' | 'ulang'. Versi awal situs baru sempat menulis
 * 'mengulang' dan 'belum'; keduanya berarti belum lulus → 'ulang'. Nilai lain/kosong → null.
 */
export function normalisasiStatus(v: unknown): StatusHafalan | null {
  if (v === 'lulus') return 'lulus'
  if (v === 'ulang' || v === 'mengulang' || v === 'belum') return 'ulang'
  return null
}

/** Dokumen setoran → record dengan status yang sudah disamakan (dipakai saat membaca dari Firestore). */
export function recordSetoran(id: string, data: Record<string, unknown>): SetoranRecord {
  return { id, ...data, statusHafalan: normalisasiStatus(data.statusHafalan) } as SetoranRecord
}
