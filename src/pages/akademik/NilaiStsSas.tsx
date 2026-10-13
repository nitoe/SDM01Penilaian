import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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
import { BackLink, Notice, NoticeAksesGuru, Spinner, btnGhost, btnPrimary, useToast } from './shared'

/** Input nilai besar — mudah disentuh & dibaca guru senior */
const inputNilaiCls =
  'h-12 w-[4.5rem] shrink-0 rounded-xl border-2 border-slate-200 bg-white text-center text-[17px] font-semibold tabular-nums text-slate-900 outline-none transition focus:border-muh-500 focus:ring-4 focus:ring-muh-500/20 disabled:bg-slate-50 disabled:text-slate-400 sm:h-14 sm:w-20 sm:text-[18px]'

function jenisDari(v: string | null): JenisAsesmen {
  return v === 'sas' ? 'sas' : 'sts'
}

function labelJenis(j: JenisAsesmen): string {
  return j === 'sts' ? 'Ujian Tengah (STS)' : 'Ujian Akhir (SAS)'
}

function labelPendek(j: JenisAsesmen): string {
  return j === 'sts' ? 'STS' : 'SAS'
}

function parseNilai(t: string | undefined): number | null {
  if (t === undefined || t.trim() === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function hitungTerisi(
  tpId: string,
  siswa: SiswaTahsin[],
  draf: Record<string, Record<string, string>>,
  existing: Record<string, Record<string, NilaiAsesmenDoc>>,
): { terisi: number; total: number } {
  let terisi = 0
  for (const s of siswa) {
    const teks = draf[tpId]?.[s.id]
    if (teks !== undefined && teks.trim() !== '') {
      terisi++
      continue
    }
    if (existing[tpId]?.[s.id]?.nilai != null) terisi++
  }
  return { terisi, total: siswa.length }
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
    // Jika belum pernah atur cakupan: default centang semua TP semester (lebih aman untuk guru senior)
    if (cakupan?.tpIds?.length) {
      setPilihTp(cakupan.tpIds)
    } else {
      setPilihTp(tampil.map((t) => t.id))
    }
    setNilai(angka)
    if (jenis === 'sas') {
      const [nilaiSlm, nilaiSts] = await Promise.all([
        getNilaiTPKelas({ mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran }),
        getNilaiAsesmenKelas({ jenis: 'sts', mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran }),
      ])
      setSlm(nilaiSlm)
      setSts(nilaiSts)
    } else {
      setSlm({})
      setSts({})
    }
    setSiap(true)
  }, [jenis, mapel, kelas, profile.role])

  useEffect(() => {
    if (!mapel || !kelas || !berhak || (!tulis && !admin)) return
    let batal = false
    muat().catch((e) => {
      console.error(e)
      if (!batal) show('Gagal memuat data. Periksa koneksi.', true)
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

  // ---- Hub: pilih jenis + mapel/kelas -----------------------------------------------------------
  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <HeroBanner
          eyebrow="Akademik"
          title="Nilai Ujian Tengah & Akhir"
          subtitle="Pilih jenis ujian, lalu mata pelajaran dan kelas. Tekan kartu untuk mulai mengisi."
        />

        {/* Pilihan jenis — tombol besar, teks lengkap */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { j: 'sts' as JenisAsesmen, judul: 'Ujian Tengah', sub: 'STS · Tengah semester' },
            { j: 'sas' as JenisAsesmen, judul: 'Ujian Akhir', sub: 'SAS · Akhir semester' },
          ]).map(({ j, judul, sub }) => (
            <button
              key={j}
              type="button"
              onClick={() => gantiJenis(j)}
              className={`rounded-2xl border-2 px-4 py-4 text-left transition ${
                jenis === j
                  ? 'border-muh-600 bg-muh-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-muh-300'
              }`}
            >
              <p className={`text-[15px] font-bold ${jenis === j ? 'text-muh-800' : 'text-slate-800'}`}>{judul}</p>
              <p className="mt-0.5 text-[12px] text-muted">{sub}</p>
            </button>
          ))}
        </div>

        <p className="text-[13px] font-medium text-slate-700">
          Pilih mapel & kelas untuk <span className="font-bold text-muh-700">{labelJenis(jenis)}</span>
        </p>

        {mapelMaster === null ? (
          <Spinner />
        ) : pilihan.length === 0 ? (
          <Notice tone="warn">Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi. Hubungi admin.</Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pilihan.map((p) => {
              const kunci = `${p.mapel}|${p.kelas}`
              const n = hubStatus?.[kunci]
              return (
                <Link
                  key={kunci}
                  to={`/akademik/nilai-sts?jenis=${jenis}&mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`}
                  className="card-soft block p-4 no-underline transition hover:border-muh-400 hover:shadow-md active:scale-[0.99]"
                >
                  <p className="text-[15px] font-semibold text-slate-900">{p.mapel}</p>
                  <p className="mt-1 text-[13px] text-muted">Kelas {p.kelas}</p>
                  <p className="mt-3">
                    {typeof n === 'number' ? (
                      n > 0 ? (
                        <Badge tone="green">Siap · {n} materi diujikan</Badge>
                      ) : (
                        <Badge tone="peach">Belum diatur materi ujian</Badge>
                      )
                    ) : tulis && hubStatus === null ? (
                      <span className="text-[12px] text-muted">Memuat…</span>
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

// ---- Halaman detail: cakupan + isi nilai --------------------------------------------------------

function Detail(props: {
  profile: AppUser
  jenis: JenisAsesmen
  mapel: string
  kelas: string
  tingkatan: string
  tulis: boolean
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
  const { jenis, mapel, kelas, tingkatan, tulis, config, tp, siswa, siap } = props
  const [busy, setBusy] = useState(false)
  const [draf, setDraf] = useState<Record<string, Record<string, string>>>({})
  const [tpAktif, setTpAktif] = useState<string | null>(null)
  const [modeCakupan, setModeCakupan] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  // Buka otomatis TP pertama yang ada di cakupan
  useEffect(() => {
    if (!siap || !tp || !props.cakupanId) return
    const terpilih = tp.filter((t) => props.pilihTp.includes(t.id))
    if (terpilih.length && !tpAktif) {
      setTpAktif(terpilih[0].id)
    }
  }, [siap, tp, props.cakupanId, props.pilihTp, tpAktif])

  const terpilih = (tp ?? []).filter((t) => props.pilihTp.includes(t.id))
  const tpSedang = terpilih.find((t) => t.id === tpAktif) ?? terpilih[0] ?? null

  async function simpanCakupan() {
    if (!config || !tulis) return
    if (props.pilihTp.length === 0) {
      props.show('Centang minimal 1 materi yang diujikan.', true)
      return
    }
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
      props.show('Materi ujian disimpan. Silakan isi nilai.')
      setModeCakupan(false)
      await props.muat()
    } catch (e) {
      console.error(e)
      props.show('Gagal menyimpan materi ujian.', true)
    } finally {
      setBusy(false)
    }
  }

  async function simpanNilai(tpId: string) {
    if (!config || !tulis || !siswa) return
    const baris = draf[tpId] ?? {}
    const existing = props.nilai[tpId] ?? {}
    const entries: { siswaId: string; nilai: number }[] = []
    for (const s of siswa) {
      const teks = baris[s.id]
      if (teks === undefined || teks.trim() === '') continue
      const n = parseNilai(teks)
      if (n === null || Number.isNaN(n) || n < 0 || n > 100) {
        props.show(`Nilai ${s.nama} harus angka 0–100.`, true)
        // fokus ke input bermasalah
        inputRefs.current[s.id]?.focus()
        return
      }
      const lama = existing[s.id]?.nilai
      if (lama === n) continue
      entries.push({ siswaId: s.id, nilai: n })
    }
    if (!entries.length) {
      props.show('Tidak ada perubahan nilai.')
      return
    }
    setBusy(true)
    try {
      const n = await saveNilaiAsesmenBatch(
        { jenis, tpId, mapel, kelas, tingkatan, semester: config.semesterAktif, tahunAjaran: config.tahunAjaran },
        entries,
        existing,
      )
      props.show(`${n} nilai berhasil disimpan.`)
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

  function centangSemua() {
    props.setPilihTp((tp ?? []).map((t) => t.id))
  }

  function kosongkanSemua() {
    props.setPilihTp([])
  }

  function onKeyDownSiswa(e: KeyboardEvent<HTMLInputElement>, _siswaId: string, index: number) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!siswa) return
    const next = siswa[index + 1]
    if (next) {
      inputRefs.current[next.id]?.focus()
      inputRefs.current[next.id]?.select()
    } else {
      // terakhir: simpan
      if (tpSedang) void simpanNilai(tpSedang.id)
    }
  }

  const progress = tpSedang && siswa ? hitungTerisi(tpSedang.id, siswa, draf, props.nilai) : null
  const berubah =
    tpSedang && siswa
      ? siswa.filter((s) => {
          const teks = draf[tpSedang.id]?.[s.id]
          if (teks === undefined || teks.trim() === '') return false
          const n = parseNilai(teks)
          if (n === null || Number.isNaN(n)) return false
          return props.nilai[tpSedang.id]?.[s.id]?.nilai !== n
        }).length
      : 0

  const perluCakupan = !props.cakupanId || modeCakupan

  return (
    <div className="space-y-4 pb-28">
      <BackLink to={`/akademik/nilai-sts?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>

      <HeroBanner
        eyebrow={config ? `Semester ${config.semesterAktif} · ${config.tahunAjaran}` : 'Akademik'}
        title={`${labelPendek(jenis)} — ${mapel} · Kelas ${kelas}`}
        subtitle={
          jenis === 'sts'
            ? 'Isi nilai ujian tengah. Nilai STS hanya dipakai jika lebih tinggi dari nilai harian (SLM).'
            : 'Isi nilai ujian akhir. Digabung dengan nilai harian sesuai bobot masing-masing materi.'
        }
      />

      {!siap || !tp || !siswa ? (
        <Spinner />
      ) : (
        <>
          {/* ---- Langkah 1: Pilih materi yang diujikan ------------------------------------------- */}
          {perluCakupan ? (
            <section className="card-soft space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">1. Pilih materi yang diujikan</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  Centang materi (TP) yang masuk soal {labelPendek(jenis)}. Yang tidak dicentang tidak perlu diisi nilainya.
                </p>
              </div>

              {tp.length === 0 ? (
                <Notice>
                  Belum ada materi untuk semester ini. Atur dulu di menu <strong>Bobot Semester</strong>.
                </Notice>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnGhost} onClick={centangSemua} disabled={!tulis}>
                      Centang semua
                    </button>
                    <button type="button" className={btnGhost} onClick={kosongkanSemua} disabled={!tulis}>
                      Kosongkan
                    </button>
                    <span className="self-center text-[13px] text-muted">
                      {props.pilihTp.length} dari {tp.length} dipilih
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {tp.map((t) => {
                      const checked = props.pilihTp.includes(t.id)
                      return (
                        <li key={t.id}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-3 transition ${
                              checked ? 'border-muh-400 bg-muh-50' : 'border-slate-200 bg-white hover:border-slate-300'
                            } ${!tulis ? 'cursor-default opacity-80' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-5 w-5 shrink-0 accent-muh-600"
                              checked={checked}
                              disabled={!tulis}
                              onChange={() => toggle(t.id)}
                            />
                            <span className="min-w-0">
                              <span className="block text-[14px] font-semibold text-slate-900">
                                Materi {t.nomorTp}
                              </span>
                              <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{t.namaTp}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              {tulis && tp.length > 0 && (
                <button
                  type="button"
                  className={`${btnPrimary} h-12 w-full text-[15px]`}
                  disabled={busy || props.pilihTp.length === 0}
                  onClick={() => void simpanCakupan()}
                >
                  {busy ? 'Menyimpan…' : props.cakupanId ? 'Simpan perubahan materi' : 'Simpan & lanjut isi nilai'}
                </button>
              )}
            </section>
          ) : (
            /* ---- Langkah 2: Isi nilai --------------------------------------------------------- */
            <>
              {/* Ringkasan cakupan + ubah */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3.5 py-3">
                <p className="text-[13px] text-slate-700">
                  <span className="font-semibold">{terpilih.length} materi</span> diujikan
                  {siswa.length > 0 ? ` · ${siswa.length} siswa` : ''}
                </p>
                {tulis && (
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-muh-700 underline"
                    onClick={() => setModeCakupan(true)}
                  >
                    Ubah materi ujian
                  </button>
                )}
              </div>

              {terpilih.length === 0 ? (
                <Notice tone="warn">Belum ada materi yang dipilih. Tekan “Ubah materi ujian”.</Notice>
              ) : (
                <>
                  {/* Pilih materi aktif — chip besar */}
                  <div className="space-y-2">
                    <p className="text-[13px] font-medium text-slate-600">Pilih materi untuk diisi:</p>
                    <div className="flex flex-wrap gap-2">
                      {terpilih.map((t) => {
                        const prog = hitungTerisi(t.id, siswa, draf, props.nilai)
                        const aktif = (tpAktif ?? terpilih[0]?.id) === t.id
                        const lengkap = prog.terisi === prog.total && prog.total > 0
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTpAktif(t.id)}
                            className={`rounded-xl border-2 px-3.5 py-2.5 text-left transition ${
                              aktif
                                ? 'border-muh-600 bg-muh-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-muh-300'
                            }`}
                          >
                            <span className={`block text-[14px] font-bold ${aktif ? 'text-muh-800' : 'text-slate-800'}`}>
                              Materi {t.nomorTp}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] text-muted">
                              {lengkap ? (
                                <span className="font-semibold text-muh-700">Lengkap {prog.terisi}/{prog.total}</span>
                              ) : (
                                `${prog.terisi}/${prog.total} terisi`
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Form isi nilai — satu materi fokus */}
                  {tpSedang && (
                    <section className="card-soft overflow-hidden">
                      <div className="border-b border-border bg-slate-50 px-4 py-3 sm:px-5">
                        <h2 className="text-[15px] font-bold text-slate-900">
                          Materi {tpSedang.nomorTp}. {tpSedang.namaTp}
                        </h2>
                        {progress && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[12.5px]">
                              <span className="text-muted">
                                Sudah diisi <strong className="text-slate-800">{progress.terisi}</strong> dari{' '}
                                <strong className="text-slate-800">{progress.total}</strong> siswa
                              </span>
                              {progress.total > 0 && (
                                <span
                                  className={`font-semibold ${
                                    progress.terisi === progress.total ? 'text-muh-700' : 'text-amber-700'
                                  }`}
                                >
                                  {Math.round((progress.terisi / progress.total) * 100)}%
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progress.terisi === progress.total ? 'bg-muh-600' : 'bg-amber-400'
                                }`}
                                style={{
                                  width: `${progress.total ? (progress.terisi / progress.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Header tabel sticky di mobile */}
                      <div className="sticky top-0 z-10 hidden border-b border-border bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[1fr_auto] sm:px-5">
                        <span>Nama siswa</span>
                        <span className="w-20 text-center sm:w-24">{labelPendek(jenis)}</span>
                      </div>

                      <ul className="divide-y divide-border">
                        {siswa.map((s, idx) => {
                          const teks = draf[tpSedang.id]?.[s.id] ?? ''
                          const n = parseNilai(teks)
                          const valid = n === null || (!Number.isNaN(n) && n >= 0 && n <= 100)
                          const sudahAda = props.nilai[tpSedang.id]?.[s.id]?.nilai != null
                          const slmN = jenis === 'sas' ? props.slm[tpSedang.id]?.[s.id]?.slm : undefined
                          const stsN = jenis === 'sas' ? props.sts[tpSedang.id]?.[s.id]?.nilai : undefined
                          const akhir =
                            jenis === 'sas'
                              ? hitungNilaiAkhirTP(slmN, teks === '' ? null : teks, tpSedang, stsN)
                              : null

                          return (
                            <li
                              key={s.id}
                              className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${
                                !valid ? 'bg-red-50' : sudahAda || (teks && teks.trim()) ? 'bg-muh-50/40' : ''
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-medium text-slate-900 sm:text-[15px]">
                                  {s.nama}
                                </p>
                                {jenis === 'sas' && (
                                  <p className="mt-0.5 text-[11.5px] text-muted">
                                    Harian {slmN ?? '—'}
                                    {stsN != null ? ` · STS ${stsN}` : ''}
                                    {akhir != null ? ` · Akhir ${akhir}` : ''}
                                  </p>
                                )}
                              </div>
                              <input
                                ref={(el) => {
                                  inputRefs.current[s.id] = el
                                }}
                                aria-label={`Nilai ${labelPendek(jenis)} ${s.nama}`}
                                className={`${inputNilaiCls} ${
                                  !valid ? 'border-red-400 ring-2 ring-red-200' : sudahAda || (teks && teks.trim()) ? 'border-muh-400' : ''
                                }`}
                                inputMode="decimal"
                                value={teks}
                                readOnly={!tulis}
                                placeholder="–"
                                onChange={(e) =>
                                  setDraf((prev) => ({
                                    ...prev,
                                    [tpSedang.id]: { ...prev[tpSedang.id], [s.id]: e.target.value },
                                  }))
                                }
                                onKeyDown={(e) => onKeyDownSiswa(e, s.id, idx)}
                                onFocus={(e) => e.target.select()}
                              />
                            </li>
                          )
                        })}
                      </ul>

                      <p className="border-t border-border px-4 py-2 text-[12px] text-muted sm:px-5">
                        Tip: tekan <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold">Enter</kbd> untuk pindah ke siswa berikutnya. Di baris terakhir, Enter = simpan.
                      </p>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Sticky save bar — selalu terlihat */}
      {tulis && !perluCakupan && tpSedang && siswa && siswa.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm md:bottom-0">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-800">
                Materi {tpSedang.nomorTp}
                {berubah > 0 ? (
                  <span className="text-amber-700"> · {berubah} perubahan</span>
                ) : (
                  <span className="text-muted"> · tidak ada perubahan</span>
                )}
              </p>
            </div>
            <button
              type="button"
              className={`${btnPrimary} h-12 min-w-[140px] shrink-0 text-[15px]`}
              disabled={busy || berubah === 0}
              onClick={() => void simpanNilai(tpSedang.id)}
            >
              {busy ? 'Menyimpan…' : berubah > 0 ? `Simpan (${berubah})` : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {props.node}
    </div>
  )
}
