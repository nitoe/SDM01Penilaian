/** Tipe data modul Tahsin-Tahfizh */

export type JenjangTahsin = 'iqro' | 'quran'
export type JenisSetoran = 'ziyadah' | 'murojaah' | 'tahsin'
/** Status satu setoran hafalan. Istilah mengikuti v2: 'lulus' atau 'ulang' (Perlu diulang). */
export type StatusHafalan = 'lulus' | 'ulang'
/** Tanda per kata saat Baca & Tandai: 1× ketuk = tajwid, 2× = makhroj. */
export type JenisKata = 'tajwid' | 'makhroj'
/** Status per ayat saat Baca & Tandai. */
export type StatusAyat = 'lulus' | 'gagal'

export interface KataSalah {
  index: number
  jenis: JenisKata
}

/** Bentuk yang disimpan di setoran.detailAyat (sama dengan v2). */
export interface DetailAyatItem {
  ayat: number
  status: StatusAyat | null
  kataSalah: KataSalah[]
}

/** Bentuk yang disimpan di setoran.detailBacaanIqro (sama dengan v2). */
export interface DetailBacaanIqro {
  teks: string
  kataSalah: KataSalah[]
}

export type JenisKelamin = 'L' | 'P'

export interface SiswaTahsin {
  id: string
  nama: string
  /** NIPD / nomor induk lokal — juga dipakai sebagai document ID */
  nis?: string
  nipd?: string
  nisn?: string
  kelas: string
  jenjang: JenjangTahsin
  tamatIqro?: boolean
  aktif?: boolean
  jk?: JenisKelamin | string
  tempatLahir?: string
  tanggalLahir?: string
  agama?: string
  alamat?: string
  rt?: string
  rw?: string
  kelurahan?: string
  kecamatan?: string
  kodePos?: string
  hp?: string
  email?: string
  ayahNama?: string
  ayahPekerjaan?: string
  ibuNama?: string
  ibuPekerjaan?: string
  sekolahAsal?: string
  beratBadan?: number | null
  tinggiBadan?: number | null
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
  detailAyat?: DetailAyatItem[]
  detailBacaanIqro?: DetailBacaanIqro | null
  statusHafalan: StatusHafalan | null
  catatan: string
  createdByNama: string
  /** Periode akademik — wajib diisi saat simpan (dokumen lama boleh kosong) */
  tahunAjaran?: string
  semester?: '1' | '2'
}

export interface SetoranRecord extends SetoranPayload {
  id: string
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null
  createdBy?: string | null
}

export interface MenulisRecord {
  id: string
  siswaId: string
  siswaNama?: string
  kelas: string
  materi?: { label?: string; tipe?: string; [k: string]: unknown }
  catatan?: string
  tanggalPeriksa?: string
  createdAt?: { seconds: number; nanoseconds: number } | string | Date | null
  createdBy?: string | null
  [k: string]: unknown
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

export const JENIS_LABEL: Record<JenisSetoran, string> = {
  ziyadah: 'Ziyadah',
  murojaah: "Muroja'ah",
  tahsin: 'Tahsin',
}

export const STATUS_LABEL: Record<StatusHafalan, string> = {
  lulus: 'Lulus',
  ulang: 'Perlu diulang',
}
