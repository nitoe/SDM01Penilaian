/** Tipe data modul Akademik & Rapor (dimigrasi dari v2 `firestore-data-akademik.js`). */

export type Semester = '1' | '2'
export type TipeTp = 'pengetahuan' | 'kinerja'

export interface LevelKktp {
  min: number
  maks: number
  deskripsi: string
}

/** Dokumen `mapel/{nama}` — ID dokumen = nama mapel persis. */
export interface Mapel {
  id: string
  nama: string
  urutan?: number
  tingkatanBerlaku?: string[]
}

/** Dokumen `tp_kktp/{id}` — satu TP per mapel per TINGKATAN (bukan per kelas paralel). */
export interface TujuanPembelajaran {
  id: string
  mapel: string
  tingkatan: string
  fase?: string
  nomorTp: number
  namaTp: string
  cp?: string
  tipe: TipeTp
  /** Bobot SLM/SAS di dalam satu TP (persen, default 60/40). */
  bobotSlm?: number
  bobotSas?: number
  /** Bobot TP di dalam nilai akhir mapel (persen per SEMESTER). Diatur di halaman Bobot Semester. */
  bobotMapel?: number
  semester?: Semester
  levels: LevelKktp[]
}

export interface ConfigAkademik {
  semesterAktif: Semester
  tahunAjaran: string
  namaSekolah?: string
  npsn?: string
  alamatSekolah?: string
  telpSekolah?: string
  namaKepsek?: string
  nbmKepsek?: string
  kotaRapor?: string
  seniSemesterGanjil?: string
  seniSemesterGenap?: string
  tglRapor?: string
  tglRapor1sampai5?: string
  dplSemesterIni?: string[]
  [k: string]: unknown
}

/** Dokumen `nilai_tp/{id}` — HANYA SLM (SAS/STS punya koleksi sendiri). */
export interface NilaiTpDoc {
  id: string
  tpId: string
  siswaId: string
  mapel: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  slm: number
}

export type JenisAsesmen = 'sts' | 'sas'

/** Dokumen `asesmen_cakupan/{id}` — TP yang diikutkan STS atau SAS. */
export interface AsesmenCakupan {
  id: string
  mapel: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  jenis: JenisAsesmen
  tpIds: string[]
}

/** Dokumen `nilai_sts` atau `nilai_sas`. */
export interface NilaiAsesmenDoc {
  id: string
  tpId: string
  siswaId: string
  mapel: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  nilai: number
}

export interface LevelHasil {
  index: number
  label: string
  deskripsi: string
}
