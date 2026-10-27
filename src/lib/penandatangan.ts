import { listAkunStaf } from './akunGuruData'
import { namaDenganGelar, type AppUser } from '../types/user'

export interface InfoWaliKelas {
  nama: string
  /** Download URL gambar tanda tangan digital, bila sudah diunggah. */
  ttdUrl?: string
  /** NBM guru, bila terisi di profil. */
  nbm?: string
}

/** Nama + URL TTD + NBM wali kelas untuk tanda tangan cetak. */
export async function cariWaliKelasLengkap(kelas: string, profil: AppUser): Promise<InfoWaliKelas> {
  if (profil.role !== 'admin') {
    if (profil.waliKelas?.includes(kelas)) {
      return {
        nama: namaDenganGelar(profil),
        ttdUrl: profil.ttdUrl?.trim() || undefined,
        nbm: profil.nbm?.trim() || undefined,
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
    return {
      nama: wali.map(namaDenganGelar).join(', '),
      ttdUrl: wali.length === 1 ? wali[0].ttdUrl?.trim() || undefined : undefined,
      nbm: wali.length === 1 ? wali[0].nbm?.trim() || undefined : undefined,
    }
  } catch {
    return { nama: '' }
  }
}

export async function cariWaliKelas(kelas: string, profil: AppUser): Promise<string> {
  const info = await cariWaliKelasLengkap(kelas, profil)
  return info.nama
}

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
