import type { Semester } from './akademik'

/** Data pelengkap Rapor SAS yang diisi wali kelas (ANTIREGRESI §23). Nilai TIDAK disimpan di sini. */

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

/** Master kegiatan ekstrakurikuler (`ekstrakurikuler`), dikelola admin. ID dokumen = slug nama. */
export interface Ekstrakurikuler {
  id: string
  nama: string
  aktif: boolean
}

/** Level 1–3 tampil di rapor; 4 = tidak ikut (disaring dari rapor). */
export const EKS_LEVEL_LABEL = ['Layak', 'Cakap', 'Mahir', 'Tidak Ikut'] as const
export type LevelEkskul = 1 | 2 | 3 | 4

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
}

export const BATAS_CATATAN = 1000
export const BATAS_KOKURIKULER = 2000
export const BATAS_EKSKUL_DESKRIPSI = 500
export const BATAS_HARI = 366
