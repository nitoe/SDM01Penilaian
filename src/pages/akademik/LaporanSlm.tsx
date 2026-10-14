import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { ConfigAkademik, Mapel, NilaiTpDoc, TujuanPembelajaran } from '../../types/akademik'
import {
  bobotTpDiSemester,
  getMapelList,
  getNilaiTPKelas,
  getTPList,
  hitungNilaiAkhirMapel,
  hitungNilaiAkhirTP,
  tentukanLevel,
  tingkatanDariKelas,
  tpMasukSemester,
} from '../../lib/akademik'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { getSiswaList } from '../../lib/tahsinData'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import type { SiswaTahsin } from '../../types/tahsin'
import { HeroBanner } from '../../components/ui'
import { BackLink, LEVEL_WARNA, Notice, NoticeAksesGuru, Spinner, btnGhost, btnPrimary } from './shared'

type NilaiKelas = Record<string, Record<string, NilaiTpDoc>>

function rataSlm(
  siswaId: string,
  daftar: TujuanPembelajaran[],
  nilai: NilaiKelas,
  semester: string,
): number | null {
  return hitungNilaiAkhirMapel(
    daftar.map((tp) => {
      const slm = nilai[tp.id]?.[siswaId]?.slm
      const bobot = bobotTpDiSemester(tp, semester)
      return {
        nilai: slm == null ? null : hitungNilaiAkhirTP(slm, null, tp),
        bobot: bobot == null ? 0 : bobot,
      }
    }),
  )
}

