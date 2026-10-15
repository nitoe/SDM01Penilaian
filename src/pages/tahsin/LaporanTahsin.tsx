import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import { isAdminRole } from '../../lib/roles'
import { SEMUA_KELAS } from '../../types/tahsin'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { muatLaporanTahsinKelas, type LaporanTahsinKelas } from '../../lib/laporanTahsin'
import { cariGuruTahsin } from '../../lib/penandatangan'
import { tanggalIndonesia } from '../../lib/raporSts'
import { PageHeader } from '../../components/ui'
import { BackLink, Notice, Spinner, btnPrimary, selectCls } from '../akademik/shared'

const TGL = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

/** Laporan cetak Tahsin-Tahfizh satu kelas: rekap setoran per siswa dan capaian terhadap target. Hanya membaca. */
export default function LaporanTahsin({ profile }: { profile: AppUser }) {
  const [params, setParams] = useSearchParams()
  const admin = isAdminRole(profile.role)
  const kelasBoleh = useMemo<string[]>(
    () => (admin ? [...SEMUA_KELAS] : (profile.kelasAmpu ?? [])),
    [admin, profile.kelasAmpu],
  )
  const kelasParam = params.get('kelas') || ''
  const kelas = kelasBoleh.includes(kelasParam) ? kelasParam : ''
  const periodeAk = usePeriodeAkademik()

  const [data, setData] = useState<LaporanTahsinKelas | null>(null)
  const [guru, setGuru] = useState('')
  const [galat, setGalat] = useState('')

  useEffect(() => {
    if (!kelas || !periodeAk.ready) return
    let batal = false
    setData(null)
    setGalat('')
    void (async () => {
      try {
        const periode = { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester }
        const [d, g] = await Promise.all([
          muatLaporanTahsinKelas({ kelas, periode, role: profile.role }),
          cariGuruTahsin(kelas, profile),
        ])
        if (batal) return
        setData(d)
        setGuru(g)
      } catch (e) {
        console.error(e)
        if (!batal) setGalat('Gagal memuat laporan. Periksa koneksi dan hak akses.')
      }
    })()
    return () => {
      batal = true
    }
  }, [kelas, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, profile])

  if (kelasBoleh.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink to="/tahsin">Tahsin & Tahfizh</BackLink>
        <Notice>Belum ada kelas ampu pada akun Anda. Hubungi admin untuk mengatur kelas ampu.</Notice>
      </div>
    )
  }

  const sekolah = data?.config.namaSekolah?.trim() || 'SD Muhammadiyah 01 Kukusan'
  const kota = data?.config.kotaRapor?.trim() || 'Depok'
  const t = data?.target
  const teksTarget = !t
    ? 'Target hafalan kelas ini belum diatur.'
    : t.jenjang === 'iqro'
      ? `Target: Iqro jilid ${t.targetJilid ?? '–'} halaman ${t.targetHalaman ?? '–'}${t.labelSemester ? ` (${t.labelSemester})` : ''}.`
      : `Target: ${t.targetSurah?.length ?? 0} surah${t.labelSemester ? ` (${t.labelSemester})` : ''}.`

  return (
    <div className="space-y-5">
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/tahsin', label: admin ? 'Pantauan Tahsin & Tahfizh' : 'Tahsin & Tahfizh' }}
          title="Cetak Laporan Tahsin-Tahfizh"
          subtitle="Rekap setoran dan capaian target per siswa dalam satu kelas. Hanya membaca."
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-medium text-slate-600">
            Kelas
            <select
              value={kelas}
              onChange={(e) => {
                const p = new URLSearchParams(params)
                e.target.value ? p.set('kelas', e.target.value) : p.delete('kelas')
                setParams(p, { replace: true })
              }}
              className={`${selectCls} mt-1 block min-w-32`}
            >
              <option value="">Pilih kelas</option>
              {kelasBoleh.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={`${btnPrimary} ml-auto`} disabled={!data} onClick={() => window.print()}>
            Cetak
          </button>
        </div>
      </div>

      {!kelas ? (
        <Notice>Pilih kelas untuk menampilkan laporan.</Notice>
      ) : !periodeAk.ready ? (
        <Notice>Pilih periode akademik di header terlebih dahulu.</Notice>
      ) : galat ? (
        <Notice tone="error">{galat}</Notice>
      ) : !data ? (
        <Spinner />
      ) : (
        <article className="card-soft overflow-hidden print:border-0 print:shadow-none">
          <header className="border-b border-border px-4 py-4 print:px-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{sekolah}</p>
            <h1 className="mt-1 text-[18px] font-semibold text-slate-900">Laporan Tahsin-Tahfizh</h1>
            <p className="mt-1 text-[12.5px] text-slate-700">
              Kelas {data.kelas} · Semester {data.periode.semester === '2' ? 'Genap' : 'Ganjil'} · Tahun ajaran{' '}
              {data.periode.tahunAjaran}
            </p>
            <p className="mt-1 text-[11.5px] text-muted">{teksTarget}</p>
            <p className="mt-2 text-[12px] text-slate-700">
              {data.ringkasKelas.jumlahSiswa} siswa · {data.ringkasKelas.sudahSetor} sudah setor ·{' '}
              {data.ringkasKelas.belumSetor} belum ada setoran · {data.ringkasKelas.totalSetoran} setoran
              {data.ringkasKelas.dinilai > 0
                ? ` · ${data.ringkasKelas.tercapai}/${data.ringkasKelas.dinilai} siswa mencapai target`
                : ''}
            </p>
          </header>

          {data.baris.length === 0 ? (
            <p className="p-4 text-[12.5px] text-muted">Tidak ada siswa aktif di kelas {kelas}.</p>
          ) : (
            <>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[720px] border-collapse text-left text-[11.5px] print:min-w-0 print:text-[10px]">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 font-semibold">No</th>
                      <th className="px-2 py-2 font-semibold">Nama</th>
                      <th className="px-2 py-2 font-semibold">Jenjang</th>
                      <th className="px-2 py-2 text-center font-semibold">Setoran</th>
                      <th className="px-2 py-2 text-center font-semibold">Ziyadah</th>
                      <th className="px-2 py-2 text-center font-semibold">Muroja'ah</th>
                      <th className="px-2 py-2 text-center font-semibold">Tahsin</th>
                      <th className="px-2 py-2 text-center font-semibold">Lulus</th>
                      <th className="px-2 py-2 text-center font-semibold">Diulang</th>
                      <th className="px-2 py-2 font-semibold">Capaian</th>
                      <th className="px-2 py-2 font-semibold">Target</th>
                      <th className="px-2 py-2 font-semibold">Terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.baris.map((b, i) => (
                      <tr key={b.siswa.id} className="border-b border-border">
                        <td className="px-2 py-1.5 text-muted">{i + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-900">{b.siswa.nama}</td>
                        <td className="px-2 py-1.5">{b.siswa.jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"}</td>
                        <td className="px-2 py-1.5 text-center font-semibold tabular-nums">{b.ringkas.total}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{b.ringkas.ziyadah}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{b.ringkas.murojaah}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{b.ringkas.tahsin}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{b.ringkas.lulus}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{b.ringkas.ulang}</td>
                        <td className="px-2 py-1.5">{b.capaian}</td>
                        <td className="px-2 py-1.5">
                          {b.tercapai === null ? '–' : b.tercapai ? 'Tercapai' : 'Belum'}
                        </td>
                        <td className="px-2 py-1.5">{b.ringkas.terakhir ? TGL.format(new Date(b.ringkas.terakhir)) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 pt-3 text-[11px] text-muted print:px-0">
                Setoran dihitung pada periode ini saja. Capaian Al-Qur'an dihitung dari setoran ziyadah lulus pada surah
                target; capaian Iqro dari posisi setoran Iqro terakhir.
              </p>
              <footer className="grid grid-cols-2 gap-6 px-4 py-6 text-[12px] text-slate-800 print:px-0">
                <div>
                  <p>Mengetahui,</p>
                  <p>Kepala Sekolah</p>
                  <div className="h-16" />
                  <p className="font-semibold">{data.config.namaKepsek?.trim() || '……………………………'}</p>
                </div>
                <div className="text-right">
                  <p>
                    {kota}, {tanggalIndonesia()}
                  </p>
                  <p>Guru Tahsin-Tahfizh {kelas}</p>
                  <div className="h-16" />
                  <p className="font-semibold">{guru || '……………………………'}</p>
                </div>
              </footer>
            </>
          )}
        </article>
      )}
    </div>
  )
}
