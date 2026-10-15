import { listAkunStaf } from './akunGuruData'
import { namaDenganGelar, type AppUser } from '../types/user'

/** Nama wali kelas untuk tanda tangan cetak. Admin mencari dari daftar akun; guru hanya dirinya sendiri. */
export async function cariWaliKelas(kelas: string, profil: AppUser): Promise<string> {
  if (profil.role !== 'admin') return profil.waliKelas?.includes(kelas) ? namaDenganGelar(profil) : ''
  try {
    const daftar = await listAkunStaf()
    return daftar
      .filter((u) => u.aktif !== false && (u.role === 'guru' || u.role === 'guru_akademik') && u.waliKelas?.includes(kelas))
      .map(namaDenganGelar)
      .join(', ')
  } catch {
    return ''
  }
}

/** Nama guru Tahsin-Tahfizh yang mengampu kelas itu. */
export async function cariGuruTahsin(kelas: string, profil: AppUser): Promise<string> {
  if (profil.role !== 'admin') return profil.kelasAmpu?.includes(kelas) ? namaDenganGelar(profil) : ''
  try {
    const daftar = await listAkunStaf()
    return daftar
      .filter((u) => u.aktif !== false && (u.role === 'guru' || u.role === 'guru_tahsin_tahfizh') && u.kelasAmpu?.includes(kelas))
      .map(namaDenganGelar)
      .join(', ')
  } catch {
    return ''
  }
}
