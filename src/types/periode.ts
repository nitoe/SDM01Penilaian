/** Periode akademik (tahun ajaran + semester) yang dikelola admin. */
export type Semester = '1' | '2'

export interface PeriodeAkademik {
  /** ID dokumen, contoh "2026-2027_1" */
  id: string
  /** Format "2026/2027" */
  tahunAjaran: string
  semester: Semester
  /** Apakah bisa dipilih oleh guru biasa saat login */
  aktif: boolean
  /** Label tampilan, contoh "Ganjil 2026/2027" */
  label?: string
  /** Tanggal rapor semester 1 (kelas 1–6) */
  tglRaporKelas1sampai6Sem1?: string
  /** Tanggal rapor semester 2 kelas 1–5 */
  tglRaporKelas1sampai5Sem2?: string
  /** Tanggal rapor semester 2 kelas 6 */
  tglRaporKelas6Sem2?: string
  kotaRapor?: string
  /** Hanya satu yang true — dipakai sebagai default saat login */
  isDefault?: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export function buatIdPeriode(tahunAjaran: string, semester: Semester): string {
  const normal = tahunAjaran.trim().replace(/\//g, '-')
  return `${normal}_${semester}`
}

export function labelPeriode(
  p: Pick<PeriodeAkademik, 'tahunAjaran' | 'semester' | 'label'>,
): string {
  if (p.label?.trim()) return p.label.trim()
  const sem = p.semester === '2' ? 'Genap' : 'Ganjil'
  return `${sem} ${p.tahunAjaran}`
}

export function labelSemester(s: Semester): string {
  return s === '2' ? 'Semester 2 (Genap)' : 'Semester 1 (Ganjil)'
}
