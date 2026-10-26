import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { ConfigAkademik, JenisAsesmen, NilaiAsesmenDoc, NilaiTpDoc, TujuanPembelajaran } from '../../types/akademik'
import type { Mapel } from '../../types/akademik'
import {
  getCakupanTP,
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
import {
  bacaDrafLokal,
  baselineDariNilaiAsesmen,
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
import {
  bacaExcelNilai,
  gabungIsiKeDraf,
  kolomDariTp,
  parseClipboardMatrix,
  parseNilaiExcelRows,
  terapkanPasteNilai,
  unduhExcelNilai,
} from '../../lib/nilaiImportExport'
import type { SiswaTahsin } from '../../types/tahsin'
import { PageHeader } from '../../components/ui'
import { MapelKelasPicker } from '../../components/MapelKelasPicker'
import { BackLink, Notice, NoticeAksesGuru, Spinner, btnGhost, btnPrimary, useToast } from './shared'

/** Kotak nilai di sel tabel — cukup besar untuk disentuh */
const cellInputCls =
  'h-11 w-[3.75rem] rounded-lg border-2 border-slate-200 bg-white text-center text-[16px] font-semibold tabular-nums text-slate-900 outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/25 disabled:bg-slate-50 disabled:text-slate-400 sm:h-12 sm:w-16 sm:text-[17px]'

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

/** Tampilkan angka nilai dengan 2 desimal (atau em dash). */
function fmtNilai(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return (Math.round(n * 100) / 100).toFixed(2)
}

/** Nilai efektif (draf mengalahkan server) untuk satu sel asesmen. */
function nilaiAsesmenEfektif(
  siswaId: string,
  tpId: string,
  nilai: Record<string, Record<string, { nilai?: number | null }>>,
  draf: Record<string, Record<string, string>>,
): number | null {
  const teks = draf[tpId]?.[siswaId]
  if (teks !== undefined && teks.trim() !== '') {
    const n = parseNilai(teks)
    if (n !== null && !Number.isNaN(n)) return n
  }
  const v = nilai[tpId]?.[siswaId]?.nilai
  return v == null ? null : v
}

/** Total = jumlah nilai materi terpilih; Rata = rata-rata sederhana materi yang terisi. */
function totalDanRataAsesmen(
  siswaId: string,
  daftar: TujuanPembelajaran[],
  nilai: Record<string, Record<string, { nilai?: number | null }>>,
  draf: Record<string, Record<string, string>>,
): { total: number | null; rata: number | null } {
  let sum = 0
  let n = 0
  for (const tp of daftar) {
    const v = nilaiAsesmenEfektif(siswaId, tp.id, nilai, draf)
    if (v == null) continue
    sum += v
    n++
  }
  if (n === 0) return { total: null, rata: null }
  return { total: Math.round(sum * 100) / 100, rata: Math.round((sum / n) * 100) / 100 }
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

  const periodeAk = usePeriodeAkademik()
  // WAJIB stabil (useMemo): `config` ada di dependensi efek sinkron draf pada <Detail>. Objek baru di tiap
  // render membuat efek itu mengembalikan draf ke data server setiap kali toast tampil/hilang, sehingga
  // hasil impor Excel / tempel hilang sebelum sempat disimpan (ANTIREGRESI §27).
  const config: ConfigAkademik | null = useMemo(
    () =>
      periodeAk.ready ? { semesterAktif: periodeAk.semester, tahunAjaran: periodeAk.tahunAjaran } : null,
    [periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran],
  )
  const [tp, setTp] = useState<TujuanPembelajaran[] | null>(null)
  const [siswa, setSiswa] = useState<SiswaTahsin[] | null>(null)
  const [cakupanId, setCakupanId] = useState<string | undefined>()
  const [pilihTp, setPilihTp] = useState<string[]>([])
  const [tpBobot, setTpBobot] = useState<Record<string, number>>({})
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
    if (!periodeAk.ready) return
    const c = { semesterAktif: periodeAk.semester, tahunAjaran: periodeAk.tahunAjaran }
    const [daftarTp, anak, cakupan, angka] = await Promise.all([
      getTPList(mapel, kelas),
      getSiswaList(kelas, { role: profile.role, kelasAmpu: [] }),
      getCakupanTP({ mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran, jenis }),
      getNilaiAsesmenKelas({ jenis, mapel, kelas, semester: c.semesterAktif, tahunAjaran: c.tahunAjaran }),
    ])
    const tampil = daftarTp.filter((t) => tpMasukSemester(t, c.semesterAktif))
        setTp(tampil)
    setSiswa(anak.sort((a, b) => a.nama.localeCompare(b.nama, 'id')))
    setCakupanId(cakupan?.id)
    // Default: semua TP semester dicentang jika belum pernah diatur
    if (cakupan?.tpIds?.length) {
      setPilihTp(cakupan.tpIds)
      const bobot: Record<string, number> = {}
      for (const id of cakupan.tpIds) {
        const n = cakupan.tpBobot?.[id]
        bobot[id] = n != null && Number.isFinite(n) && n > 0 ? Number(n) : 1
      }
      setTpBobot(bobot)
    } else {
      const ids = tampil.map((t) => t.id)
      setPilihTp(ids)
      setTpBobot(Object.fromEntries(ids.map((id) => [id, 1])))
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
  }, [jenis, mapel, kelas, profile.role, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran])

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
    if (!periodeAk.ready) return
    void (async () => {
      try {
        const baris = await Promise.all(
          pilihan.map(async (p) => {
            const kunci = `${p.mapel}|${p.kelas}`
            try {
              const cakupan = await getCakupanTP({
                mapel: p.mapel,
                kelas: p.kelas,
                semester: periodeAk.semester,
                tahunAjaran: periodeAk.tahunAjaran,
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
      } catch {
        if (!batal) setHubStatus({})
      }
    })()
    return () => {
      batal = true
    }
  }, [mapel, kelas, tulis, pilihan, jenis, periodeAk.ready, periodeAk.semester, periodeAk.tahunAjaran])

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

  if (!mapel || !kelas) {
    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          title={admin ? 'Daftar Nilai STS & SAS' : 'Nilai Ujian Tengah & Akhir'}
          subtitle="Pilih jenis ujian, lalu mapel × kelas."
        />
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {(
            [
              { j: 'sts' as JenisAsesmen, judul: 'STS', sub: 'Ujian tengah semester' },
              { j: 'sas' as JenisAsesmen, judul: 'SAS', sub: 'Ujian akhir semester' },
            ] as const
          ).map(({ j, judul, sub }) => (
            <button
              key={j}
              type="button"
              onClick={() => gantiJenis(j)}
              className={`rounded-lg border-2 px-3 py-3 text-left transition ${
                jenis === j ? 'border-muh-600 bg-muh-50' : 'border-border bg-white hover:border-muh-300'
              }`}
            >
              <p className={`text-[14px] font-bold ${jenis === j ? 'text-muh-800' : 'text-slate-800'}`}>{judul}</p>
              <p className="mt-0.5 text-[11px] text-muted">{sub}</p>
            </button>
          ))}
        </div>
        <p className="text-[13px] font-medium text-slate-700">
          Mapel & kelas — <span className="font-semibold text-muh-700">{labelJenis(jenis)}</span>
        </p>
        <MapelKelasPicker
          pilihan={pilihan}
          loading={mapelMaster === null}
          showStatusFilter
          isAda={(m, k) => {
            const n = hubStatus?.[`${m}|${k}`]
            if (n == null) return null
            const num = typeof n === 'number' ? n : Number(n)
            return Number.isFinite(num) ? num > 0 : null
          }}
          hrefFor={(m, k) =>
            `/akademik/nilai-sts?jenis=${jenis}&mapel=${encodeURIComponent(m)}&kelas=${encodeURIComponent(k)}`
          }
          renderCell={(m, k) => {
            const n = hubStatus?.[`${m}|${k}`]
            if (hubStatus === null && tulis) return <span className="text-muted">…</span>
            if (typeof n === 'number') {
              return n > 0 ? (
                <span className="text-muh-700">{n} TP</span>
              ) : (
                <span className="text-amber-700">Belum</span>
              )
            }
            return <span className="text-muh-700">Buka</span>
          }}
          footer={node}
        />
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to={`/akademik/nilai-sts?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>
        <Notice tone="error">
          Anda tidak mengampu {mapel} di kelas {kelas}.
        </Notice>
      </div>
    )
  }

  return (
    <Detail
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
      tpBobot={tpBobot}
      setTpBobot={setTpBobot}
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

// ---- Detail: satu tabel spreadsheet + panel kanan materi ---------------------------------------

function Detail(props: {
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
  tpBobot: Record<string, number>
  setTpBobot: (next: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void
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
  const [busyCakupan, setBusyCakupan] = useState(false)
  /** draf[tpId][siswaId] = teks input */
  const [draf, setDraf] = useState<Record<string, Record<string, string>>>({})
  /** Panel materi di kanan (desktop) / atas (mobile) — bisa disembunyikan */
  const [panelMateri, setPanelMateri] = useState(true)
  const [drafPulih, setDrafPulih] = useState(false)
  const [busyIo, setBusyIo] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const skipCacheWrite = useRef(false)
  const fileImporRef = useRef<HTMLInputElement>(null)

  const kunciCache = useMemo(() => {
    if (!config) return null
    return kunciDraf({
      jenis,
      mapel,
      kelas,
      semester: config.semesterAktif,
      tahunAjaran: config.tahunAjaran,
    })
  }, [config, jenis, mapel, kelas])

  useEffect(() => {
    if (!config) return
    const baseline = baselineDariNilaiAsesmen(props.nilai)
    if (!kunciCache) {
      setDraf(baseline)
      return
    }
    const lokal = bacaDrafLokal(kunciCache)
    if (lokal && drafLokalBerbedaDariServer(lokal.draf, props.nilai, 'asesmen')) {
      skipCacheWrite.current = true
      setDraf(gabungDrafDenganServer(baseline, lokal.draf))
      setDrafPulih(true)
      props.show('Draf lokal dipulihkan — nilai belum disimpan ke server. Silakan periksa lalu tekan Simpan.')
    } else {
      setDraf(baseline)
      setDrafPulih(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat nilai server / kunci berubah
  }, [props.nilai, kunciCache, config])

  const terpilih = useMemo(
    () => (tp ?? []).filter((t) => props.pilihTp.includes(t.id)),
    [tp, props.pilihTp],
  )

  /** Hitung berapa sel berubah dibanding data tersimpan */
  const perubahan = useMemo(() => {
    if (!siswa) return [] as { tpId: string; siswaId: string; nilai: number }[]
    const out: { tpId: string; siswaId: string; nilai: number }[] = []
    for (const t of terpilih) {
      for (const s of siswa) {
        const teks = draf[t.id]?.[s.id]
        if (teks === undefined || teks.trim() === '') continue
        const n = parseNilai(teks)
        if (n === null || Number.isNaN(n) || n < 0 || n > 100) continue
        const lama = props.nilai[t.id]?.[s.id]?.nilai
        if (lama === n) continue
        out.push({ tpId: t.id, siswaId: s.id, nilai: n })
      }
    }
    return out
  }, [draf, terpilih, siswa, props.nilai])

  /** Sel invalid (bukan kosong, tapi bukan 0–100) */
  const adaInvalid = useMemo(() => {
    if (!siswa) return false
    for (const t of terpilih) {
      for (const s of siswa) {
        const teks = draf[t.id]?.[s.id]
        if (teks === undefined || teks.trim() === '') continue
        const n = parseNilai(teks)
        if (n === null || Number.isNaN(n) || n < 0 || n > 100) return true
      }
    }
    return false
  }, [draf, terpilih, siswa])

  /** Progress: berapa sel terisi / total (siswa × materi terpilih) */
  const progress = useMemo(() => {
    if (!siswa || !terpilih.length) return { terisi: 0, total: 0 }
    let terisi = 0
    const total = siswa.length * terpilih.length
    for (const t of terpilih) {
      for (const s of siswa) {
        const teks = draf[t.id]?.[s.id]
        if (teks !== undefined && teks.trim() !== '') {
          terisi++
          continue
        }
        if (props.nilai[t.id]?.[s.id]?.nilai != null) terisi++
      }
    }
    return { terisi, total }
  }, [draf, terpilih, siswa, props.nilai])

  /** Ringkasan mapel: rata kelas dari rata-rata per siswa. */
  const ringkasanMapel = useMemo(() => {
    if (!siswa || !terpilih.length) {
      return { punya: 0, rataKelas: null as number | null, max: null as number | null, min: null as number | null }
    }
    const rates: number[] = []
    for (const s of siswa) {
      const { rata } = totalDanRataAsesmen(s.id, terpilih, props.nilai, draf)
      if (rata != null) rates.push(rata)
    }
    if (!rates.length) return { punya: 0, rataKelas: null, max: null, min: null }
    const sum = rates.reduce((a, b) => a + b, 0)
    return {
      punya: rates.length,
      rataKelas: Math.round((sum / rates.length) * 100) / 100,
      max: Math.max(...rates),
      min: Math.min(...rates),
    }
  }, [siswa, terpilih, props.nilai, draf])

  const dirty = perubahan.length > 0
  const { dialogNode } = useUnsavedGuard(dirty && tulis)

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

  async function simpanCakupan() {
    if (!config || !tulis) return
    if (props.pilihTp.length === 0) {
      props.show('Centang minimal 1 materi yang diujikan.', true)
      return
    }
    setBusyCakupan(true)
    try {
      const bobot: Record<string, number> = {}
      for (const id of props.pilihTp) {
        const n = Number(props.tpBobot[id])
        bobot[id] = Number.isFinite(n) && n > 0 ? n : 1
      }
      await saveCakupanTP(
        {
          mapel,
          kelas,
          tingkatan,
          semester: config.semesterAktif,
          tahunAjaran: config.tahunAjaran,
          jenis,
          tpIds: props.pilihTp,
          tpBobot: bobot,
        },
        props.cakupanId,
      )
      props.show('Materi ujian disimpan.')
      await props.muat()
    } catch (e) {
      console.error(e)
      props.show('Gagal menyimpan materi ujian.', true)
    } finally {
      setBusyCakupan(false)
    }
  }

  async function simpanSemuaNilai() {
    if (!config || !tulis || !siswa) return
    if (adaInvalid) {
      props.show('Ada nilai di luar 0–100. Perbaiki dulu.', true)
      return
    }
    if (!perubahan.length) {
      props.show('Tidak ada perubahan nilai.')
      return
    }
    setBusy(true)
    try {
      // Kelompokkan per TP lalu simpan batch
      const byTp = new Map<string, { siswaId: string; nilai: number }[]>()
      for (const p of perubahan) {
        const list = byTp.get(p.tpId) ?? []
        list.push({ siswaId: p.siswaId, nilai: p.nilai })
        byTp.set(p.tpId, list)
      }
      let total = 0
      for (const [tpId, entries] of byTp) {
        const n = await saveNilaiAsesmenBatch(
          {
            jenis,
            tpId,
            mapel,
            kelas,
            tingkatan,
            semester: config.semesterAktif,
            tahunAjaran: config.tahunAjaran,
          },
          entries,
          props.nilai[tpId] ?? {},
        )
        total += n
      }
      if (kunciCache) hapusDrafLokal(kunciCache)
      setDrafPulih(false)
      props.show(`${total} nilai berhasil disimpan.`)
      await props.muat()
    } catch (e) {
      console.error(e)
      props.show('Gagal menyimpan nilai. Periksa hak akses.', true)
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: string) {
    if (props.pilihTp.includes(id)) {
      props.setPilihTp(props.pilihTp.filter((x) => x !== id))
    } else {
      props.setPilihTp([...props.pilihTp, id])
      if (props.tpBobot[id] == null) {
        props.setTpBobot((prev) => ({ ...prev, [id]: 1 }))
      }
    }
  }

  function setBobotTp(id: string, value: string) {
    const n = Number(String(value).replace(',', '.'))
    props.setTpBobot((prev) => ({
      ...prev,
      [id]: Number.isFinite(n) && n > 0 ? n : 1,
    }))
  }

  function setNilaiCell(tpId: string, siswaId: string, value: string) {
    setDraf((prev) => ({
      ...prev,
      [tpId]: { ...prev[tpId], [siswaId]: value },
    }))
  }

  const kolomMeta = useMemo(() => kolomDariTp(terpilih, labelPendek(jenis)), [terpilih, jenis])

  function nilaiMapUntukEkspor(): Record<string, Record<string, number | null>> {
    const out: Record<string, Record<string, number | null>> = {}
    if (!siswa) return out
    for (const t of terpilih) {
      out[t.id] = {}
      for (const s of siswa) {
        out[t.id]![s.id] = nilaiAsesmenEfektif(s.id, t.id, props.nilai, draf)
      }
    }
    return out
  }

  async function unduhSheet(template: boolean) {
    if (!config || !siswa || !terpilih.length) return
    setBusyIo(true)
    try {
      await unduhExcelNilai({
        jenis,
        mapel,
        kelas,
        semester: config.semesterAktif,
        tahunAjaran: config.tahunAjaran,
        siswa,
        kolom: kolomMeta,
        nilai: template ? {} : nilaiMapUntukEkspor(),
        template,
      })
      props.show(template ? 'Template Excel diunduh.' : `Nilai ${labelPendek(jenis)} diekspor ke Excel.`)
    } catch (e) {
      console.error(e)
      props.show('Gagal membuat file Excel.', true)
    } finally {
      setBusyIo(false)
    }
  }

  async function imporDariFile(file: File) {
    if (!siswa || !terpilih.length || !tulis) return
    setBusyIo(true)
    try {
      const rows = await bacaExcelNilai(await file.arrayBuffer())
      const hasil = parseNilaiExcelRows(rows, siswa, kolomMeta)
      if (!hasil.terisi) {
        props.show(hasil.peringatan[0] || 'Tidak ada nilai valid di file.', true)
        return
      }
      setDraf((prev) => gabungIsiKeDraf(prev, hasil.isi))
      const ekstra =
        hasil.peringatan.length > 0 ? ` (${hasil.peringatan.slice(0, 2).join('; ')})` : ''
      props.show(`${hasil.terisi} nilai dimuat ke draf. Periksa lalu tekan Simpan.${ekstra}`)
    } catch (e) {
      console.error(e)
      props.show('File Excel tidak bisa dibaca.', true)
    } finally {
      setBusyIo(false)
      if (fileImporRef.current) fileImporRef.current.value = ''
    }
  }

  function onPasteCell(e: ClipboardEvent<HTMLInputElement>, siswaIdx: number, tpIdx: number) {
    if (!tulis || !siswa || !terpilih.length) return
    const text = e.clipboardData.getData('text/plain')
    if (!text || (!text.includes('\t') && !text.includes('\n') && !text.includes(';'))) return
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()
    const matrix = parseClipboardMatrix(text)
    if (!matrix.length) return
    const { patch, terisi, invalid } = terapkanPasteNilai(matrix, siswaIdx, tpIdx, siswa, kolomMeta)
    if (!terisi) {
      props.show(invalid ? 'Nilai tempel di luar 0–100.' : 'Tidak ada nilai yang bisa ditempel.', true)
      return
    }
    setDraf((prev) => {
      const next = { ...prev }
      for (const [tpId, byS] of Object.entries(patch)) {
        next[tpId] = { ...(next[tpId] || {}), ...byS }
      }
      return next
    })
    props.show(
      invalid
        ? `${terisi} nilai ditempel; ${invalid} diabaikan (di luar 0–100).`
        : `${terisi} nilai ditempel dari clipboard.`,
    )
  }

  /** Enter / ArrowRight → sel berikutnya di baris; ArrowDown → siswa berikutnya */
  function onKeyCell(e: KeyboardEvent<HTMLInputElement>, siswaIdx: number, tpIdx: number) {
    if (!siswa || !terpilih.length) return
    const key = e.key
    if (key !== 'Enter' && key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'ArrowDown' && key !== 'ArrowUp') {
      return
    }
    e.preventDefault()
    let sIdx = siswaIdx
    let tIdx = tpIdx
    if (key === 'Enter' || key === 'ArrowRight') {
      tIdx++
      if (tIdx >= terpilih.length) {
        tIdx = 0
        sIdx++
      }
    } else if (key === 'ArrowLeft') {
      tIdx--
      if (tIdx < 0) {
        tIdx = terpilih.length - 1
        sIdx--
      }
    } else if (key === 'ArrowDown') {
      sIdx++
    } else if (key === 'ArrowUp') {
      sIdx--
    }
    if (sIdx < 0 || sIdx >= siswa.length || tIdx < 0 || tIdx >= terpilih.length) return
    const refKey = `${terpilih[tIdx].id}__${siswa[sIdx].id}`
    const el = inputRefs.current[refKey]
    el?.focus()
    el?.select()
  }

  const tombolSimpan = (
    <button
      type="button"
      className={`${btnPrimary} h-12 w-full text-[15px] shadow-md`}
      disabled={!tulis || busy || perubahan.length === 0 || adaInvalid}
      onClick={() => void simpanSemuaNilai()}
    >
      {busy
        ? 'Menyimpan…'
        : perubahan.length > 0
          ? `Simpan ${perubahan.length} perubahan`
          : 'Tidak ada perubahan'}
    </button>
  )

  const panelMateriIsi = (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">Materi diujikan</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            Centang materi + atur bobot relatif untuk rata-rata leger {labelPendek(jenis)} (bukan bobot semester). Default setara (1).
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-muh-700 hover:bg-muh-50"
          onClick={() => setPanelMateri(false)}
          title="Sembunyikan panel"
        >
          Sembunyikan
        </button>
      </div>

      {!tp || tp.length === 0 ? (
        <Notice>Belum ada materi semester ini. Atur dulu di Bobot Semester.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`${btnGhost} py-1.5 text-[12px]`}
              disabled={!tulis}
              onClick={() => props.setPilihTp(tp.map((t) => t.id))}
            >
              Semua
            </button>
            <button
              type="button"
              className={`${btnGhost} py-1.5 text-[12px]`}
              disabled={!tulis}
              onClick={() => props.setPilihTp([])}
            >
              Kosongkan
            </button>
            <span className="self-center text-[12px] text-muted">
              {props.pilihTp.length}/{tp.length}
            </span>
          </div>

          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 'min(50vh, 420px)' }}>
            {tp.map((t) => {
              const checked = props.pilihTp.includes(t.id)
              return (
                <li key={t.id}>
                  <div
                    className={`rounded-xl border px-2.5 py-2 transition ${
                      checked ? 'border-muh-400 bg-muh-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${!tulis ? 'opacity-80' : ''}`}
                  >
                    <label className={`flex items-start gap-2.5 ${tulis ? 'cursor-pointer' : 'cursor-default'}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-muh-600"
                        checked={checked}
                        disabled={!tulis}
                        onChange={() => toggle(t.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-slate-900">Materi {t.nomorTp}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-600">{t.namaTp}</span>
                      </span>
                    </label>
                    {checked && (
                      <div className="mt-2 flex items-center gap-2 border-t border-muh-200/60 pt-2 pl-6">
                        <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                          <span className="shrink-0">Bobot</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="h-8 w-14 rounded-lg border border-border bg-white px-2 text-center text-[13px] font-semibold tabular-nums outline-none focus:border-muh-500"
                            value={props.tpBobot[t.id] ?? 1}
                            readOnly={!tulis}
                            aria-label={`Bobot materi ${t.nomorTp} untuk ${labelPendek(jenis)}`}
                            onChange={(e) => setBobotTp(t.id, e.target.value)}
                          />
                        </label>
                        <span className="text-[10.5px] text-muted">relatif (1 = setara)</span>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {tulis && (
            <button
              type="button"
              className={`${btnGhost} h-10 w-full text-[13px]`}
              disabled={busyCakupan || props.pilihTp.length === 0}
              onClick={() => void simpanCakupan()}
            >
              {busyCakupan ? 'Menyimpan materi…' : 'Simpan daftar materi'}
            </button>
          )}
        </>
      )}

      {/* Tombol simpan nilai — SELALU di panel kanan saat panel terbuka */}
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
        <p className="text-[11px] leading-snug text-muted">
          Tab / panah navigasi antar sel. Template · Ekspor · Impor Excel di bilah atas tabel. Bisa juga
          salin blok di Excel → klik sel → Ctrl+V.
        </p>
      </div>
    </div>
  )

  return (
    <div className={`space-y-4 ${panelMateri ? '' : 'pb-24'}`}>
      <BackLink to={`/akademik/nilai-sts?jenis=${jenis}`}>Pilih mata pelajaran</BackLink>

      <PageHeader
        eyebrow={config ? `Semester ${config.semesterAktif} · ${config.tahunAjaran}` : 'Akademik'}
        title={tulis ? `${labelPendek(jenis)} — ${mapel} · Kelas ${kelas}` : `Daftar Nilai ${labelPendek(jenis)} — ${mapel} · Kelas ${kelas}`}
        subtitle={
          !tulis
            ? 'Mode lihat. Nilai diinput oleh guru kelas dan guru bidang studi; administrator hanya membaca.'
            : jenis === 'sts'
            ? 'Satu tabel untuk semua materi. Centang materi di panel kanan, isi nilai, lalu simpan.'
            : 'Satu tabel untuk semua materi SAS. Panel kanan untuk memilih materi ujian.'
        }
      />

      {!siap || !tp || !siswa ? (
        <Spinner />
      ) : (
        <>
          {drafPulih && dirty && (
            <Notice tone="warn">
              Ada draf nilai dari sesi sebelumnya di perangkat ini yang belum disimpan ke server. Periksa tabel lalu tekan{' '}
              <strong>Simpan</strong>.
            </Notice>
          )}
          {/* Bilah alat: panel materi + ekspor/impor (selalu terlihat) */}
          <div className="flex flex-wrap items-center gap-2">
            {!panelMateri && (
              <button
                type="button"
                className={`${btnGhost} text-[13px]`}
                onClick={() => setPanelMateri(true)}
              >
                Tampilkan materi diujikan ({props.pilihTp.length})
              </button>
            )}
            <span className="text-[12.5px] text-muted">
              Terisi {progress.terisi}/{progress.total}
              {perubahan.length > 0 ? ` · ${perubahan.length} belum disimpan` : ''}
            </span>
            {tulis && terpilih.length > 0 && siswa && (
              <>
                <span className="hidden text-border sm:inline">|</span>
                <button
                  type="button"
                  className={`${btnGhost} text-[12.5px]`}
                  disabled={busyIo}
                  onClick={() => void unduhSheet(true)}
                  title="Unduh template kosong siap diisi di Excel"
                >
                  Template Excel
                </button>
                <button
                  type="button"
                  className={`${btnGhost} text-[12.5px]`}
                  disabled={busyIo}
                  onClick={() => void unduhSheet(false)}
                  title="Unduh nilai terkini ke Excel"
                >
                  Ekspor nilai
                </button>
                <button
                  type="button"
                  className={`${btnGhost} text-[12.5px]`}
                  disabled={busyIo}
                  onClick={() => fileImporRef.current?.click()}
                  title="Impor nilai dari file Excel"
                >
                  Impor Excel…
                </button>
                <input
                  ref={fileImporRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void imporDariFile(f)
                  }}
                />
              </>
            )}
          </div>

          {/* Layout: tabel + panel kanan (desktop) / panel atas (mobile) */}
          <div className={`flex flex-col gap-4 ${panelMateri ? 'lg:flex-row lg:items-start' : ''}`}>
            {/* Panel materi — di mobile di atas; di desktop di kanan */}
            {panelMateri && (
              <aside className="order-1 card-soft w-full shrink-0 p-4 lg:order-2 lg:sticky lg:top-4 lg:w-[320px] lg:self-start">
                {panelMateriIsi}
              </aside>
            )}

            {/* Tabel utama */}
            <div className="order-2 min-w-0 flex-1 lg:order-1">
              {terpilih.length === 0 ? (
                <Notice tone="warn">
                  Belum ada materi yang dicentang.
                  {panelMateri
                    ? ' Centang materi di panel kanan.'
                    : ' Tampilkan panel materi, lalu centang yang diujikan.'}
                </Notice>
              ) : (
                <>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="card-soft px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted">Rata-rata kelas</p>
                    <p className="mt-0.5 text-[20px] font-bold tabular-nums text-slate-900">
                      {fmtNilai(ringkasanMapel.rataKelas)}
                    </p>
                  </div>
                  <div className="card-soft px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted">Nilai tertinggi</p>
                    <p className="mt-0.5 text-[20px] font-bold tabular-nums text-muh-700">
                      {fmtNilai(ringkasanMapel.max)}
                    </p>
                  </div>
                  <div className="card-soft px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted">Nilai terendah</p>
                    <p className="mt-0.5 text-[20px] font-bold tabular-nums text-slate-700">
                      {fmtNilai(ringkasanMapel.min)}
                    </p>
                  </div>
                  <div className="card-soft px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted">Siswa punya rata-rata</p>
                    <p className="mt-0.5 text-[20px] font-bold tabular-nums text-slate-900">
                      {ringkasanMapel.punya}
                      <span className="text-[13px] font-medium text-muted">/{siswa?.length ?? 0}</span>
                    </p>
                  </div>
                </div>
                <div className="card-soft overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-slate-50">
                          <th className="sticky left-0 z-20 bg-slate-50 px-3 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted sm:px-4">
                            Siswa
                          </th>
                          {terpilih.map((t) => (
                            <th
                              key={t.id}
                              className="max-w-[7.5rem] px-2 py-2 text-center sm:px-3"
                              title={t.namaTp}
                            >
                              <span className="block text-[12px] font-bold text-slate-800">M.{t.nomorTp}</span>
                              <span className="mt-0.5 line-clamp-2 block text-[10.5px] font-normal leading-tight text-muted">
                                {t.namaTp}
                              </span>
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted sm:px-3">
                            Total
                          </th>
                          <th className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted sm:px-3">
                            Rata
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {siswa.map((s, sIdx) => {
                          const tr = totalDanRataAsesmen(s.id, terpilih, props.nilai, draf)
                          return (
                          <tr key={s.id} className="border-t border-border hover:bg-slate-50/80">
                            <td className="sticky left-0 z-10 bg-white px-3 py-2 text-[13.5px] font-medium text-slate-900 sm:px-4">
                              <span className="line-clamp-2 max-w-[10rem] sm:max-w-[14rem]">{s.nama}</span>
                            </td>
                            {terpilih.map((t, tIdx) => {
                              const teks = draf[t.id]?.[s.id] ?? ''
                              const n = parseNilai(teks)
                              const invalid = teks.trim() !== '' && (n === null || Number.isNaN(n) || n < 0 || n > 100)
                              const terisi = teks.trim() !== '' || props.nilai[t.id]?.[s.id]?.nilai != null
                              const refKey = `${t.id}__${s.id}`
                              // SAS: hint kecil SLM di title
                              const slmN = jenis === 'sas' ? props.slm[t.id]?.[s.id]?.slm : undefined
                              const stsN = jenis === 'sas' ? props.sts[t.id]?.[s.id]?.nilai : undefined
                              const hint =
                                jenis === 'sas'
                                  ? `Harian ${slmN ?? '—'} · STS ${stsN ?? '—'}${
                                      teks.trim() !== '' && !invalid
                                        ? ` · Akhir ${hitungNilaiAkhirTP(slmN, teks, t, stsN) ?? '—'}`
                                        : ''
                                    }`
                                  : undefined
                              return (
                                <td key={t.id} className="px-1.5 py-1.5 text-center sm:px-2">
                                  <input
                                    ref={(el) => {
                                      inputRefs.current[refKey] = el
                                    }}
                                    aria-label={`${labelPendek(jenis)} ${s.nama} materi ${t.nomorTp}`}
                                    title={hint}
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
                                    onPaste={(e) => onPasteCell(e, sIdx, tIdx)}
                                    onFocus={(e) => e.target.select()}
                                  />
                                </td>
                              )
                            })}
                            <td className="px-2 py-2 text-center text-[13px] font-semibold tabular-nums text-slate-600 sm:px-3">
                              {fmtNilai(tr.total)}
                            </td>
                            <td className="px-2 py-2 text-center text-[13px] font-semibold tabular-nums text-slate-700 sm:px-3">
                              {fmtNilai(tr.rata)}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-border px-3 py-2 text-[11.5px] text-muted sm:px-4">
                    {siswa.length} siswa · {terpilih.length} materi · Total = jumlah nilai · Rata = rata-rata materi
                    terisi · gulir horizontal jika kolom banyak
                  </p>
                </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Sticky save — hanya saat panel materi disembunyikan (agar tombol selalu ada) */}
      {tulis && !panelMateri && siap && terpilih.length > 0 && (
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

      {props.node}
      {dialogNode}
    </div>
  )
}
