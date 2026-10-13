import type {
  LevelHasil,
  LevelKktp,
  Mapel,
  TipeTp,
  TujuanPembelajaran,
} from '../types/akademik'

// Berkas ini MURNI (tanpa Firebase) supaya bisa diuji lewat `node scripts/cek-rumus-akademik.mjs`.

/* ==========================================================================
   Konstanta & helper murni (tanpa Firestore) — rumus ini SATU-SATUNYA sumber
   kebenaran perhitungan nilai. Jangan menghitung ulang di halaman lain
   (v2 antiregresi §8.5).
   ========================================================================== */

export const LEVEL_LABEL: Record<TipeTp, string[]> = {
  pengetahuan: ['Perlu Bimbingan', 'Cukup', 'Baik', 'Sangat Baik'],
  kinerja: ['Mulai Berkembang', 'Layak', 'Cakap', 'Mahir'],
}

export const LEVEL_RANGE_DEFAULT: Pick<LevelKktp, 'min' | 'maks'>[] = [
  { min: 0, maks: 60 },
  { min: 61, maks: 75 },
  { min: 76, maks: 85 },
  { min: 86, maks: 100 },
]

export function faseDariTingkatan(tingkatan: string | number): string {
  const t = parseInt(String(tingkatan), 10)
  if (t <= 2) return 'A'
  if (t <= 4) return 'B'
  return 'C'
}

/** "4A" / "4" → "4". */
export function tingkatanDariKelas(kelas: string): string {
  return String(kelas || '').replace(/[^0-9]/g, '')
}

export function mapelBerlakuDiTingkatan(mapel: Mapel | null | undefined, tingkatan: string): boolean {
  if (!mapel || !Array.isArray(mapel.tingkatanBerlaku) || !mapel.tingkatanBerlaku.length) return true
  return mapel.tingkatanBerlaku.includes(String(tingkatan))
}

type Angka = number | string | null | undefined
const kosong = (v: Angka) => v === '' || v === null || v === undefined

/**
 * Nilai akhir satu TP. efektifSLM = STS bila STS > SLM, selain itu SLM.
 * SAS kosong → efektifSLM saja; SAS ada → campuran sesuai bobot TP (default 60/40).
 */
export function hitungNilaiAkhirTP(
  nilaiSlm: Angka,
  nilaiSas: Angka,
  tp: Pick<TujuanPembelajaran, 'bobotSlm' | 'bobotSas'> | null | undefined,
  nilaiSts: Angka = null,
): number | null {
  if (kosong(nilaiSlm)) return null
  const slm = parseFloat(String(nilaiSlm))
  const sts = kosong(nilaiSts) ? null : parseFloat(String(nilaiSts))
  const efektif = sts !== null && sts > slm ? sts : slm
  if (kosong(nilaiSas)) return Math.round(efektif)
  const bSlm = (tp?.bobotSlm ?? 60) / 100
  const bSas = (tp?.bobotSas ?? 40) / 100
  return Math.round(efektif * bSlm + parseFloat(String(nilaiSas)) * bSas)
}

/** Level KKTP dari nilai akhir TP; di luar rentang → level terakhir (perilaku v2). */
export function tentukanLevel(
  nilaiAkhirTP: Angka,
  tp: Pick<TujuanPembelajaran, 'tipe' | 'levels'>,
): LevelHasil | null {
  if (kosong(nilaiAkhirTP)) return null
  const n = parseFloat(String(nilaiAkhirTP))
  const labels = LEVEL_LABEL[tp.tipe] || LEVEL_LABEL.pengetahuan
  const levels = tp.levels || []
  if (!levels.length) return null
  for (let i = 0; i < levels.length; i++) {
    if (n >= levels[i].min && n <= levels[i].maks) {
      return { index: i, label: labels[i], deskripsi: levels[i].deskripsi || '' }
    }
  }
  const last = levels.length - 1
  return { index: last, label: labels[last], deskripsi: levels[last]?.deskripsi || '' }
}

/**
 * Apakah TP dialokasikan ke semester tertentu.
 * - Jika `bobotPerSemester` ada: key semester harus terisi (boleh 0).
 * - Legacy: field `semester` eksklusif; tanpa semester = ikut semua (belum dikelompokkan).
 */
export function tpMasukSemester(
  tp: {
    semester?: string | null
    bobotPerSemester?: Partial<Record<string, number>> | null
  },
  semester: string,
): boolean {
  const bps = tp.bobotPerSemester
  if (bps && typeof bps === 'object' && Object.keys(bps).length > 0) {
    return Object.prototype.hasOwnProperty.call(bps, semester) && bps[semester] != null
  }
  return !tp.semester || tp.semester === semester
}

