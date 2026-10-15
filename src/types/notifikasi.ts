export type JenisNotifikasi = 'laporan_tugas' | 'laporan_kendala' | 'mutasi_siswa'
export type StatusNotifikasi = 'baru' | 'diproses' | 'selesai'
export type ArahMutasi = 'masuk' | 'keluar'

export interface MutasiSiswa {
  arah: ArahMutasi
  namaSiswa: string
  /** YYYY-MM-DD */
  tanggal: string
  keterangan?: string
}

/** Dokumen koleksi `notifikasi` (ANTIREGRESI §19). */
export interface Notifikasi {
  id: string
  jenis: JenisNotifikasi
  judul: string
  isi: string
  kelas?: string
  mutasi?: MutasiSiswa
  status: StatusNotifikasi
  catatanAdmin?: string
  dariUid: string
  dariNama: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

export const JENIS_LABEL: Record<JenisNotifikasi, string> = {
  laporan_tugas: 'Laporan tugas',
  laporan_kendala: 'Laporan kendala',
  mutasi_siswa: 'Mutasi siswa',
}

export const STATUS_LABEL: Record<StatusNotifikasi, string> = {
  baru: 'Baru',
  diproses: 'Diproses',
  selesai: 'Selesai',
}

export const BATAS_JUDUL = 120
export const BATAS_ISI = 2000