export default function LaporanSlm({ profile }: { profile: AppUser }) {
  const [params] = useSearchParams()
  const mapel = params.get('mapel') || ''
  const kelas = params.get('kelas') || ''
  const tingkatan = tingkatanDariKelas(kelas)
  const tulis = isGuruAkademikRole(profile.role)
  const admin = isAdminRole(profile.role)
  const [mapelMaster, setMapelMaster] = useState<Mapel[] | null>(null)
  const pilihan = useMemo(
    () => (mapelMaster ? aksesMapelKelas(profile, mapelMaster) : []),
    [profile, mapelMaster],
  )
  const berhak = pilihan.some((p) => p.mapel === mapel && p.kelas === kelas)

  const periodeAk = usePeriodeAkademik()
  const config: ConfigAkademik | null = periodeAk.ready
    ? { semesterAktif: periodeAk.semester, tahunAjaran: periodeAk.tahunAjaran }
    : null
  const [tpList, setTpList] = useState<TujuanPembelajaran[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [nilai, setNilai] = useState<NilaiKelas | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    let batal = false
    getMapelList()
      .then((daftar) => {
        if (!batal) setMapelMaster(daftar)
      })
      .catch(() => {
        if (!batal) setMapelMaster([])
      })
    return () => {
      batal = true
    }
  }, [])

  useEffect(() => {
    if (!mapel || !kelas || !berhak || (!tulis && !admin)) return
    if (!periodeAk.ready) return
    let batal = false
    setTpList(null)
    setSiswa(null)
    setNilai(null)
    setGalat('')
    void (async () => {
      try {
        const [t, s] = await Promise.all([
          getTPList(mapel, kelas),
          getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
        ])
        const n = await getNilaiTPKelas({
          mapel,
          kelas,
          semester: periodeAk.semester,
          tahunAjaran: periodeAk.tahunAjaran,
        })
        if (batal) return
        setTpList(t.filter((tp) => tpMasukSemester(tp, periodeAk.semester)))
        setSiswa(s)
        setNilai(n)
      } catch (e) {
        console.error(e)
        if (!batal) setGalat('Gagal memuat laporan. Periksa koneksi dan hak akses.')
      }
    })()
    return () => {
      batal = true
    }
  }, [mapel, kelas, tingkatan, berhak, tulis, admin, profile.role, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran])

  if (!tulis && !admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <NoticeAksesGuru aksi="Laporan SLM dibuka" role={profile.role} />
      </div>
    )
  }

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <HeroBanner
          eyebrow="Akademik"
          title="Laporan SLM"
          subtitle="Rekap nilai sumatif lingkup materi per kelas. Belum termasuk STS dan SAS."
        />
        {mapelMaster === null ? (
          <Spinner />
        ) : pilihan.length === 0 ? (
          <Notice tone="warn">
            Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi. Hubungi admin.
          </Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => (
              <Link
                key={`${p.mapel}-${p.kelas}`}
                to={`/akademik/laporan-slm?mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`}
                className="card-soft block p-4 no-underline transition hover:border-muh-300"
              >
                <p className="text-[14px] font-semibold text-slate-900">{p.mapel}</p>
                <p className="mt-0.5 text-[12px] text-muted">Kelas {p.kelas}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/laporan-slm">Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.</Notice>
      </div>
    )
  }

  const siap = config && tpList && siswa && nilai
  const sekolah = config?.namaSekolah?.trim() || 'SD Muhammadiyah 01 Kukusan'
  const inputUrl = `/akademik/nilai-slm?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink to="/akademik/laporan-slm">Pilih mata pelajaran</BackLink>
        <div className="flex gap-2">
          <Link to={inputUrl} className={`${btnGhost} no-underline`}>
            Input nilai
          </Link>
          <button type="button" className={btnPrimary} onClick={() => window.print()}>
            Cetak
          </button>
        </div>
      </div>

      {galat ? (
        <Notice tone="error">{galat}</Notice>
      ) : !siap ? (
        <Spinner />
      ) : tpList.length === 0 ? (
        <Notice>
          Belum ada TP semester {config.semesterAktif} untuk {mapel} tingkat {tingkatan}. Susun di Setup TP, lalu
          kelompokkan di Bobot Semester.
        </Notice>
      ) : (
        <article className="card-soft overflow-hidden print:border-0 print:shadow-none">
          <header className="border-b border-border px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{sekolah}</p>
            <h1 className="mt-1 text-[18px] font-semibold text-slate-900">Laporan Nilai SLM</h1>
            <p className="mt-1 text-[12.5px] text-slate-700">
              {mapel} · Kelas {kelas} · Semester {config.semesterAktif} · Tahun ajaran {config.tahunAjaran}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Angka rata-rata adalah SLM tertimbang per TP. STS dan SAS belum masuk. Level di bawah angka mengikuti
              KKTP TP itu, dihitung dari SLM saja.
            </p>
          </header>
          {siswa.length === 0 ? (
            <p className="p-4 text-[12.5px] text-muted">Tidak ada siswa aktif di kelas {kelas}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-semibold">No</th>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    {tpList.map((tp) => (
                      <th key={tp.id} className="px-2 py-2 text-center font-semibold" title={tp.namaTp}>
                        TP {tp.nomorTp}
                        <span className="mt-0.5 block font-medium normal-case tracking-normal text-slate-400">
                          {(() => {
                            const b = bobotTpDiSemester(tp, config.semesterAktif)
                            return b == null ? 'setara' : `${b}%`
                          })()}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-semibold">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {siswa.map((s, i) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{s.nama}</td>
                      {tpList.map((tp) => {
                        const slm = nilai[tp.id]?.[s.id]?.slm
                        const lv = slm == null ? null : tentukanLevel(hitungNilaiAkhirTP(slm, null, tp), tp)
                        return (
                          <td key={tp.id} className="px-2 py-2 text-center">
                            <div className="font-semibold text-slate-800">{slm == null ? '–' : slm}</div>
                            {lv && (
                              <div className={`mx-auto mt-0.5 w-fit rounded-full px-1.5 text-[9.5px] font-semibold ${LEVEL_WARNA[lv.index]}`}>
                                {lv.label}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center text-[14px] font-bold text-muh-800">
                        {rataSlm(s.id, tpList, nilai, config.semesterAktif) ?? '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
    </div>
  )
}
