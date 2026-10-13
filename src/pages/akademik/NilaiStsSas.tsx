import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { ConfigAkademik, JenisAsesmen, NilaiAsesmenDoc, NilaiTpDoc, TujuanPembelajaran } from '../../types/akademik'
import type { Mapel } from '../../types/akademik'
import {
  getCakupanTP,
  getConfigAkademik,
  getMapelList,
  getNilaiAsesmenKelas,
  getNilaiTPKelas,
  getTPList,
  hitungNilaiAkhirTP,
  saveCakupanTP,
  saveNilaiAsesmenBatch,
  tingkatanDariKelas,
  tpMasukSemester,
} from '../../lib/akademik'
import { getSiswaList } from '../../lib/tahsinData'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import type { SiswaTahsin } from '../../types/tahsin'
import { Badge, HeroBanner } from '../../components/ui'
import { BackLink, Notice, NoticeAksesGuru, Spinner, btnPrimary, inputCls, useToast } from './shared'

function jenisDari(v: string | null): JenisAsesmen {
  return v === 'sas' ? 'sas' : 'sts'
}

export default function NilaiStsSas({ profile }: { profile: AppUser }) {
  const [params, setParams] = useSearchParams()
  const jenis = jenisDari(params.get('jenis'))
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

  const [config, setConfig] = useState<ConfigAkademik | null>(null)
  const [tp, setTp] = useState<TujuanPembelajaran[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [cakupanId, setCakupanId] = useState<string | undefined>()
  const [pilihTp, setPilihTp] = useState<string[]>([])
  const [nilai, setNilai] = useState<Record<string, Record<string, NilaiAsesmenDoc>>>({})
  const [slm, setSlm] = useState<Record<string, Record<string, NilaiTpDoc>>>({})
  const [sts, setSts] = useState<Record<string, Record<string, NilaiAsesmenDoc>>>({})
  const [siap, setSiap] = useState(false)
  const [hubStatus, setHubStatus] = useState<Record<string, number | 'gagal'> | null>(null)
  const { show, node } = useToast()

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

  const muat = useCallback(async () => {
    setSiap(false)
    const c = await getConfigAkademik()
    const [daftarTp, anak, cakupan, angka] = await Promise.all([
      getTPList(mapel, kelas),
      getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
      getCakupanTP({ mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran, jenis }),
      getNilaiAsesmenKelas({ jenis, mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran }),
    ])
    const tampil = daftarTp.filter((t) => tpMasukSemester(t, c.semesterAktif))
    setConfig(c)
    setTp(tampil)
    setSiswa(anak.sort((a, b) => a.nama.localeCompare(b.nama, 'id')))
    setCakupanId(cakupan?.id)
    setPilihTp(cakupan?.tpIds ?? [])
    setNilai(angka)
    if (jenis === 'sas') {
      const [nilaiSlm, nilaiSts] = await Promise.all([
        getNilaiTPKelas({ mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran }),
        getNilaiAsesmenKelas({ jenis: 'sts', mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran }),
      ])
      setSlm(nilaiSlm)
      setSts(nilaiSts)
    }
    setSiap(true)
  }, [jenis, mapel, kelas, tingkatan, profile.role])

  useEffect(() => {
    if (!mapel || !kelas || !berhak || (!tulis && !admin)) return
    let batal = false
    muat().catch((e) => {
      console.error(e)
      if (!batal) show('Gagal memuat STS/SAS.', true)
    })
    return () => {
      batal = true
    }
  }, [mapel, kelas, berhak, tulis, admin, muat, show])

  useEffect(() => {
    if (mapel || kelas || !tulis || pilihan.length === 0) return
    let batal = false
    setHubStatus(null)
    void getConfigAkademik()
      .then(async (c) => {
        const baris = await Promise.all(
          pilihan.map(async (p) => {
            const kunci = `${p.mapel}|${p.kelas}`
            try {
              const cakupan = await getCakupanTP({
                mapel: p.mapel,
                kelas: p.kelas,
                semester: c.semesterAktif,
                tahunAjaran: c.tahunAjaran,
                jenis,
              })
              return [kunci, cakupan?.tpIds.length ?? 0] as const
            } catch (e) {
              console.error(e)
              return [kunci, 'gagal'] as const
            }
          }),
        )
        if (!batal) setHubStatus(Object.fromEntries(baris))
      })
      .catch(() => {
        if (!batal) setHubStatus({})
      })
    return () => {
      batal = true
    }
  }, [mapel, kelas, tulis, pilihan, jenis])

  function gantiJenis(next: JenisAsesmen) {
    const q = new URLSearchParams(params)
    q.set('jenis', next)
    q.delete('mapel')
    q.delete('kelas')
    setParams(q)
  }

  if (!tulis && !admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <NoticeAksesGuru aksi="Nilai STS dan SAS diisi" role={profile.role} />
      </div>
    )
  }

  const judul = jenis === 'sts' ? 'Nilai STS' : 'Nilai SAS'

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <HeroBanner
          eyebrow="Akademik"
          title="Nilai STS & SAS"
          subtitle="Pilih jenis asesmen, lalu mata pelajaran dan kelas. Cakupan STS dan SAS sengaja terpisah."
        />
        <div className="flex gap-2">
          {(['sts', 'sas'] as JenisAsesmen[]).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => gantiJenis(j)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold uppercase ${
                jenis === j ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {j}
            </button>
          ))}
        </div>
        {mapelMaster === null ? (
          <Spinner />
        ) : pilihan.length === 0 ? (
          <Notice tone="warn">Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi.</Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => {
              const kunci = `${p.mapel}|${p.kelas}`
              const n = hubStatus?.[kunci]
              return (
                <Link
                  key={kunci}
                  to={`/akademik/nilai-sts?jenis=${jenis}&mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`}
                  className="card-soft block p-4 no-underline transition hover:border-muh-300"
                >
                  <p className="text-[14px] font-semibold text-slate-900">{p.mapel}</p>
                  <p className="mt-0.5 text-[12px] text-muted">Kelas {p.kelas}</p>
                  <p className="mt-2">
                    {typeof n === 'number' ? (
                      n > 0 ? <Badge tone="green">{n} TP di cakupan</Badge> : <Badge tone="peach">Cakupan belum diatur</Badge>
                    ) : tulis && hubStatus === null ? (
                      <span className="text-[11px] text-muted">Memuat…</span>
                    ) : null}
                  </p>
                </Link>
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
        <BackLink to={`/akademik/nilai-sts?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak mengampu {mapel} di kelas {kelas}.</Notice>
      </div>
    )
  }

  return (
    <Detail
      profile={profile}
      jenis={jenis}
      mapel={mapel}
      kelas={kelas}
      tingkatan={tingkatan}
      tulis={tulis}
      judul={judul}
      config={config}
      tp={tp}
      siswa={siswa}
      cakupanId={cakupanId}
      pilihTp={pilihTp}
      setPilihTp={setPilihTp}
      nilai={nilai}
      slm={slm}
      sts={sts}
      siap={siap}
      show={show}
      node={node}
      muat={muat}
    />
  )
}

function Detail(props: {
  profile: AppUser
  jenis: JenisAsesmen
  mapel: string
  kelas: string
  tingkatan: string
  tulis: boolean
  judul: string
  config: ConfigAkademik | null
  tp: TujuanPembelajaran[] | null
  siswa: SiswaTahsin[] | null
  cakupanId?: string
  pilihTp: string[]
  setPilihTp: (next: string[]) => void
  nilai: Record<string, Record<string, NilaiAsesmenDoc>>
  slm: Record<string, Record<string, NilaiTpDoc>>
  sts: Record<string, Record<string, NilaiAsesmenDoc>>
  siap: boolean
  show: (msg: string, err?: boolean) => void
  node: ReactNode
  muat: () => Promise<void>
}) {
  const { jenis, mapel, kelas, tingkatan, tulis, judul, config, tp, siswa, siap } = props
  const [busy, setBusy] = useState(false)
  const [draf, setDraf] = useState<Record<string, Record<string, string>>>({})

  useEffect(() => {
    const awal: Record<string, Record<string, string>> = {}
    for (const [tpId, perSiswa] of Object.entries(props.nilai)) {
      awal[tpId] = {}
      for (const [siswaId, doc] of Object.entries(perSiswa)) {
        awal[tpId][siswaId] = Number.isFinite(doc.nilai) ? String(doc.nilai) : ''
      }
    }
    setDraf(awal)
  }, [props.nilai])

  const terpilih = (tp ?? []).filter((t) => props.pilihTp.includes(t.id))

  async function simpanCakupan() {
    if (!config || !tulis) return
    setBusy(true)
    try {
      await saveCakupanTP(
        {
          mapel,
          kelas,
          tingkatan,
          semester: config.semesterAktif,
          tahunAjaran: config.tahunAjaran,
          jenis,
          tpIds: props.pilihTp,
        },
        props.cakupanId,
      )
      props.show('Cakupan TP disimpan.')
      await props.muat()
    } catch (e) {
      console.error(e)
      props.show('Gagal menyimpan cakupan.', true)
    } finally {
      setBusy(false)
    }
  }

  async function simpanNilai(tpId: string) {
    if (!config || !tulis) return
    const baris = draf[tpId] ?? {}
    const existing = props.nilai[tpId] ?? {}
    const entries: { siswaId: string; nilai: number }[] = []
    for (const [siswaId, teks] of Object.entries(baris)) {
      if (teks.trim() === '') continue
      const n = Number(teks)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        props.show('Nilai harus angka 0–100.', true)
        return
      }
      const lama = existing[siswaId]?.nilai
      if (lama === n) continue
      entries.push({ siswaId, nilai: n })
    }
    if (!entries.length) return
    setBusy(true)
    try {
      const n = await saveNilaiAsesmenBatch(
        { jenis, tpId, mapel, kelas, tingkatan, semester: config.semesterAktif, tahunAjaran: config.tahunAjaran },
        entries,
        existing,
      )
      props.show(`${n} nilai disimpan.`)
      await props.muat()
    } catch (e) {
      console.error(e)
      props.show('Gagal menyimpan nilai. Periksa hak akses.', true)
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string) {
    props.setPilihTp(props.pilihTp.includes(id) ? props.pilihTp.filter((x) => x !== id) : [...props.pilihTp, id])
  }

  return (
    <div className="space-y-5">
      <BackLink to={`/akademik/nilai-sts?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>
      <HeroBanner
        eyebrow={config ? `Semester ${config.semesterAktif} · ${config.tahunAjaran}` : 'Akademik'}
        title={`${judul} — ${mapel} ${kelas}`}
        subtitle={
          jenis === 'sts'
            ? 'STS hanya menaikkan SLM bila nilainya lebih tinggi. Admin tidak menyimpan.'
            : 'SAS digabung dengan SLM (atau STS bila lebih tinggi) sesuai bobot TP. Kosongkan bila tidak diujikan.'
        }
      />
      {!siap || !tp || !siswa ? (
        <Spinner />
      ) : (
        <>
          <section className="card-soft space-y-3 p-4">
            <h2 className="text-[14px] font-semibold text-slate-900">Cakupan {jenis.toUpperCase()}</h2>
            <p className="text-[12px] text-muted">
              Centang TP semester ini yang masuk ujian. Cakupan STS dan SAS tidak disamakan otomatis.
            </p>
            {tp.length === 0 ? (
              <Notice>Belum ada TP untuk semester ini. Atur dulu di Bobot Semester.</Notice>
            ) : (
              <ul className="space-y-1.5">
                {tp.map((t) => (
                  <li key={t.id}>
                    <label className="flex items-start gap-2 text-[13px] text-slate-800">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={props.pilihTp.includes(t.id)}
                        disabled={!tulis}
                        onChange={() => toggle(t.id)}
                      />
                      <span>
                        <span className="font-semibold">{t.nomorTp}.</span> {t.namaTp}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {tulis && (
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => void simpanCakupan()}>
                {busy ? 'Menyimpan…' : 'Simpan cakupan'}
              </button>
            )}
          </section>

          {!props.cakupanId ? (
            <Notice tone="warn">Simpan cakupan TP terlebih dahulu sebelum mengisi nilai.</Notice>
          ) : terpilih.length === 0 ? (
            <Notice>Tidak ada TP pada cakupan ini.</Notice>
          ) : (
            terpilih.map((t) => (
              <section key={t.id} className="card-soft space-y-3 p-4">
                <h2 className="text-[14px] font-semibold text-slate-900">
                  TP {t.nomorTp}. {t.namaTp}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-muted">
                        <th className="py-1 pr-2 font-medium">Siswa</th>
                        {jenis === 'sas' && <th className="py-1 pr-2 font-medium">SLM</th>}
                        {jenis === 'sas' && <th className="py-1 pr-2 font-medium">STS</th>}
                        <th className="py-1 pr-2 font-medium">{jenis.toUpperCase()}</th>
                        {jenis === 'sas' && <th className="py-1 font-medium">Akhir</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {siswa.map((s) => {
                        const teks = draf[t.id]?.[s.id] ?? ''
                        const slmN = props.slm[t.id]?.[s.id]?.slm
                        const stsN = props.sts[t.id]?.[s.id]?.nilai
                        const akhir =
                          jenis === 'sas'
                            ? hitungNilaiAkhirTP(slmN, teks === '' ? null : teks, t, stsN)
                            : null
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="py-1.5 pr-2">{s.nama}</td>
                            {jenis === 'sas' && <td className="py-1.5 pr-2 text-muted">{slmN ?? '—'}</td>}
                            {jenis === 'sas' && <td className="py-1.5 pr-2 text-muted">{stsN ?? '—'}</td>}
                            <td className="py-1.5 pr-2">
                              <input
                                aria-label={`${jenis} ${s.nama}`}
                                className={`${inputCls} w-16 text-center`}
                                inputMode="decimal"
                                value={teks}
                                readOnly={!tulis}
                                onChange={(e) =>
                                  setDraf((prev) => ({
                                    ...prev,
                                    [t.id]: { ...prev[t.id], [s.id]: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            {jenis === 'sas' && <td className="py-1.5 font-semibold">{akhir ?? '—'}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {tulis && (
                  <button type="button" className={btnPrimary} disabled={busy} onClick={() => void simpanNilai(t.id)}>
                    Simpan TP {t.nomorTp}
                  </button>
                )}
              </section>
            ))
          )}
        </>
      )}
      {props.node}
    </div>
  )
}
