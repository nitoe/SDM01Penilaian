import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { ConfigAkademik, NilaiTpDoc, TujuanPembelajaran } from '../../types/akademik'
import {
  getConfigAkademik,
  getNilaiTPKelas,
  getTPList,
  hitungNilaiAkhirMapel,
  hitungNilaiAkhirTP,
  saveNilaiTPBatch,
  tentukanLevel,
  tingkatanDariKelas,
  tpMasukSemester,
} from '../../lib/akademik'
import { getSiswaList } from '../../lib/tahsinData'
import { mapelKelasSaya } from '../../lib/penugasan'
import { isGuruAkademikRole } from '../../lib/roles'
import type { SiswaTahsin } from '../../types/tahsin'
import { Badge, HeroBanner } from '../../components/ui'
import { BackLink, LEVEL_WARNA, Notice, Spinner, btnGhost, btnPrimary, inputCls, useToast } from './shared'

type Draf = Record<string, string>
type NilaiKelas = Record<string, Record<string, NilaiTpDoc>>
type StatusKartu =
  | { jenis: 'tanpa-tp'; siswa: number }
  | { jenis: 'ada'; lengkap: number; total: number; siswa: number }
  | { jenis: 'gagal' }

const KOSONG: Record<string, NilaiTpDoc> = {}

function drafDari(existing: Record<string, NilaiTpDoc>): Draf {
  return Object.fromEntries(
    Object.values(existing).map((n) => [n.siswaId, n.slm == null ? '' : String(n.slm)]),
  )
}

function rataSlm(siswaId: string, daftar: TujuanPembelajaran[], nilai: NilaiKelas): number | null {
  return hitungNilaiAkhirMapel(
    daftar.map((tp) => {
      const slm = nilai[tp.id]?.[siswaId]?.slm
      return { nilai: slm == null ? null : hitungNilaiAkhirTP(slm, null, tp), bobot: tp.bobotMapel ?? 1 }
    }),
  )
}