/**
 * Bobot % TP di dalam nilai akhir mapel untuk satu semester.
 * Prefer `bobotPerSemester[semester]`; fallback legacy `bobotMapel` bila semester cocok.
 * Mengembalikan null jika TP tidak dialokasikan ke semester itu.
 */
export function bobotTpDiSemester(
  tp: {
    semester?: string | null
    bobotMapel?: number | null
    bobotPerSemester?: Partial<Record<string, number>> | null
  },
  semester: string,
): number | null {
  const bps = tp.bobotPerSemester
  if (bps && typeof bps === 'object' && Object.keys(bps).length > 0) {
    if (!Object.prototype.hasOwnProperty.call(bps, semester) || bps[semester] == null) return null
    return Number(bps[semester])
  }
  if (!tp.semester || tp.semester === semester) {
    return tp.bobotMapel != null ? Number(tp.bobotMapel) : 1
  }
  return null
}

/** Normalisasi dokumen TP lama → bentuk alokasi modern (tanpa menulis Firestore). */
export function normalisasiAlokasiTp(tp: {
  semester?: string | null
  bobotMapel?: number | null
  bobotPerSemester?: Partial<Record<string, number>> | null
}): Partial<Record<'1' | '2', number>> {
  const bps = tp.bobotPerSemester
  if (bps && typeof bps === 'object' && Object.keys(bps).length > 0) {
    const out: Partial<Record<'1' | '2', number>> = {}
    if (bps['1'] != null) out['1'] = Number(bps['1'])
    if (bps['2'] != null) out['2'] = Number(bps['2'])
    return out
  }
  if (tp.semester === '1' || tp.semester === '2') {
    return { [tp.semester]: tp.bobotMapel != null ? Number(tp.bobotMapel) : 1 }
  }
  return {}
}

/** Rata-rata tertimbang nilai akhir TP; dinormalisasi terhadap entri yang punya nilai. */
export function hitungNilaiAkhirMapel(entries: { nilai: Angka; bobot?: number | null }[]): number | null {
  const valid = (entries || [])
    .map((e) => ({ nilai: e?.nilai, bobot: e?.bobot ?? 1 }))
    .filter((e) => !kosong(e.nilai) && e.bobot > 0)
  if (!valid.length) return null
  const totalBobot = valid.reduce((a, e) => a + e.bobot, 0)
  const total = valid.reduce((a, e) => a + parseFloat(String(e.nilai)) * e.bobot, 0)
  return Math.round(total / totalBobot)
}

/**
 * Ubah bobot satu kelompok TP (SATU semester) jadi persen bulat yang total tepat 100,
 * tanpa mengubah rasio (largest remainder). Pemanggil wajib menyaring ke satu semester.
 */
export function normalisasiPersenBobotMapel(
  tpList: Pick<TujuanPembelajaran, 'id' | 'bobotMapel'>[],
): { id: string; bobotBaru: number }[] {
  if (!tpList.length) return []
  const asal = tpList.map((tp) => Math.max(0, tp.bobotMapel ?? 1))
  const total = asal.reduce((a, b) => a + b, 0)
  const eksak = total > 0 ? asal.map((v) => (v / total) * 100) : tpList.map(() => 100 / tpList.length)
  const lantai = eksak.map(Math.floor)
  const sisa = 100 - lantai.reduce((a, b) => a + b, 0)
  const urutan = eksak.map((v, i) => ({ i, frac: v - lantai[i] })).sort((a, b) => b.frac - a.frac)
  const hasil = [...lantai]
  for (let k = 0; k < sisa && k < urutan.length; k++) hasil[urutan[k].i] += 1
  return tpList.map((tp, i) => ({ id: tp.id, bobotBaru: hasil[i] }))
}

/**
 * Validasi 4 level KKTP: angka 0–100, min ≤ maks, naik tanpa tumpang tindih.
 * (Validasi ini TAMBAHAN dibanding v2, yang hanya memeriksa nama TP.)
 * @returns pesan galat, atau null bila valid.
 */
export function validasiLevels(levels: LevelKktp[]): string | null {
  if (levels.length !== 4) return 'KKTP harus terdiri dari 4 level.'
  for (let i = 0; i < 4; i++) {
    const { min, maks } = levels[i]
    if (![min, maks].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) {
      return `Level ${i + 1}: rentang harus berupa angka 0–100.`
    }
    if (min > maks) return `Level ${i + 1}: nilai minimum lebih besar dari maksimum.`
    if (i > 0 && min <= levels[i - 1].maks) {
      return `Level ${i + 1} tumpang tindih dengan level ${i}. Minimum harus lebih besar dari maksimum level sebelumnya.`
    }
  }
  return null
}
