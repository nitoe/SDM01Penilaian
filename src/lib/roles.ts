import type { UserRole } from '../types/user'

/** Hak akses menu di sisi UI. Penegakan sebenarnya tetap di firestore.rules. */
export const isAdminRole = (r: UserRole) => r === 'admin'
export const canTahsin = (r: UserRole) =>
  r === 'admin' || r === 'guru' || r === 'guru_tahsin_tahfizh'
export const canAkademik = (r: UserRole) =>
  r === 'admin' || r === 'guru' || r === 'guru_akademik'
export const isStaff = (r: UserRole) => canTahsin(r) || canAkademik(r)
/** Guru yang boleh menulis TP/nilai: guru kelas, guru bidang studi, atau kombinasi dengan Tahsin. Admin tidak. */
export const isGuruAkademikRole = (r: UserRole) => r === 'guru_akademik' || r === 'guru'
/** Guru yang boleh menulis setoran/target Tahsin-Tahfizh. Admin hanya memantau (ANTIREGRESI §17). */
export const isGuruTahsinRole = (r: UserRole) => r === 'guru_tahsin_tahfizh' || r === 'guru'

/**
 * Teks menu/halaman yang berbeda untuk administrator. Admin tidak menyusun TP, bobot, nilai, maupun
 * setoran: semua itu tanggung jawab guru kelas dan guru bidang studi (ANTIREGRESI §17).
 * Satu tempat supaya nama menu admin tidak tersebar dan tidak menyimpang antar halaman.
 */
export function teksPeran<T extends string>(admin: boolean, guru: T, adminTeks: T): T {
  return admin ? adminTeks : guru
}
