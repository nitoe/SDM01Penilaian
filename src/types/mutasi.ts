/** Mutasi siswa masuk / keluar — diajukan wali kelas, disetujui admin. */

export type ArahMutasi = 'masuk' | 'keluar'
export type StatusPengajuanMutasi = 'diajukan' | 'disetujui' | 'ditolak' | 'dibatalkan'

/** Cuplikan data siswa yang disimpan di pengajuan & arsip. */
export interface SnapshotSiswaMutasi {
  id: string
  nama: string
  nis?: string
  nisn?: string
  kelas: string
  jk?: string
  tempatLahir?: string
  tanggalLahir?: string
  sekolahAsal?: string
}

export interface PengajuanMutasi {
  id: string
  arah: ArahMutasi
  status: StatusPengajuanMutasi
  /** YYYY-MM-DD */
  tanggal: string
  alasan: string
  /** Sekolah asal (masuk) atau tujuan (keluar) */
  sekolahTerkait?: string
  catatan?: string
  /** Kelas yang diwalikan pengaju (otorisasi rules) */
  kelas: string
  /** Wajib untuk keluar; untuk masuk diisi setelah disetujui / dari form */
  siswaId?: string
  siswaNama: string
  snapshot?: SnapshotSiswaMutasi
  /** Data calon siswa masuk (sebelum ada di koleksi siswa) */
  calonMasuk?: {
    nis?: string
    nisn?: string
    jk?: string
    tempatLahir?: string
    tanggalLahir?: string
    jenjang?: 'iqro' | 'quran'
  }
  diajukanOleh: string
  diajukanNama: string
  diajukanAt?: Date | null
  diprosesOleh?: string
  diprosesNama?: string
  diprosesAt?: Date | null
  catatanAdmin?: string
  /** ID dokumen di siswa_mutasi setelah disetujui */
  arsipId?: string
}

/** Arsip resmi — hanya admin. */
export interface ArsipSiswaMutasi {
  id: string
  arah: ArahMutasi
  tanggal: string
  alasan: string
  sekolahTerkait?: string
  catatan?: string
  kelas: string
  siswaId: string
  siswaNama: string
  snapshot: SnapshotSiswaMutasi
  pengajuanId: string
  diajukanOleh: string
  diajukanNama: string
  disetujuiOleh: string
  disetujuiNama: string
  disetujuiAt?: Date | null
  tahunAjaran?: string
  semester?: string
}

export const ARAH_LABEL: Record<ArahMutasi, string> = {
  masuk: 'Masuk',
  keluar: 'Keluar',
}

export const STATUS_PENGAJUAN_LABEL: Record<StatusPengajuanMutasi, string> = {
  diajukan: 'Menunggu persetujuan',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
}

export const BATAS_ALASAN = 500
export const BATAS_CATATAN = 500
