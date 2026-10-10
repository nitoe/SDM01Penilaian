import type { UserRole } from '../types/user'

/** Hak akses menu di sisi UI. Penegakan sebenarnya tetap di firestore.rules. */
export const isAdminRole = (r: UserRole) => r === 'admin'
export const canTahsin = (r: UserRole) =>
  r === 'admin' || r === 'guru' || r === 'guru_tahsin_tahfizh'
export const canAkademik = (r: UserRole) =>
  r === 'admin' || r === 'guru' || r === 'guru_akademik'
export const isStaff = (r: UserRole) => canTahsin(r) || canAkademik(r)
