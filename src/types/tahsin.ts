/** Tipe data modul Tahsin-Tahfizh */

export type JenjangTahsin = 'iqro' | 'quran'

export type JenisSetoran = 'ziyadah' | 'murojaah' | 'tahsin'

export type StatusHafalan = 'lulus' | 'mengulang' | 'belum'

export interface SiswaTahsin {
  id: string
  nama: string
  nis?: string
  kelas: string
  jenjang: JenjangTahsin
  /** true = siswa Iqro sudah pindah ke materi Al-Qur'an */
  tamatIqro?: boolean
  aktif?: boolean
}

export interface MateriQuran {
  tipe: 'quran'
  surahAwal: number
  ayatMulai: number
  surahAkhir: number
  ayatAkhir: number
  totalAyat: number
  label: string
}

export interface MateriIqro {
  tipe: 'iqro'
  buku: number
  halamanMulai: number
  halamanAkhir: number
  label: string
}

export type MateriSetoran = MateriQuran | MateriIqro

export interface SetoranPayload {
  siswaId: string
  siswaNama: string
  kelas: string
  jenjang: JenjangTahsin
  jenis: JenisSetoran
  materi: MateriSetoran
  detailAyat?: { ayat: number; status?: string; kataSalah?: { index: number; jenis: string }[] }[]
  detailBacaanIqro?: { teks: string; kataSalah?: { index: number; jenis: string }[] } | null
  statusHafalan: StatusHafalan | null
  catatan: string
  createdByNama: string
}

export interface AuthScope {
  role: string
  kelasAmpu?: string[]
}

export const SEMUA_KELAS = [
  '1A', '1B', '1C',
  '2A', '2B',
  '3A', '3B', '3C',
  '4A', '4B',
  '5A', '5B', '5C',
  '6A', '6B',
] as const
