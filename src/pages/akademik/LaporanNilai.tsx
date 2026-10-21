/**
 * Laporan Nilai terpadu: tab SLM | STS | SAS.
 * - SLM: rekap nilai harian (sumatif lingkup materi) — logika sama LaporanSlm lama.
 * - STS / SAS: leger nilai asesmen per TP yang masuk cakupan + rata-rata tertimbang.
 * Route baru: /akademik/laporan?jenis=slm|sts|sas&mapel=…&kelas=…
 * Route lama /akademik/laporan-slm tetap dialihkan di App.tsx.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type {
  ConfigAkademik,
  JenisAsesmen,
  Mapel,
  NilaiAsesmenDoc,
  NilaiTpDoc,
  TujuanPembelajaran,
} from '../../types/akademik'
import {
  bobotTpDiSemester,
  getCakupanTP,
  getMapelList,
  getNilaiAsesmenKelas,
  getNilaiTPKelas,
  getTPList,
  hitungNilaiAkhirMapel,
  hitungNilaiAkhirTP,
  tentukanLevel,
  tingkatanDariKelas,
  tpMasukSemester,
} from '../../lib/akademik'
import { bobotUntukCakupan } from '../../lib/asesmenRumus'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { getSiswaList } from '../../lib/tahsinData'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import type { SiswaTahsin } from '../../types/tahsin'
import { PageHeader } from '../../components/ui'
import { MapelKelasPicker } from '../../components/MapelKelasPicker'
import Tabs from '../../components/Tabs'
import { BackLink, LEVEL_WARNA, Notice, NoticeAksesGuru, Spinner, btnGhost, btnPrimary } from './shared'

type JenisLaporan = 'slm' | 'sts' | 'sas'
type NilaiSlmKelas = Record<string, Record<string, NilaiTpDoc>>
type NilaiAsesmenKelas = Record<string, Record<string, NilaiAsesmenDoc>>

function parseJenis(v: string | null): JenisLaporan {
  if (v === 'sts' || v === 'sas') return v
  return 'slm'
}

function labelJenis(j: JenisLaporan): string {
  if (j === 'sts') return 'STS'
  if (j === 'sas') return 'SAS'
  return 'SLM'
}

function subJenis(j: JenisLaporan): string {
  if (j === 'sts') return 'Ujian tengah semester'
  if (j === 'sas') return 'Ujian akhir semester'
  return 'Sumatif lingkup materi'
}

/** Rata-rata SLM tertimbang (sama LaporanSlm). */
function rataSlm(
  siswaId: string,
  daftar: TujuanPembelajaran[],
  nilai: NilaiSlmKelas,
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

/** Rata-rata STS/SAS tertimbang dari TP cakupan. */
function rataAsesmen(
  siswaId: string,
  daftar: TujuanPembelajaran[],
  nilai: NilaiAsesmenKelas,
  tpBobot?: Record<string, number> | null,
): number | null {
  return hitungNilaiAkhirMapel(
    daftar.map((tp) => ({
      nilai: nilai[tp.id]?.[siswaId]?.nilai ?? null,
      bobot: bobotUntukCakupan(tp.id, tpBobot),
    })),
  )
}

export default function LaporanNilai({ profile }: { profile: AppUser }) {
  const [params, setParams] = useSearchParams()
  const jenis = parseJenis(params.get('jenis'))
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
  const [nilaiSlm, setNilaiSlm] = useState<NilaiSlmKelas | null>(null)
  const [nilaiAsesmen, setNilaiAsesmen] = useState<NilaiAsesmenKelas | null>(null)
  const [galat, setGalat] = useState('')
  const [tpBobot, setTpBobot] = useState<Record<string, number> | null>(null)

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
    setNilaiSlm(null)
    setNilaiAsesmen(null)
    setTpBobot(null)
    setGalat('')
    void (async () => {
      try {
        const [t, s] = await Promise.all([
          getTPList(mapel, kelas),
          getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
        ])
        const semester = periodeAk.semester
        const tahunAjaran = periodeAk.tahunAjaran
        if (jenis === 'slm') {
          const n = await getNilaiTPKelas({ mapel, kelas, semester, tahunAjaran })
          if (batal) return
          setTpList(t.filter((tp) => tpMasukSemester(tp, semester)))
          setSiswa(s)
          setNilaiSlm(n)
          setNilaiAsesmen(null)
        } else {
          const j = jenis as JenisAsesmen
          const [cakupan, angka] = await Promise.all([
            getCakupanTP({ mapel, kelas, semester, tahunAjaran, jenis: j }),
            getNilaiAsesmenKelas({ jenis: j, mapel, kelas, semester, tahunAjaran }),
          ])
          if (batal) return
          const ids = new Set(cakupan?.tpIds ?? [])
          const semesterTp = t.filter((tp) => tpMasukSemester(tp, semester))
          // Utama: TP di cakupan. Fallback: semua TP semester (agar leger tidak kosong bila cakupan belum diatur).
          const tampil = ids.size
            ? semesterTp.filter((tp) => ids.has(tp.id))
            : semesterTp
          setTpList(tampil)
          setSiswa(s)
          setNilaiAsesmen(angka)
          setNilaiSlm(null)
          setTpBobot(cakupan?.tpBobot ?? null)
        }
      } catch (e) {
        console.error(e)
        if (!batal) setGalat('Gagal memuat laporan. Periksa koneksi dan hak akses.')
      }
    })()
    return () => {
      batal = true
    }
  }, [
    mapel,
    kelas,
    tingkatan,
    berhak,
    tulis,
    admin,
    profile.role,
    jenis,
    periodeAk.ready,
    periodeAk.semester,
    periodeAk.tahunAjaran,
  ])

  function setJenis(next: JenisLaporan) {
    const q = new URLSearchParams(params)
    q.set('jenis', next)
    // Ganti jenis → kembali ke picker mapel×kelas agar status cakupan bisa beda
    q.delete('mapel')
    q.delete('kelas')
    setParams(q)
  }

  if (!tulis && !admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <NoticeAksesGuru aksi="Laporan nilai dibuka" role={profile.role} />
      </div>
    )
  }

  const tabItems = [
    { id: 'slm', label: 'SLM' },
    { id: 'sts', label: 'STS' },
    { id: 'sas', label: 'SAS' },
  ]

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          title={admin ? 'Rekap Nilai' : 'Laporan Nilai'}
          subtitle="Pilih jenis laporan, lalu mapel × kelas."
        />
        <Tabs items={tabItems} aktif={jenis} onUbah={(id) => setJenis(id as JenisLaporan)} ariaLabel="Jenis laporan">
          <p className="mb-3 text-[13px] text-slate-600">
            <span className="font-semibold text-muh-700">{labelJenis(jenis)}</span>
            {' — '}
            {subJenis(jenis)}
          </p>
          <MapelKelasPicker
            pilihan={pilihan}
            loading={mapelMaster === null}
            hrefFor={(m, k) =>
              `/akademik/laporan?jenis=${jenis}&mapel=${encodeURIComponent(m)}&kelas=${encodeURIComponent(k)}`
            }
          />
        </Tabs>
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to={`/akademik/laporan?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>
        <Notice tone="error">
          Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.
        </Notice>
      </div>
    )
  }

  const siap =
    config &&
    tpList &&
    siswa &&
    (jenis === 'slm' ? nilaiSlm != null : nilaiAsesmen != null)
  const sekolah = config?.namaSekolah?.trim() || 'SD Muhammadiyah 01 Kukusan'
  const inputUrl =
    jenis === 'slm'
      ? `/akademik/nilai-slm?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`
      : `/akademik/nilai-sts?jenis=${jenis}&mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`

  const judulLaporan =
    jenis === 'slm' ? 'Laporan Nilai SLM' : jenis === 'sts' ? 'Laporan Nilai STS' : 'Laporan Nilai SAS'

  const keterangan =
    jenis === 'slm'
      ? 'Angka rata-rata adalah SLM tertimbang per TP. STS dan SAS belum masuk. Level di bawah angka mengikuti KKTP TP itu, dihitung dari SLM saja.'
      : jenis === 'sts'
        ? 'Nilai per materi yang masuk cakupan STS. Rata-rata memakai bobot cakupan STS (default setara antar TP). Bobot semester tidak dipakai di sini.'
        : 'Nilai per materi yang masuk cakupan SAS. Rata-rata memakai bobot cakupan SAS (default setara). Nilai akhir rapor (SLM+STS+SAS) ada di menu Rapor.'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink to={`/akademik/laporan?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>
        <div className="flex gap-2">
          <Link to={inputUrl} className={`${btnGhost} no-underline`}>
            {admin ? 'Lihat daftar nilai' : 'Input nilai'}
          </Link>
          <button type="button" className={btnPrimary} onClick={() => window.print()}>
            Cetak
          </button>
        </div>
      </div>

      <div className="print:hidden">
        <Tabs
          items={tabItems}
          aktif={jenis}
          onUbah={(id) => {
            const q = new URLSearchParams(params)
            q.set('jenis', id)
            // Tetap di mapel×kelas yang sama saat ganti tab
            setParams(q)
          }}
          ariaLabel="Jenis laporan"
        >
          <span className="sr-only">{subJenis(jenis)}</span>
        </Tabs>
      </div>

      {galat ? (
        <Notice tone="error">{galat}</Notice>
      ) : !siap ? (
        <Spinner />
      ) : tpList.length === 0 ? (
        <Notice>
          {jenis === 'slm' ? (
            <>
              Belum ada TP semester {config.semesterAktif} untuk {mapel} tingkat {tingkatan}. Susun di Setup TP, lalu
              kelompokkan di Bobot Semester.
            </>
          ) : (
            <>
              Belum ada materi {labelJenis(jenis)} untuk {mapel} kelas {kelas}. Atur cakupan di menu Nilai STS &amp; SAS,
              atau pastikan TP sudah dikelompokkan di Bobot Semester.
            </>
          )}
        </Notice>
      ) : (
        <article className="card-soft overflow-hidden print:border-0 print:shadow-none">
          <header className="border-b border-border px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{sekolah}</p>
            <h1 className="mt-1 text-[18px] font-semibold text-slate-900">{judulLaporan}</h1>
            <p className="mt-1 text-[12.5px] text-slate-700">
              {mapel} · Kelas {kelas} · Semester {config.semesterAktif} · Tahun ajaran {config.tahunAjaran}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{keterangan}</p>
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
                            if (jenis === 'slm') {
                              const b = bobotTpDiSemester(tp, config.semesterAktif)
                              return b == null || b <= 0 ? 'setara' : `${b}%`
                            }
                            const b = bobotUntukCakupan(tp.id, tpBobot)
                            return b === 1 ? 'setara' : String(b)
                          })()}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-semibold">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {siswa.map((s, i) => {
                    const rata =
                      jenis === 'slm' && nilaiSlm
                        ? rataSlm(s.id, tpList, nilaiSlm, config.semesterAktif)
                        : nilaiAsesmen
                          ? rataAsesmen(s.id, tpList, nilaiAsesmen, tpBobot)
                          : null
                    return (
                      <tr key={s.id} className="border-b border-border">
                        <td className="px-3 py-2 text-muted">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{s.nama}</td>
                        {tpList.map((tp) => {
                          if (jenis === 'slm' && nilaiSlm) {
                            const slm = nilaiSlm[tp.id]?.[s.id]?.slm
                            const lv =
                              slm == null ? null : tentukanLevel(hitungNilaiAkhirTP(slm, null, tp), tp)
                            return (
                              <td key={tp.id} className="px-2 py-2 text-center">
                                <div className="font-semibold text-slate-800">{slm == null ? '–' : slm}</div>
                                {lv && (
                                  <div
                                    className={`mx-auto mt-0.5 w-fit rounded-full px-1.5 text-[9.5px] font-semibold ${LEVEL_WARNA[lv.index]}`}
                                  >
                                    {lv.label}
                                  </div>
                                )}
                              </td>
                            )
                          }
                          const n = nilaiAsesmen?.[tp.id]?.[s.id]?.nilai
                          return (
                            <td key={tp.id} className="px-2 py-2 text-center">
                              <div className="font-semibold text-slate-800">{n == null ? '–' : n}</div>
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-center text-[14px] font-bold text-muh-800">
                          {rata ?? '–'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Rata-rata kelas */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-slate-50">
                    <td className="px-3 py-2" colSpan={2}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Rata-rata kelas
                      </span>
                    </td>
                    {tpList.map((tp) => {
                      const angka: number[] = []
                      for (const s of siswa) {
                        if (jenis === 'slm' && nilaiSlm) {
                          const v = nilaiSlm[tp.id]?.[s.id]?.slm
                          if (v != null && Number.isFinite(v)) angka.push(v)
                        } else if (nilaiAsesmen) {
                          const v = nilaiAsesmen[tp.id]?.[s.id]?.nilai
                          if (v != null && Number.isFinite(v)) angka.push(v)
                        }
                      }
                      const avg =
                        angka.length > 0
                          ? Math.round(angka.reduce((a, b) => a + b, 0) / angka.length)
                          : null
                      return (
                        <td key={tp.id} className="px-2 py-2 text-center font-semibold text-slate-700">
                          {avg ?? '–'}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center text-[14px] font-bold text-muh-800">
                      {(() => {
                        const angka: number[] = []
                        for (const s of siswa) {
                          const r =
                            jenis === 'slm' && nilaiSlm
                              ? rataSlm(s.id, tpList, nilaiSlm, config.semesterAktif)
                              : nilaiAsesmen
                                ? rataAsesmen(s.id, tpList, nilaiAsesmen, tpBobot)
                                : null
                          if (r != null && Number.isFinite(r)) angka.push(r)
                        }
                        return angka.length
                          ? Math.round(angka.reduce((a, b) => a + b, 0) / angka.length)
                          : '–'
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </article>
      )}
    </div>
  )
}
