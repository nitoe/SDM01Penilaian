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

/**
 * Nilai SAS (akhir) mapel satu siswa. Per TP: SLM, STS (bila lebih tinggi menggantikan SLM), dan SAS hanya bila
 * TP itu masuk cakupan SAS; lalu dirata-rata menurut bobot TP semester. Sama dengan "Akhir" di halaman Nilai STS & SAS.
 */
export function nilaiSasMapel(
  tpSemester: TpRumus[],
  data: {
    slm: PerTp<{ slm: number }>
    sts: PerTp<{ nilai: number }>
    sas: PerTp<{ nilai: number }>
    cakupanSas: Set<string>
  },
  siswaId: string,
  semester: string,
): number | null {
  return hitungNilaiAkhirMapel(
    tpSemester.map((tp) => {
      const sas = data.cakupanSas.has(tp.id) ? (data.sas[tp.id]?.[siswaId]?.nilai ?? null) : null
      const nilai = hitungNilaiAkhirTP(
        data.slm[tp.id]?.[siswaId]?.slm,
        sas,
        tp,
        data.sts[tp.id]?.[siswaId]?.nilai ?? null,
      )
      return { nilai, bobot: bobotTpDiSemester(tp, semester) ?? 0 }
    }),
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

export interface HasilStsMapel {
  nilaiAkhir: number | null
  /** deskripsi KKTP TP bernilai tertinggi (tanpa awalan kalimat) */
  capaianTerbaik: string
  /** deskripsi KKTP TP bernilai terendah; kosong bila hanya satu TP terisi */
  capaianPerluBimbingan: string
}

/**
 * Nilai akhir STS + bahan kalimat capaian satu mapel untuk satu siswa. Dipakai Rapor STS satu siswa
 * dan seluruh kelas supaya hasilnya identik (ANTIREGRESI §21).
 */
export function hitungStsMapel(
  tpCakupan: (TpRumus & Pick<TujuanPembelajaran, 'tipe' | 'levels'>)[],
  sts: PerTp<{ nilai: number }>,
  siswaId: string,
  semester: string,
): HasilStsMapel {
  const hasil: HasilStsMapel = { nilaiAkhir: null, capaianTerbaik: '', capaianPerluBimbingan: '' }
  if (!tpCakupan.length) return hasil
  const perTp = tpCakupan.map((tp) => ({
    tp,
    nilai: sts[tp.id]?.[siswaId]?.nilai ?? null,
    bobot: bobotUntukSts(tp, semester),
  }))
  hasil.nilaiAkhir = hitungNilaiAkhirMapel(perTp.map((x) => ({ nilai: x.nilai, bobot: x.bobot })))
  const terisi = perTp.filter((x) => x.nilai != null && Number.isFinite(x.nilai))
  if (terisi.length) {
    const urut = [...terisi].sort((a, b) => Number(b.nilai) - Number(a.nilai))
    const terbaik = urut[0]
    const terendah = urut[urut.length - 1]
    hasil.capaianTerbaik = tentukanLevel(terbaik.nilai, terbaik.tp)?.deskripsi || ''
    if (terendah.tp.id !== terbaik.tp.id) {
      hasil.capaianPerluBimbingan = tentukanLevel(terendah.nilai, terendah.tp)?.deskripsi || ''
    }
  }
  return hasil
}

const akhiriTitik = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)

/** Kalimat capaian pada rapor, pola v1: "Mencapai kompetensi dengan sangat baik dalam …" dan "Perlu peningkatan dalam …". */
export function kalimatCapaian(terbaik: string, perlu: string): string[] {
  const hasil: string[] = []
  if (terbaik.trim()) hasil.push(akhiriTitik(`Mencapai kompetensi dengan sangat baik dalam ${terbaik.trim()}`))
  if (perlu.trim()) hasil.push(akhiriTitik(`Perlu peningkatan dalam ${perlu.trim()}`))
  return hasil
}
