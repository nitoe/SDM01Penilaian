import type { UserRole } from '../types/user'

/** Hak akses menu di sisi UI. Penegakan sebenarnya tetap di firestore.rules. */
export const isAdminRole = (r: UserRole) => r === 'admin'
export const canTahsin = (r: UserRole) =>
  r === 'admin' || r === 'guru' || r === 'guru_tahsin_tahfizh'
export const canAkademik = (r: UserRole) =>
  r === 'admin' || r === 'guru' || r === 'guru_akademik'
export const isStaff = (r: UserRole) => canTahsin(r) || canAkademik(r)
/** Guru yang boleh menulis TP/nilai: guru mapel, atau kombinasi Tahsin + akademik. Admin tidak. */
export const isGuruAkademikRole = (r: UserRole) => r === 'guru_akademik' || r === 'guru'
