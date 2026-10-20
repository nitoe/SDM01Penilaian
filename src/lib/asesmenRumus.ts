import type { TujuanPembelajaran } from '../types/akademik.ts'
import { bobotTpDiSemester, hitungNilaiAkhirMapel, hitungNilaiAkhirTP, tentukanLevel } from './akademikRumus.ts'

// Rumus murni nilai STS/SAS untuk rapor cetak (ANTIREGRESI §21). Tanpa Firebase agar bisa diuji:
// node --experimental-strip-types scripts/cek-laporan-cetak.mjs

type TpRumus = Pick<TujuanPembelajaran, 'id' | 'semester' | 'bobotMapel' | 'bobotPerSemester' | 'bobotSlm' | 'bobotSas'>
/** tpId → siswaId → entri */
type PerTp<T> = Record<string, Record<string, T> | undefined>

/** Bobot TP untuk STS: bobot semester bila > 0, lalu bobotMapel, lalu 1. Sama dengan Rapor STS (raporSts.ts). */
export function bobotUntukSts(tp: Pick<TpRumus, 'semester' | 'bobotMapel' | 'bobotPerSemester'>, semester: string): number {
  const b = bobotTpDiSemester(tp, semester)
  if (b != null && b > 0) return b
  return tp.bobotMapel != null && tp.bobotMapel > 0 ? Number(tp.bobotMapel) : 1
}

type SumberSas = {
  slm: PerTp<{ slm: number }>
  sts: PerTp<{ nilai: number }>
  sas: PerTp<{ nilai: number }>
  cakupanSas: Set<string>
}

/** Nilai akhir satu TP: SLM, STS (bila lebih tinggi menggantikan SLM), dan SAS hanya bila TP masuk cakupan SAS. */
function nilaiAkhirPerTp(tp: TpRumus & Pick<TujuanPembelajaran, 'tipe' | 'levels'>, data: SumberSas, siswaId: string) {
  const sas = data.cakupanSas.has(tp.id) ? (data.sas[tp.id]?.[siswaId]?.nilai ?? null) : null
  return hitungNilaiAkhirTP(data.slm[tp.id]?.[siswaId]?.slm, sas, tp, data.sts[tp.id]?.[siswaId]?.nilai ?? null)
}

/**
 * Nilai SAS (akhir) mapel + bahan capaian satu siswa. Sama dengan "Akhir" di halaman Nilai STS & SAS:
 * per TP digabung (SLM, STS, SAS), lalu dirata-rata menurut bobot TP semester (bobot 0 tidak dihitung).
 * Capaian: deskripsi KKTP TP bernilai akhir tertinggi dan terendah (pola v1/v2), TP terendah hanya bila beda TP.
 */
export function hitungSasMapel(
  tpSemester: TpUntukCapaian[],
  data: SumberSas,
  siswaId: string,
  semester: string,
): HasilStsMapel {
  const hasil: HasilStsMapel = { nilaiAkhir: null, capaianTerbaik: '', capaianPerluBimbingan: '', levelIndexTerbaik: null }
  if (!tpSemester.length) return hasil
  const perTp = tpSemester.map((tp) => ({
    tp,
    nilai: nilaiAkhirPerTp(tp, data, siswaId),
    bobot: bobotTpDiSemester(tp, semester) ?? 0,
  }))
  hasil.nilaiAkhir = hitungNilaiAkhirMapel(perTp.map((x) => ({ nilai: x.nilai, bobot: x.bobot })))
  const terisi = perTp
    .filter((x) => x.nilai != null && Number.isFinite(x.nilai))
    .map((x) => ({ tp: x.tp as TpUntukCapaian, nilai: Number(x.nilai) }))
  isiCapaianDariTerisi(hasil, terisi)
  return hasil
}

/** Nilai SAS (akhir) mapel satu siswa saja (tanpa capaian). */
export function nilaiSasMapel(
  tpSemester: TpRumus[],
  data: SumberSas,
  siswaId: string,
  semester: string,
): number | null {
  return hitungNilaiAkhirMapel(
    tpSemester.map((tp) => ({
      nilai: nilaiAkhirPerTp(tp as TpRumus & Pick<TujuanPembelajaran, 'tipe' | 'levels'>, data, siswaId),
      bobot: bobotTpDiSemester(tp, semester) ?? 0,
    })),
  )
}

