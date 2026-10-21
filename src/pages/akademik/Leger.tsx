/**
 * Leger nilai kelas: satu tabel seluruh siswa × seluruh mapel untuk SLM / STS / SAS.
 * Kolom tambahan: Total, Rata-rata, Peringkat kelas.
 * Akses: wali kelas (kelas yang diwalikan) dan admin (semua kelas).
 * Route: /akademik/leger?jenis=slm|sts|sas&kelas=…
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type {
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
  mapelBerlakuDiTingkatan,
  tingkatanDariKelas,
  tpMasukSemester,
} from '../../lib/akademik'
import { hitungStsMapel } from '../../lib/asesmenRumus'
import { getSeniKelas, labelSeniBudaya } from '../../lib/seniKelas'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { getSiswaList } from '../../lib/tahsinData'
import { kelasSaya } from '../../lib/kelasSaya'
import { isAdminRole } from '../../lib/roles'
import { SEMUA_KELAS, type SiswaTahsin } from '../../types/tahsin'
import { PageHeader } from '../../components/ui'
import Tabs from '../../components/Tabs'
import { BackLink, Notice, Spinner, btnPrimary, inputCls } from './shared'

type JenisLeger = 'slm' | 'sts' | 'sas'

type NilaiSlmKelas = Record<string, Record<string, NilaiTpDoc>>
type NilaiAsesmenKelas = Record<string, Record<string, NilaiAsesmenDoc>>

interface SumberMapel {
  mapel: Mapel
  label: string
  tpList: TujuanPembelajaran[]
  /** SLM: nilai per TP; STS/SAS: nilai asesmen per TP */
  nilaiSlm?: NilaiSlmKelas
  nilaiAsesmen?: NilaiAsesmenKelas
  tpBobot?: Record<string, number> | null
}

function parseJenis(v: string | null): JenisLeger {
  if (v === 'sts' || v === 'sas') return v
  return 'slm'
}

function labelJenis(j: JenisLeger): string {
  if (j === 'sts') return 'STS'
  if (j === 'sas') return 'SAS'
  return 'SLM'
}

function subJenis(j: JenisLeger): string {
  if (j === 'sts') return 'Ujian tengah semester — nilai per mapel dari TP cakupan'
  if (j === 'sas') return 'Ujian akhir semester — nilai per mapel dari TP cakupan'
  return 'Sumatif lingkup materi — rata-rata tertimbang TP per mapel'
}

/** Rata-rata dengan 2 digit desimal (mis. 87.25). */
function rataDuaDigit(angka: number[]): number | null {
  if (!angka.length) return null
  const sum = angka.reduce((a, b) => a + b, 0)
  return Math.round((sum / angka.length) * 100) / 100
}

/** Tampilkan angka rata-rata: selalu 2 digit di belakang koma. */
function fmtRata(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return n.toFixed(2)
}

/** Nilai satu mapel untuk satu siswa (SLM). */
function nilaiSlmMapel(
  siswaId: string,
  tpList: TujuanPembelajaran[],
  nilai: NilaiSlmKelas | undefined,
  semester: string,
): number | null {
  if (!nilai || !tpList.length) return null
  return hitungNilaiAkhirMapel(
    tpList.map((tp) => {
      const slm = nilai[tp.id]?.[siswaId]?.slm
      const bobot = bobotTpDiSemester(tp, semester)
      return {
        nilai: slm == null ? null : hitungNilaiAkhirTP(slm, null, tp),
        bobot: bobot == null ? 0 : bobot,
      }
    }),
  )
}

/** Nilai satu mapel untuk satu siswa (STS/SAS murni). */
function nilaiAsesmenMapel(
  siswaId: string,
  tpList: TujuanPembelajaran[],
  nilai: NilaiAsesmenKelas | undefined,
  tpBobot: Record<string, number> | null | undefined,
  semester: string,
): number | null {
  if (!nilai || !tpList.length) return null
  return hitungStsMapel(tpList, nilai, siswaId, semester, tpList, tpBobot).nilaiAkhir
}

