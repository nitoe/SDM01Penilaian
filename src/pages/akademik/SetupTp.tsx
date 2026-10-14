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
  normalisasiAlokasiTp,
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
        // Samakan nama mapel dengan yang dipakai di sistem (Firestore/penugasan)
        .map((it) => ({ ...it, mapel: mapelTarget }))
      if (!daftar.length) {
        show(`Tidak ada TP ${mapelTarget} kelas ${kls} di file.`, true)
        return
      }
    }
    // Batasi ke mapel×kelas yang user berhak tulis (dengan alias mapel)
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
        // Gagal memuat data mapel (jaringan) tidak boleh mengunci guru yang memang berhak.
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
        <BackLink to="/akademik">Akademik &amp; Rapor</BackLink>
        <NoticeAksesGuru aksi="TP dan KKTP disusun" role={profile.role} />
      </div>
    )
  }

  // ---- Pemilih mapel × kelas --------------------------------------
  if (!mapel || !kelas) {
    // Kelompokkan pilihan per tingkatan (1–6) untuk tab
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
          back={{ to: '/akademik', label: 'Akademik & Rapor' }}
          title="Setup TP & KKTP"
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
                <h2 className="text-[14px] font-semibold text-slate-900">Impor &amp; ekspor Tujuan Pembelajaran</h2>
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

            {/* Tab tingkatan */}
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
                  value={filterMapel}
                  onChange={(e) => setFilterMapel(e.target.value)}
                  placeholder="Cari mapel…"
                  className="min-w-[10rem] flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15 sm:max-w-xs sm:flex-none"
                />
                <div className="inline-flex flex-wrap items-center gap-1">
                  {(
                    [
                      ['semua', 'Semua'],
                      ['ada', 'Sudah ada TP'],
                      ['belum', 'Belum ada TP'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilterStatus(id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                        filterStatus === id ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="ml-auto text-[12px] text-muted">
                  Fase {faseDariTingkatan(tingkatAktif)} · {paralelList.join(', ')}
                </p>
              </div>

              {/* Matriks mapel × paralel — lebih rapi untuk admin */}
              {mapelDiTingkat.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted">Tidak ada penugasan di kelas {tingkatAktif}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2 font-semibold">Mata pelajaran</th>
                        {paralelList.map((kl) => (
                          <th key={kl} className="px-2 py-2 text-center font-semibold">
                            {kl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mapelDiTingkat
                        .filter((m) => {
                          const q = filterMapel.trim().toLowerCase()
                          if (q && !m.toLowerCase().includes(q)) return false
                          if (filterStatus === 'semua' || jumlahTp === null) return true
                          return paralelList.some((kl) => {
                            const p = { mapel: m, kelas: kl }
                            return pilihanTingkat.some((x) => x.mapel === m && x.kelas === kl) && lolosFilter(p)
                          })
                        })
                        .map((m) => (
                          <tr key={m} className="border-b border-border/70 hover:bg-slate-50/80">
                            <td className="px-2 py-2.5 font-medium text-slate-900">{m}</td>
                            {paralelList.map((kl) => {
                              const ada = pilihanTingkat.some((x) => x.mapel === m && x.kelas === kl)
                              if (!ada) {
                                return (
                                  <td key={kl} className="px-2 py-2.5 text-center text-slate-300">
                                    —
                                  </td>
                                )
                              }
                              const kunci = `${m}|${kl}`
                              const n = jumlahTp?.[kunci]
                              const lolos = lolosFilter({ mapel: m, kelas: kl })
                              if (!lolos) {
                                return (
                                  <td key={kl} className="px-2 py-2.5 text-center text-slate-300">
                                    ·
                                  </td>
                                )
                              }
                              return (
                                <td key={kl} className="px-2 py-2.5 text-center">
                                  <Link
                                    to={`/akademik/setup-tp?mapel=${encodeURIComponent(m)}&kelas=${encodeURIComponent(kl)}`}
                                    className="inline-flex min-w-[4.5rem] items-center justify-center rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] font-semibold no-underline transition hover:border-muh-400 hover:bg-muh-50 hover:text-muh-800"
                                  >
                                    {jumlahTp === null ? (
                                      <span className="text-muted">…</span>
                                    ) : n === 'gagal' ? (
                                      <span className="text-red-600">!</span>
                                    ) : typeof n === 'number' && n > 0 ? (
                                      <span className="text-muh-700">{n} TP</span>
                                    ) : (
                                      <span className="text-amber-700">Belum</span>
                                    )}
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
      </div>
    )
  }

  if (!berhak) {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mata pelajaran</BackLink>
        <Notice tone="error">Anda tidak memiliki penugasan untuk {mapel} kelas {kelas}.</Notice>
      </div>
    )
  }

  if (statusCakupan === 'di luar') {
    return (
      <div className="space-y-4">
        <BackLink to="/akademik/setup-tp">Pilih mata pelajaran</BackLink>
        <Notice tone="warn">
          {mapel} tidak diajarkan di kelas {kelas}. Cek kembali data mapel di Administrasi → Mata
          Pelajaran kalau ini seharusnya diajarkan.
        </Notice>
      </div>
    )
  }

  const listTampil = (() => {
    if (!list) return null
    if (!isSeniBudaya || tabSeni === 'setup' || tabSeni === 'semua') return list
    return list.filter((tp) => (tp.disiplinSeni || '') === tabSeni)
  })()

    async function simpan() {
    if (!form) return
    const namaTp = form.namaTp.trim()
    const nomor = parseInt(form.nomorTp, 10)
    if (!namaTp) return show('Nama TP wajib diisi.', true)
    if (!Number.isInteger(nomor) || nomor < 1) return show('Nomor TP harus bilangan bulat ≥ 1.', true)
    if ((list ?? []).some((t) => t.nomorTp === nomor && t.id !== form.id)) {
      return show(`Nomor TP ${nomor} sudah dipakai TP lain.`, true)
    }
    const bSlm = Number(form.bobotSlm)
    const bSas = Number(form.bobotSas)
    if (![bSlm, bSas].every((v) => Number.isFinite(v) && v >= 0) || bSlm + bSas !== 100) {
      return show('Bobot SLM + SAS harus berjumlah tepat 100.', true)
    }
    const levels = form.levels.map((l) => ({
      min: Number(l.min),
      maks: Number(l.maks),
      deskripsi: l.deskripsi.trim(),
    }))
    const galat = validasiLevels(levels)
    if (galat) return show(galat, true)
    if (levels.some((l) => !l.deskripsi)) return show('Deskripsi keempat level KKTP wajib diisi.', true)

    setBusy(true)
    try {
      await saveTP({
        id: form.id,
        mapel,
        kelas,
        nomorTp: nomor,
        namaTp,
        cp: form.cp.trim(),
        tipe: form.tipe,
        bobotSlm: bSlm,
        bobotSas: bSas,
        levels,
        disiplinSeni:
          isSeniBudaya && tabSeni !== 'setup' && tabSeni !== 'semua' ? tabSeni : undefined,
      })
      show(form.id ? 'TP diperbarui.' : 'TP ditambahkan.')
      setForm(null)
      await muat()
    } catch (e) {
      console.error(e)
      show('Gagal menyimpan TP.', true)
    } finally {
      setBusy(false)
    }
  }

  async function hapus(tp: TujuanPembelajaran) {
    if (
      !window.confirm(
        `Hapus TP ${tp.nomorTp} "${tp.namaTp}"?\n\nNilai siswa yang sudah diinput untuk TP ini tidak ikut terhapus tetapi menjadi yatim dan tidak lagi tampil. Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return
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
          back={{ to: '/akademik/setup-tp', label: 'Pilih mata pelajaran' }}
        eyebrow={`Kelas ${kelas} · Fase ${faseDariTingkatan(tingkatan)}`}
        title={`TP & KKTP — ${mapel}`}
        subtitle={
          isSeniBudaya
            ? 'Seni Budaya punya tab khusus: atur disiplin aktif per semester, lalu susun TP per cabang seni (rupa, musik, tari, teater).'
            : tulis
              ? 'TP & KKTP dipakai bersama di kelas ini untuk mapel ini — guru kelas dan guru bidang studi yang mengampu melihat data yang sama. Semester & bobot diatur di menu Bobot Semester.'
              : 'Mode lihat. Administrator dapat membaca TP yang disusun guru, tetapi tidak mengubahnya.'
        }
      />

      {isSeniBudaya && (
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => { setTabSeni('setup'); setForm(null) }}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              tabSeni === 'setup' ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Setup Seni Budaya
          </button>
          {DISIPLIN_SENI.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setTabSeni(d); setForm(null) }}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                tabSeni === d ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              TP {d.replace('Seni ', '')}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setTabSeni('semua'); setForm(null) }}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              tabSeni === 'semua' ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua TP
          </button>
        </div>
      )}

      {isSeniBudaya && tabSeni === 'setup' ? (
        <section className="card-soft p-4">
          <SeniBudayaPanel kelas={kelas} bolehTulis={tulis} />
        </section>
      ) : statusCakupan !== 'boleh' ? (
        <Spinner />
      ) : (
        <>
      {!form && tulis && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setForm(formBaru(Math.max(0, ...(list ?? []).map((t) => t.nomorTp || 0)) + 1))}
          >
            + Tambah TP
          </button>
          <button type="button" className={btnGhost} onClick={() => setPanelImpor((v) => !v)}>
            {panelImpor ? 'Tutup panel' : 'Impor / Ekspor'}
          </button>
          <Link
            to={`/akademik/bobot-semester?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`}
            className={`${btnGhost} no-underline`}
          >
            Atur semester &amp; bobot
          </Link>
        </div>
      )}

      {panelImpor && tulis && !form && (
        <section className="card-soft space-y-3 p-4">
          <h2 className="text-[14px] font-semibold text-slate-900">
            Impor / ekspor — {mapel} kelas {kelas}
          </h2>
          <p className="text-[12.5px] leading-relaxed text-muted">
            Unduh template (kosong atau terisi TP saat ini), edit di Excel, lalu unggah. Saat impor, hanya
            baris mapel &amp; tingkatan ini yang ditulis. Mode ganti hanya menghapus TP pasangan ini.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() =>
                void unduhTemplateExcel({
                  mapel,
                  kelas,
                  namaFile: `template-tp-${mapel.replace(/\s+/g, '-').toLowerCase()}-${kelas.toLowerCase()}.xlsx`,
                })
              }
            >
              Template kosong
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={!list?.length}
              onClick={() => {
                const items: TpImportItem[] = (list ?? []).map((tp) => ({
                  mapel: tp.mapel,
                  kelas: tp.kelas || kelas,
                  tingkatan: tp.tingkatan,
                  nomorTp: tp.nomorTp,
                  namaTp: tp.namaTp,
                  cp: tp.cp,
                  tipe: tp.tipe,
                  bobotSlm: tp.bobotSlm ?? 60,
                  bobotSas: tp.bobotSas ?? 40,
                  levels: tp.levels?.length === 4 ? tp.levels : [
                    { min: 0, maks: 60, deskripsi: '' },
                    { min: 61, maks: 75, deskripsi: '' },
                    { min: 76, maks: 85, deskripsi: '' },
                    { min: 86, maks: 100, deskripsi: '' },
                  ],
                }))
                void unduhTemplateExcel({
                  items,
                  mapel,
                  kelas,
                  namaFile: `tp-${mapel.replace(/\s+/g, '-').toLowerCase()}-${kelas.toLowerCase()}.xlsx`,
                })
              }}
            >
              Ekspor TP saat ini ({list?.length ?? 0})
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
              <input
                type="radio"
                name="modeImporDetail"
                checked={modeImpor === 'tambah'}
                onChange={() => setModeImpor('tambah')}
              />
              Tambah saja
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="modeImporDetail"
                checked={modeImpor === 'ganti'}
                onChange={() => setModeImpor('ganti')}
              />
              Ganti (hapus dulu TP mapel ini)
            </label>
          </div>
          {pratinjauImpor && (
            <div className="space-y-2 rounded-xl border border-border bg-slate-50/80 p-3 text-[12.5px]">
              {(() => {
                const cocok = pratinjauImpor.items.filter(
                  (it) => ekuivalenMapel(it.mapel, mapel) && it.kelas.toUpperCase() === kelas,
                )
                return (
                  <>
                    <p className="font-semibold text-slate-800">
                      Cocok untuk {mapel} kelas {kelas}: {cocok.length} dari{' '}
                      {pratinjauImpor.items.length} TP di file
                    </p>
                    {cocok.length > 0 && (
                      <ul className="max-h-28 space-y-0.5 overflow-y-auto text-slate-600">
                        {cocok.slice(0, 12).map((it) => (
                          <li key={`${it.nomorTp}-${it.namaTp.slice(0, 24)}`}>
                            TP {it.nomorTp}: {it.namaTp.slice(0, 80)}
                            {it.namaTp.length > 80 ? '…' : ''}
                          </li>
                        ))}
                        {cocok.length > 12 && <li>…dan {cocok.length - 12} lainnya</li>}
                      </ul>
                    )}
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyImpor || cocok.length === 0}
                      onClick={() => void jalankanImpor({ mapel, kelas })}
                    >
                      {busyImpor ? 'Mengimpor…' : `Impor ${cocok.length} TP ke sini`}
                    </button>
                  </>
                )
              })()}
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
                onChange={(e) => setForm({ ...form, nomorTp: e.target.value })}
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Nama TP
              <input
                className={`${inputCls} mt-1`}
                value={form.namaTp}
                onChange={(e) => setForm({ ...form, namaTp: e.target.value })}
                placeholder="Rumusan tujuan pembelajaran"
              />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-slate-600">
            Capaian Pembelajaran (opsional)
            <textarea
              className={`${inputCls} mt-1`}
              rows={2}
              value={form.cp}
              onChange={(e) => setForm({ ...form, cp: e.target.value })}
              placeholder="Kalimat CP dari mapel ini untuk fase terkait"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[12px] font-medium text-slate-600">Jenis penilaian</p>
              <div className="mt-1 flex gap-1.5">
                {(['pengetahuan', 'kinerja'] as TipeTp[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, tipe: t })}
                    className={`flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-medium capitalize ${
                      form.tipe === t
                        ? 'border-muh-600 bg-muh-50 text-muh-800'
                        : 'border-border bg-white text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-[12px] font-medium text-slate-600">
              Bobot SLM (%)
              <input
                className={`${inputCls} mt-1`}
                inputMode="numeric"
                value={form.bobotSlm}
                onChange={(e) => {
                  const v = e.target.value
                  const n = Number(v)
                  setForm({
                    ...form,
                    bobotSlm: v,
                    bobotSas: Number.isFinite(n) && n >= 0 && n <= 100 && v !== '' ? String(100 - n) : form.bobotSas,
                  })
                }}
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Bobot SAS (%)
              <input
                className={`${inputCls} mt-1`}
                inputMode="numeric"
                value={form.bobotSas}
                onChange={(e) => setForm({ ...form, bobotSas: e.target.value })}
              />
            </label>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Dipakai kalau SAS TP ini diisi. Kalau SAS kosong, nilai akhir TP = SLM saja.
          </p>

          <div className="space-y-2.5">
            <p className="text-[12px] font-medium text-slate-600">
              Empat level KKTP — rentang nilai dan deskripsi capaian
            </p>
            {form.levels.map((l, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LEVEL_WARNA[i]}`}>
                    {LEVEL_LABEL[form.tipe][i]}
                  </span>
                  <input
                    aria-label={`Nilai minimum level ${i + 1}`}
                    className={`${inputCls} w-16 text-center`}
                    inputMode="numeric"
                    value={l.min}
                    onChange={(e) => setLevel(i, 'min', e.target.value)}
                  />
                  <span className="text-muted">–</span>
                  <input
                    aria-label={`Nilai maksimum level ${i + 1}`}
                    className={`${inputCls} w-16 text-center`}
                    inputMode="numeric"
                    value={l.maks}
                    onChange={(e) => setLevel(i, 'maks', e.target.value)}
                  />
                </div>
                <textarea
                  aria-label={`Deskripsi level ${i + 1}`}
                  className={`${inputCls} mt-2`}
                  rows={2}
                  value={l.deskripsi}
                  onChange={(e) => setLevel(i, 'deskripsi', e.target.value)}
                  placeholder="Kalimat capaian yang akan muncul di rapor"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void simpan()}>
              {busy ? 'Menyimpan…' : 'Simpan TP'}
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => setForm(null)}>
              Batal
            </button>
          </div>
        </section>
      )}

      {list === null || listTampil === null ? (
        <Spinner />
      ) : listTampil.length === 0 ? (
        <Notice>
          {isSeniBudaya && tabSeni !== 'semua' && tabSeni !== 'setup'
            ? `Belum ada TP untuk ${tabSeni} di kelas ${kelas}. Tambahkan TP di tab ini.`
            : `Belum ada TP untuk ${mapel} kelas ${kelas}. Tambahkan TP pertama.`}
        </Notice>
      ) : (
        <div className="space-y-2.5">
          {listTampil.map((tp) => {
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
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold leading-snug text-slate-900">{tp.namaTp}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="green">{tp.tipe}</Badge>
                      {tp.disiplinSeni && <Badge tone="peach">{tp.disiplinSeni}</Badge>}
                      <Badge>
                        SLM {tp.bobotSlm ?? 60}% · SAS {tp.bobotSas ?? 40}%
                      </Badge>
                      {(() => {
                        const alokasi = normalisasiAlokasiTp(tp)
                        const keys = (Object.keys(alokasi) as ('1' | '2')[]).sort()
                        if (!keys.length) {
                          return <Badge tone="peach">Semester &amp; bobot belum diatur</Badge>
                        }
                        return (
                          <Badge>
                            {keys.map((s) => `Sem ${s} ${alokasi[s]}%`).join(' · ')}
                          </Badge>
                        )
                      })()}
                    </span>
                  </span>
                </button>
                {buka && (
                  <div className="space-y-3 border-t border-border p-3.5">
                    {tp.cp && <p className="text-[12.5px] text-slate-600">{tp.cp}</p>}
                    <ul className="space-y-1.5">
                      {(tp.levels || []).map((l, i) => (
                        <li key={i} className="flex gap-2 text-[12.5px]">
                          <span className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${LEVEL_WARNA[i]}`}>
                            {LEVEL_LABEL[tp.tipe][i]} {l.min}–{l.maks}
                          </span>
                          <span className="text-slate-600">{l.deskripsi || 'Belum diisi'}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      {tulis && (
                        <>
                      <button type="button" className={btnGhost} onClick={() => { setForm(formDariTp(tp)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-[13px] font-medium text-red-700 hover:bg-red-50"
                        onClick={() => void hapus(tp)}
                      >
                        Hapus
                      </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
        </>
      )}
      {node}
    </div>
  )
}
