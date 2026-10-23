import type {
  AspekMenulis,
  KesalahanMenulis,
  MenulisRecord,
  PenilaianMenulis,
} from '../types/tahsin.ts'
import { KESALAHAN_MENULIS_LABEL } from '../types/tahsin.ts'

// Logika murni penilaian menulis Tahsin-Tahfizh (Catat Menulis). Tanpa Firebase agar bisa diuji:
//   npx tsx scripts/cek-menulis.mts   (ANTIREGRESI §18)
//
// Rancangan: tiga aspek inti dengan skala 1–4 yang masuk rata-rata, ditambah Kerapian sebagai aspek
// pelengkap yang boleh kosong dan tidak masuk rata-rata. Nama kunci sama dengan v2.

export interface AspekInfo {
  key: AspekMenulis
  label: string
  /** Apa yang diperiksa guru (satu baris). */
  periksa: string
  /** Indikator per level; indeks 0 = level 1 … indeks 3 = level 4. */
  level: [string, string, string, string]
}

export const ASPEK_INTI: AspekInfo[] = [
  {
    key: 'hurufSambungan',
    label: 'Huruf & Sambungan',
    periksa: 'Bentuk huruf, titik, posisi awal/tengah/akhir, dan huruf yang tidak bisa disambung.',
    level: [
      'Banyak huruf salah sehingga sulit dibaca',
      'Beberapa huruf tertukar atau salah sambung',
      'Sedikit salah (titik atau sambungan), huruf tetap jelas',
      'Semua benar',
    ],
  },
  {
    key: 'harakat',
    label: 'Harakat & Tanda Baca',
    periksa: 'Fathah, kasrah, dhammah, tanwin, sukun, tasydid, dan mad.',
    level: [
      'Hampir tidak ada atau salah',
      'Sering terlewat atau tertukar',
      'Sedikit terlewat atau salah letak',
      'Lengkap dan tepat letaknya',
    ],
  },
  {
    key: 'keutuhanTeks',
    label: 'Kelengkapan Teks',
    periksa: 'Tidak ada kata atau ayat yang hilang, tertukar, atau tertambah.',
    level: [
      'Banyak bagian hilang',
      'Beberapa bagian terlewat',
      '1 bagian kecil terlewat atau salah',
      'Utuh',
    ],
  },
]

/** Aspek pelengkap: opsional, tidak masuk rata-rata. */
export const ASPEK_KERAPIAN: { label: string; periksa: string; level: [string, string, string, string] } = {
  label: 'Kerapian & keterbacaan',
  periksa: 'Ukuran, jarak, dan garis tulisan. Opsional, tidak masuk rata-rata.',
  level: ['Sulit dibaca', 'Kurang rapi', 'Cukup rapi dan terbaca', 'Rapi dan jelas'],
}

export const LEVEL_MENULIS_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: 'Perlu bimbingan',
  2: 'Cukup',
  3: 'Baik',
  4: 'Sangat baik',
}

/** Nilai awal setiap aspek: guru hanya mengubah yang menyimpang. */
export const SKOR_AWAL = 3

export const URUTAN_KESALAHAN: KesalahanMenulis[] = [
  'huruf-mirip',
  'salah-sambung',
  'bentuk-posisi',
  'harakat-hilang',
  'tasydid-tanwin',
  'bagian-terlewat',
]

const bulat1 = (n: number) => Math.round(n * 10) / 10

/** Skor sah = bilangan bulat 1–4. */
export function skorSah(v: unknown): v is 1 | 2 | 3 | 4 {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4
}

/**
 * Rata-rata tiga aspek inti (skala 1–4, satu desimal). Kerapian TIDAK ikut. Aspek yang kosong atau di luar
 * 1–4 dilewati; null bila tidak ada satu pun skor sah.
 */
export function rataInti(p: PenilaianMenulis | Record<string, unknown> | null | undefined): number | null {
  if (!p) return null
  const v = ASPEK_INTI.map((a) => (p as Record<string, unknown>)[a.key]).filter(skorSah)
  return v.length ? bulat1(v.reduce((a, b) => a + b, 0) / v.length) : null
}

export type NamaLevel = 'Sangat baik' | 'Baik' | 'Cukup' | 'Perlu bimbingan'

/** Nama level dari rata-rata (batas sama dengan narasi laporan: ≥3.5, ≥2.5, ≥1.5). */
export function levelDariRata(rata: number): NamaLevel {
  if (rata >= 3.5) return 'Sangat baik'
  if (rata >= 2.5) return 'Baik'
  if (rata >= 1.5) return 'Cukup'
  return 'Perlu bimbingan'
}

