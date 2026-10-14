import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
  saveNilaiTPBatch,
  tentukanLevel,
  tingkatanDariKelas,
  tpMasukSemester,
} from '../../lib/akademik'
import {
  bacaDrafLokal,
  baselineDariNilaiSlm,
  drafLokalBerbedaDariServer,
  gabungDrafDenganServer,
  hapusDrafLokal,
  kunciDraf,
  tulisDrafLokal,
} from '../../lib/nilaiDraftCache'
import { useUnsavedGuard } from '../../lib/useUnsavedGuard'
import { getSiswaList } from '../../lib/tahsinData'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import type { SiswaTahsin } from '../../types/tahsin'
import { Badge, PageHeader } from '../../components/ui'
import { BackLink, LEVEL_WARNA, Notice, NoticeAksesGuru, Spinner, btnGhost, btnPrimary, useToast } from './shared'

type NilaiKelas = Record<string, Record<string, NilaiTpDoc>>
type StatusKartu =
  | { jenis: 'tanpa-tp'; siswa: number }
  | { jenis: 'ada'; lengkap: number; total: number; siswa: number }
  | { jenis: 'gagal' }

const cellInputCls =
  'h-11 w-[3.75rem] rounded-lg border-2 border-slate-200 bg-white text-center text-[16px] font-semibold tabular-nums text-slate-900 outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/25 disabled:bg-slate-50 disabled:text-slate-400 sm:h-12 sm:w-16 sm:text-[17px]'

