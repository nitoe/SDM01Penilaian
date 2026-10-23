import type { Semester } from './akademik'

/**
 * Kokurikuler: DPL + Proyek STEM + 7KAIH.
 * Nilai mapel/TP di proyek STEM hanya metadata dokumentasi — TIDAK ditulis ke nilai_tp/SLM.
 */

/** 4 level observasi DPL (skala resmi panduan STEM). Index 0–3. */
export const DPL_LEVEL_LABEL = [
  'Belum Terlihat',
  'Mulai Terlihat',
  'Berkembang Sesuai Harapan',
  'Sangat Berkembang',
] as const

/** Level numerik 1–4 (selaras index+1 label di atas). */
export type LevelDpl = 1 | 2 | 3 | 4

/** 8 nama baku Dimensi Profil Lulusan (bukan Profil Pelajar Pancasila nasional). */
export const DPL_NAMA_BAKU = [
  'Keimanan & Ketakwaan',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
] as const

/** Koleksi `dpl` — per kelas, dikelola wali kelas. */
export interface Dpl {
  id: string
  kelas: string
  tingkatan: string
  nama: string
  urutan: number
  aktif: boolean
  /** Empat kalimat deskripsi, satu per level (index 0 = Belum Terlihat). */
  levelDeskripsi: [string, string, string, string]
}

/** Keterkaitan mapel di proyek STEM (metadata saja; tidak menulis nilai_tp). */
export type JenisNilaiProyek = 'SLM' | 'SAS'

/**
 * Satu baris mapel+TP. Mapel yang sama boleh muncul beberapa kali
 * (lebih dari satu TP per mapel).
 */
export interface MapelTerlibatStem {
  mapel: string
  tpId: string
  namaTp?: string
  jenisNilai: JenisNilaiProyek
}

/**
 * Rentang angka 0–100 selaras skala predikat AI / LEVEL_RANGE_DEFAULT.
 * Index 0 = D (0–74), 1 = C (75–83), 2 = B (84–89), 3 = A (90–100).
 */
export const STEM_NILAI_RANGE = [
  { min: 0, maks: 74, label: 'D' },
  { min: 75, maks: 83, label: 'C' },
  { min: 84, maks: 89, label: 'B' },
  { min: 90, maks: 100, label: 'A' },
] as const

/** Aspek rubrik penilaian produk/proses proyek (bukan DPL, bukan nilai_tp). */
export interface RubrikAspekStem {
  id: string
  nama: string
  /** Opsional: taut ke mapel terlibat. */
  mapel?: string
  /** Empat deskripsi sesuai STEM_NILAI_RANGE. */
  deskripsiRentang: [string, string, string, string]
}

/** Koleksi `proyek_stem` — hanya wali kelas. */
export interface ProyekStem {
  id: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  judul: string
  /** Ringkasan tujuan & konteks proyek (boleh diisi AI). */
  deskripsi?: string
  mapelTerlibat: MapelTerlibatStem[]
  /** 2–4 id DPL aktif yang diamati (AI biasanya mengisi 3). */
  dplId: string[]
  tanggalMulai: string
  tanggalSelesai: string
  jumlahPertemuan: number
  /** Langkah per pertemuan (scaffolding). */
  scaffolding?: string[]
  /**
   * Legacy: daftar nama aspek singkat.
   * Prefer `rubrik` jika ada.
   */
  daftarNilai?: string[]
  /** Rubrik terstruktur untuk instrumen penilaian 0–100. */
  rubrik?: RubrikAspekStem[]
}

/**
 * Koleksi `kokurikuler` — nilai level DPL per siswa × proyek STEM × DPL.
 * Bukan `kokurikuler_rapor` (deskripsi gabungan final untuk cetak SAS).
 */
export interface NilaiDplStem {
  id: string
  siswaId: string
  dplId: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  proyekStemId: string
  level: LevelDpl
  deskripsi: string
}

/**
 * Koleksi `nilai_proyek_stem` — skor 0–100 per aspek rubrik × siswa.
 * Doc id: {proyekStemId}_{siswaId}. Tidak menyentuh nilai_tp.
 */
export interface NilaiProyekStem {
  id: string
  proyekStemId: string
  siswaId: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  /** aspekId → 0–100 (atau null jika belum diisi). */
  nilai: Record<string, number | null>
}

/** 7 kebiasaan resmi 7KAIH (urutan tetap). */
export const DAFTAR_KEBIASAAN_7KAIH = [
  { id: 'bangunPagi', label: 'Bangun Pagi' },
  { id: 'beribadah', label: 'Beribadah' },
  { id: 'olahraga', label: 'Berolahraga' },
  { id: 'makanSehat', label: 'Makan Sehat dan Bergizi' },
  { id: 'gemarBelajar', label: 'Gemar Belajar' },
  { id: 'bermasyarakat', label: 'Bermasyarakat' },
  { id: 'tidurCepat', label: 'Tidur Cepat' },
] as const

export type Kebiasaan7KaihId = (typeof DAFTAR_KEBIASAAN_7KAIH)[number]['id']

/** Sulit diverifikasi guru — boleh dikosongkan. */
export const KEBIASAAN_SULIT_VERIFIKASI_7KAIH: readonly Kebiasaan7KaihId[] = [
  'bangunPagi',
  'tidurCepat',
  'makanSehat',
]

/** Satu kebiasaan 7KAIH: level 1–4 (utama); catatan/dplId opsional (legacy). */
export interface CatatanKebiasaan {
  level: LevelDpl | null
  catatan?: string
  dplId?: string
}

/** Koleksi `g7kaih` — satu dokumen per siswa × semester. */
export interface G7kaih {
  id: string
  siswaId: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  kebiasaan: Record<string, CatatanKebiasaan>
}

export const BATAS_DPL_DESKRIPSI = 500
export const BATAS_STEM_JUDUL = 200
export const BATAS_7KAIH_CATATAN = 500
export const BATAS_NILAI_DPL_DESKRIPSI = 500

/** Label predikat dari angka 0–100 (selaras STEM_NILAI_RANGE). */
export function predikatDariNilaiStem(n: number | null | undefined): string | null {
  if (n == null || Number.isNaN(n)) return null
  const v = Math.max(0, Math.min(100, Math.round(n)))
  for (const r of STEM_NILAI_RANGE) {
    if (v >= r.min && v <= r.maks) return r.label
  }
  return STEM_NILAI_RANGE[STEM_NILAI_RANGE.length - 1].label
}

/** Rata-rata skor aspek rubrik proyek (abaikan null/kosong). */
export function rataNilaiProyek(
  nilai: Record<string, number | null | undefined> | null | undefined,
): number | null {
  if (!nilai) return null
  const nums: number[] = []
  for (const v of Object.values(nilai)) {
    if (v == null || Number.isNaN(Number(v))) continue
    nums.push(Math.max(0, Math.min(100, Number(v))))
  }
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

/**
 * Map rata-rata 0–100 → LevelDpl 1–4 mengikuti STEM_NILAI_RANGE
 * (index 0 → level 1, …, index 3 → level 4).
 */
export function levelDplDariNilaiStem(n: number | null | undefined): LevelDpl | null {
  if (n == null || Number.isNaN(n)) return null
  const v = Math.max(0, Math.min(100, Number(n)))
  for (let i = 0; i < STEM_NILAI_RANGE.length; i++) {
    const r = STEM_NILAI_RANGE[i]
    if (v >= r.min && v <= r.maks) return (i + 1) as LevelDpl
  }
  return 4
}
