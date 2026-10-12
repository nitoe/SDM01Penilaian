/** Role pengguna di sistem penilaian */
export type UserRole =
  | 'admin'
  | 'guru'
  | 'guru_tahsin_tahfizh'
  | 'guru_akademik'
  | 'orangtua'

export type ParentStatus = 'pending' | 'approved' | 'rejected'

export interface AppUser {
  uid: string
  email: string
  nama: string
  role: UserRole
  /** Kelas yang diampu (untuk guru) — contoh: ["5A", "5B"] */
  kelasAmpu?: string[]
  /** Status akun orang tua */
  status?: ParentStatus
  /** ID siswa yang menjadi anak (untuk orang tua) */
  anakIds?: string[]
  /** Penugasan mapel (untuk guru akademik) */
  penugasan?: { kelas: string; mapel: string }[]
  /** Kelas tempat guru menjadi wali kelas (guru akademik). */
  waliKelas?: string[]
  /**
   * Field datar turunan `penugasan`, dibaca firestore.rules (rules tidak bisa menelusuri array
   * of map). WAJIB sinkron dengan `penugasan` — lihat `turunkanFieldRules()` di lib/penugasan.ts.
   */
  penugasanKelas?: string[]
  /** Format "KELAS::MAPEL", mis. "4A::Matematika". */
  penugasanKelasMapel?: string[]
  /**
   * `false` = tidak boleh masuk dan rules menolak akses.
   * Tidak ada / `true` = aktif. Hanya admin yang boleh mengubahnya.
   */
  aktif?: boolean
  createdAt?: string
  updatedAt?: string
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  guru: 'Guru',
  guru_tahsin_tahfizh: 'Guru Tahsin-Tahfizh',
  guru_akademik: 'Guru Akademik',
  orangtua: 'Orang Tua',
}