function TpNilai({
  tp,
  siswa,
  ctx,
  config,
  existing,
  onSelesai,
  onPesan,
}: {
  tp: TujuanPembelajaran
  siswa: SiswaTahsin[]
  ctx: { mapel: string; kelas: string; tingkatan: string }
  config: ConfigAkademik
  existing: Record<string, NilaiTpDoc>
  onSelesai: () => Promise<void>
  onPesan: (msg: string, err?: boolean) => void
}) {
  const [draf, setDraf] = useState<Draf>(() => drafDari(existing))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraf(drafDari(existing))
  }, [existing])

  const parse = (t: string | undefined): number | null => {
    if (t === undefined || t.trim() === '') return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }

  const berubah = siswa.filter((s) => {
    const n = parse(draf[s.id])
    if (n === null) return false
    const lama = existing[s.id]?.slm
    return lama === undefined || lama !== n
  })
  const terisi = siswa.filter((s) => parse(draf[s.id]) !== null).length

  async function simpan() {
    const galat = berubah.find((s) => {
      const n = parse(draf[s.id])
      return n === null || Number.isNaN(n) || n < 0 || n > 100
    })
    if (galat) return onPesan(`Nilai ${galat.nama} harus angka 0–100.`, true)
    if (!berubah.length) return onPesan('Tidak ada perubahan untuk disimpan.')
    setBusy(true)
    try {
      const n = await saveNilaiTPBatch(
        {
          tpId: tp.id,
          mapel: ctx.mapel,
          kelas: ctx.kelas,
          tingkatan: ctx.tingkatan,
          semester: config.semesterAktif,
          tahunAjaran: config.tahunAjaran,
        },
        berubah.map((s) => ({ siswaId: s.id, slm: parse(draf[s.id]) as number })),
        existing,
      )
      await onSelesai()
      onPesan(`${n} nilai disimpan.`)
    } catch (err) {
      console.error(err)
      onPesan('Gagal menyimpan nilai.', true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11.5px] text-muted">
        Terisi {terisi}/{siswa.length} siswa · SLM saja (STS dan SAS diinput di menu terpisah)
      </p>
      <ul className="divide-y divide-border">
        {siswa.map((s) => {
          const n = parse(draf[s.id])
          const valid = n !== null && !Number.isNaN(n) && n >= 0 && n <= 100
          const lv = valid ? tentukanLevel(hitungNilaiAkhirTP(n, null, tp), tp) : null
          return (
            <li key={s.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-800">{s.nama}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  lv ? LEVEL_WARNA[lv.index] : 'bg-slate-100 text-slate-400'
                }`}
              >
                {lv ? lv.label : '—'}
              </span>
              <input
                aria-label={`Nilai SLM ${s.nama}`}
                className={`${inputCls} w-[68px] shrink-0 text-center ${
                  n !== null && !valid ? 'border-red-400 ring-2 ring-red-200' : ''
                }`}
                inputMode="decimal"
                value={draf[s.id] ?? ''}
                onChange={(e) => setDraf((d) => ({ ...d, [s.id]: e.target.value }))}
                placeholder="–"
              />
            </li>
          )
        })}
      </ul>
      <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !berubah.length} onClick={() => void simpan()}>
        {busy ? 'Menyimpan…' : berubah.length ? `Simpan ${berubah.length} perubahan` : 'Tidak ada perubahan'}
      </button>
    </div>
  )
}

export default function NilaiSlm({ profile }: { profile: AppUser }) {
  const [params] = useSearchParams()
  const mapel = params.get('mapel') || ''
  const kelas = params.get('kelas') || ''
  const tingkatan = tingkatanDariKelas(kelas)
  const pilihan = useMemo(() => mapelKelasSaya(profile), [profile])
  const berhak = pilihan.some((p) => p.mapel === mapel && p.kelas === kelas)
  const guru = isGuruAkademikRole(profile.role)

  const [config, setConfig] = useState<ConfigAkademik | null>(null)
  const [tpList, setTpList] = useState<TujuanPembelajaran[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [nilai, setNilai] = useState<NilaiKelas | null>(null)
  const [status, setStatus] = useState<Record<string, StatusKartu> | null>(null)
  const [terbuka, setTerbuka] = useState<string | null>(null)
  const [gagalMuat, setGagalMuat] = useState(false)
  const { show, node } = useToast()

  const muatDetail = useCallback(async () => {
    const [c, t, s] = await Promise.all([
      getConfigAkademik(),
      getTPList(mapel, tingkatan),
      getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
    ])
    const n = await getNilaiTPKelas({
      mapel,
      kelas,
      semester: c.semesterAktif,
      tahunAjaran: c.tahunAjaran,
    })
    setConfig(c)
    setTpList(t)
    setSiswa(s)
    setNilai(n)
  }, [mapel, kelas, tingkatan, profile.role])

  useEffect(() => {
    if (mapel || kelas || !guru || pilihan.length === 0) return
    let batal = false
    setStatus(null)
    void (async () => {
      try {
        const cfg = await getConfigAkademik()
        const baris = await Promise.all(
          pilihan.map(async (p) => {
            const kunci = `${p.mapel}|${p.kelas}`
            try {
              const [daftar, anak] = await Promise.all([
                getTPList(p.mapel, tingkatanDariKelas(p.kelas)),
                getSiswaList(p.kelas, { role: profile.role, kelasAmpu: [] }),
              ])
              const tampil = daftar.filter((t) => tpMasukSemester(t, cfg.semesterAktif))
              if (!tampil.length) return [kunci, { jenis: 'tanpa-tp', siswa: anak.length } as StatusKartu] as const
              const n = await getNilaiTPKelas({
                mapel: p.mapel,
                kelas: p.kelas,
                semester: cfg.semesterAktif,
                tahunAjaran: cfg.tahunAjaran,
              })
              const lengkap = tampil.filter(
                (t) => anak.length > 0 && anak.every((s) => n[t.id]?.[s.id]?.slm != null),
              ).length
              return [kunci, { jenis: 'ada', lengkap, total: tampil.length, siswa: anak.length } as StatusKartu] as const
            } catch (e) {
              console.error(e)
              return [kunci, { jenis: 'gagal' } as StatusKartu] as const
            }
          }),
        )
        if (!batal) setStatus(Object.fromEntries(baris))
      } catch (e) {
        console.error(e)
        if (!batal) show('Gagal memuat status SLM.', true)
      }
    })()
    return () => {
      batal = true
    }
  }, [mapel, kelas, guru, pilihan, profile.role, show])

  useEffect(() => {
    if (!mapel || !kelas || !berhak || !guru) return
    let batal = false
    setConfig(null)
    setTpList(null)
    setSiswa(null)
    setNilai(null)
    setGagalMuat(false)
    void muatDetail().catch((e) => {
      console.error(e)
      if (batal) return
      setGagalMuat(true)
      show('Gagal memuat data kelas. Periksa koneksi dan hak akses.', true)
    })
    return () => {
      batal = true
    }
  }, [mapel, kelas, berhak, guru, muatDetail, show])

  const segarkanNilai = useCallback(async () => {
    if (!config?.tahunAjaran) return
    setNilai(
      await getNilaiTPKelas({
        mapel,
        kelas,
        semester: config.semesterAktif,
        tahunAjaran: config.tahunAjaran,
      }),
    )
  }, [config, mapel, kelas])

  if (!guru) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <Notice tone="warn">Input nilai dilakukan oleh guru mata pelajaran sesuai penugasannya.</Notice>
      </div>
    )
  }

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <HeroBanner
          eyebrow="Akademik"
          title="Input Nilai SLM"
          subtitle="Pilih mata pelajaran dan kelas. Status di kartu adalah kelengkapan nilai semester yang sedang berjalan."
        />
        {pilihan.length === 0 ? (
          <Notice tone="warn">Akun Anda belum memiliki penugasan mata pelajaran. Hubungi admin.</Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => {
              const kunci = `${p.mapel}|${p.kelas}`
              const st = status?.[kunci]
              return (
                <article key={kunci} className="card-soft p-4">
                  <Link
                    to={`/akademik/nilai-slm?mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`}
                    className="block no-underline"
                  >
                    <p className="text-[14px] font-semibold text-slate-900">{p.mapel}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Kelas {p.kelas}
                      {st && st.jenis !== 'gagal' ? ` · ${st.siswa} siswa` : ''}
                      {status === null ? ' · Memuat status…' : st?.jenis === 'gagal' ? ' · Gagal memuat status' : ''}
                    </p>
                  </Link>
                  {st?.jenis === 'tanpa-tp' && (
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="peach">Belum ada TP</Badge>
                      <Link
                        className="text-[11.5px] font-semibold text-muh-700 underline"
                        to={`/akademik/setup-tp?mapel=${encodeURIComponent(p.mapel)}&tingkatan=${tingkatanDariKelas(p.kelas)}`}
                      >
                        Buat TP dulu
                      </Link>
                    </p>
                  )}
                  {st?.jenis === 'ada' && (
                    <p className="mt-2">
                      {st.lengkap === st.total ? (
                        <Badge tone="green">SLM lengkap semua TP ({st.total})</Badge>
                      ) : (
                        <Badge tone="peach">SLM lengkap {st.lengkap}/{st.total} TP</Badge>
                      )}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
        {node}
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/nilai-slm">Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.</Notice>
      </div>
    )
  }

  const tampil = (tpList ?? []).filter((t) => config && tpMasukSemester(t, config.semesterAktif))
  const tersembunyi = (tpList?.length ?? 0) - tampil.length
  const belumKelompok = tampil.filter((t) => !t.semester).length
  const laporan = `/akademik/laporan-slm?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`

  return (
    <div className="space-y-5">
      <BackLink to="/akademik/nilai-slm">Pilih mata pelajaran</BackLink>
      <HeroBanner
        eyebrow={`Kelas ${kelas}`}
        title={`Nilai SLM — ${mapel}`}
        subtitle={
          config?.tahunAjaran
            ? `Semester ${config.semesterAktif} · Tahun ajaran ${config.tahunAjaran}`
            : 'Memuat…'
        }
      />
      {gagalMuat ? (
        <Notice tone="error">Gagal memuat data kelas. Periksa koneksi, lalu muat ulang halaman.</Notice>
      ) : tpList === null || siswa === null || config === null || nilai === null ? (
        <Spinner />
      ) : tpList.length === 0 ? (
        <Notice>
          Belum ada TP untuk {mapel} tingkat {tingkatan}. Susun dulu di{' '}
          <Link className="font-semibold underline" to={`/akademik/setup-tp?mapel=${encodeURIComponent(mapel)}&tingkatan=${tingkatan}`}>
            Setup TP & KKTP
          </Link>
          .
        </Notice>
      ) : siswa.length === 0 ? (
        <Notice tone="warn">Tidak ada siswa aktif di kelas {kelas}.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Link to={laporan} className={`${btnGhost} no-underline`}>
              Laporan SLM
            </Link>
          </div>
          {belumKelompok > 0 && (
            <Notice tone="warn">
              {belumKelompok} TP belum dikelompokkan ke semester, jadi ikut tampil di sini. Atur di{' '}
              <Link className="font-semibold underline" to={`/akademik/bobot-semester?mapel=${encodeURIComponent(mapel)}&tingkatan=${tingkatan}`}>
                Bobot Semester
              </Link>
              .
            </Notice>
          )}
          {tersembunyi > 0 && (
            <p className="text-[11.5px] text-muted">{tersembunyi} TP semester lain disembunyikan.</p>
          )}
          <div className="space-y-2.5">
            {tampil.map((tp) => {
              const buka = terbuka === tp.id
              const isi = siswa.filter((s) => nilai[tp.id]?.[s.id]?.slm != null).length
              return (
                <article key={tp.id} className="card-soft overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTerbuka(buka ? null : tp.id)}
                    className="flex w-full items-center gap-3 p-3.5 text-left"
                    aria-expanded={buka}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muh-50 text-[13px] font-bold text-muh-700">
                      {tp.nomorTp}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold leading-snug text-slate-900">{tp.namaTp}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge>
                          {isi}/{siswa.length} siswa
                        </Badge>
                        <Badge tone={tp.bobotMapel == null ? 'peach' : 'neutral'}>
                          {tp.bobotMapel == null ? 'Bobot belum diatur' : `${tp.bobotMapel}% dari nilai mapel`}
                        </Badge>
                      </span>
                    </span>
                  </button>
                  {buka && (
                    <div className="border-t border-border p-3.5">
                      <TpNilai
                        tp={tp}
                        siswa={siswa}
                        ctx={{ mapel, kelas, tingkatan }}
                        config={config}
                        existing={nilai[tp.id] ?? KOSONG}
                        onSelesai={segarkanNilai}
                        onPesan={show}
                      />
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <section className="card-soft p-4">
            <h2 className="text-[14px] font-semibold text-slate-900">Ringkasan SLM (sementara)</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Rata-rata tertimbang SLM saja, sesuai bobot TP dalam mapel pada semester ini. Belum termasuk STS/SAS.
              TP yang bobotnya belum diatur dihitung setara.
            </p>
            <ul className="mt-2 divide-y divide-border">
              {siswa.map((s) => {
                const akhir = rataSlm(s.id, tampil, nilai)
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-800">{s.nama}</span>
                    <span className={`w-10 text-center text-[14px] font-bold ${akhir === null ? 'text-slate-400' : 'text-muh-700'}`}>
                      {akhir === null ? '–' : akhir}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
      {node}
    </div>
  )
}
