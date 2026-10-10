import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { ConfigAkademik, NilaiTpDoc, TujuanPembelajaran } from '../../types/akademik'
import {
  getConfigAkademik,
  getNilaiTPUntukTP,
  getTPList,
  hitungNilaiAkhirTP,
  saveNilaiTPBatch,
  tentukanLevel,
  tingkatanDariKelas,
} from '../../lib/akademik'
import { getSiswaList } from '../../lib/tahsinData'
import { mapelKelasSaya } from '../../lib/penugasan'
import { isGuruAkademikRole } from '../../lib/roles'
import type { SiswaTahsin } from '../../types/tahsin'
import { HeroBanner } from '../../components/ui'
import { BackLink, LEVEL_WARNA, Notice, Spinner, btnPrimary, inputCls, useToast } from './shared'

type Draf = Record<string, string> // siswaId -> teks input

function TpNilai({
  tp,
  siswa,
  ctx,
  config,
  onSaved,
}: {
  tp: TujuanPembelajaran
  siswa: SiswaTahsin[]
  ctx: { mapel: string; kelas: string; tingkatan: string }
  config: ConfigAkademik
  onSaved: (msg: string, err?: boolean) => void
}) {
  const [existing, setExisting] = useState<Record<string, NilaiTpDoc> | null>(null)
  const [draf, setDraf] = useState<Draf>({})
  const [busy, setBusy] = useState(false)

  const muat = useCallback(async () => {
    try {
      const e = await getNilaiTPUntukTP({
        tpId: tp.id,
        mapel: ctx.mapel,
        kelas: ctx.kelas,
        semester: config.semesterAktif,
        tahunAjaran: config.tahunAjaran,
      })
      setExisting(e)
      setDraf(Object.fromEntries(Object.values(e).map((n) => [n.siswaId, String(n.slm)])))
    } catch (err) {
      console.error(err)
      onSaved('Gagal memuat nilai. Periksa koneksi dan hak akses.', true)
      setExisting({})
    }
  }, [tp.id, ctx.mapel, ctx.kelas, config.semesterAktif, config.tahunAjaran, onSaved])

  useEffect(() => {
    void muat()
  }, [muat])

  if (existing === null) return <Spinner />

  const parse = (t: string | undefined): number | null => {
    if (t === undefined || t.trim() === '') return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }

  // Hanya entri yang berubah dari nilai tersimpan yang ditulis (v2 menulis semua).
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
    if (galat) return onSaved(`Nilai ${galat.nama} harus angka 0–100.`, true)
    if (!berubah.length) return onSaved('Tidak ada perubahan untuk disimpan.')
    setBusy(true)
    try {
      const n = await saveNilaiTPBatch(
        { tpId: tp.id, mapel: ctx.mapel, kelas: ctx.kelas, tingkatan: ctx.tingkatan, semester: config.semesterAktif, tahunAjaran: config.tahunAjaran },
        berubah.map((s) => ({ siswaId: s.id, slm: parse(draf[s.id]) as number })),
        existing as Record<string, NilaiTpDoc>,
      )
      onSaved(`${n} nilai disimpan.`)
      await muat()
    } catch (err) {
      console.error(err)
      onSaved('Gagal menyimpan nilai.', true)
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
              {lv && (
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold sm:inline ${LEVEL_WARNA[lv.index]}`}>
                  {lv.label}
                </span>
              )}
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

  const [config, setConfig] = useState<ConfigAkademik | null>(null)
  const [tpList, setTpList] = useState<TujuanPembelajaran[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [terbuka, setTerbuka] = useState<string | null>(null)
  const { show, node } = useToast()

  useEffect(() => {
    if (!mapel || !kelas || !berhak) return
    let batal = false
    Promise.all([
      getConfigAkademik(),
      getTPList(mapel, tingkatan),
      getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
    ])
      .then(([c, t, s]) => {
        if (batal) return
        setConfig(c)
        setTpList(t)
        setSiswa(s)
      })
      .catch((e) => {
        console.error(e)
        show('Gagal memuat data kelas. Periksa koneksi dan hak akses.', true)
        setTpList([])
        setSiswa([])
      })
    return () => {
      batal = true
    }
  }, [mapel, kelas, tingkatan, berhak, profile.role, show])

  if (!isGuruAkademikRole(profile.role)) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <Notice tone="warn">Input nilai dilakukan oleh guru mata pelajaran sesuai penugasannya.</Notice>
      </div>
    )
  }

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <HeroBanner eyebrow="Akademik" title="Input Nilai SLM" subtitle="Pilih mata pelajaran dan kelas yang Anda ampu." />
        {pilihan.length === 0 ? (
          <Notice tone="warn">Akun Anda belum memiliki penugasan mata pelajaran. Hubungi admin.</Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => (
              <Link
                key={`${p.mapel}-${p.kelas}`}
                to={`/akademik/nilai-slm?mapel=${encodeURIComponent(p.mapel)}&kelas=${p.kelas}`}
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
        <BackLink to="/akademik/nilai-slm">Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.</Notice>
      </div>
    )
  }

  // Tampilkan TP semester aktif + yang belum dikelompokkan; TP semester lain disembunyikan.
  const tampil = (tpList ?? []).filter((t) => !t.semester || !config || t.semester === config.semesterAktif)
  const tersembunyi = (tpList?.length ?? 0) - tampil.length
  const belumKelompok = tampil.filter((t) => !t.semester).length

  return (
    <div className="space-y-5">
      <BackLink to="/akademik/nilai-slm">Pilih mata pelajaran</BackLink>
      <HeroBanner
        eyebrow={`Kelas ${kelas}`}
        title={`Nilai SLM — ${mapel}`}
        subtitle={config ? `Semester ${config.semesterAktif} · Tahun ajaran ${config.tahunAjaran}` : 'Memuat…'}
      />
      {tpList === null || siswa === null || config === null ? (
        <Spinner />
      ) : tpList.length === 0 ? (
        <Notice>
          Belum ada TP untuk {mapel} tingkat {tingkatan}. Susun dulu di{' '}
          <Link className="font-semibold underline" to={`/akademik/setup-tp?mapel=${encodeURIComponent(mapel)}&tingkatan=${tingkatan}`}>
            Setup TP &amp; KKTP
          </Link>
          .
        </Notice>
      ) : siswa.length === 0 ? (
        <Notice tone="warn">Tidak ada siswa aktif di kelas {kelas}.</Notice>
      ) : (
        <>
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
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-slate-900">{tp.namaTp}</span>
                  </button>
                  {buka && (
                    <div className="border-t border-border p-3.5">
                      <TpNilai tp={tp} siswa={siswa} ctx={{ mapel, kelas, tingkatan }} config={config} onSaved={show} />
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
      {node}
    </div>
  )
}
