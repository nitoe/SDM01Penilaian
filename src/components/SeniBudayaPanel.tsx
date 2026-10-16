import { useCallback, useEffect, useState } from 'react'
import {
  DISIPLIN_SENI,
  getSeniKelas,
  simpanSeniKelas,
  type SeniKelasDoc,
} from '../lib/seniKelas'

/**
 * Panel pengaturan disiplin Seni Budaya per kelas × semester.
 * Dipakai di Setup TP (tab khusus) agar wali/guru mapel menetapkan
 * disiplin aktif sebelum menyusun TP per cabang seni.
 */
export default function SeniBudayaPanel({
  kelas,
  bolehTulis,
}: {
  kelas: string
  bolehTulis: boolean
}) {
  const [seni, setSeni] = useState<SeniKelasDoc>({ ganjil: [], genap: [] })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    setLoading(true)
    setPesan(null)
    setDirty(false)
    void getSeniKelas(kelas)
      .then((d) => {
        if (!batal) setSeni(d)
      })
      .finally(() => {
        if (!batal) setLoading(false)
      })
    return () => {
      batal = true
    }
  }, [kelas])

  const toggle = useCallback((sem: 'ganjil' | 'genap', nama: string) => {
    if (!bolehTulis) return
    setSeni((prev) => {
      const list = prev[sem]
      const next = list.includes(nama) ? list.filter((x) => x !== nama) : [...list, nama]
      return { ...prev, [sem]: next }
    })
    setDirty(true)
    setPesan(null)
  }, [bolehTulis])

  const simpan = useCallback(async () => {
    setBusy(true)
    setPesan(null)
    try {
      await simpanSeniKelas(kelas, seni)
      setDirty(false)
      setPesan('Tersimpan. Disiplin aktif akan muncul di rapor sebagai label Seni Budaya.')
    } catch (e) {
      console.error(e)
      setPesan('Gagal menyimpan. Pastikan Anda wali kelas atau guru mapel di kelas ini.')
    } finally {
      setBusy(false)
    }
  }, [kelas, seni])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muh-200 border-t-muh-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-950">
        <strong className="font-semibold">Langkah pertama untuk Seni Budaya.</strong> Tentukan disiplin
        yang diajarkan di kelas ini per semester. Boleh lebih dari satu. Setelah itu susun TP di tab
        masing-masing disiplin.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(['ganjil', 'genap'] as const).map((sem) => (
          <div key={sem} className="rounded-xl border border-border bg-white p-4">
            <p className="mb-2 text-[12px] font-semibold text-slate-800">
              Semester {sem === 'ganjil' ? '1 (ganjil)' : '2 (genap)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DISIPLIN_SENI.map((d) => {
                const on = seni[sem].includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!bolehTulis}
                    onClick={() => toggle(sem, d)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${
                      on
                        ? 'bg-muh-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Aktif: {seni[sem].length ? seni[sem].join(', ') : 'belum dipilih'}
            </p>
          </div>
        ))}
      </div>

      {bolehTulis && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => void simpan()}
            className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-50"
          >
            {busy ? 'Menyimpan…' : 'Simpan pengaturan seni'}
          </button>
          {pesan && (
            <span
              className={`text-[12px] ${pesan.startsWith('Gagal') ? 'text-red-700' : 'text-emerald-800'}`}
            >
              {pesan}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
