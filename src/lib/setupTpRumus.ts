// Logika murni untuk halaman Setup TP & KKTP (daftar, saringan, navigasi). Tanpa Firebase/React,
// supaya bisa diuji: node --experimental-strip-types scripts/cek-setup-tp.mjs
import type { TujuanPembelajaran } from '../types/akademik'

/** Jumlah level KKTP per TP. */
export const JUMLAH_LEVEL_KKTP = 4

type TpRingkas = Pick<TujuanPembelajaran, 'nomorTp' | 'namaTp' | 'levels'>

/** Berapa dari 4 level KKTP yang deskripsinya sudah terisi (spasi saja dianggap kosong). */
export function jumlahKktpTerisi(tp: Pick<TujuanPembelajaran, 'levels'>): number {
  return (tp.levels || []).filter((l) => typeof l?.deskripsi === 'string' && l.deskripsi.trim() !== '').length
}

export function kktpLengkap(tp: Pick<TujuanPembelajaran, 'levels'>): boolean {
  return jumlahKktpTerisi(tp) >= JUMLAH_LEVEL_KKTP
}

export type FilterTp = 'semua' | 'kktp-kurang'

/**
 * Saring daftar TP. `cari` cocok dengan nomor atau nama (tanpa peduli huruf besar/kecil); awalan "TP"
 * boleh diketik ("tp 12"). Urutan asli dipertahankan.
 */
export function saringTp<T extends TpRingkas>(list: T[], opsi: { cari: string; filter: FilterTp }): T[] {
  const q = opsi.cari
    .trim()
    .toLowerCase()
    .replace(/^tp\s*/, '')
  return list.filter((tp) => {
    if (opsi.filter === 'kktp-kurang' && kktpLengkap(tp)) return false
    if (!q) return true
    return `${tp.nomorTp} ${tp.namaTp}`.toLowerCase().includes(q)
  })
}

/** Posisi TP `id` di `list` (urutan tampil) beserta tetangganya. `indeks` = -1 bila tidak ditemukan. */
export function tetanggaTp<T extends { id: string }>(
  list: T[] | null | undefined,
  id: string | undefined,
): { indeks: number; sebelumnya?: T; berikutnya?: T } {
  if (!list || !id) return { indeks: -1 }
  const indeks = list.findIndex((t) => t.id === id)
  if (indeks < 0) return { indeks: -1 }
  return { indeks, sebelumnya: list[indeks - 1], berikutnya: list[indeks + 1] }
}

/** Nomor TP baru = nomor terbesar + 1 (bukan jumlah TP, agar tidak bentrok bila ada nomor yang bolong). */
export function nomorTpBerikut(list: { nomorTp?: number }[] | null | undefined): number {
  return Math.max(0, ...(list ?? []).map((t) => t.nomorTp || 0)) + 1
}
