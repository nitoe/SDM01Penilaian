import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type { Mapel, TipeTp, TujuanPembelajaran } from '../../types/akademik'
import {
  LEVEL_LABEL,
  LEVEL_RANGE_DEFAULT,
  deleteTP,
  faseDariTingkatan,
  tingkatanDariKelas,
  getMapelByNama,
  getMapelList,
  getTPList,
  importTPBatch,
  mapelBerlakuDiTingkatan,
  saveTP,
  validasiLevels,
  type ModeImporTp,
} from '../../lib/akademik'
import {
  buatExcelTp,
  bacaExcelTp,
  parseTpExcelRows,
  parseTpImport,
  ekuivalenMapel,
  unduhBlob,
  type TpImportHasil,
  type TpImportItem,
} from '../../lib/tpImport'
import { aksesMapelKelas } from '../../lib/aksesAkademik'
import { isAdminRole, isGuruAkademikRole } from '../../lib/roles'
import { PageHeader, Badge } from '../../components/ui'
import SeniBudayaPanel from '../../components/SeniBudayaPanel'
import { DISIPLIN_SENI } from '../../lib/seniKelas'
import { capaianUntuk, type CapaianResmi } from '../../lib/capaianPembelajaran'
import { bolehGenerateAi, generateKktpAi, generateTpAi, type ProviderAi } from '../../lib/generateAi'
import {
  BackLink,
  LEVEL_WARNA,
  Notice,
  NoticeAksesGuru,
  Spinner,
  btnGhost,
  btnPrimary,
  inputCls,
  useToast,
} from './shared'

interface FormState {
  id?: string
  nomorTp: string
  namaTp: string
  cp: string
  tipe: TipeTp
  bobotSlm: string
  bobotSas: string
  levels: { min: string; maks: string; deskripsi: string }[]
  /** Teks CP resmi — tidak boleh diedit. */
  cpTerkunci?: boolean
}

function formBaru(nomor: number): FormState {
  return {
    nomorTp: String(nomor),
    namaTp: '',
    cp: '',
    tipe: 'pengetahuan',
    bobotSlm: '60',
    bobotSas: '40',
    levels: LEVEL_RANGE_DEFAULT.map((l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: '' })),
  }
}

function formDariTp(tp: TujuanPembelajaran): FormState {
  return {
    id: tp.id,
    nomorTp: String(tp.nomorTp),
    namaTp: tp.namaTp,
    cp: tp.cp || '',
    tipe: tp.tipe,
    bobotSlm: String(tp.bobotSlm ?? 60),
    bobotSas: String(tp.bobotSas ?? 40),
    levels: (tp.levels?.length === 4 ? tp.levels : LEVEL_RANGE_DEFAULT.map((l) => ({ ...l, deskripsi: '' }))).map(
      (l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: l.deskripsi || '' }),
    ),
  }
}

