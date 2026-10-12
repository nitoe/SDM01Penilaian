import type { AppUser } from '../types/user'
import { tingkatanDariKelas } from './akademikRumus.ts'

type Penugasan = { kelas: string; mapel: string }

/**
 * Turunkan field datar yang dibaca firestore.rules dari `penugasan` + `waliKelas`.
 * Dipakai halaman Kelola Akun (tahap berikutnya) supaya field ini tidak lagi diisi manual
 * lewat Console seperti di v2 — sumber ketidaksinkronan yang berbahaya.
 */
export function turunkanFieldRules(penugasan: Penugasan[] = []) {
  return {
    penugasanKelas: [...new Set(penugasan.map((p) => p.kelas))].sort(),
    penugasanKelasMapel: [...new Set(penugasan.map((p) => `${p.kelas}::${p.mapel}`))].sort(),
  }
}

/** Pasangan unik mapel × tingkatan (TP berlaku per tingkatan, bukan per kelas paralel). */
export function mapelTingkatanSaya(p: AppUser): { mapel: string; tingkatan: string }[] {
  const seen = new Map<string, { mapel: string; tingkatan: string }>()
  for (const x of p.penugasan ?? []) {
    const tingkatan = tingkatanDariKelas(x.kelas)
    seen.set(`${x.mapel}::${tingkatan}`, { mapel: x.mapel, tingkatan })
  }
  return [...seen.values()].sort(
    (a, b) => a.mapel.localeCompare(b.mapel, 'id') || a.tingkatan.localeCompare(b.tingkatan),
  )
}

/** Pasangan unik mapel × kelas (nilai terikat ke kelas paralel). */
export function mapelKelasSaya(p: AppUser): { mapel: string; kelas: string }[] {
  const seen = new Map<string, { mapel: string; kelas: string }>()
  for (const x of p.penugasan ?? []) seen.set(`${x.mapel}::${x.kelas}`, { mapel: x.mapel, kelas: x.kelas })
  return [...seen.values()].sort(
    (a, b) => a.mapel.localeCompare(b.mapel, 'id') || a.kelas.localeCompare(b.kelas),
  )
}