/** Susun isian penilaian untuk disimpan: skor dipaksa bulat 1–4; kerapian null bila tidak dinilai. */
export function bangunPenilaian(input: {
  hurufSambungan: number
  harakat: number
  keutuhanTeks: number
  kerapian: number | null
}): Required<PenilaianMenulis> {
  const jepit = (n: number) => Math.min(4, Math.max(1, Math.round(Number.isFinite(n) ? n : SKOR_AWAL)))
  return {
    hurufSambungan: jepit(input.hurufSambungan),
    harakat: jepit(input.harakat),
    keutuhanTeks: jepit(input.keutuhanTeks),
    kerapian: input.kerapian == null ? null : jepit(input.kerapian),
  }
}

/** Kesalahan umum: hanya kunci yang dikenal, tanpa duplikat, urutan tetap. */
export function bangunKesalahan(daftar: Iterable<string>): KesalahanMenulis[] {
  const ada = new Set(daftar)
  return URUTAN_KESALAHAN.filter((k) => ada.has(k))
}

type Waktu = MenulisRecord['createdAt'] | string | number | null | undefined

function keMs(v: Waktu): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string') return new Date(v).getTime() || 0
  return typeof v === 'object' && 'seconds' in v ? v.seconds * 1000 : 0
}

/** Waktu catatan: tanggal periksa bila ada, kalau tidak waktu dibuat. */
export function waktuCatatan(r: MenulisRecord): number {
  return keMs((r.tanggalPeriksa as Waktu) || r.createdAt)
}

/** Urut terbaru → terlama, tanpa mengubah array asli. */
export function urutTerbaru(daftar: MenulisRecord[]): MenulisRecord[] {
  return [...daftar].sort((a, b) => waktuCatatan(b) - waktuCatatan(a))
}

export interface RingkasanMenulis {
  jumlah: number
  /** Rata-rata per aspek inti dari semua catatan yang memuat aspek itu; null bila tidak ada. */
  perAspek: Record<AspekMenulis, number | null>
  /** Rata-rata ketiga aspek inti (rata dari rata-rata tiap aspek). */
  rata: number | null
  /** Rata-rata Kerapian dari catatan yang mengisinya (di luar rata-rata inti). */
  kerapian: number | null
  /** Selisih rata-rata catatan terbaru dengan sebelumnya; null bila kurang dari dua catatan bernilai. */
  tren: 'naik' | 'turun' | 'tetap' | null
  kesalahanTerbanyak: { kunci: KesalahanMenulis; label: string; jumlah: number }[]
}

function rataDari(nilai: number[]): number | null {
  return nilai.length ? bulat1(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null
}

/**
 * Ringkasan catatan menulis satu siswa. Bila `periode` diberikan, hanya catatan dengan tahun ajaran dan
 * semester yang sama yang dihitung (catatan tanpa periode tidak ikut, sama dengan isolasi periode setoran).
 * Tren: selisih rata-rata inti catatan terbaru dengan sebelumnya, ambang ±0.3.
 */
export function ringkasMenulis(
  catatan: MenulisRecord[],
  periode?: { tahunAjaran: string; semester: string } | null,
): RingkasanMenulis {
  const dipakai = urutTerbaru(
    periode
      ? catatan.filter((r) => r.tahunAjaran === periode.tahunAjaran && String(r.semester) === periode.semester)
      : catatan,
  )

  const perAspek = {} as Record<AspekMenulis, number | null>
  for (const a of ASPEK_INTI) {
    perAspek[a.key] = rataDari(
      dipakai.map((r) => (r.penilaian as Record<string, unknown> | undefined)?.[a.key]).filter(skorSah),
    )
  }
  const nilaiAspek = Object.values(perAspek).filter((x): x is number => x != null)

  const kerapian = rataDari(
    dipakai.map((r) => (r.penilaian as Record<string, unknown> | undefined)?.kerapian).filter(skorSah),
  )

  const ratarata = dipakai.map((r) => rataInti(r.penilaian)).filter((x): x is number => x != null)
  let tren: RingkasanMenulis['tren'] = null
  if (ratarata.length >= 2) {
    const selisih = ratarata[0]! - ratarata[1]!
    tren = selisih >= 0.3 ? 'naik' : selisih <= -0.3 ? 'turun' : 'tetap'
  }

  const hitung = new Map<KesalahanMenulis, number>()
  for (const r of dipakai) for (const k of bangunKesalahan(r.kesalahan ?? [])) hitung.set(k, (hitung.get(k) ?? 0) + 1)
  const kesalahanTerbanyak = [...hitung.entries()]
    .sort((a, b) => b[1] - a[1] || URUTAN_KESALAHAN.indexOf(a[0]) - URUTAN_KESALAHAN.indexOf(b[0]))
    .map(([kunci, jumlah]) => ({ kunci, label: KESALAHAN_MENULIS_LABEL[kunci], jumlah }))

  return {
    jumlah: dipakai.length,
    perAspek,
    rata: rataDari(nilaiAspek),
    kerapian,
    tren,
    kesalahanTerbanyak,
  }
}
