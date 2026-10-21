import type { Semester } from './akademik'

/** Data pelengkap Rapor SAS yang diisi wali kelas / pengampu ekskul (ANTIREGRESI §23). Nilai TIDAK disimpan di sini. */

export const KEPUTUSAN_OPSI = ['Belum diputuskan', 'Naik Kelas', 'Tinggal Kelas'] as const
export type KeputusanKenaikan = (typeof KEPUTUSAN_OPSI)[number]

/** Koleksi `absensi_rapor`, satu dokumen per siswa × periode. */
export interface AbsensiRapor {
  siswaId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  sakit: number
  izin: number
  tanpaKeterangan: number
  catatanWali: string
  keputusan: KeputusanKenaikan
}

/** Koleksi `kokurikuler_rapor`, satu dokumen per siswa × periode. */
export interface KokurikulerRapor {
  siswaId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  deskripsi: string
}

/**
 * Predikat capaian ekskul untuk template deskripsi (C / B / A).
 * Dipetakan ke level integer yang sudah dipakai rapor: C=1 Layak, B=2 Cakap, A=3 Mahir.
 * Predikat TIDAK dicetak di rapor — hanya deskripsi capaian.
 */
export const PREDIKAT_EKSKUL = ['C', 'B', 'A'] as const
export type PredikatEkskul = (typeof PREDIKAT_EKSKUL)[number]

/** Template deskripsi capaian per predikat (disimpan di master ekstrakurikuler). */
export interface DeskripsiCapaianTemplate {
  predikat: PredikatEkskul
  /** Teks yang bisa dipilih guru saat input; dicetak di rapor. */
  teks: string
}

/**
 * Master kegiatan ekstrakurikuler (`ekstrakurikuler`), dikelola admin.
 * ID dokumen = slug nama.
 * pengampuUids: guru yang diizinkan menginput nilai ekskul ini (bisa lebih dari satu).
 */
export interface Ekstrakurikuler {
  id: string
  nama: string
  aktif: boolean
  /** UID guru pengampu yang sudah disetujui admin. */
  pengampuUids?: string[]
  /** Nama singkat aktivitas yang sering dipakai (opsional, untuk dropdown). */
  aktivitas?: string[]
  /** Template deskripsi capaian per predikat C/B/A (opsional). */
  deskripsiCapaian?: DeskripsiCapaianTemplate[]
}

/** Level 1–3 tampil di rapor; 4 = tidak ikut (disaring dari rapor). */
export const EKS_LEVEL_LABEL = ['Layak', 'Cakap', 'Mahir', 'Tidak Ikut'] as const
export type LevelEkskul = 1 | 2 | 3 | 4

/** Mapping predikat huruf → level integer. */
export function predikatKeLevel(p: PredikatEkskul): LevelEkskul {
  if (p === 'A') return 3
  if (p === 'B') return 2
  return 1
}

export function levelKePredikat(level: LevelEkskul): PredikatEkskul | null {
  if (level === 3) return 'A'
  if (level === 2) return 'B'
  if (level === 1) return 'C'
  return null
}

/** Koleksi `ekstrakurikuler_siswa`. */
export interface EkskulSiswa {
  id: string
  siswaId: string
  kelas: string
  semester: Semester
  tahunAjaran: string
  ekskulId: string
  nama: string
  level: LevelEkskul
  deskripsi: string
  /** Aktivitas/kegiatan spesifik (opsional, tidak dicetak di rapor). */
  aktivitas?: string
  /** UID penginput (pengampu atau wali). */
  diisiOleh?: string
}

/**
 * Pengajuan guru menjadi pengampu ekskul (`ekstrakurikuler_ajukan`).
 * ID: `{ekskulId}__{uid}` agar satu guru satu pengajuan per ekskul.
 */
export interface EkskulAjukan {
  id: string
  ekskulId: string
  ekskulNama: string
  uid: string
  namaGuru: string
  status: 'pending' | 'disetujui' | 'ditolak'
  catatan?: string
  createdAt?: unknown
  updatedAt?: unknown
}

export const BATAS_CATATAN = 1000
export const BATAS_KOKURIKULER = 2000
export const BATAS_EKSKUL_DESKRIPSI = 500
export const BATAS_HARI = 366
export const BATAS_AKTIVITAS = 120
