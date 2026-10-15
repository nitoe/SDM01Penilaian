import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { ConfigAkademik, JenisAsesmen } from '../../types/akademik'
import { getConfigAkademik } from '../../lib/akademik'
import { tanggalIndonesia } from '../../lib/raporSts'
import { muatRekapAsesmenKelas } from '../../lib/rekapAsesmen'
import { cariWaliKelas } from '../../lib/penandatangan'
import type { RekapKelas } from '../../lib/asesmenRumus'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import { SEMUA_KELAS } from '../../types/tahsin'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, Spinner, btnPrimary, selectCls } from './shared'

const jenisDari = (v: string | null): JenisAsesmen => (v === 'sas' ? 'sas' : 'sts')
const NAMA: Record<JenisAsesmen, string> = { sts: 'STS (Sumatif Tengah Semester)', sas: 'SAS (Sumatif Akhir Semester)' }

/**
 * Rekap cetak STS/SAS satu kelas, semua mapel. Admin: semua kelas. Wali kelas: kelas yang diwalikan.
 * Hanya membaca; rumus di lib/asesmenRumus.ts (ANTIREGRESI §20).
 */
export default function LaporanStsSas({ profile }: { profile: AppUser }) {
  const [params, setParams] = useSearchParams()
  const jenis = jenisDari(params.get('jenis'))
  const admin = isAdminRole(profile.role)
  const kelasBoleh = useMemo<string[]>(
    () => (admin ? [...SEMUA_KELAS] : isGuruAkademikRole(profile.role) ? (profile.waliKelas ?? []) : []),
    [admin, profile.role, profile.waliKelas],
  )
  const kelasParam = params.get('kelas') || ''
  const kelas = kelasBoleh.includes(kelasParam) ? kelasParam : ''
  const periodeAk = usePeriodeAkademik()

  const [rekap, setRekap] = useState<RekapKelas | null>(null)
  const [config, setConfig] = useState<ConfigAkademik | null>(null)
  const [wali, setWali] = useState('')
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!kelas || !periodeAk.ready) return
    let batal = false
    setRekap(null)
    setGalat('')
    void (async () => {
      try {
        const [r, c, w] = await Promise.all([
          muatRekapAsesmenKelas({
            kelas,
            jenis,
            semester: periodeAk.semester,
            tahunAjaran: periodeAk.tahunAjaran,
            role: profile.role,
          }),
          getConfigAkademik(),
          cariWaliKelas(kelas, profile),
        ])
        if (batal) return
        setRekap(r)
        setConfig(c)
        setWali(w)
      } catch (e) {
        console.error(e)
        if (!batal) setGalat('Gagal memuat rekap. Periksa koneksi dan hak akses.')
      }
    })()
    return () => {
      batal = true
    }
  }, [kelas, jenis, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, profile])

  const ubah = (k: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [a, b] of Object.entries(k)) b ? p.set(a, b) : p.delete(a)
    setParams(p, { replace: true })
  }

  if (kelasBoleh.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">{admin ? 'Pantauan Akademik' : 'Akademik & Rapor'}</BackLink>
        <Notice>Rekap STS dan SAS dapat dicetak oleh administrator atau wali kelas.</Notice>
      </div>
    )
  }

  const sekolah = config?.namaSekolah?.trim() || 'SD Muhammadiyah 01 Kukusan'
  const kota = config?.kotaRapor?.trim() || 'Depok'
  const adaNilai = rekap ? rekap.mapel.some((m) => rekap.rataMapel[m.nama] != null) : false

  return (
    <div className="space-y-5">
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          title="Cetak Rekap STS & SAS"
          subtitle="Nilai semua mata pelajaran satu kelas dalam satu tabel. Hanya membaca; nilai diinput oleh guru."
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Jenis asesmen" className="flex gap-1">
            {(['sts', 'sas'] as const).map((j) => (
              <button
                key={j}
                type="button"
                aria-pressed={jenis === j}
                onClick={() => ubah({ jenis: j })}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium ${
                  jenis === j ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {j.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="text-[12px] font-medium text-slate-600">
            Kelas
            <select value={kelas} onChange={(e) => ubah({ kelas: e.target.value })} className={`${selectCls} mt-1 block min-w-32`}>
              <option value="">Pilih kelas</option>
              {kelasBoleh.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={`${btnPrimary} ml-auto`} disabled={!rekap} onClick={() => window.print()}>
            Cetak
          </button>
        </div>
      </div>

      {!kelas ? (
        <Notice>Pilih kelas untuk menampilkan rekap.</Notice>
      ) : !periodeAk.ready ? (
        <Notice>Pilih periode akademik di header terlebih dahulu.</Notice>
      ) : galat ? (
        <Notice tone="error">{galat}</Notice>
      ) : !rekap ? (
        <Spinner />
      ) : (
        <article className="card-soft overflow-hidden print:border-0 print:shadow-none">
          <header className="border-b border-border px-4 py-4 print:px-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{sekolah}</p>
            <h1 className="mt-1 text-[18px] font-semibold text-slate-900">Rekap Nilai {NAMA[jenis]}</h1>
            <p className="mt-1 text-[12.5px] text-slate-700">
              Kelas {kelas} · Semester {periodeAk.semester === '2' ? 'Genap' : 'Ganjil'} · Tahun ajaran {periodeAk.tahunAjaran}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              {jenis === 'sts'
                ? 'Nilai tiap mapel adalah rata-rata tertimbang nilai STS pada TP yang masuk cakupan STS.'
                : 'Nilai tiap mapel adalah nilai akhir: SLM, STS, dan SAS digabung per TP, lalu dirata-rata menurut bobot TP.'}{' '}
              Tanda – berarti belum ada nilai.
            </p>
          </header>

          {rekap.siswa.length === 0 ? (
            <p className="p-4 text-[12.5px] text-muted">Tidak ada siswa aktif di kelas {kelas}.</p>
          ) : (
            <>
              {!adaNilai && (
                <p className="border-b border-border bg-gold-50 px-4 py-2 text-[12px] text-gold-500 print:hidden">
                  Belum ada nilai {jenis.toUpperCase()} yang masuk untuk kelas ini pada periode terpilih.
                </p>
              )}
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[720px] border-collapse text-left text-[11.5px] print:min-w-0 print:text-[10px]">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 font-semibold">No</th>
                      <th className="px-2 py-2 font-semibold">Nama</th>
                      {rekap.mapel.map((m) => (
                        <th key={m.nama} className="px-1.5 py-2 text-center font-semibold normal-case tracking-normal">
                          {m.label}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold">Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.siswa.map((s, i) => (
                      <tr key={s.id} className="border-b border-border">
                        <td className="px-2 py-1.5 text-muted">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-900">{s.nama}</td>
                        {rekap.mapel.map((m) => (
                          <td key={m.nama} className="px-1.5 py-1.5 text-center tabular-nums">
                            {rekap.nilai[s.id]?.[m.nama] ?? '–'}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center font-bold tabular-nums text-muh-800">
                          {rekap.rataSiswa[s.id] ?? '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-2 py-1.5" colSpan={2}>
                        Rata-rata kelas
                      </td>
                      {rekap.mapel.map((m) => (
                        <td key={m.nama} className="px-1.5 py-1.5 text-center tabular-nums">
                          {rekap.rataMapel[m.nama] ?? '–'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center tabular-nums">
                        {(() => {
                          const ada = rekap.mapel.map((m) => rekap.rataMapel[m.nama]).filter((n): n is number => n != null)
                          return ada.length ? Math.round(ada.reduce((a, b) => a + b, 0) / ada.length) : '–'
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <footer className="grid grid-cols-2 gap-6 px-4 py-6 text-[12px] text-slate-800 print:px-0">
                <div>
                  <p>Mengetahui,</p>
                  <p>Kepala Sekolah</p>
                  <div className="h-16" />
                  <p className="font-semibold">{config?.namaKepsek?.trim() || '……………………………'}</p>
                </div>
                <div className="text-right">
                  <p>
                    {kota}, {tanggalIndonesia()}
                  </p>
                  <p>Wali Kelas {kelas}</p>
                  <div className="h-16" />
                  <p className="font-semibold">{wali || '……………………………'}</p>
                </div>
              </footer>
            </>
          )}
        </article>
      )}
    </div>
  )
}