function parseNilai(t: string | undefined): number | null {
  if (t === undefined || t.trim() === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function rataSlm(
  siswaId: string,
  daftar: TujuanPembelajaran[],
  nilai: NilaiKelas,
  draf: Record<string, Record<string, string>>,
  semester: string,
): number | null {
  return hitungNilaiAkhirMapel(
    daftar.map((tp) => {
      const teks = draf[tp.id]?.[siswaId]
      let slm: number | null | undefined = nilai[tp.id]?.[siswaId]?.slm
      if (teks !== undefined && teks.trim() !== '') {
        const n = parseNilai(teks)
        if (n !== null && !Number.isNaN(n)) slm = n
      }
      const bobot = bobotTpDiSemester(tp, semester)
      return {
        nilai: slm == null ? null : hitungNilaiAkhirTP(slm, null, tp),
        bobot: bobot == null ? 0 : bobot,
      }
    }),
  )
}

export default function NilaiSlm({ profile }: { profile: AppUser }) {
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
  const guru = tulis || admin

  // Semester + tahun ajaran dari periode yang dipilih saat login (bukan config global)
  const periodeAk = usePeriodeAkademik()
  const config: ConfigAkademik | null = periodeAk.ready
    ? { semesterAktif: periodeAk.semester, tahunAjaran: periodeAk.tahunAjaran }
    : null

  const [tpList, setTpList] = useState<TujuanPembelajaran[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [nilai, setNilai] = useState<NilaiKelas | null>(null)
  const [status, setStatus] = useState<Record<string, StatusKartu> | null>(null)
  const [gagalMuat, setGagalMuat] = useState(false)
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

  const muatDetail = useCallback(async () => {
    if (!periodeAk.ready) return
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
    setTpList(t)
    setSiswa(s.sort((a, b) => a.nama.localeCompare(b.nama, 'id')))
    setNilai(n)
  }, [mapel, kelas, profile.role, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran])

  useEffect(() => {
    if (mapel || kelas || !tulis || pilihan.length === 0) return
    let batal = false
    setStatus(null)
    void (async () => {
      try {
        if (!periodeAk.ready) return
        const baris = await Promise.all(
          pilihan.map(async (p) => {
            const kunci = `${p.mapel}|${p.kelas}`
            try {
              const [daftar, anak] = await Promise.all([
                getTPList(p.mapel, p.kelas),
                getSiswaList(p.kelas, { role: profile.role, kelasAmpu: [] }),
              ])
              const tampil = daftar.filter((t) => tpMasukSemester(t, periodeAk.semester))
              if (!tampil.length) return [kunci, { jenis: 'tanpa-tp', siswa: anak.length } as StatusKartu] as const
              const n = await getNilaiTPKelas({
                mapel: p.mapel,
                kelas: p.kelas,
                semester: periodeAk.semester,
                tahunAjaran: periodeAk.tahunAjaran,
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
  }, [mapel, kelas, tulis, pilihan, profile.role, show, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran])

  useEffect(() => {
    if (!mapel || !kelas || !berhak || !guru) return
    let batal = false
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
    if (!periodeAk.ready) return
    setNilai(
      await getNilaiTPKelas({
        mapel,
        kelas,
        semester: periodeAk.semester,
        tahunAjaran: periodeAk.tahunAjaran,
      }),
    )
  }, [periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran, mapel, kelas])

  if (!tulis && !admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <NoticeAksesGuru aksi="Nilai SLM diisi" role={profile.role} />
      </div>
    )
  }

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <PageHeader
          back={{ to: '/akademik', label: 'Akademik & Rapor' }}
          eyebrow="Akademik"
          title="Input Nilai Harian (SLM)"
          subtitle={periodeAk.ready ? `Periode: ${periodeAk.label}. Status di kartu = kelengkapan nilai periode ini.` : "Pilih periode dulu (login ulang atau header). Status di kartu = kelengkapan nilai periode aktif."}
        />
        {mapelMaster === null ? (
          <Spinner />
        ) : pilihan.length === 0 ? (
          <Notice tone="warn">
            Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi. Hubungi admin.
          </Notice>
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
                    <p className="text-[15px] font-semibold text-slate-900">{p.mapel}</p>
                    <p className="mt-1 text-[13px] text-muted">
                      Kelas {p.kelas}
                      {st && st.jenis !== 'gagal' ? ` · ${st.siswa} siswa` : ''}
                      {tulis && status === null ? ' · Memuat…' : st?.jenis === 'gagal' ? ' · Gagal memuat' : ''}
                    </p>
                  </Link>
                  {st?.jenis === 'tanpa-tp' && (
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="peach">Belum ada materi</Badge>
                      <Link
                        className="text-[12px] font-semibold text-muh-700 underline"
                        to={`/akademik/setup-tp?mapel=${encodeURIComponent(p.mapel)}&kelas=${encodeURIComponent(p.kelas)}`}
                      >
                        Buat TP dulu
                      </Link>
                    </p>
                  )}
                  {st?.jenis === 'ada' && (
                    <p className="mt-2">
                      {st.lengkap === st.total ? (
                        <Badge tone="green">Lengkap semua materi ({st.total})</Badge>
                      ) : (
                        <Badge tone="peach">
                          Lengkap {st.lengkap}/{st.total} materi
                        </Badge>
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
        <Notice tone="error">
          Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.
        </Notice>
      </div>
    )
  }

  return (
    <Detail
      mapel={mapel}
      kelas={kelas}
      tingkatan={tingkatan}
      tulis={tulis}
      config={config}
      tpList={tpList}
      siswa={siswa}
      nilai={nilai}
      gagalMuat={gagalMuat}
      show={show}
      node={node}
      onSegarkan={segarkanNilai}
    />
  )
}

// ---- Detail: satu tabel spreadsheet + panel materi ---------------------------------------------

function Detail({
  mapel,
  kelas,
  tingkatan,
  tulis,
  config,
  tpList,
  siswa,
  nilai,
  gagalMuat,
  show,
  node,
  onSegarkan,
}: {
  mapel: string
  kelas: string
  tingkatan: string
  tulis: boolean
  config: ConfigAkademik | null
  tpList: TujuanPembelajaran[] | null
  siswa: SiswaTahsin[] | null
  nilai: NilaiKelas | null
  gagalMuat: boolean
  show: (msg: string, err?: boolean) => void
  node: React.ReactNode
  onSegarkan: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [draf, setDraf] = useState<Record<string, Record<string, string>>>({})
  const [tampilKolom, setTampilKolom] = useState<string[] | null>(null)
  const [panelMateri, setPanelMateri] = useState(true)
  const [drafPulih, setDrafPulih] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const skipCacheWrite = useRef(false)

  const kunciCache = useMemo(() => {
    if (!config) return null
    return kunciDraf({
      jenis: 'slm',
      mapel,
      kelas,
      semester: config.semesterAktif,
      tahunAjaran: config.tahunAjaran,
    })
  }, [config, mapel, kelas])

  const tampil = useMemo(
    () => (tpList ?? []).filter((t) => config && tpMasukSemester(t, config.semesterAktif)),
    [tpList, config],
  )
  const tersembunyi = (tpList?.length ?? 0) - tampil.length
  const belumKelompok = (tpList ?? []).filter((t) => {
    if (!config) return false
    const b1 = bobotTpDiSemester(t, '1')
    const b2 = bobotTpDiSemester(t, '2')
    if (!t.semester && (!t.bobotPerSemester || Object.keys(t.bobotPerSemester).length === 0)) return true
    return b1 == null && b2 == null
  }).length

  // Sinkron draf dari server + pulihkan cache lokal bila ada
  useEffect(() => {
    if (!nilai || !kunciCache) return
    const baseline = baselineDariNilaiSlm(nilai)
    const lokal = bacaDrafLokal(kunciCache)
    if (lokal && drafLokalBerbedaDariServer(lokal.draf, nilai, 'slm')) {
      skipCacheWrite.current = true
      setDraf(gabungDrafDenganServer(baseline, lokal.draf))
      setDrafPulih(true)
      show('Draf lokal dipulihkan — nilai belum disimpan ke server. Silakan periksa lalu tekan Simpan.')
    } else {
      setDraf(baseline)
      setDrafPulih(false)
    }
  }, [nilai, kunciCache, show])

  // Default: tampilkan semua kolom semester
  useEffect(() => {
    if (tampil.length && tampilKolom === null) {
      setTampilKolom(tampil.map((t) => t.id))
    }
  }, [tampil, tampilKolom])

  const kolom = useMemo(
    () => tampil.filter((t) => (tampilKolom ?? tampil.map((x) => x.id)).includes(t.id)),
    [tampil, tampilKolom],
  )

  const perubahan = useMemo(() => {
    if (!siswa || !nilai) return [] as { tpId: string; siswaId: string; slm: number }[]
    const out: { tpId: string; siswaId: string; slm: number }[] = []
    for (const t of kolom) {
      for (const s of siswa) {
        const teks = draf[t.id]?.[s.id]
        if (teks === undefined || teks.trim() === '') continue
        const n = parseNilai(teks)
        if (n === null || Number.isNaN(n) || n < 0 || n > 100) continue
        const lama = nilai[t.id]?.[s.id]?.slm
        if (lama === n) continue
        out.push({ tpId: t.id, siswaId: s.id, slm: n })
      }
    }
    return out
  }, [draf, kolom, siswa, nilai])

  const adaInvalid = useMemo(() => {
    if (!siswa) return false
    for (const t of kolom) {
      for (const s of siswa) {
        const teks = draf[t.id]?.[s.id]
        if (teks === undefined || teks.trim() === '') continue
        const n = parseNilai(teks)
        if (n === null || Number.isNaN(n) || n < 0 || n > 100) return true
      }
    }
    return false
  }, [draf, kolom, siswa])

  const progress = useMemo(() => {
    if (!siswa || !kolom.length || !nilai) return { terisi: 0, total: 0 }
    let terisi = 0
    const total = siswa.length * kolom.length
    for (const t of kolom) {
      for (const s of siswa) {
        const teks = draf[t.id]?.[s.id]
        if (teks !== undefined && teks.trim() !== '') {
          terisi++
          continue
        }
        if (nilai[t.id]?.[s.id]?.slm != null) terisi++
      }
    }
    return { terisi, total }
  }, [draf, kolom, siswa, nilai])

  const dirty = perubahan.length > 0
  const { dialogNode } = useUnsavedGuard(dirty && tulis)

  // Tulis cache lokal saat ada perubahan (debounce)
  useEffect(() => {
    if (!kunciCache || !tulis) return
    if (skipCacheWrite.current) {
      skipCacheWrite.current = false
      return
    }
    if (!dirty) return
    const t = window.setTimeout(() => tulisDrafLokal(kunciCache, draf), 400)
    return () => window.clearTimeout(t)
  }, [draf, dirty, kunciCache, tulis])

  async function simpanSemua() {
    if (!config || !tulis || !siswa || !nilai) return
    if (adaInvalid) {
      show('Ada nilai di luar 0–100. Perbaiki dulu.', true)
      return
    }
    if (!perubahan.length) {
      show('Tidak ada perubahan nilai.')
      return
    }
    setBusy(true)
    try {
      const byTp = new Map<string, { siswaId: string; slm: number }[]>()
      for (const p of perubahan) {
        const list = byTp.get(p.tpId) ?? []
        list.push({ siswaId: p.siswaId, slm: p.slm })
        byTp.set(p.tpId, list)
      }
      let total = 0
      for (const [tpId, entries] of byTp) {
        const n = await saveNilaiTPBatch(
          {
            tpId,
            mapel,
            kelas,
            tingkatan,
            semester: config.semesterAktif,
            tahunAjaran: config.tahunAjaran,
          },
          entries,
          nilai[tpId] ?? {},
        )
        total += n
      }
      if (kunciCache) hapusDrafLokal(kunciCache)
      setDrafPulih(false)
      show(`${total} nilai berhasil disimpan.`)
      await onSegarkan()
    } catch (e) {
      console.error(e)
      show('Gagal menyimpan nilai. Periksa hak akses.', true)
    } finally {
      setBusy(false)
    }
  }

  function setNilaiCell(tpId: string, siswaId: string, value: string) {
    setDraf((prev) => ({
      ...prev,
      [tpId]: { ...prev[tpId], [siswaId]: value },
    }))
  }

  function toggleKolom(id: string) {
    const cur = tampilKolom ?? tampil.map((t) => t.id)
    setTampilKolom(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
  }

  function onKeyCell(e: KeyboardEvent<HTMLInputElement>, siswaIdx: number, tpIdx: number) {
    if (!siswa || !kolom.length) return
    const key = e.key
    if (key !== 'Enter' && key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'ArrowDown' && key !== 'ArrowUp') {
      return
    }
    e.preventDefault()
    let sIdx = siswaIdx
    let tIdx = tpIdx
    if (key === 'Enter' || key === 'ArrowRight') {
      tIdx++
      if (tIdx >= kolom.length) {
        tIdx = 0
        sIdx++
      }
    } else if (key === 'ArrowLeft') {
      tIdx--
      if (tIdx < 0) {
        tIdx = kolom.length - 1
        sIdx--
      }
    } else if (key === 'ArrowDown') {
      sIdx++
    } else if (key === 'ArrowUp') {
      sIdx--
    }
    if (sIdx < 0 || sIdx >= siswa.length || tIdx < 0 || tIdx >= kolom.length) return
    const refKey = `${kolom[tIdx].id}__${siswa[sIdx].id}`
    const el = inputRefs.current[refKey]
    el?.focus()
    el?.select()
  }

  const tombolSimpan = (
    <button
      type="button"
      className={`${btnPrimary} h-12 w-full text-[15px] shadow-md`}
      disabled={!tulis || busy || perubahan.length === 0 || adaInvalid}
      onClick={() => void simpanSemua()}
    >
      {busy
        ? 'Menyimpan…'
        : perubahan.length > 0
          ? `Simpan ${perubahan.length} perubahan`
          : 'Tidak ada perubahan'}
    </button>
  )

  const laporan = `/akademik/laporan-slm?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`

  const panelIsi = (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">Materi di tabel</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            Centang materi yang ingin ditampilkan sebagai kolom. Semua materi semester tetap tersimpan.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-muh-700 hover:bg-muh-50"
          onClick={() => setPanelMateri(false)}
        >
          Sembunyikan
        </button>
      </div>

      {tampil.length === 0 ? (
        <Notice>Belum ada materi semester ini.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`${btnGhost} py-1.5 text-[12px]`}
              onClick={() => setTampilKolom(tampil.map((t) => t.id))}
            >
              Semua
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-[12px]`} onClick={() => setTampilKolom([])}>
              Kosongkan
            </button>
            <span className="self-center text-[12px] text-muted">
              {(tampilKolom ?? tampil.map((t) => t.id)).length}/{tampil.length}
            </span>
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 'min(50vh, 420px)' }}>
            {tampil.map((t) => {
              const checked = (tampilKolom ?? tampil.map((x) => x.id)).includes(t.id)
              const b = config ? bobotTpDiSemester(t, config.semesterAktif) : null
              return (
                <li key={t.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-2.5 py-2 transition ${
                      checked ? 'border-muh-400 bg-muh-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-muh-600"
                      checked={checked}
                      onChange={() => toggleKolom(t.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-slate-900">
                        Materi {t.nomorTp}
                        {b != null ? <span className="ml-1 font-normal text-muted">· {b}%</span> : null}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-600">{t.namaTp}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>
            Terisi {progress.terisi}/{progress.total}
          </span>
          {progress.total > 0 && (
            <span className={progress.terisi === progress.total ? 'font-semibold text-muh-700' : ''}>
              {Math.round((progress.terisi / progress.total) * 100)}%
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${progress.terisi === progress.total && progress.total > 0 ? 'bg-muh-600' : 'bg-amber-400'}`}
            style={{ width: `${progress.total ? (progress.terisi / progress.total) * 100 : 0}%` }}
          />
        </div>
        {tombolSimpan}
        <Link to={laporan} className={`${btnGhost} flex h-10 w-full items-center justify-center text-[13px] no-underline`}>
          Laporan SLM
        </Link>
      </div>
    </div>
  )

  return (
    <div className={`space-y-4 ${panelMateri ? '' : 'pb-24'}`}>
      <BackLink to="/akademik/nilai-slm">Pilih mata pelajaran</BackLink>
      <PageHeader
        eyebrow={config ? `Semester ${config.semesterAktif} · ${config.tahunAjaran}` : `Kelas ${kelas}`}
        title={`Nilai Harian (SLM) — ${mapel} · ${kelas}`}
        subtitle="Satu tabel untuk semua materi. Panel kanan mengatur kolom yang ditampilkan. Simpan kapan saja."
      />

      {gagalMuat ? (
        <Notice tone="error">Gagal memuat data kelas. Periksa koneksi, lalu muat ulang halaman.</Notice>
      ) : tpList === null || siswa === null || config === null || nilai === null ? (
        <Spinner />
      ) : tpList.length === 0 ? (
        <Notice>
          Belum ada TP untuk {mapel} tingkat {tingkatan}. Susun dulu di{' '}
          <Link
            className="font-semibold underline"
            to={`/akademik/setup-tp?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`}
          >
            Setup TP & KKTP
          </Link>
          .
        </Notice>
      ) : siswa.length === 0 ? (
        <Notice tone="warn">Tidak ada siswa aktif di kelas {kelas}.</Notice>
      ) : (
        <>
          {drafPulih && dirty && (
            <Notice tone="warn">
              Ada draf nilai dari sesi sebelumnya di perangkat ini yang belum disimpan ke server. Periksa tabel lalu tekan{' '}
              <strong>Simpan</strong>.
            </Notice>
          )}
          {belumKelompok > 0 && (
            <Notice tone="warn">
              {belumKelompok} materi belum dikelompokkan ke semester. Atur di{' '}
              <Link
                className="font-semibold underline"
                to={`/akademik/bobot-semester?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`}
              >
                Bobot Semester
              </Link>
              .
            </Notice>
          )}
          {tersembunyi > 0 && (
            <p className="text-[12px] text-muted">{tersembunyi} materi semester lain disembunyikan.</p>
          )}

          {!panelMateri && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={`${btnGhost} text-[13px]`} onClick={() => setPanelMateri(true)}>
                Tampilkan daftar materi ({kolom.length})
              </button>
              <span className="text-[12.5px] text-muted">
                Terisi {progress.terisi}/{progress.total}
                {perubahan.length > 0 ? ` · ${perubahan.length} belum disimpan` : ''}
              </span>
            </div>
          )}

          <div className={`flex flex-col gap-4 ${panelMateri ? 'lg:flex-row lg:items-start' : ''}`}>
            {panelMateri && (
              <aside className="order-1 card-soft w-full shrink-0 p-4 lg:order-2 lg:sticky lg:top-4 lg:w-[320px] lg:self-start">
                {panelIsi}
              </aside>
            )}

            <div className="order-2 min-w-0 flex-1 lg:order-1">
              {kolom.length === 0 ? (
                <Notice tone="warn">
                  Tidak ada kolom materi yang ditampilkan.
                  {panelMateri ? ' Centang materi di panel kanan.' : ' Tampilkan panel materi dulu.'}
                </Notice>
              ) : (
                <div className="card-soft overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-slate-50">
                          <th className="sticky left-0 z-20 bg-slate-50 px-3 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted sm:px-4">
                            Siswa
                          </th>
                          {kolom.map((t) => (
                            <th key={t.id} className="max-w-[7.5rem] px-2 py-2 text-center sm:px-3" title={t.namaTp}>
                              <span className="block text-[12px] font-bold text-slate-800">M.{t.nomorTp}</span>
                              <span className="mt-0.5 line-clamp-2 block text-[10.5px] font-normal leading-tight text-muted">
                                {t.namaTp}
                              </span>
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted sm:px-3">
                            Rata*
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {siswa.map((s, sIdx) => {
                          const rata = rataSlm(s.id, tampil, nilai, draf, config.semesterAktif)
                          return (
                            <tr key={s.id} className="border-t border-border hover:bg-slate-50/80">
                              <td className="sticky left-0 z-10 bg-white px-3 py-2 text-[13.5px] font-medium text-slate-900 sm:px-4">
                                <span className="line-clamp-2 max-w-[10rem] sm:max-w-[14rem]">{s.nama}</span>
                              </td>
                              {kolom.map((t, tIdx) => {
                                const teks = draf[t.id]?.[s.id] ?? ''
                                const n = parseNilai(teks)
                                const invalid =
                                  teks.trim() !== '' && (n === null || Number.isNaN(n) || n < 0 || n > 100)
                                const terisi = teks.trim() !== '' || nilai[t.id]?.[s.id]?.slm != null
                                const valid = n !== null && !Number.isNaN(n) && n >= 0 && n <= 100
                                const lv = valid ? tentukanLevel(hitungNilaiAkhirTP(n, null, t), t) : null
                                const refKey = `${t.id}__${s.id}`
                                return (
                                  <td key={t.id} className="px-1.5 py-1.5 text-center sm:px-2">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <input
                                        ref={(el) => {
                                          inputRefs.current[refKey] = el
                                        }}
                                        aria-label={`SLM ${s.nama} materi ${t.nomorTp}`}
                                        className={`${cellInputCls} ${
                                          invalid
                                            ? 'border-red-400 ring-2 ring-red-200'
                                            : terisi
                                              ? 'border-muh-400 bg-muh-50/50'
                                              : ''
                                        }`}
                                        inputMode="decimal"
                                        value={teks}
                                        readOnly={!tulis}
                                        placeholder="–"
                                        onChange={(e) => setNilaiCell(t.id, s.id, e.target.value)}
                                        onKeyDown={(e) => onKeyCell(e, sIdx, tIdx)}
                                        onFocus={(e) => e.target.select()}
                                      />
                                      {lv && (
                                        <span
                                          className={`rounded px-1 text-[9px] font-semibold ${LEVEL_WARNA[lv.index]}`}
                                        >
                                          {lv.label}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )
                              })}
                              <td className="px-2 py-2 text-center text-[13px] font-semibold tabular-nums text-slate-700 sm:px-3">
                                {rata ?? '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-border px-3 py-2 text-[11.5px] text-muted sm:px-4">
                    {siswa.length} siswa · {kolom.length} materi · *Rata = rata-rata tertimbang SLM (belum STS/SAS) ·
                    gulir horizontal jika kolom banyak
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tulis && !panelMateri && siswa && kolom.length > 0 && nilai && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm md:bottom-0">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <div className="min-w-0 flex-1 text-[13px] text-slate-700">
              {perubahan.length > 0 ? (
                <span className="font-semibold text-amber-700">{perubahan.length} perubahan belum disimpan</span>
              ) : (
                <span className="text-muted">Semua perubahan sudah disimpan</span>
              )}
              <span className="text-muted">
                {' '}
                · {progress.terisi}/{progress.total} terisi
              </span>
            </div>
            <div className="w-[180px] shrink-0 sm:w-[220px]">{tombolSimpan}</div>
          </div>
        </div>
      )}

      {node}
      {dialogNode}
    </div>
  )
}