/**
 * Muatan Yayasan pada rapor (A.2) — mengikuti rapor v1 (ISMUBA di luar Al-Islam): Bahasa Arab dan
 * Kemuhammadiyahan. Mapel lain masuk Muatan Wajib (A.1). Ubah di sini bila susunan rapor berubah.
 */
export const MUATAN_YAYASAN = ['Bahasa Arab', 'Kemuhammadiyahan'] as const

export function muatanMapel(nama: string): 'wajib' | 'yayasan' {
  return (MUATAN_YAYASAN as readonly string[]).includes(nama) ? 'yayasan' : 'wajib'
}

/** TP minimal untuk menyusun fragmen capaian (perlu namaTp sebagai cadangan). */
export type TpUntukCapaian = TpRumus & Pick<TujuanPembelajaran, 'tipe' | 'levels' | 'namaTp'>

/**
 * Fragmen capaian dari satu TP + nilainya.
 * Utama: deskripsi KKTP pada level yang cocok dengan nilai.
 * Cadangan: nama TP (huruf awal kecil) agar baris capaian tetap muncul
 * bila guru belum mengisi deskripsi level tersebut.
 */
export function fragmenDariTpNilai(
  nilai: number,
  tp: Pick<TujuanPembelajaran, 'tipe' | 'levels' | 'namaTp'>,
): { deskripsi: string; levelIndex: number | null } {
  const lv = tentukanLevel(nilai, tp)
  const desk = String(lv?.deskripsi ?? '').trim()
  if (desk) return { deskripsi: desk, levelIndex: lv?.index ?? null }
  const nama = String(tp.namaTp ?? '').trim()
  if (!nama) return { deskripsi: '', levelIndex: lv?.index ?? null }
  return {
    deskripsi: nama.charAt(0).toLowerCase() + nama.slice(1),
    levelIndex: lv?.index ?? null,
  }
}

/**
 * Isi capaianTerbaik + capaianPerluBimbingan dari daftar TP yang punya nilai.
 * - ≥1 TP terisi → selalu ada capaianTerbaik
 * - ≥2 TP berbeda → selalu ada capaianPerluBimbingan (TP nilai terendah)
 * Ini menjamin setiap mapel menampilkan dua baris bila ada diferensiasi TP.
 */
export function isiCapaianDariTerisi(
  hasil: Pick<HasilStsMapel, 'capaianTerbaik' | 'capaianPerluBimbingan' | 'levelIndexTerbaik'>,
  terisi: { tp: TpUntukCapaian; nilai: number }[],
): void {
  if (!terisi.length) return
  const urut = [...terisi].sort((a, b) => Number(b.nilai) - Number(a.nilai))
  const terbaik = urut[0]
  const terendah = urut[urut.length - 1]
  const best = fragmenDariTpNilai(terbaik.nilai, terbaik.tp)
  hasil.capaianTerbaik = best.deskripsi
  hasil.levelIndexTerbaik = best.levelIndex
  if (terendah.tp.id !== terbaik.tp.id) {
    hasil.capaianPerluBimbingan = fragmenDariTpNilai(terendah.nilai, terendah.tp).deskripsi
  }
}

export interface HasilStsMapel {
  nilaiAkhir: number | null
  /** deskripsi KKTP TP bernilai tertinggi (tanpa awalan kalimat) */
  capaianTerbaik: string
  /** deskripsi KKTP TP bernilai terendah; kosong bila hanya satu TP terisi */
  capaianPerluBimbingan: string
  /**
   * Indeks level KKTP (0–3) dari nilai TP tertinggi.
   * Dipakai memilih awalan kalimat agar tidak selalu "sangat baik"
   * (mis. nilai 34 → level 0 → "Masih memerlukan bimbingan dalam …").
   */
  levelIndexTerbaik: number | null
}

/**
 * Nilai akhir STS + bahan kalimat capaian satu mapel untuk satu siswa. Dipakai Rapor STS satu siswa
 * dan seluruh kelas supaya hasilnya identik (ANTIREGRESI §21).
 */
