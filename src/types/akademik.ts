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

/**
 * Dokumen `tp_kktp/{id}` — satu TP per mapel per KELAS paralel.
 * Sengaja tidak dibagi antarkelas (5A ≠ 5B) agar setiap guru menyusun TP & KKTP sendiri.
 * `tingkatan` disimpan sebagai turunan kelas (untuk fase), bukan kunci unik.
 */
export interface TujuanPembelajaran {
  id: string
  mapel: string
  /** Kelas paralel, contoh "5A". Wajib untuk dokumen baru. */
  kelas: string
  tingkatan: string
  fase?: string
  nomorTp: number
  namaTp: string
  cp?: string
  tipe: TipeTp
  /** Bobot SLM/SAS di dalam satu TP (persen, default 60/40). */
  bobotSlm?: number
  bobotSas?: number
  /**
   * Legacy: semester eksklusif (1 ATAU 2). Dipertahankan untuk dokumen lama.
   * Sumber kebenaran baru: `bobotPerSemester` (boleh keduanya).
   */
  semester?: Semester
  /** Legacy: bobot % di semester eksklusif. Fallback bila `bobotPerSemester` kosong. */
  bobotMapel?: number
  /**
   * Alokasi bobot per semester. Key yang ada = TP dipakai di semester itu.
   * Nilai = % kontribusi terhadap nilai akhir mapel di semester tersebut (total ideal 100 per semester).
   * TP boleh masuk semester 1 dan 2 sekaligus dengan bobot berbeda.
   */
  bobotPerSemester?: Partial<Record<Semester, number>>
  levels: LevelKktp[]
  /** Hanya untuk mapel Seni Budaya: Seni Rupa | Seni Musik | Seni Tari | Seni Teater. */
  disiplinSeni?: string
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
  /** @deprecated Pilihan seni sekarang per-kelas di koleksi seni_kelas. */
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

/**
 * Dokumen `asesmen_cakupan/{id}` — TP yang diikutkan STS atau SAS.
 *
 * `tpBobot` = bobot relatif antar TP **hanya untuk rata-rata leger/rapor STS (atau SAS)**.
 * Tidak mempengaruhi rumus nilai akhir mapel (SLM/STS/SAS global di hitungNilaiAkhirTP).
 * Bila kosong: tiap TP cakupan dianggap bobot 1 (setara).
 */
export interface AsesmenCakupan {
  id: string
  mapel: string
  kelas: string
  tingkatan: string
  semester: Semester
  tahunAjaran: string
  jenis: JenisAsesmen
  tpIds: string[]
  /** Bobot relatif per tpId untuk rata-rata leger/rapor jenis ini saja. */
  tpBobot?: Record<string, number>
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
