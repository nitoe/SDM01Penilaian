import type { JenjangTahsin, SetoranRecord } from '../types/tahsin'
import { SURAH_LIST, surahByNo } from './quranSurah'

/**
 * Logika murni Target Hafalan dan progres siswa terhadap target (tanpa Firebase, bisa diuji).
 * Aturan mengikuti v2: tahsin-tahfizh/target-hafalan.html, assets/firestore-data.js (hitungProgresSurah),
 * dan blok Target di riwayat-siswa.html.
 */

/** Dokumen `target_hafalan/{kelas}`. Kelas Iqro memakai targetJilid/targetHalaman; kelas Al-Qur'an memakai targetSurah. */
export interface TargetHafalan {
  kelas: string
  /** Periode yang berlaku (multi-tahun) */
  tahunAjaran?: string
  semester?: '1' | '2'

  jenjang: JenjangTahsin
  labelSemester?: string
  targetSurah?: number[]
  targetJilid?: number
  targetHalaman?: number
}

/** Kelas 1–2 = jenjang Iqro, 3–6 = Al-Qur'an (sama dengan inferJenjang pada data siswa). */
export function jenjangKelas(kelas: string): JenjangTahsin {
  const n = parseInt(kelas, 10)
  return Number.isFinite(n) && n <= 2 ? 'iqro' : 'quran'
}

/** Juz 30 = An-Naba (78) sampai An-Nas (114); Juz 29 = Al-Mulk (67) sampai Al-Mursalat (77). */
export const SURAH_JUZ_30: number[] = SURAH_LIST.filter((s) => s.no >= 78).map((s) => s.no)
export const SURAH_JUZ_29: number[] = SURAH_LIST.filter((s) => s.no >= 67 && s.no <= 77).map((s) => s.no)

export interface InputTarget {
  labelSemester: string
  surah: Iterable<number>
  jilid: number
  halaman: number
}

/** Bentuk yang disimpan (sama dengan v2); `kelas`, `updatedBy`, `updatedAt` ditambahkan saat simpan. */
export function bangunTarget(
  kelas: string,
  input: InputTarget,
): Omit<TargetHafalan, 'kelas'> {
  const jenjang = jenjangKelas(kelas)
  const dasar = { jenjang, labelSemester: input.labelSemester.trim() }
  if (jenjang === 'iqro') {
    return {
      ...dasar,
      targetJilid: Math.min(6, Math.max(1, Math.round(input.jilid) || 1)),
      targetHalaman: Math.max(1, Math.round(input.halaman) || 1),
    }
  }
  return { ...dasar, targetSurah: [...new Set(input.surah)].filter((n) => n >= 1 && n <= 114).sort((a, b) => a - b) }
}

export interface ProgresSurah {
  surahNo: number
  maxAyatAkhir: number
}

/**
 * Progres per surah target: hanya setoran ziyadah berstatus lulus, materi Al-Qur'an dalam SATU surah
 * (surahAwal = surahAkhir = surah target); diambil ayat akhir tertinggi.
 */
export function hitungProgresSurah(
  targetSurah: number[] | undefined,
  riwayat: SetoranRecord[],
): ProgresSurah[] {
  return (targetSurah ?? []).map((surahNo) => {
    let max = 0
    for (const r of riwayat) {
      const m = r.materi
      if (r.jenis !== 'ziyadah' || r.statusHafalan !== 'lulus' || m?.tipe !== 'quran') continue
      if (m.surahAwal !== surahNo || m.surahAkhir !== surahNo) continue
      max = Math.max(max, m.ayatAkhir || 0)
    }
    return { surahNo, maxAyatAkhir: max }
  })
}

export const persenSurah = (p: ProgresSurah): number => {
  const s = surahByNo(p.surahNo)
  return s ? Math.min(100, Math.round((p.maxAyatAkhir / s.ayat) * 100)) : 0
}

export const surahTercapai = (p: ProgresSurah): boolean => {
  const s = surahByNo(p.surahNo)
  return Boolean(s) && p.maxAyatAkhir >= s.ayat
}

/** Posisi Iqro terakhir dari setoran Iqro terbaru (riwayat harus terurut terbaru → lama). */
export function posisiIqro(riwayat: SetoranRecord[]): { jilid: number; halaman: number } {
  const r = riwayat.find((x) => x.materi?.tipe === 'iqro')
  return r?.materi?.tipe === 'iqro'
    ? { jilid: r.materi.buku || 1, halaman: r.materi.halamanAkhir || 0 }
    : { jilid: 1, halaman: 0 }
}

export function iqroTercapai(
  target: Pick<TargetHafalan, 'targetJilid' | 'targetHalaman'>,
  pos: { jilid: number; halaman: number },
): boolean {
  const tj = target.targetJilid ?? 1
  const th = target.targetHalaman ?? 1
  return pos.jilid > tj || (pos.jilid === tj && pos.halaman >= th)
}

export interface KualitasBacaan {
  sesi: number
  ayatDinilai: number
  tajwid: number
  makhroj: number
}

/** Kualitas bacaan dari 5 sesi terbaru yang punya data Baca & Tandai (Al-Qur'an) atau Latihan Membaca (Iqro). Null bila tidak ada. */
export function ringkasKualitasBacaan(riwayat: SetoranRecord[]): KualitasBacaan | null {
  const sesi = riwayat.filter((r) => r.detailAyat?.length || r.detailBacaanIqro).slice(0, 5)
  if (!sesi.length) return null
  let ayatDinilai = 0
  let tajwid = 0
  let makhroj = 0
  const hitung = (k: { jenis: string }[] | undefined) => {
    for (const x of k ?? []) {
      if (x.jenis === 'tajwid') tajwid++
      else if (x.jenis === 'makhroj') makhroj++
    }
  }
  for (const r of sesi) {
    if (r.detailAyat?.length) {
      for (const a of r.detailAyat) {
        ayatDinilai++
        hitung(a.kataSalah)
      }
    } else if (r.detailBacaanIqro) {
      ayatDinilai++ // satu latihan dihitung 1
      hitung(r.detailBacaanIqro.kataSalah)
    }
  }
  return { sesi: sesi.length, ayatDinilai, tajwid, makhroj }
}
