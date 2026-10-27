import { listAkunStaf } from './akunGuruData'
import { namaDenganGelar, type AppUser } from '../types/user'

export interface InfoWaliKelas {
  nama: string
  /** Download URL gambar tanda tangan digital, bila sudah diunggah. */
  ttdUrl?: string
}

/** Nama + URL TTD wali kelas untuk tanda tangan cetak. Admin mencari dari daftar akun; guru hanya dirinya sendiri. */
export async function cariWaliKelasLengkap(kelas: string, profil: AppUser): Promise<InfoWaliKelas> {
  if (profil.role !== 'admin') {
    if (profil.waliKelas?.includes(kelas)) {
      return {
        nama: namaDenganGelar(profil),
        ttdUrl: profil.ttdUrl?.trim() || undefined,
      }
    }
    return { nama: '' }
  }
  try {
    const daftar = await listAkunStaf()
    const wali = daftar.filter(
      (u) =>
        u.aktif !== false &&
        (u.role === 'guru' || u.role === 'guru_akademik') &&
        u.waliKelas?.includes(kelas),
    )
    if (!wali.length) return { nama: '' }
    // Satu wali: pakai TTD-nya. Beberapa wali: gabung nama, TTD hanya bila tepat satu orang.
    return {
      nama: wali.map(namaDenganGelar).join(', '),
      ttdUrl: wali.length === 1 ? wali[0].ttdUrl?.trim() || undefined : undefined,
    }
  } catch {
    return { nama: '' }
  }
}

/** Nama wali kelas untuk tanda tangan cetak. Admin mencari dari daftar akun; guru hanya dirinya sendiri. */
export async function cariWaliKelas(kelas: string, profil: AppUser): Promise<string> {
  const info = await cariWaliKelasLengkap(kelas, profil)
  return info.nama
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