export default function SetupTp({ profile }: { profile: AppUser }) {
  const [params] = useSearchParams()
  const mapel = params.get('mapel') || ''
  const kelas = (params.get('kelas') || '').toUpperCase()
  const tingkatan = kelas.replace(/[^0-9]/g, '')
  const tulis = isGuruAkademikRole(profile.role)
  const admin = isAdminRole(profile.role)
  const [mapelMaster, setMapelMaster] = useState<Mapel[] | null>(null)
  const pilihan = useMemo(
    () => (mapelMaster ? aksesMapelKelas(profile, mapelMaster) : []),
    [profile, mapelMaster],
  )
  const berhak = pilihan.some((p) => p.mapel === mapel && p.kelas === kelas)
  const isSeniBudaya = mapel === 'Seni Budaya'

  const [list, setList] = useState<TujuanPembelajaran[] | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [busy, setBusy] = useState(false)
  const [terbuka, setTerbuka] = useState<string | null>(null)
  const [jumlahTp, setJumlahTp] = useState<Record<string, number | 'gagal'> | null>(null)
  const [cakupan, setCakupan] = useState<{ kunci: string; status: 'boleh' | 'di luar' } | null>(null)
  const [filterMapel, setFilterMapel] = useState('')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'ada' | 'belum'>('semua')
  /** Tab tingkatan (1–6) di layar pilih mapel×kelas. */
  const [tabTingkat, setTabTingkat] = useState<string>('')
  const [panelImpor, setPanelImpor] = useState(false)
  const [pratinjauImpor, setPratinjauImpor] = useState<TpImportHasil | null>(null)
  const [modeImpor, setModeImpor] = useState<ModeImporTp>('tambah')
  const [busyImpor, setBusyImpor] = useState(false)
  const [refreshHub, setRefreshHub] = useState(0)
  /** Tab khusus Seni Budaya: 'setup' | nama disiplin | 'semua' */
  const [tabSeni, setTabSeni] = useState<string>('setup')
  const [antrianAi, setAntrianAi] = useState<{ namaTp: string; tipe: TipeTp; bobotSlm: number; bobotSas: number; cp: string; nomor: number }[]>([])
  const [busyAi, setBusyAi] = useState<'tp' | 'kktp' | null>(null)
  /** Hanya untuk akun AI: CP yang ditandai selesai / disembunyikan (key: elemen|disiplin). */
  const [cpSelesai, setCpSelesai] = useState<Set<string>>(() => new Set())
  const [tampilkanCpSelesai, setTampilkanCpSelesai] = useState(false)
  /** Panel daftar CP di kanan — bisa disembunyikan kapan saja. */
  const [panelCp, setPanelCp] = useState(true)
  const fileImporRef = useRef<HTMLInputElement>(null)
  const { show, node } = useToast()

  async function bacaFileImpor(file: File) {
    const nama = file.name.toLowerCase()
    const excel = nama.endsWith('.xlsx') || nama.endsWith('.xls') || file.type.includes('sheet') || file.type.includes('excel')
    try {
      let hasil: TpImportHasil
      if (excel) {
        const rows = await bacaExcelTp(await file.arrayBuffer())
        hasil = parseTpExcelRows(rows)
      } else {
        const teks = await file.text()
        const data = JSON.parse(teks) as unknown
        hasil = parseTpImport(data)
      }
      setPratinjauImpor(hasil)
      if (!hasil.items.length) show(hasil.peringatan[0] || 'Tidak ada TP di file.', true)
    } catch (e) {
      console.error(e)
      setPratinjauImpor(null)
      show(excel ? 'File Excel tidak bisa dibaca.' : 'File JSON tidak bisa dibaca.', true)
    }
  }

  async function unduhTemplateExcel(isi?: {
    items?: TpImportItem[]
    mapel?: string
    kelas?: string
    namaFile?: string
  }) {
    try {
      const blob = await buatExcelTp({
        items: isi?.items,
        mapel: isi?.mapel,
        kelas: isi?.kelas,
      })
      const nama =
        isi?.namaFile ||
        (isi?.mapel && isi?.kelas
          ? `template-tp-${isi.mapel.replace(/\s+/g, '-').toLowerCase()}-${isi.kelas.toLowerCase()}.xlsx`
          : 'template-tp.xlsx')
      unduhBlob(blob, nama)
      show(isi?.items?.length ? `Diekspor ${isi.items.length} TP ke Excel.` : 'Template Excel diunduh.')
    } catch (e) {
      console.error(e)
      show('Gagal membuat file Excel.', true)
    }
  }

  async function jalankanImpor(hanyaMapelTingkatan?: { mapel: string; kelas: string }) {
    if (!pratinjauImpor?.items.length) return
    let daftar = pratinjauImpor.items
    if (hanyaMapelTingkatan) {
      const kls = String(hanyaMapelTingkatan.kelas).toUpperCase()
      const mapelTarget = hanyaMapelTingkatan.mapel
      daftar = daftar
        .filter((it) => ekuivalenMapel(it.mapel, mapelTarget) && it.kelas.toUpperCase() === kls)
        .map((it) => ({ ...it, mapel: mapelTarget }))
      if (!daftar.length) {
        show(`Tidak ada TP ${mapelTarget} kelas ${kls} di file.`, true)
        return
      }
    }
    const sebelum = daftar.length
    daftar = daftar
      .map((it) => {
        const cocokPenugasan = pilihan.find(
          (p) => ekuivalenMapel(it.mapel, p.mapel) && p.kelas === it.kelas.toUpperCase(),
        )
        if (cocokPenugasan) return { ...it, mapel: cocokPenugasan.mapel }
        if (admin) return it
        return null
      })
      .filter((it): it is NonNullable<typeof it> => it != null)
    if (!daftar.length) {
      show('Tidak ada TP di file yang sesuai penugasan Anda.', true)
      return
    }
    if (daftar.length < sebelum) {
      show(`${sebelum - daftar.length} TP di luar penugasan dilewati.`)
    }
    if (
      modeImpor === 'ganti' &&
      !window.confirm(
        `Mode GANTI akan menghapus TP yang sudah ada untuk pasangan mapel×kelas di file, lalu menulis ulang.\n\nLanjutkan impor ${daftar.length} TP?`,
      )
    ) {
      return
    }
    setBusyImpor(true)
    try {
      const hasil = await importTPBatch(daftar, modeImpor)
      show(
        `Impor selesai: ${hasil.ditulis} ditulis` +
          (hasil.dilewati ? `, ${hasil.dilewati} dilewati (nomor/teks TP sama)` : '') +
          (hasil.dihapus ? `, ${hasil.dihapus} dihapus dulu` : '') +
          '.',
      )
      setPratinjauImpor(null)
      setPanelImpor(false)
      if (mapel && kelas) await muat()
      else setRefreshHub((n) => n + 1)
    } catch (e) {
      console.error(e)
      show('Gagal mengimpor TP. Periksa hak akses Firestore.', true)
    } finally {
      setBusyImpor(false)
    }
  }

  const kunciCakupan = `${mapel}|${kelas}`
  const statusCakupan: 'memeriksa' | 'boleh' | 'di luar' =
    !mapel || !kelas ? 'boleh' : cakupan?.kunci === kunciCakupan ? cakupan.status : 'memeriksa'

  const muat = useCallback(async () => {
    setList(null)
    try {
      setList(await getTPList(mapel, kelas))
    } catch (e) {
      console.error(e)
      show('Gagal memuat TP. Periksa koneksi dan hak akses.', true)
      setList([])
    }
  }, [mapel, kelas, show])

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
    if (mapel || kelas || (!tulis && !admin) || pilihan.length === 0) return
    let batal = false
    setJumlahTp(null)
    void Promise.all(
      pilihan.map(async (p) => {
        const kunci = `${p.mapel}|${p.kelas}`
        try {
          const daftar = await getTPList(p.mapel, p.kelas)
          return [kunci, daftar.length] as const
        } catch (e) {
          console.error(e)
          return [kunci, 'gagal'] as const
        }
      }),
    ).then((baris) => {
      if (!batal) setJumlahTp(Object.fromEntries(baris))
    })
    return () => {
      batal = true
    }
  }, [mapel, kelas, tulis, admin, pilihan, refreshHub])

  useEffect(() => {
    if (!mapel || !kelas || !berhak || (!tulis && !admin)) return
    const kunci = `${mapel}|${kelas}`
    let batal = false
    void getMapelByNama(mapel)
      .then((m) => {
        if (batal) return
        setCakupan({ kunci, status: mapelBerlakuDiTingkatan(m, tingkatan) ? 'boleh' : 'di luar' })
      })
      .catch((e) => {
        console.error(e)
        if (!batal) setCakupan({ kunci, status: 'boleh' })
      })
    return () => {
      batal = true
    }
  }, [mapel, kelas, tingkatan, berhak, tulis, admin])

  useEffect(() => {
    if (mapel && kelas && berhak && statusCakupan === 'boleh') void muat()
  }, [mapel, kelas, berhak, statusCakupan, muat])

  if (!tulis && !admin) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik">Akademik & Rapor</BackLink>
        <NoticeAksesGuru aksi="TP dan KKTP disusun" role={profile.role} />
      </div>
    )
  }

  // ---- Pemilih mapel × kelas --------------------------------------
  if (!mapel || !kelas) {
    const tingkatList = Array.from(
      new Set(pilihan.map((p) => tingkatanDariKelas(p.kelas)).filter(Boolean)),
    ).sort((a, b) => Number(a) - Number(b))
    const tingkatAktif = tabTingkat && tingkatList.includes(tabTingkat) ? tabTingkat : tingkatList[0] || ''
    const pilihanTingkat = pilihan.filter((p) => tingkatanDariKelas(p.kelas) === tingkatAktif)
    const paralelList = Array.from(new Set(pilihanTingkat.map((p) => p.kelas))).sort((a, b) =>
      a.localeCompare(b, 'id'),
    )
    const mapelDiTingkat = Array.from(new Set(pilihanTingkat.map((p) => p.mapel))).sort((a, b) =>
      a.localeCompare(b, 'id'),
    )

    function lolosFilter(p: { mapel: string; kelas: string }) {
      const q = filterMapel.trim().toLowerCase()
      if (q && !p.mapel.toLowerCase().includes(q)) return false
      if (filterStatus === 'semua' || jumlahTp === null) return true
      const n = jumlahTp[`${p.mapel}|${p.kelas}`]
      if (typeof n !== 'number') return true
      if (filterStatus === 'ada') return n > 0
      return n === 0
    }

    return (
      <div className="space-y-5">
        <PageHeader
          back={{ to: '/akademik', label: admin ? 'Pantauan Akademik' : 'Akademik & Rapor' }}
          title={admin ? 'Tujuan Pembelajaran' : 'Setup TP & KKTP'}
          subtitle="Pilih kelas lalu mata pelajaran. TP terikat mapel×kelas — kelas paralel (1A ≠ 1B) tetap terpisah."
          actions={
            tulis ? (
              <button type="button" className={btnGhost} onClick={() => setPanelImpor((v) => !v)}>
                {panelImpor ? 'Tutup impor' : 'Impor / Ekspor'}
              </button>
            ) : undefined
          }
        />
        {mapelMaster === null ? (
          <Spinner />
        ) : pilihan.length === 0 ? (
          <Notice tone="warn">
            Akun ini belum menjadi guru kelas dan belum memiliki mapel bidang studi. Hubungi admin.
          </Notice>
        ) : (
          <>
            {panelImpor && tulis && (
              <section className="card-soft space-y-3 p-4">
                <h2 className="text-[14px] font-semibold text-slate-900">Impor & ekspor Tujuan Pembelajaran</h2>
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Unduh template Excel, isi di spreadsheet, lalu unggah kembali. Format JSON kurikulum tetap
                  didukung.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={() => void unduhTemplateExcel()}>
                    Unduh template Excel
                  </button>
                </div>
                <input
                  ref={fileImporRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json,.json"
                  className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-muh-50 file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-muh-800"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void bacaFileImpor(f)
                    e.target.value = ''
                  }}
                />
                <div className="flex flex-wrap gap-3 text-[12.5px]">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="modeImporHub"
                      checked={modeImpor === 'tambah'}
                      onChange={() => setModeImpor('tambah')}
                    />
                    Tambah saja (lewati nomor yang sudah ada)
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="modeImporHub"
                      checked={modeImpor === 'ganti'}
                      onChange={() => setModeImpor('ganti')}
                    />
                    Ganti (hapus dulu TP mapel×kelas yang ada di file)
                  </label>
                </div>
                {pratinjauImpor && (
                  <div className="space-y-2 rounded-lg border border-border bg-slate-50/80 p-3 text-[12.5px]">
                    <p className="font-semibold text-slate-800">Pratinjau: {pratinjauImpor.items.length} TP</p>
                    <ul className="max-h-36 space-y-0.5 overflow-y-auto text-slate-600">
                      {Object.entries(pratinjauImpor.ringkasan)
                        .sort(([a], [b]) => a.localeCompare(b, 'id'))
                        .map(([k, n]) => (
                          <li key={k}>
                            {k.replace('|', ' · kelas ')} — {n} TP
                          </li>
                        ))}
                    </ul>
                    {pratinjauImpor.peringatan.length > 0 && (
                      <Notice tone="warn">
                        <ul className="list-inside list-disc">
                          {pratinjauImpor.peringatan.slice(0, 8).map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                          {pratinjauImpor.peringatan.length > 8 && (
                            <li>…dan {pratinjauImpor.peringatan.length - 8} peringatan lain</li>
                          )}
                        </ul>
                      </Notice>
                    )}
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyImpor || !pratinjauImpor.items.length}
                      onClick={() => void jalankanImpor()}
                    >
                      {busyImpor ? 'Mengimpor…' : `Impor ${pratinjauImpor.items.length} TP`}
                    </button>
                  </div>
                )}
              </section>
            )}

            <div className="flex flex-wrap gap-1 border-b border-border pb-0">
              {tingkatList.map((tg) => {
                const aktif = tg === tingkatAktif
                const count = pilihan.filter((p) => tingkatanDariKelas(p.kelas) === tg).length
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => setTabTingkat(tg)}
                    className={`-mb-px rounded-t-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                      aktif
                        ? 'border border-b-white border-border bg-white text-muh-800'
                        : 'border border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Kelas {tg}
                    <span className={`ml-1.5 text-[11px] font-medium ${aktif ? 'text-muh-600' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="space-y-4 rounded-b-lg rounded-tr-lg border border-border bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Cari mapel…"
                  value={filterMapel}
                  onChange={(e) => setFilterMapel(e.target.value)}
                  className="min-w-[10rem] flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15 sm:max-w-xs sm:flex-none"
                />
                <div className="flex flex-wrap gap-1">
                  {(['semua', 'ada', 'belum'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilterStatus(id)}
                      className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${
                        filterStatus === id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {id === 'semua' ? 'Semua' : id === 'ada' ? 'Sudah ada TP' : 'Belum ada TP'}
                    </button>
                  ))}
                </div>
              </div>

              {mapelDiTingkat.length === 0 ? (
                <p className="text-[13px] text-muted">Tidak ada mapel di kelas {tingkatAktif}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">Mapel</th>
                        {paralelList.map((k) => (
                          <th key={k} className="px-1 py-2 text-center">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mapelDiTingkat.map((m) => (
                        <tr key={m} className="border-b border-border/70 hover:bg-slate-50/80">
                          <td className="py-2 pr-3 font-medium text-slate-800">{m}</td>
                          {paralelList.map((k) => {
                            const p = { mapel: m, kelas: k }
                            if (!pilihanTingkat.some((x) => x.mapel === m && x.kelas === k)) {
                              return (
                                <td key={k} className="px-1 py-2 text-center text-slate-300">
                                  —
                                </td>
                              )
                            }
                            if (!lolosFilter(p)) {
                              return (
                                <td key={k} className="px-1 py-2 text-center text-slate-300">
                                  ·
                                </td>
                              )
                            }
                            const n = jumlahTp?.[`${m}|${k}`]
                            return (
                              <td key={k} className="px-1 py-2 text-center">
                                <Link
                                  to={`/akademik/setup-tp?mapel=${encodeURIComponent(m)}&kelas=${encodeURIComponent(k)}`}
                                  className="inline-flex min-w-[4.5rem] items-center justify-center rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] font-semibold no-underline transition hover:border-muh-400 hover:bg-muh-50 hover:text-muh-800"
                                >
                                  {typeof n === 'number' ? (n > 0 ? `${n} TP` : 'Setup') : n === 'gagal' ? '!' : '…'}
                                </Link>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        {node}
      </div>
    )
  }

  // ---- Detail mapel × kelas ----------------------------------------
  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mapel & kelas</BackLink>
        <Notice tone="warn">
          Anda tidak berhak mengelola TP untuk {mapel} kelas {kelas}.
        </Notice>
      </div>
    )
  }

  if (statusCakupan === 'memeriksa') {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mapel & kelas</BackLink>
        <Spinner />
      </div>
    )
  }

  if (statusCakupan === 'di luar') {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mapel & kelas</BackLink>
        <Notice tone="warn">
          Mapel {mapel} tidak berlaku di tingkatan kelas {tingkatan}.
        </Notice>
      </div>
    )
  }

  const akunAi = bolehGenerateAi(profile.uid)
  const faseCp = faseDariTingkatan(tingkatan)
  const disiplinAktif = isSeniBudaya && tabSeni !== 'setup' && tabSeni !== 'semua' ? tabSeni : undefined
  const daftarCp =
    isSeniBudaya && !disiplinAktif ? [] : capaianUntuk(mapel, faseCp, disiplinAktif)

  function kunciCp(cp: CapaianResmi) {
    return `${cp.elemen}|${cp.disiplinSeni || ''}`
  }

  const daftarCpTampil = akunAi
    ? daftarCp.filter((cp) => tampilkanCpSelesai || !cpSelesai.has(kunciCp(cp)))
    : daftarCp

  function tandaiCpSelesai(cp: CapaianResmi) {
    setCpSelesai((s) => new Set(s).add(kunciCp(cp)))
  }

  function bukaFormDariCp(cp: CapaianResmi) {
    const nomor = Math.max(0, ...(list ?? []).map((t) => t.nomorTp || 0)) + 1
    setAntrianAi([])
    setForm({ ...formBaru(nomor), cp: cp.teks, cpTerkunci: true })
  }

  async function jalankanGenerateTp(provider: ProviderAi, cp: CapaianResmi) {
    setBusyAi('tp')
    try {
      const hasil = await generateTpAi({
        provider,
        mapel,
        kelas,
        fase: faseCp,
        elemen: cp.elemen,
        teksCp: cp.teks,
        disiplinSeni: cp.disiplinSeni,
      })
      const awal = Math.max(0, ...(list ?? []).map((t) => t.nomorTp || 0)) + 1
      const [pertama, ...sisa] = hasil
      if (!pertama) throw new Error('AI tidak menghasilkan TP.')
      setAntrianAi(sisa.map((d, i) => ({ ...d, cp: cp.teks, nomor: awal + 1 + i })))
      setForm({
        nomorTp: String(awal),
        namaTp: pertama.namaTp,
        cp: cp.teks,
        tipe: pertama.tipe,
        bobotSlm: String(pertama.bobotSlm),
        bobotSas: String(pertama.bobotSas),
        levels: LEVEL_RANGE_DEFAULT.map((l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: '' })),
        cpTerkunci: true,
      })
      show(
        `${hasil.length} TP dari elemen “${cp.elemen}” masuk ke form. Isi KKTP (bisa dengan AI), lalu Simpan.` +
          (sisa.length ? ` ${sisa.length} TP lain menunggu setelah yang ini disimpan.` : ''),
      )
    } catch (e) {
      show(e instanceof Error ? e.message : 'Gagal generate TP.', true)
    } finally {
      setBusyAi(null)
    }
  }

  async function jalankanGenerateKktp(provider: ProviderAi) {
    if (!form?.namaTp.trim()) return show('Isi nama TP dulu.', true)
    setBusyAi('kktp')
    try {
      const deskripsi = await generateKktpAi({
        provider,
        mapel,
        kelas,
        namaTp: form.namaTp.trim(),
        tipe: form.tipe,
        teksCp: form.cp,
      })
      setForm((f) =>
        f
          ? {
              ...f,
              levels: f.levels.map((l, i) => ({
                ...l,
                deskripsi: deskripsi[i] || l.deskripsi,
              })),
            }
          : f,
      )
      show('Deskripsi KKTP diisi AI. Periksa lalu Simpan.')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Gagal generate KKTP.', true)
    } finally {
      setBusyAi(null)
    }
  }

  async function simpan() {
    if (!form) return
    const nomorTp = Number(form.nomorTp)
    if (!Number.isFinite(nomorTp) || nomorTp < 1) return show('Nomor TP tidak valid.', true)
    if (!form.namaTp.trim()) return show('Nama TP wajib diisi.', true)
    const bobotSlm = Number(form.bobotSlm)
    const bobotSas = Number(form.bobotSas)
    if (!Number.isFinite(bobotSlm) || !Number.isFinite(bobotSas) || bobotSlm + bobotSas !== 100) {
      return show('Bobot SLM + SAS harus 100.', true)
    }
    const levels = form.levels.map((l) => ({
      min: Number(l.min),
      maks: Number(l.maks),
      deskripsi: l.deskripsi.trim(),
    }))
    const galatLevels = validasiLevels(levels)
    if (galatLevels) return show(galatLevels, true)

    setBusy(true)
    try {
      const payload = {
        mapel,
        kelas,
        nomorTp,
        namaTp: form.namaTp.trim(),
        cp: form.cp.trim(),
        tipe: form.tipe,
        bobotSlm,
        bobotSas,
        levels,
      }
      if (form.id) {
        await saveTP({ ...payload, id: form.id })
        show('TP diperbarui.')
        setForm(null)
        setAntrianAi([])
      } else {
        await saveTP(payload)
        show('TP disimpan.')
        if (antrianAi.length) {
          const [berikut, ...sisa] = antrianAi
          setAntrianAi(sisa)
          setForm({
            nomorTp: String(berikut.nomor),
            namaTp: berikut.namaTp,
            cp: berikut.cp,
            tipe: berikut.tipe,
            bobotSlm: String(berikut.bobotSlm),
            bobotSas: String(berikut.bobotSas),
            levels: LEVEL_RANGE_DEFAULT.map((l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: '' })),
            cpTerkunci: true,
          })
          show(`TP disimpan. ${sisa.length + 1} TP antrian tersisa — isi KKTP lalu Simpan lagi.`)
        } else {
          setForm(null)
        }
      }
      await muat()
    } catch (e) {
      console.error(e)
      show('Gagal menyimpan TP.', true)
    } finally {
      setBusy(false)
    }
  }

  async function hapus(tp: TujuanPembelajaran) {
    if (!window.confirm(`Hapus TP ${tp.nomorTp}: ${tp.namaTp}?`)) return
    try {
      await deleteTP(tp.id)
      show('TP dihapus.')
      await muat()
    } catch (e) {
      console.error(e)
      show('Gagal menghapus TP.', true)
    }
  }

  const setLevel = (i: number, k: 'min' | 'maks' | 'deskripsi', v: string) =>
    setForm((f) => (f ? { ...f, levels: f.levels.map((l, j) => (j === i ? { ...l, [k]: v } : l)) } : f))

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik/setup-tp', label: 'Pilih mapel & kelas' }}
        title={`${mapel} · ${kelas}`}
        subtitle={`Fase ${faseCp} · Setup Tujuan Pembelajaran & KKTP`}
        actions={
          tulis ? (
            <button type="button" className={btnPrimary} onClick={() => setForm(formBaru((list?.length || 0) + 1))}>
              + TP baru
            </button>
          ) : undefined
        }
      />

      {isSeniBudaya && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setTabSeni('setup')}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
              tabSeni === 'setup' ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Setup
          </button>
          {DISIPLIN_SENI.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setTabSeni(d)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                tabSeni === d ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTabSeni('semua')}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
              tabSeni === 'semua' ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua
          </button>
        </div>
      )}

      {tulis && !panelCp && (
        <button type="button" className={btnGhost} onClick={() => setPanelCp(true)}>
          Tampilkan daftar CP{daftarCp.length ? ` (${daftarCp.length})` : ''}
        </button>
      )}

      <div className={`flex flex-col gap-4 ${tulis && panelCp ? 'lg:flex-row lg:items-start' : ''}`}>
      <div className="min-w-0 flex-1 space-y-5">

      {isSeniBudaya && tabSeni === 'setup' && <SeniBudayaPanel kelas={kelas} bolehTulis={tulis} />}

      {list === null ? (
        <Spinner />
      ) : (
        <section className="card-soft space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-slate-900">Daftar TP ({list.length})</h2>
            {tulis && (
              <button type="button" className={btnGhost} onClick={() => setPanelImpor((v) => !v)}>
                {panelImpor ? 'Tutup impor' : 'Impor / Ekspor'}
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <p className="text-[13px] text-muted">Belum ada TP. Gunakan CP di bawah atau + TP baru.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((tp) => (
                <li key={tp.id} className="py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setTerbuka(terbuka === tp.id ? null : tp.id)}
                    >
                      <span className="text-[13px] font-semibold text-slate-900">
                        TP {tp.nomorTp}. {tp.namaTp}
                      </span>
                      <span className="ml-2"><Badge tone="brand">{tp.tipe}</Badge></span>
                    </button>
                    {tulis && (
                      <div className="flex gap-1">
                        <button type="button" className={btnGhost} onClick={() => setForm(formDariTp(tp))}>
                          Edit
                        </button>
                        <button type="button" className={btnGhost} onClick={() => void hapus(tp)}>
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                  {terbuka === tp.id && (
                    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-700">
                      {tp.cp && <p className="whitespace-pre-wrap"><span className="font-medium">CP:</span> {tp.cp}</p>}
                      <p>
                        Bobot SLM {tp.bobotSlm ?? 60}% · SAS {tp.bobotSas ?? 40}%
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {(tp.levels || []).map((l, i) => (
                          <li key={i}>
                            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_WARNA[i]}`}>
                              {LEVEL_LABEL[tp.tipe]?.[i] || `L${i + 1}`}
                            </span>{' '}
                            {l.min}–{l.maks}: {l.deskripsi}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tulis && panelImpor && (
        <section className="card-soft space-y-3 p-4">
          <h2 className="text-[14px] font-semibold text-slate-900">Impor / ekspor untuk {mapel} {kelas}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() =>
                void unduhTemplateExcel({
                  mapel,
                  kelas,
                  items: (list || []).map((tp) => ({
                    mapel,
                    kelas,
                    nomorTp: tp.nomorTp,
                    namaTp: tp.namaTp,
                    cp: tp.cp || '',
                    tipe: tp.tipe,
                    bobotSlm: tp.bobotSlm ?? 60,
                    bobotSas: tp.bobotSas ?? 40,
                    levels: tp.levels || [],
                  })),
                  namaFile: `tp-${mapel.replace(/\s+/g, '-').toLowerCase()}-${kelas.toLowerCase()}.xlsx`,
                })
              }
            >
              Ekspor Excel
            </button>
            <button type="button" className={btnGhost} onClick={() => void unduhTemplateExcel({ mapel, kelas })}>
              Template kosong
            </button>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json,.json"
            className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-muh-50 file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-muh-800"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void bacaFileImpor(f)
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-3 text-[12.5px]">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="modeImporDetail" checked={modeImpor === 'tambah'} onChange={() => setModeImpor('tambah')} />
              Tambah saja
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="modeImporDetail" checked={modeImpor === 'ganti'} onChange={() => setModeImpor('ganti')} />
              Ganti
            </label>
          </div>
          {pratinjauImpor && (
            <div className="space-y-2 rounded-xl border border-border bg-slate-50/80 p-3 text-[12.5px]">
              <p className="font-semibold">{pratinjauImpor.items.length} TP di file</p>
              <button
                type="button"
                className={btnPrimary}
                disabled={busyImpor}
                onClick={() => void jalankanImpor({ mapel, kelas })}
              >
                {busyImpor ? 'Mengimpor…' : 'Impor ke mapel×kelas ini'}
              </button>
            </div>
          )}
        </section>
      )}

      {form && (
        <section className="card-soft space-y-4 p-4">
          <h2 className="text-[14px] font-semibold text-slate-900">{form.id ? 'Edit TP' : 'TP baru'}</h2>
          <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
            <label className="block text-[12px] font-medium text-slate-600">
              Nomor TP
              <input
                className={`${inputCls} mt-1`}
                inputMode="numeric"
                value={form.nomorTp}
                onChange={(e) => setForm((f) => (f ? { ...f, nomorTp: e.target.value } : f))}
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Nama TP
              <input
                className={`${inputCls} mt-1`}
                value={form.namaTp}
                onChange={(e) => setForm((f) => (f ? { ...f, namaTp: e.target.value } : f))}
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-slate-600">
            Capaian Pembelajaran
            <textarea
              className={`${inputCls} mt-1 min-h-[5rem]`}
              value={form.cp}
              readOnly={Boolean(form.cpTerkunci)}
              onChange={(e) => setForm((f) => (f ? { ...f, cp: e.target.value } : f))}
            />
            {form.cpTerkunci && (
              <span className="mt-1 block text-[11.5px] text-muted">Teks CP resmi terkunci (dari dokumen pemerintah).</span>
            )}
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="text-[12px] font-medium text-slate-600">
              Tipe
              <select
                className={`${inputCls} mt-1`}
                value={form.tipe}
                onChange={(e) => setForm((f) => (f ? { ...f, tipe: e.target.value as TipeTp } : f))}
              >
                <option value="pengetahuan">Pengetahuan</option>
                <option value="kinerja">Kinerja</option>
              </select>
            </label>
            <label className="text-[12px] font-medium text-slate-600">
              Bobot SLM %
              <input
                className={`${inputCls} mt-1 w-20`}
                inputMode="numeric"
                value={form.bobotSlm}
                onChange={(e) => setForm((f) => (f ? { ...f, bobotSlm: e.target.value } : f))}
              />
            </label>
            <label className="text-[12px] font-medium text-slate-600">
              Bobot SAS %
              <input
                className={`${inputCls} mt-1 w-20`}
                inputMode="numeric"
                value={form.bobotSas}
                onChange={(e) => setForm((f) => (f ? { ...f, bobotSas: e.target.value } : f))}
              />
            </label>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Dipakai kalau SAS TP ini diisi. Kalau SAS kosong, nilai akhir TP = SLM saja.
          </p>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-slate-800">KKTP (4 level)</h3>
              {akunAi && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={busyAi !== null}
                    onClick={() => void jalankanGenerateKktp('gemini')}
                  >
                    {busyAi === 'kktp' ? 'Menyusun…' : 'Generate KKTP · Gemini'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                    disabled={busyAi !== null}
                    onClick={() => void jalankanGenerateKktp('openai')}
                  >
                    Generate KKTP · OpenAI
                  </button>
                </div>
              )}
            </div>
            {form.levels.map((l, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LEVEL_WARNA[i]}`}>
                    {LEVEL_LABEL[form.tipe][i]}
                  </span>
                  <input
                    className={`${inputCls} w-16`}
                    inputMode="numeric"
                    value={l.min}
                    onChange={(e) => setLevel(i, 'min', e.target.value)}
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    className={`${inputCls} w-16`}
                    inputMode="numeric"
                    value={l.maks}
                    onChange={(e) => setLevel(i, 'maks', e.target.value)}
                  />
                </div>
                <textarea
                  className={`${inputCls} mt-2 min-h-[3.5rem]`}
                  placeholder="Deskripsi level…"
                  value={l.deskripsi}
                  onChange={(e) => setLevel(i, 'deskripsi', e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void simpan()}>
              {busy ? 'Menyimpan…' : antrianAi.length ? `Simpan TP (${antrianAi.length} menunggu)` : 'Simpan TP'}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => {
                setForm(null)
                setAntrianAi([])
              }}
            >
              Batal
            </button>
          </div>
        </section>
      )}

      </div>
      {tulis && panelCp && (
        <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[360px] lg:self-start">
        <section className="card-soft flex max-h-[calc(100vh-2rem)] flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900">
                CP resmi — Fase {faseCp}
              </h2>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">
                Pilih elemen di samping form. Teks CP resmi tidak boleh diubah.
                {isSeniBudaya && !disiplinAktif ? ' Buka tab disiplin dulu.' : ''}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-muh-700 hover:bg-muh-50"
              onClick={() => setPanelCp(false)}
            >
              Sembunyikan
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {daftarCp.length === 0 ? (
            <p className="text-[12.5px] text-muted">
              {isSeniBudaya && !disiplinAktif
                ? 'Belum ada elemen yang ditampilkan.'
                : `Tidak ada CP tersimpan untuk ${mapel} fase ${faseCp}.`}
            </p>
          ) : (
            <>
              {akunAi && daftarCp.some((cp) => cpSelesai.has(kunciCp(cp))) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <button type="button" className={btnGhost} onClick={() => setTampilkanCpSelesai((v) => !v)}>
                    {tampilkanCpSelesai
                      ? 'Sembunyikan CP selesai'
                      : `Tampilkan CP selesai (${[...cpSelesai].filter((k) => daftarCp.some((c) => kunciCp(c) === k)).length})`}
                  </button>
                </div>
              )}
              <ul className="space-y-3">
                {daftarCpTampil.map((cp) => {
                  const selesai = akunAi && cpSelesai.has(kunciCp(cp))
                  return (
                    <li
                      key={`${cp.elemen}-${cp.disiplinSeni || ''}`}
                      className={`rounded-lg border p-3 ${selesai ? 'border-slate-200 bg-slate-50/60 opacity-80' : 'border-border'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-900">
                          {cp.elemen}
                          {selesai ? ' · selesai' : ''}
                        </p>
                        {akunAi && (
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                            onClick={() => {
                              if (selesai) {
                                setCpSelesai((s) => {
                                  const n = new Set(s)
                                  n.delete(kunciCp(cp))
                                  return n
                                })
                              } else {
                                tandaiCpSelesai(cp)
                              }
                            }}
                          >
                            {selesai ? 'Tampilkan lagi' : 'Tandai selesai'}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">{cp.teks}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className={btnGhost} onClick={() => bukaFormDariCp(cp)}>
                          Pakai CP ini
                        </button>
                        {akunAi && (
                          <>
                            <button
                              type="button"
                              className={btnPrimary}
                              disabled={busyAi !== null}
                              onClick={() => void jalankanGenerateTp('gemini', cp)}
                            >
                              {busyAi === 'tp' ? 'Menyusun…' : 'Generate TP · Gemini'}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                              disabled={busyAi !== null}
                              onClick={() => void jalankanGenerateTp('openai', cp)}
                            >
                              Generate TP · OpenAI
                            </button>
                            {!selesai && (
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => tandaiCpSelesai(cp)}
                                title="Sembunyikan CP ini agar tidak membuat TP ganda"
                              >
                                CP selesai
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {akunAi && daftarCpTampil.length === 0 && (
                <p className="mt-2 text-[12.5px] text-muted">
                  Semua CP sudah ditandai selesai. Klik "Tampilkan CP selesai" untuk melihat lagi.
                </p>
              )}
            </>
          )}
          </div>
        </section>
        </aside>
      )}

      </div>

      {node}
    </div>
  )
}
