import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { listPeriodeAktif, listSemuaPeriode } from '../lib/periode'
import type { PeriodeAkademik } from '../types/periode'

const STORAGE_KEY = 'sdm01.periodeId'

interface PeriodeContextValue {
  /** Periode yang sedang dipakai sesi ini */
  periode: PeriodeAkademik | null
  /** Daftar yang boleh dipilih (semua untuk admin, hanya aktif untuk guru) */
  daftar: PeriodeAkademik[]
  loading: boolean
  isAdmin: boolean
  setPeriodeId: (id: string) => void
  refresh: () => Promise<void>
}

const PeriodeContext = createContext<PeriodeContextValue | null>(null)

export function PeriodeProvider({
  children,
  isAdmin,
}: {
  children: ReactNode
  isAdmin: boolean
}) {
  const [daftar, setDaftar] = useState<PeriodeAkademik[]>([])
  const [periodeId, setPeriodeIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = isAdmin ? await listSemuaPeriode() : await listPeriodeAktif()
      setDaftar(list)
      const saved = localStorage.getItem(STORAGE_KEY)
      const valid = list.find((p) => p.id === saved)
      if (valid) {
        setPeriodeIdState(valid.id)
      } else {
        const def = list.find((p) => p.isDefault) ?? list[0] ?? null
        setPeriodeIdState(def?.id ?? null)
        if (def) localStorage.setItem(STORAGE_KEY, def.id)
      }
    } catch (err) {
      console.error('Gagal memuat periode', err)
      setDaftar([])
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const setPeriodeId = useCallback((id: string) => {
    setPeriodeIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const periode = useMemo(
    () => daftar.find((p) => p.id === periodeId) ?? null,
    [daftar, periodeId],
  )

  const value = useMemo(
    () => ({ periode, daftar, loading, isAdmin, setPeriodeId, refresh: load }),
    [periode, daftar, loading, isAdmin, setPeriodeId, load],
  )

  return <PeriodeContext.Provider value={value}>{children}</PeriodeContext.Provider>
}

export function usePeriode() {
  const ctx = useContext(PeriodeContext)
  if (!ctx) throw new Error('usePeriode harus dipakai di dalam PeriodeProvider')
  return ctx
}
