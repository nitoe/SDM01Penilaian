import { SEMUA_KELAS } from '../types/tahsin'
import type { AppUser } from '../types/user'

export interface KelasSaya {
  /** Kelas yang diwalikan */
  wali: string[]
  /** Kelas tempat mengajar mapel (dari `penugasan`), tanpa duplikat */
  mengajar: string[]
  /** Gabungan wali + mengajar, urut kelas 1A → 6B */
  semua: string[]
}

const URUTAN: readonly string[] = SEMUA_KELAS

function urut(list: string[]): string[] {
  return [...new Set(list)].sort((a, b) => URUTAN.indexOf(a) - URUTAN.indexOf(b))
}

/**
 * Kelas milik guru AKADEMIK (wali kelas + penugasan mapel).
 * `kelasAmpu` sengaja tidak ikut: itu khusus guru Tahsin-Tahfizh.
 */
export function kelasSaya(p: AppUser): KelasSaya {
  const wali = urut(p.waliKelas ?? [])
  const mengajar = urut((p.penugasan ?? []).map((x) => x.kelas))
  return { wali, mengajar, semua: urut([...wali, ...mengajar]) }
}

/** Ringkasan satu baris untuk kartu "Masuk sebagai". */
export function ringkasKelas(p: AppUser): string {
  const k = kelasSaya(p)
  const bagian: string[] = []
  if (k.wali.length) bagian.push(`Wali kelas ${k.wali.join(', ')}`)
  else if (k.mengajar.length) bagian.push(`Mengajar ${k.mengajar.length} kelas`)
  if (p.role === 'guru_tahsin_tahfizh' && p.kelasAmpu?.length) {
    bagian.push(`Tahsin ${p.kelasAmpu.join(', ')}`)
  }
  return bagian.join(' · ')
}