/**
 * Nilai akhir STS + bahan kalimat capaian satu mapel untuk satu siswa.
 *
 * - Nilai akhir: hanya dari `tpCakupan` (TP yang masuk Setup Cakupan STS).
 * - Capaian terbaik/terburuk: dari `tpUntukCapaian` bila diberikan, else `tpCakupan`.
 *   Pool capaian memuat semua TP semester yang punya nilai STS siswa, supaya
 *   diferensiasi dua baris tetap muncul meski cakupan STS belum lengkap.
 * - Bila deskripsi KKTP level kosong, fragmen memakai nama TP (cadangan).
 */
export function hitungStsMapel(
  tpCakupan: TpUntukCapaian[],
  sts: PerTp<{ nilai: number }>,
  siswaId: string,
  semester: string,
  tpUntukCapaian?: TpUntukCapaian[],
): HasilStsMapel {
  const hasil: HasilStsMapel = { nilaiAkhir: null, capaianTerbaik: '', capaianPerluBimbingan: '', levelIndexTerbaik: null }
  const perTpNilai = tpCakupan.map((tp) => ({
    tp,
    nilai: sts[tp.id]?.[siswaId]?.nilai ?? null,
    bobot: bobotUntukSts(tp, semester),
  }))
  if (tpCakupan.length) {
    hasil.nilaiAkhir = hitungNilaiAkhirMapel(perTpNilai.map((x) => ({ nilai: x.nilai, bobot: x.bobot })))
  }

  const pool = tpUntukCapaian ?? tpCakupan
  const terisi = pool
    .map((tp) => ({ tp, nilai: sts[tp.id]?.[siswaId]?.nilai ?? null }))
    .filter((x) => x.nilai != null && Number.isFinite(x.nilai))
    .map((x) => ({ tp: x.tp, nilai: Number(x.nilai) }))
  isiCapaianDariTerisi(hasil, terisi)
  return hasil
}

const akhiriTitik = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)

/**
 * Fragmen deskripsi KKTP untuk disambung setelah "… dalam …".
 * Huruf pertama dipaksa kecil agar tidak muncul kapital di tengah kalimat
 * (banyak isian guru/AI masih diawali huruf besar). Kalimat berikutnya di
 * dalam fragmen yang sudah diawali kapital (mis. ". Menjawab …") tetap utuh.
 */
export function fragmenCapaian(teks: string): string {
  const s = String(teks ?? '').trim()
  if (!s) return ''
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/**
 * Awalan kalimat capaian terbaik — mengikuti level KKTP nilai TP tertinggi.
 * Indeks: 0 Perlu Bimbingan/Mulai Berkembang … 3 Sangat Baik/Mahir.
 * Jangan selalu "sangat baik": nilai 34 (level 0) harus memakai awalan level 0.
 */
export const AWALAN_CAPAIAN_TERBAIK = [
  'Masih memerlukan bimbingan dalam',
  'Mencapai kompetensi dengan cukup baik dalam',
  'Mencapai kompetensi dengan baik dalam',
  'Mencapai kompetensi dengan sangat baik dalam',
] as const

export const AWALAN_CAPAIAN_PERLU = 'Perlu peningkatan dalam'

export function awalanCapaianTerbaik(levelIndex: number | null | undefined): string {
  if (levelIndex == null || !Number.isFinite(levelIndex)) {
    // Tanpa info level: netral (bukan mengklaim "sangat baik")
    return 'Mencapai kompetensi dalam'
  }
  const i = Math.max(0, Math.min(3, Math.floor(Number(levelIndex))))
  return AWALAN_CAPAIAN_TERBAIK[i]
}

/**
 * Kalimat capaian rapor.
 * - Terbaik: awalan sesuai level KKTP nilai TP tertinggi + fragmen deskripsi level itu.
 * - Perlu: "Perlu peningkatan dalam …" dari TP bernilai terendah (bila beda TP).
 */
export function kalimatCapaian(
  terbaik: string,
  perlu: string,
  levelIndexTerbaik?: number | null,
): string[] {
  const hasil: string[] = []
  const b = fragmenCapaian(terbaik)
  const p = fragmenCapaian(perlu)
  if (b) hasil.push(akhiriTitik(`${awalanCapaianTerbaik(levelIndexTerbaik)} ${b}`))
  if (p) hasil.push(akhiriTitik(`${AWALAN_CAPAIAN_PERLU} ${p}`))
  return hasil
}