/** Peringkat dari skor (total). Nilai lebih tinggi = peringkat lebih baik. Seri = peringkat sama. */
function hitungPeringkat(skorList: (number | null)[]): (number | null)[] {
  const indexed = skorList
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r != null && Number.isFinite(x.r as number)) as { r: number; i: number }[]
  indexed.sort((a, b) => b.r - a.r)
  const out: (number | null)[] = skorList.map(() => null)
  let rank = 1
  for (let k = 0; k < indexed.length; k++) {
    if (k > 0 && indexed[k].r < indexed[k - 1].r) {
      rank = k + 1
    }
    out[indexed[k].i] = rank
  }
  return out
}

export default function Leger({ profile }: { profile: AppUser }) {
  const [params, setParams] = useSearchParams()
  const jenis = parseJenis(params.get('jenis'))
  const kelasParam = (params.get('kelas') || '').toUpperCase()
  const admin = isAdminRole(profile.role)

  /**
   * Stabilkan daftar kelas: `kelasSaya()` selalu mengembalikan array baru,
   * jadi jangan pakai referensi itu sebagai dependency useMemo/useEffect
   * (akan memicu muat ulang tak berujung / flicker spinner).
   */
  const waliKey = (profile.waliKelas ?? []).join('|')
  const kelasBoleh = useMemo<string[]>(() => {
    if (admin) return [...SEMUA_KELAS]
    return kelasSaya(profile).wali
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stabil lewat waliKey
  }, [admin, waliKey])

  const periodeAk = usePeriodeAkademik()
  const [kelas, setKelas] = useState(() => kelasParam || kelasBoleh[0] || '')
  const [sumber, setSumber] = useState<SumberMapel[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [galat, setGalat] = useState('')
  const [loading, setLoading] = useState(false)

  // Sinkronkan kelas dari query / daftar boleh — jangan depend pada `kelas` agar tidak loop.
  useEffect(() => {
    if (kelasParam && kelasBoleh.includes(kelasParam)) {
      setKelas((prev) => (prev === kelasParam ? prev : kelasParam))
      return
    }
    if (kelasBoleh.length && !kelasBoleh.includes(kelas)) {
      setKelas(kelasBoleh[0])
    } else if (!kelas && kelasBoleh.length) {
      setKelas(kelasBoleh[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja tidak memasukkan `kelas` agar setKelas tidak memicu ulang
  }, [kelasParam, kelasBoleh])

  function setJenis(next: JenisLeger) {
    const q = new URLSearchParams(params)
    q.set('jenis', next)
    if (kelas) q.set('kelas', kelas)
    setParams(q, { replace: true })
  }

  function gantiKelas(k: string) {
    setKelas(k)
    const q = new URLSearchParams(params)
    q.set('jenis', jenis)
    q.set('kelas', k)
    setParams(q, { replace: true })
  }

  useEffect(() => {
    if (!kelas || !kelasBoleh.includes(kelas)) {
      setSumber(null)
      setSiswa(null)
      return
    }
    if (!periodeAk.ready) return
    let batal = false
    setLoading(true)
    setSumber(null)
    setSiswa(null)
    setGalat('')
    const semester = periodeAk.semester
    const tahunAjaran = periodeAk.tahunAjaran
    const tingkatan = tingkatanDariKelas(kelas)

    void (async () => {
      try {
        const [mapelList, siswaList, seni] = await Promise.all([
          getMapelList(),
          getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
          getSeniKelas(kelas),
        ])
        if (batal) return
        const disiplinAktif = semester === '2' ? seni.genap : seni.ganjil
        const mapelBerlaku = mapelList
          .filter((m) => mapelBerlakuDiTingkatan(m, tingkatan))
          .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.nama.localeCompare(b.nama, 'id'))

        const sumberMapel: SumberMapel[] = await Promise.all(
          mapelBerlaku.map(async (m) => {
            const label =
              m.nama === 'Seni Budaya' ? labelSeniBudaya(disiplinAktif) : m.nama
            if (jenis === 'slm') {
              const [tpList, nilai] = await Promise.all([
                getTPList(m.nama, kelas),
                getNilaiTPKelas({ mapel: m.nama, kelas, semester, tahunAjaran }),
              ])
              return {
                mapel: m,
                label,
                tpList: tpList.filter((tp) => tpMasukSemester(tp, semester)),
                nilaiSlm: nilai,
              }
            }
            const j = jenis as JenisAsesmen
            const [tpList, cakupan, angka] = await Promise.all([
              getTPList(m.nama, kelas),
              getCakupanTP({ mapel: m.nama, kelas, semester, tahunAjaran, jenis: j }),
              getNilaiAsesmenKelas({ jenis: j, mapel: m.nama, kelas, semester, tahunAjaran }),
            ])
            const ids = new Set(cakupan?.tpIds ?? [])
            const semesterTp = tpList.filter((tp) => tpMasukSemester(tp, semester))
            const tampil = ids.size ? semesterTp.filter((tp) => ids.has(tp.id)) : semesterTp
            return {
              mapel: m,
              label,
              tpList: tampil,
              nilaiAsesmen: angka,
              tpBobot: cakupan?.tpBobot ?? null,
            }
          }),
        )
        if (batal) return
        setSiswa(siswaList)
        setSumber(sumberMapel)
      } catch (e) {
        console.error(e)
        if (!batal) setGalat('Gagal memuat leger. Periksa koneksi dan hak akses.')
      } finally {
        if (!batal) setLoading(false)
      }
    })()
    return () => {
      batal = true
    }
  }, [
    kelas,
    jenis,
    // kelasBoleh stabil lewat waliKey; string join agar referensi array tidak memicu ulang
    waliKey,
    admin,
    profile.role,
    periodeAk.ready,
    periodeAk.semester,
    periodeAk.tahunAjaran,
  ])

  if (!admin && !kelasBoleh.length) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="warn">
          Leger hanya dapat dibuka oleh wali kelas atau administrator. Hubungi admin agar kelas
          wali ditetapkan di Kelola Akun.
        </Notice>
      </div>
    )
  }

  if (!periodeAk.loading && !periodeAk.ready) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="warn">
          Belum ada periode akademik yang dipilih. Minta admin membuat periode di Administrasi →
          Periode Akademik, lalu login ulang atau pilih periode di header.
        </Notice>
      </div>
    )
  }

  const tabItems = [
    { id: 'slm', label: 'SLM' },
    { id: 'sts', label: 'STS' },
    { id: 'sas', label: 'SAS' },
  ]

  const semester = periodeAk.semester
  const baris =
    sumber && siswa
      ? siswa.map((s) => {
          const nilaiPerMapel = sumber.map((src) => {
            if (jenis === 'slm') {
              return nilaiSlmMapel(s.id, src.tpList, src.nilaiSlm, semester)
            }
            return nilaiAsesmenMapel(
              s.id,
              src.tpList,
              src.nilaiAsesmen,
              src.tpBobot,
              semester,
            )
          })
          const terisi = nilaiPerMapel.filter((n) => n != null && Number.isFinite(n)) as number[]
          const total = terisi.length ? terisi.reduce((a, b) => a + b, 0) : null
          const rata = rataDuaDigit(terisi)
          return { siswa: s, nilaiPerMapel, total, rata }
        })
      : []

  // Peringkat berdasarkan total (bukan rata-rata)
  const peringkat = hitungPeringkat(baris.map((b) => b.total))

  // Urutkan tampilan: peringkat naik, lalu nama
  const barisUrut = baris
    .map((b, i) => ({ ...b, peringkat: peringkat[i] }))
    .sort((a, b) => {
      if (a.peringkat == null && b.peringkat == null) return a.siswa.nama.localeCompare(b.siswa.nama, 'id')
      if (a.peringkat == null) return 1
      if (b.peringkat == null) return -1
      if (a.peringkat !== b.peringkat) return a.peringkat - b.peringkat
      return a.siswa.nama.localeCompare(b.siswa.nama, 'id')
    })

  const judul = `Leger ${labelJenis(jenis)}`
  const sekolah = 'SD Muhammadiyah 01 Kukusan'

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          title={admin ? `Rekap Leger ${labelJenis(jenis)}` : judul}
          subtitle={
            periodeAk.ready
              ? `Periode ${periodeAk.label} · Capaian seluruh mapel dalam satu tabel (total, rata-rata, peringkat).`
              : 'Pilih periode di header atau login ulang.'
          }
        />
      </div>

      <div className="print:hidden">
        <Tabs
          items={tabItems}
          aktif={jenis}
          onUbah={(id) => setJenis(id as JenisLeger)}
          ariaLabel="Jenis leger"
        >
          <p className="mb-3 text-[13px] text-slate-600">
            <span className="font-semibold text-muh-700">{labelJenis(jenis)}</span>
            {' — '}
            {subJenis(jenis)}
          </p>
        </Tabs>
      </div>

      <div className="card-soft flex flex-wrap items-end gap-3 p-4 print:hidden">
        <label className="block min-w-[140px]">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Kelas</span>
          <select
            className={inputCls}
            value={kelas}
            onChange={(e) => gantiKelas(e.target.value)}
          >
            {kelasBoleh.map((k) => (
              <option key={k} value={k}>
                Kelas {k}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btnPrimary} onClick={() => window.print()}>
          Cetak
        </button>
      </div>

      {galat && <Notice tone="error">{galat}</Notice>}

      {loading || !sumber || !siswa ? (
        <Spinner />
      ) : siswa.length === 0 ? (
        <Notice>Tidak ada siswa aktif di kelas {kelas}.</Notice>
      ) : (
        <article className="card-soft overflow-hidden print:border-0 print:shadow-none">
          <header className="border-b border-border px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{sekolah}</p>
            <h1 className="mt-1 text-[18px] font-semibold text-slate-900">{judul}</h1>
            <p className="mt-1 text-[12.5px] text-slate-700">
              Kelas {kelas} · Semester {periodeAk.semester} · Tahun ajaran {periodeAk.tahunAjaran}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Total = jumlah nilai mapel yang terisi. Rata-rata = rata-rata mapel yang terisi (2
              digit desimal). Peringkat dihitung dari total (nilai lebih tinggi = peringkat lebih
              baik; total sama = peringkat sama). Mapel tanpa nilai ditandai “–” dan tidak masuk
              total/rata-rata.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 font-semibold">No</th>
                  <th className="sticky left-8 z-10 bg-slate-50 px-2 py-2 font-semibold">Nama</th>
                  {sumber.map((src) => (
                    <th
                      key={src.mapel.nama}
                      className="px-1.5 py-2 text-center font-semibold"
                      title={src.mapel.nama}
                    >
                      <span className="mx-auto block max-w-[4.5rem] truncate">{src.label}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold">Total</th>
                  <th className="px-2 py-2 text-center font-semibold">Rata-rata</th>
                  <th className="px-2 py-2 text-center font-semibold">Peringkat</th>
                </tr>
              </thead>
              <tbody>
                {barisUrut.map((b, idx) => (
                  <tr key={b.siswa.id} className="border-b border-border">
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-muted">{idx + 1}</td>
                    <td className="sticky left-8 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium text-slate-900">
                      {b.siswa.nama}
                    </td>
                    {b.nilaiPerMapel.map((n, mi) => (
                      <td key={sumber[mi].mapel.nama} className="px-1.5 py-1.5 text-center font-semibold text-slate-800">
                        {n == null ? '–' : n}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-semibold text-slate-800">
                      {b.total == null ? '–' : b.total}
                    </td>
                    <td className="px-2 py-1.5 text-center text-[13px] font-bold text-muh-800">
                      {fmtRata(b.rata)}
                    </td>
                    <td className="px-2 py-1.5 text-center text-[13px] font-bold text-muh-800">
                      {b.peringkat == null ? '–' : b.peringkat}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50">
                  <td className="px-2 py-2" colSpan={2}>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Rata-rata kelas
                    </span>
                  </td>
                  {sumber.map((src, mi) => {
                    const angka = baris
                      .map((b) => b.nilaiPerMapel[mi])
                      .filter((n): n is number => n != null && Number.isFinite(n))
                    return (
                      <td key={src.mapel.nama} className="px-1.5 py-2 text-center font-semibold text-slate-700">
                        {fmtRata(rataDuaDigit(angka))}
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center font-semibold text-slate-700">
                    {(() => {
                      const angka = baris
                        .map((b) => b.total)
                        .filter((n): n is number => n != null && Number.isFinite(n))
                      return angka.length
                        ? Math.round(angka.reduce((a, b) => a + b, 0) / angka.length)
                        : '–'
                    })()}
                  </td>
                  <td className="px-2 py-2 text-center text-[13px] font-bold text-muh-800">
                    {fmtRata(
                      rataDuaDigit(
                        baris
                          .map((b) => b.rata)
                          .filter((n): n is number => n != null && Number.isFinite(n)),
                      ),
                    )}
                  </td>
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      )}
    </div>
  )
}
