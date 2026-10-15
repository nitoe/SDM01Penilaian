import type { TujuanPembelajaran } from '../types/akademik.ts'
import { bobotTpDiSemester, hitungNilaiAkhirMapel, hitungNilaiAkhirTP } from './akademikRumus.ts'

// Rumus murni untuk rekap cetak STS/SAS per kelas (ANTIREGRESI §20). Tanpa Firebase agar bisa diuji:
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

/** Nilai STS mapel satu siswa: rata tertimbang nilai STS murni pada TP yang masuk cakupan STS. */
export function nilaiStsMapel(
  tpCakupan: TpRumus[],
  sts: PerTp<{ nilai: number }>,
  siswaId: string,
  semester: string,
): number | null {
  return hitungNilaiAkhirMapel(
    tpCakupan.map((tp) => ({ nilai: sts[tp.id]?.[siswaId]?.nilai ?? null, bobot: bobotUntukSts(tp, semester) })),
  )
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

/** Rata-rata bulat dari nilai yang ada; null bila tidak ada satu pun. */
export function rataNilai(daftar: (number | null | undefined)[]): number | null {
  const ada = daftar.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  return ada.length ? Math.round(ada.reduce((a, b) => a + b, 0) / ada.length) : null
}

export interface RekapKelas {
  mapel: { nama: string; label: string }[]
  siswa: { id: string; nama: string }[]
  /** siswaId → mapel → nilai */
  nilai: Record<string, Record<string, number | null>>
  rataMapel: Record<string, number | null>
  rataSiswa: Record<string, number | null>
}

/** Susun tabel rekap dari nilai per mapel per siswa. Rata-rata siswa dihitung dari mapel yang punya nilai. */
export function susunRekap(
  mapel: { nama: string; label: string }[],
  siswa: { id: string; nama: string }[],
  nilai: Record<string, Record<string, number | null>>,
): RekapKelas {
  const rataMapel: Record<string, number | null> = {}
  for (const m of mapel) rataMapel[m.nama] = rataNilai(siswa.map((s) => nilai[s.id]?.[m.nama]))
  const rataSiswa: Record<string, number | null> = {}
  for (const s of siswa) rataSiswa[s.id] = rataNilai(mapel.map((m) => nilai[s.id]?.[m.nama]))
  return { mapel, siswa, nilai, rataMapel, rataSiswa }
}
