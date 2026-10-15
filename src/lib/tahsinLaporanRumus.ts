import type { SetoranRecord } from '../types/tahsin.ts'

// Rumus murni laporan cetak Tahsin-Tahfizh per kelas (ANTIREGRESI §20). Capaian terhadap target
// (butuh quranSurah) dihitung di laporanTahsin.ts; berkas ini hanya menghitung/mengelompokkan setoran.

const ms = (v: SetoranRecord['createdAt']): number => {
  if (!v) return 0
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string') return new Date(v).getTime() || 0
  return typeof v === 'object' && 'seconds' in v ? v.seconds * 1000 : 0
}

/** Kelompokkan per siswa, terbaru dulu (urutan dipakai posisiIqro). */
export function kelompokkanSetoran(setoran: SetoranRecord[]): Record<string, SetoranRecord[]> {
  const hasil: Record<string, SetoranRecord[]> = {}
  for (const s of setoran) (hasil[s.siswaId] ||= []).push(s)
  for (const k of Object.keys(hasil)) hasil[k].sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
  return hasil
}

export interface RingkasSetoranSiswa {
  total: number
  ziyadah: number
  murojaah: number
  tahsin: number
  lulus: number
  ulang: number
  /** epoch ms setoran terakhir; 0 bila belum ada */
  terakhir: number
}

export function ringkasSetoranSiswa(daftar: SetoranRecord[] = []): RingkasSetoranSiswa {
  const r: RingkasSetoranSiswa = { total: daftar.length, ziyadah: 0, murojaah: 0, tahsin: 0, lulus: 0, ulang: 0, terakhir: 0 }
  for (const s of daftar) {
    if (s.jenis === 'ziyadah') r.ziyadah++
    else if (s.jenis === 'murojaah') r.murojaah++
    else if (s.jenis === 'tahsin') r.tahsin++
    if (s.statusHafalan === 'lulus') r.lulus++
    else if (s.statusHafalan === 'ulang') r.ulang++
    r.terakhir = Math.max(r.terakhir, ms(s.createdAt))
  }
  return r
}

export interface RingkasKelasTahsin {
  jumlahSiswa: number
  sudahSetor: number
  belumSetor: number
  totalSetoran: number
  /** siswa yang target-nya dapat dinilai (ada target + jenjang cocok) */
  dinilai: number
  tercapai: number
}

/** `tercapai`: id siswa → true/false, null/undefined = tidak dapat dinilai (tanpa target). */
export function ringkasKelasTahsin(
  siswaIds: string[],
  perSiswa: Record<string, RingkasSetoranSiswa>,
  tercapai: Record<string, boolean | null | undefined>,
): RingkasKelasTahsin {
  const sudah = siswaIds.filter((id) => (perSiswa[id]?.total ?? 0) > 0).length
  const dinilai = siswaIds.filter((id) => typeof tercapai[id] === 'boolean')
  return {
    jumlahSiswa: siswaIds.length,
    sudahSetor: sudah,
    belumSetor: siswaIds.length - sudah,
    totalSetoran: siswaIds.reduce((n, id) => n + (perSiswa[id]?.total ?? 0), 0),
    dinilai: dinilai.length,
    tercapai: dinilai.filter((id) => tercapai[id] === true).length,
  }
}
