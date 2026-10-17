import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { faseDariTingkatan, tingkatanDariKelas } from '../lib/akademik'

export type PilihanMapelKelas = { mapel: string; kelas: string }

type FilterStatus = 'semua' | 'ada' | 'belum'

/**
 * Pemilih mapel×kelas: tab per tingkatan (Kelas 1–6) + matriks mapel × paralel.
 * Dipakai di Setup TP, Nilai SLM/STS, Bobot, Laporan — mengganti grid katalog.
 */
export function MapelKelasPicker({
  pilihan,
  loading,
  emptyMessage = 'Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi. Hubungi admin.',
  hrefFor,
  /** Isi sel (status). Default: label "Buka". Return null = sembunyikan sel dari filter "ada/belum". */
  renderCell,
  /** true jika pasangan mapel×kelas "sudah ada data" (untuk filter). Default: selalu true. */
  isAda,
  showStatusFilter = false,
  toolbarExtra,
  footer,
}: {
  pilihan: PilihanMapelKelas[]
  loading?: boolean
  emptyMessage?: string
  hrefFor: (mapel: string, kelas: string) => string
  renderCell?: (mapel: string, kelas: string) => ReactNode
  isAda?: (mapel: string, kelas: string) => boolean | null
  showStatusFilter?: boolean
  toolbarExtra?: ReactNode
  footer?: ReactNode
}) {
  const [tabTingkat, setTabTingkat] = useState('')
  const [filterMapel, setFilterMapel] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('semua')

  const tingkatList = useMemo(
    () =>
      Array.from(new Set(pilihan.map((p) => tingkatanDariKelas(p.kelas)).filter(Boolean))).sort(
        (a, b) => Number(a) - Number(b),
      ),
    [pilihan],
  )
  const tingkatAktif = tabTingkat && tingkatList.includes(tabTingkat) ? tabTingkat : tingkatList[0] || ''
  const pilihanTingkat = useMemo(
    () => pilihan.filter((p) => tingkatanDariKelas(p.kelas) === tingkatAktif),
    [pilihan, tingkatAktif],
  )
  const paralelList = useMemo(
    () => Array.from(new Set(pilihanTingkat.map((p) => p.kelas))).sort((a, b) => a.localeCompare(b, 'id')),
    [pilihanTingkat],
  )
  const mapelDiTingkat = useMemo(
    () => Array.from(new Set(pilihanTingkat.map((p) => p.mapel))).sort((a, b) => a.localeCompare(b, 'id')),
    [pilihanTingkat],
  )

  function lolosFilter(mapel: string, kelas: string) {
    const q = filterMapel.trim().toLowerCase()
    if (q && !mapel.toLowerCase().includes(q)) return false
    if (!showStatusFilter || filterStatus === 'semua' || !isAda) return true
    const ada = isAda(mapel, kelas)
    if (ada == null) return true
    return filterStatus === 'ada' ? ada : !ada
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muh-200 border-t-muh-600" />
      </div>
    )
  }

  if (pilihan.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab tingkatan */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tingkatList.map((tg) => {
          const aktif = tg === tingkatAktif
          const count = pilihan.filter((p) => tingkatanDariKelas(p.kelas) === tg).length
          return (
            <button
              key={tg}
              type="button"
              onClick={() => setTabTingkat(tg)}
              className={`-mb-px rounded-t-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                aktif
                  ? 'border border-b-white border-border bg-white text-muh-800'
                  : 'border border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Kelas {tg}
              <span className={`ml-1.5 text-[11px] font-medium ${aktif ? 'text-muh-600' : 'text-muted'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3 rounded-b-lg rounded-tr-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filterMapel}
            onChange={(e) => setFilterMapel(e.target.value)}
            placeholder="Cari mapel…"
            className="min-w-[10rem] flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15 sm:max-w-xs sm:flex-none"
          />
          {showStatusFilter && (
            <div className="inline-flex flex-wrap items-center gap-1">
              {(
                [
                  ['semua', 'Semua'],
                  ['ada', 'Sudah ada'],
                  ['belum', 'Belum'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilterStatus(id)}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap ${
                    filterStatus === id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {toolbarExtra}
          <p className="ml-auto text-[12px] text-muted">
            Fase {faseDariTingkatan(tingkatAktif)}
            {paralelList.length ? ` · ${paralelList.join(', ')}` : ''}
          </p>
        </div>

        {mapelDiTingkat.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">Tidak ada penugasan di kelas {tingkatAktif}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-semibold">Mata pelajaran</th>
                  {paralelList.map((kl) => (
                    <th key={kl} className="px-2 py-2 text-center font-semibold">
                      {kl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapelDiTingkat
                  .filter((m) =>
                    paralelList.some(
                      (kl) =>
                        pilihanTingkat.some((x) => x.mapel === m && x.kelas === kl) && lolosFilter(m, kl),
                    ),
                  )
                  .map((m) => (
                    <tr key={m} className="border-b border-border/70 hover:bg-slate-50/80">
                      <td className="px-2 py-2.5 font-medium text-slate-900">{m}</td>
                      {paralelList.map((kl) => {
                        const adaPenugasan = pilihanTingkat.some((x) => x.mapel === m && x.kelas === kl)
                        if (!adaPenugasan) {
                          return (
                            <td key={kl} className="px-2 py-2.5 text-center text-slate-300">
                              —
                            </td>
                          )
                        }
                        if (!lolosFilter(m, kl)) {
                          return (
                            <td key={kl} className="px-2 py-2.5 text-center text-slate-300">
                              ·
                            </td>
                          )
                        }
                        const label = renderCell ? renderCell(m, kl) : <span className="text-muh-700">Buka</span>
                        return (
                          <td key={kl} className="px-2 py-2.5 text-center">
                            <Link
                              to={hrefFor(m, kl)}
                              className="inline-flex min-w-[4.5rem] items-center justify-center rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] font-semibold no-underline transition hover:border-muh-400 hover:bg-muh-50 hover:text-muh-800"
                            >
                              {label}
                            </Link>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {footer}
    </div>
  )
}
