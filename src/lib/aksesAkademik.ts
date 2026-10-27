import type { Mapel } from '../types/akademik.ts'
import type { AppUser } from '../types/user.ts'
import { SEMUA_KELAS } from '../types/tahsin.ts'
import { mapelBerlakuDiTingkatan, tingkatanDariKelas } from './akademikRumus.ts'
import { ekuivalenMapel } from './tpImport.ts'
import { isAdminRole } from './roles.ts'

type AkunAkses = Pick<AppUser, 'role' | 'waliKelas' | 'penugasan'>

const TINGKAT = ['1', '2', '3', '4', '5', '6']

function unik<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const item of items) seen.set(key(item), item)
  return [...seen.values()]
}

<<<<<<< HEAD

=======
>>>>>>> 6d35930d91f3682f312000ebfc080fb6d878fe52
/** Cocokkan nama penugasan ke master mapel (termasuk alias IPAS/PJOK). */
function temukanMapelMaster(mapel: Mapel[], namaPenugasan: string): Mapel | undefined {
  return mapel.find((m) => m.nama === namaPenugasan || ekuivalenMapel(m.nama, namaPenugasan))
}

function tingkatMapel(m: Mapel): string[] {
  return m.tingkatanBerlaku?.length ? [...m.tingkatanBerlaku] : [...TINGKAT]
}

/** Mapel × tingkatan yang boleh dibuka untuk Setup TP dan bobot. Guru kelas: semua mapel di tingkat kelas walinya. */
export function aksesMapelTingkatan(akun: AkunAkses, mapel: Mapel[]): { mapel: string; tingkatan: string }[] {
  const out: { mapel: string; tingkatan: string }[] = []
  if (isAdminRole(akun.role)) {
    for (const m of mapel) {
      for (const tingkatan of tingkatMapel(m)) out.push({ mapel: m.nama, tingkatan })
    }
  } else {
    const tingkatWali = new Set((akun.waliKelas ?? []).map((k) => tingkatanDariKelas(k)).filter(Boolean))
    for (const tingkatan of tingkatWali) {
      for (const m of mapel) {
        if (mapelBerlakuDiTingkatan(m, tingkatan)) out.push({ mapel: m.nama, tingkatan })
      }
    }
    for (const p of akun.penugasan ?? []) {
      const tingkatan = tingkatanDariKelas(p.kelas)
      if (!p.mapel || !tingkatan) continue
      const master = temukanMapelMaster(mapel, p.mapel)
      if (master && !mapelBerlakuDiTingkatan(master, tingkatan)) continue
      // Pakai nama resmi master agar URL/input/leger konsisten (IPAS/PJOK, bukan nama panjang)
      out.push({ mapel: master?.nama ?? p.mapel, tingkatan })
    }
  }
  return unik(out, (x) => `${x.mapel}|${x.tingkatan}`).sort(
    (a, b) => a.mapel.localeCompare(b.mapel, 'id') || a.tingkatan.localeCompare(b.tingkatan),
  )
}

/** Mapel × kelas untuk input dan laporan nilai. Guru kelas mendapat setiap mapel di kelas yang diwalikan. */
export function aksesMapelKelas(akun: AkunAkses, mapel: Mapel[]): { mapel: string; kelas: string }[] {
  const out: { mapel: string; kelas: string }[] = []
  const kelasAdmin = isAdminRole(akun.role) ? [...SEMUA_KELAS] : []
  const kelasWali = isAdminRole(akun.role) ? kelasAdmin : [...(akun.waliKelas ?? [])]
  for (const kelas of kelasWali) {
    const tingkatan = tingkatanDariKelas(kelas)
    for (const m of mapel) {
      if (mapelBerlakuDiTingkatan(m, tingkatan)) out.push({ mapel: m.nama, kelas })
    }
  }
  if (!isAdminRole(akun.role)) {
    for (const p of akun.penugasan ?? []) {
      if (!p.mapel || !p.kelas) continue
      const master = temukanMapelMaster(mapel, p.mapel)
      if (master && !mapelBerlakuDiTingkatan(master, tingkatanDariKelas(p.kelas))) continue
      // Nama resmi master → nilai baru tersimpan di bawah IPAS/PJOK; alias baca menangani data lama
      out.push({ mapel: master?.nama ?? p.mapel, kelas: p.kelas })
    }
  }
  return unik(out, (x) => `${x.mapel}|${x.kelas}`).sort(
    (a, b) => a.mapel.localeCompare(b.mapel, 'id') || a.kelas.localeCompare(b.kelas, 'id'),
  )
}
