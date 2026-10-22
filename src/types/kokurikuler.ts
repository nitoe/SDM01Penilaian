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

export interface MapelTerlibatStem {
  mapel: string
  tpId: string
  namaTp?: string
  jenisNilai: JenisNilaiProyek
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
  /** Aspek observasi/penilaian yang dapat diisi guru (bukan nilai mapel). */
  daftarNilai?: string[]
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

export interface CatatanKebiasaan {
  catatan: string
  dplId: string
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
