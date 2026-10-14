/**
 * Sumber kebenaran semester + tahun ajaran untuk modul Akademik.
 * Mengambil dari PeriodeContext (pilihan login / header),
 * bukan lagi dari config/akademik.semesterAktif global.
 */
import { useMemo } from 'react'
import { usePeriode } from '../context/PeriodeContext'
import type { Semester } from '../types/akademik'
import { labelPeriode } from '../types/periode'

export interface PeriodeAkademikCtx {
  /** Siap dipakai (periode sudah dimuat dan ada yang dipilih) */
  ready: boolean
  /** Sedang memuat daftar periode */
  loading: boolean
  /** ID dokumen periode_akademik, mis. "2026-2027_1" */
  periodeId: string | null
  semester: Semester
  tahunAjaran: string
  /** Label tampilan, mis. "Ganjil 2026/2027" */
  label: string
  /** Objek periode penuh (null jika belum ada) */
  periode: ReturnType<typeof usePeriode>['periode']
}

/**
 * Hook untuk halaman nilai / rapor / laporan.
 * Wajib dipanggil di dalam PeriodeProvider (sudah membungkus App).
 */
export function usePeriodeAkademik(): PeriodeAkademikCtx {
  const { periode, loading } = usePeriode()

  return useMemo(() => {
    if (!periode) {
      return {
        ready: false,
        loading,
        periodeId: null,
        semester: '1' as Semester,
        tahunAjaran: '',
        label: '',
        periode: null,
      }
    }
    return {
      ready: true,
      loading: false,
      periodeId: periode.id,
      semester: periode.semester,
      tahunAjaran: periode.tahunAjaran,
      label: labelPeriode(periode),
      periode,
    }
  }, [periode, loading])
}
