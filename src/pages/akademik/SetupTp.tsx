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
  salinTPKeKelas,
  saveTP,
  setDisiplinSeniBatch,
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
  JUMLAH_LEVEL_KKTP,
  jumlahKktpTerisi,
  nomorTpBerikut,
  saringTp,
  tetanggaTp,
  type FilterTp,
} from '../../lib/setupTpRumus'
import {
  DISIPLIN_SENI_NAMA,
  adalahSeniBudaya,
  jumlahTanpaDisiplin,
  normalisasiDisiplinSeni,
  sarankanDisiplinSeni,
} from '../../lib/disiplinSeniRumus'
import { useUnsavedGuard } from '../../lib/useUnsavedGuard'
import {
  BackLink,
  ChipToggle,
  LEVEL_WARNA,
  Notice,
  NoticeAksesGuru,
  Segmented,
  Spinner,
  btnDangerGhostSm,
  btnGhost,
  btnGhostSm,
  btnPrimary,
  inputCls,
  inputSempitCls,
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
  /** Teks CP resmi — tidak boleh diedit (dari daftar CP, hanya akun AI). */
  cpTerkunci?: boolean
  /** Seni Budaya saja: Seni Rupa / Seni Musik / Seni Tari / Seni Teater ('' = belum ditentukan). */
  disiplinSeni?: string
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
    disiplinSeni: normalisasiDisiplinSeni(tp.disiplinSeni),
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
  /** Panel salin TP+KKTP(+bobot) ke kelas paralel setingkat. */
  const [panelSalin, setPanelSalin] = useState(false)
  const [kelasSalinDipilih, setKelasSalinDipilih] = useState<string[]>([])
  const [modeSalin, setModeSalin] = useState<ModeImporTp>('tambah')
  const [termasukBobotSalin, setTermasukBobotSalin] = useState(true)
  const [busySalin, setBusySalin] = useState(false)
  const [refreshHub, setRefreshHub] = useState(0)
  /** Tab khusus Seni Budaya: 'setup' | nama disiplin | 'semua' */
  const [tabSeni, setTabSeni] = useState<string>('setup')
  // ---- Generate AI: hanya akun pemilik API key (§25). Guru lain tidak pernah melihatnya. ----
  const [antrianAi, setAntrianAi] = useState<{ namaTp: string; tipe: TipeTp; bobotSlm: number; bobotSas: number; cp: string; nomor: number; disiplinSeni?: string }[]>([])
  const [busyAi, setBusyAi] = useState<'tp' | 'kktp' | null>(null)
  /** CP yang ditandai selesai / disembunyikan (key: elemen|disiplin). */
  const [cpSelesai, setCpSelesai] = useState<Set<string>>(() => new Set())
  const [tampilkanCpSelesai, setTampilkanCpSelesai] = useState(false)
  // ---- Tata letak daftar ⇄ editor (§26) ----
  /** Isi panel kanan: editor TP atau daftar CP (tab CP hanya untuk akun AI). */
  const [tabKanan, setTabKanan] = useState<'editor' | 'cp'>('editor')
  /** Isi form saat dibuka (JSON). null = form dianggap belum tersimpan (mis. hasil AI). Dasar penanda "belum disimpan". */
  const [snapshotForm, setSnapshotForm] = useState<string | null>(null)
  /** Naik tiap editor membuka TP lain: menggulung editor ke atas dan daftar ke baris aktif. */
  const [kunciForm, setKunciForm] = useState(0)
  const [cariTp, setCariTp] = useState('')
  const [filterTp, setFilterTp] = useState<FilterTp>('semua')
  // ---- Seni Budaya: penetapan disiplin per TP (§27) ----
  const [panelDisiplin, setPanelDisiplin] = useState(false)
  /** Pilihan yang BELUM diterapkan: id TP → disiplin. */
  const [rancangDisiplin, setRancangDisiplin] = useState<Record<string, string>>({})
  /** id TP yang pilihannya berasal dari saran otomatis dan belum diubah guru (diberi penanda agar diperiksa). */
  const [disaranIds, setDisaranIds] = useState<Set<string>>(() => new Set())
  const [hanyaTanpaDisiplin, setHanyaTanpaDisiplin] = useState(true)
  const [busyDisiplin, setBusyDisiplin] = useState(false)
  /** Disiplin untuk TP Seni Budaya di file impor yang tidak mencantumkannya. null = ikuti tab yang sedang dibuka. */
  const [disiplinImporDefault, setDisiplinImporDefault] = useState<string | null>(null)
  /** Mode baca (§26.8): panel editor disembunyikan, daftar TP melebar, dan tiap TP bisa dibuka rinciannya tanpa masuk mode edit. */
  const [modeBaca, setModeBaca] = useState(false)
  const [bacaTerbuka, setBacaTerbuka] = useState<Set<string>>(() => new Set())
  const badanEditorRef = useRef<HTMLDivElement>(null)
  /** Posisi scroll halaman saat daftar TP ditinggalkan di layar kecil; dipulihkan saat kembali. */
  const yDaftar = useRef(0)
  const fileImporRef = useRef<HTMLInputElement>(null)
  // Posisi notifikasi dinaikkan agar tidak menutup bilah Simpan yang menempel di bawah editor.
  const { show, node } = useToast('bottom-36 md:bottom-24')

  const dirty = form !== null && (snapshotForm === null || JSON.stringify(form) !== snapshotForm)
  const { dialogNode } = useUnsavedGuard(dirty && tulis, {
    judul: 'TP belum disimpan',
    pesan: 'Ada TP yang belum disimpan. Jika keluar sekarang, perubahan pada TP itu bisa hilang. Tetap tinggal di halaman ini?',
  })

  // Ctrl/Cmd+S menyimpan TP yang sedang dibuka (tidak perlu menggulung ke tombol Simpan).
  useEffect(() => {
    function saatTekan(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return
      if (!form || modeBaca) return
      e.preventDefault()
      if (busy || (form.id && !dirty)) return
      void simpan()
    }
    window.addEventListener('keydown', saatTekan)
    return () => window.removeEventListener('keydown', saatTekan)
  })

  // Tiap editor membuka TP: isi editor kembali ke atas, dan baris TP aktif dibawa ke area terlihat di daftar.
  useEffect(() => {
    badanEditorRef.current?.scrollTo({ top: 0 })
    if (form?.id) document.getElementById(`tp-baris-${form.id}`)?.scrollIntoView({ block: 'nearest' })
    // Sengaja hanya bergantung pada kunciForm: tidak boleh menggulung ulang tiap ketikan.
  }, [kunciForm])

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
    // Seni Budaya: TP di file yang tidak mencantumkan disiplin diberi disiplin pilihan guru (bawaan: tab yang dibuka).
    const disiplinDefault = hanyaMapelTingkatan ? normalisasiDisiplinSeni(disiplinImporDefault ?? disiplinTab ?? '') : ''
    if (disiplinDefault) {
      daftar = daftar.map((it) =>
        adalahSeniBudaya(it.mapel) && !normalisasiDisiplinSeni(it.disiplinSeni) ? { ...it, disiplinSeni: disiplinDefault } : it,
      )
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
          (hasil.disiplinDilengkapi ? `, ${hasil.disiplinDilengkapi} TP lama dilengkapi disiplinnya` : '') +
          '.',
      )
      setDisiplinImporDefault(null)
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

  /** Kelas paralel setingkat yang guru ajar untuk mapel ini (selain kelas sumber). */
  const kelasParalelSalin = useMemo(() => {
    if (!mapel || !kelas || !tingkatan) return [] as string[]
    return pilihan
      .filter((p) => p.mapel === mapel && tingkatanDariKelas(p.kelas) === tingkatan && p.kelas !== kelas)
      .map((p) => p.kelas)
      .sort((a, b) => a.localeCompare(b, 'id'))
  }, [pilihan, mapel, kelas, tingkatan])

  async function jalankanSalin() {
    if (!mapel || !kelas || !kelasSalinDipilih.length || !list?.length) return
    // Hanya kelas setingkat + yang ada di penugasan (atau admin lewat pilihan)
    const tujuan = kelasSalinDipilih
      .map((k) => k.toUpperCase())
      .filter((k) => k !== kelas && tingkatanDariKelas(k) === tingkatan && kelasParalelSalin.includes(k))
    if (!tujuan.length) {
      show('Pilih minimal satu kelas paralel setingkat.', true)
      return
    }
    if (
      modeSalin === 'ganti' &&
      !window.confirm(
        `Mode GANTI akan menghapus SEMUA TP ${mapel} di kelas ${tujuan.join(', ')}, lalu menyalin ulang dari kelas ${kelas}.\n\nLanjutkan?`,
      )
    ) {
      return
    }
    if (
      modeSalin === 'tambah' &&
      !window.confirm(
        `Salin ${list.length} TP ${mapel} dari kelas ${kelas} ke ${tujuan.join(', ')}?\n` +
          (termasukBobotSalin ? 'Bobot semester ikut disalin.\n' : 'Bobot semester TIDAK disalin.\n') +
          'TP yang nomor/namanya sudah ada di tujuan akan dilewati.',
      )
    ) {
      return
    }
    setBusySalin(true)
    try {
      const hasil = await salinTPKeKelas({
        mapel,
        kelasSumber: kelas,
        kelasTujuan: tujuan,
        mode: modeSalin,
        termasukBobot: termasukBobotSalin,
      })
      const totalDitulis = hasil.reduce((s, h) => s + h.ditulis, 0)
      const totalLewat = hasil.reduce((s, h) => s + h.dilewati, 0)
      const totalHapus = hasil.reduce((s, h) => s + h.dihapus, 0)
      const rincian = hasil
        .map((h) => `${h.kelasTujuan}: ${h.ditulis} ditulis` + (h.dilewati ? `/${h.dilewati} dilewati` : '') + (h.dihapus ? `/${h.dihapus} dihapus` : ''))
        .join('; ')
      show(
        totalDitulis || totalLewat || totalHapus
          ? `Salin selesai — ${rincian}.`
          : 'Tidak ada TP yang disalin (sumber kosong atau semua sudah ada di tujuan).',
      )
      setPanelSalin(false)
      setKelasSalinDipilih([])
      setRefreshHub((n) => n + 1)
    } catch (e) {
      console.error(e)
      show('Gagal menyalin TP. Periksa hak akses Firestore.', true)
    } finally {
      setBusySalin(false)
    }
  }

  const kunciCakupan = `${mapel}|${kelas}`
  const statusCakupan: 'memeriksa' | 'boleh' | 'di luar' =
    !mapel || !kelas ? 'boleh' : cakupan?.kunci === kunciCakupan ? cakupan.status : 'memeriksa'

  /**
   * `senyap` = muat ulang tanpa mengosongkan daftar (dipakai setelah simpan/hapus), supaya tidak muncul
   * spinner yang meruntuhkan halaman dan menghilangkan posisi scroll.
   */
  const muat = useCallback(
    async (senyap = false) => {
      if (!senyap) setList(null)
      try {
        setList(await getTPList(mapel, kelas))
      } catch (e) {
        console.error(e)
        show('Gagal memuat TP. Periksa koneksi dan hak akses.', true)
        if (!senyap) setList([])
      }
    },
    [mapel, kelas, show],
  )

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

  /** Disiplin yang sedang dibuka (hanya Seni Budaya, di tab disiplin). Dipakai untuk menandai TP baru dan memilih CP. */
  const disiplinTab = isSeniBudaya && tabSeni !== 'setup' && tabSeni !== 'semua' ? tabSeni : undefined

  // Hanya akun pemilik API key yang melihat daftar CP + generate AI (§25). Guru lain: layout tanpa panel itu.
  const akunAi = bolehGenerateAi(profile.uid)
  const faseCp = faseDariTingkatan(tingkatan)
  const daftarCp = akunAi && !(isSeniBudaya && !disiplinTab) ? capaianUntuk(mapel, faseCp, disiplinTab) : []

  function kunciCp(cp: CapaianResmi) {
    return `${cp.elemen}|${cp.disiplinSeni || ''}`
  }

  const daftarCpTampil = akunAi
    ? daftarCp.filter((cp) => tampilkanCpSelesai || !cpSelesai.has(kunciCp(cp)))
    : daftarCp

  function tandaiCpSelesai(cp: CapaianResmi) {
    setCpSelesai((s) => new Set(s).add(kunciCp(cp)))
  }

  // ---- Navigasi daftar ⇄ editor -------------------------------------
  // Layar lebar (xl, ≥1280px): daftar TP di kiri, editor di kanan, keduanya selalu terlihat.
  // Layar kecil: bergantian — daftar ATAU editor — supaya tidak ada scroll jauh ke form.
  const layarKecil = () => window.innerWidth < 1280
  const detailTampilDiKecil = !modeBaca && (form !== null || (akunAi && tabKanan === 'cp'))
  const sibuk = busy || busyAi !== null || busyDisiplin

  /** Buka editor. `snapshot` = isi form yang dianggap "sudah tersimpan"; null = langsung dianggap belum tersimpan. */
  function bukaForm(f: FormState, snapshot: string | null) {
    if (layarKecil()) {
      if (!detailTampilDiKecil) yDaftar.current = window.scrollY
      window.scrollTo({ top: 0 })
    }
    setForm(f)
    setSnapshotForm(snapshot)
    setTabKanan('editor')
    setKunciForm((n) => n + 1)
  }

  function tutupFormPaksa() {
    setForm(null)
    setSnapshotForm(null)
    setAntrianAi([])
    setTabKanan('editor')
    if (layarKecil()) {
      const y = yDaftar.current
      window.requestAnimationFrame(() => window.scrollTo({ top: y }))
    }
  }

  /** true bila aman melanjutkan (tidak ada perubahan, atau pengguna setuju membuangnya). */
  function konfirmasiBuang(): boolean {
    if (!dirty) return true
    return window.confirm(
      'Perubahan pada TP yang sedang dibuka belum disimpan.' +
        (antrianAi.length ? ` ${antrianAi.length} TP antrean AI juga akan dibuang.` : '') +
        '\n\nBuang perubahan dan lanjut?',
    )
  }

  function bukaTp(tp: TujuanPembelajaran) {
    if (sibuk) return
    setModeBaca(false)
    if (form?.id === tp.id) {
      setTabKanan('editor')
      return
    }
    if (!konfirmasiBuang()) return
    setAntrianAi([])
    const f = formDariTp(tp)
    bukaForm(f, JSON.stringify(f))
  }

  function bukaTpBaru() {
    if (sibuk) return
    setModeBaca(false)
    if (!konfirmasiBuang()) return
    setAntrianAi([])
    const f: FormState = { ...formBaru(nomorTpBerikut(list)), ...(disiplinTab ? { disiplinSeni: disiplinTab } : {}) }
    bukaForm(f, JSON.stringify(f))
  }

  function bukaFormDariCp(cp: CapaianResmi) {
    if (sibuk) return
    setModeBaca(false)
    if (!konfirmasiBuang()) return
    setAntrianAi([])
    const disiplinCp = isSeniBudaya ? normalisasiDisiplinSeni(cp.disiplinSeni) || disiplinTab : undefined
    const f: FormState = {
      ...formBaru(nomorTpBerikut(list)),
      cp: cp.teks,
      cpTerkunci: true,
      ...(disiplinCp ? { disiplinSeni: disiplinCp } : {}),
    }
    bukaForm(f, JSON.stringify(f))
  }

  function kembaliKeDaftar() {
    if (sibuk || !konfirmasiBuang()) return
    tutupFormPaksa()
  }

  /** Pindah tab Seni Budaya. Dulu langsung `setForm(null)`; kini bertanya dulu bila ada perubahan. */
  function gantiTabSeni(tab: string) {
    if (tab === tabSeni || sibuk || !konfirmasiBuang()) return
    setTabSeni(tab)
    tutupFormPaksa()
  }

  function tampilkanTabCp() {
    if (!akunAi) return
    setModeBaca(false)
    if (layarKecil()) {
      if (!detailTampilDiKecil) yDaftar.current = window.scrollY
      window.scrollTo({ top: 0 })
    }
    setTabKanan('cp')
  }

  // ---- Mode baca ------------------------------------------------------
  function tampilkanEditor() {
    setModeBaca(false)
  }

  /**
   * Sembunyikan panel editor. TP yang sudah bersih ditutup; TP yang BELUM tersimpan tetap ada di memori
   * (dan diberi penanda di daftar) supaya muncul utuh lagi saat editor ditampilkan.
   */
  function sembunyikanEditor() {
    if (sibuk) return
    if (form && !dirty) tutupFormPaksa()
    setModeBaca(true)
  }

  function toggleBaca(id: string) {
    setBacaTerbuka((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // ---- Seni Budaya: penetapan disiplin ----------------------------------
  function tutupPanelDisiplin() {
    if (busyDisiplin) return
    if (perubahanDisiplin.length && !window.confirm(`${perubahanDisiplin.length} pilihan disiplin belum diterapkan. Buang?`)) return
    setRancangDisiplin({})
    setDisaranIds(new Set())
    setPanelDisiplin(false)
  }

  function pilihDisiplin(id: string, nilai: string) {
    setRancangDisiplin((r) => {
      const n = { ...r }
      if (nilai) n[id] = nilai
      else delete n[id]
      return n
    })
    // Pilihan yang diubah/dikonfirmasi guru bukan lagi "saran otomatis".
    setDisaranIds((s) => {
      if (!s.has(id)) return s
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  /** Isi usulan dari kata kunci HANYA pada TP yang masih kosong; guru wajib memeriksa lalu menekan Terapkan. */
  function isiSaranDisiplin() {
    const baru: Record<string, string> = {}
    let belumJelas = 0
    for (const tp of barisDisiplin) {
      if (normalisasiDisiplinSeni(tp.disiplinSeni) || rancangDisiplin[tp.id]) continue
      const saran = sarankanDisiplinSeni(tp.namaTp, tp.cp)
      if (saran.disiplin) baru[tp.id] = saran.disiplin
      else belumJelas += 1
    }
    const n = Object.keys(baru).length
    if (!n) return show('Tidak ada saran yang cukup jelas. Pilih disiplin secara manual.', true)
    setRancangDisiplin((r) => ({ ...r, ...baru }))
    setDisaranIds((s) => new Set([...s, ...Object.keys(baru)]))
    show(`Saran terisi untuk ${n} TP${belumJelas ? `; ${belumJelas} TP belum jelas, pilih manual` : ''}. Periksa dulu sebelum menerapkan.`)
  }

  function semuaKosongKeDisiplin(d: string) {
    if (!d) return
    const baru: Record<string, string> = {}
    for (const tp of barisDisiplin) if (!normalisasiDisiplinSeni(tp.disiplinSeni)) baru[tp.id] = d
    setRancangDisiplin((r) => ({ ...r, ...baru }))
    setDisaranIds((s) => {
      const n = new Set(s)
      for (const id of Object.keys(baru)) n.delete(id)
      return n
    })
  }

  async function terapkanDisiplin() {
    if (!perubahanDisiplin.length || busyDisiplin) return
    setBusyDisiplin(true)
    try {
      const n = await setDisiplinSeniBatch(perubahanDisiplin.map(([id, disiplin]) => ({ id, disiplin })))
      show(`${n} TP ditetapkan disiplinnya.`)
      setRancangDisiplin({})
      setDisaranIds(new Set())
      await muat(true)
    } catch (e) {
      console.error(e)
      show('Gagal menetapkan disiplin. Periksa koneksi dan hak akses.', true)
    } finally {
      setBusyDisiplin(false)
    }
  }

  // ---- Generate AI (hanya akun AI) ----------------------------------
  async function jalankanGenerateTp(provider: ProviderAi, cp: CapaianResmi) {
    if (!akunAi) return
    if (sibuk || !konfirmasiBuang()) return
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
      const awal = nomorTpBerikut(list)
      const [pertama, ...sisa] = hasil
      if (!pertama) throw new Error('AI tidak menghasilkan TP.')
      const disiplinAi = isSeniBudaya ? normalisasiDisiplinSeni(cp.disiplinSeni) || disiplinTab : undefined
      setAntrianAi(sisa.map((d, i) => ({ ...d, cp: cp.teks, nomor: awal + 1 + i, disiplinSeni: disiplinAi })))
      bukaForm(
        {
          nomorTp: String(awal),
          namaTp: pertama.namaTp,
          cp: cp.teks,
          tipe: pertama.tipe,
          bobotSlm: String(pertama.bobotSlm),
          bobotSas: String(pertama.bobotSas),
          levels: LEVEL_RANGE_DEFAULT.map((l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: '' })),
          cpTerkunci: true,
          ...(disiplinAi ? { disiplinSeni: disiplinAi } : {}),
        },
        null,
      )
      show(
        `${hasil.length} TP dari elemen “${cp.elemen}” masuk ke editor. Isi KKTP (bisa dengan AI), lalu Simpan.` +
          (sisa.length ? ` ${sisa.length} TP lain menunggu setelah yang ini disimpan.` : ''),
      )
    } catch (e) {
      show(e instanceof Error ? e.message : 'Gagal generate TP.', true)
    } finally {
      setBusyAi(null)
    }
  }

  async function jalankanGenerateKktp(provider: ProviderAi) {
    if (!akunAi) return
    if (!form?.namaTp.trim()) return show('Isi nama TP dulu.', true)
    if (
      form.levels.some((l) => l.deskripsi.trim()) &&
      !window.confirm('Deskripsi KKTP yang sudah terisi akan diganti hasil AI. Lanjutkan?')
    ) {
      return
    }
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

  // ---- Simpan / hapus -----------------------------------------------
  /** `lanjut` = setelah tersimpan, langsung buka TP berikutnya di daftar (hanya saat mengedit TP yang sudah ada). */
  async function simpan(lanjut = false) {
    if (!form || busy) return
    const namaTp = form.namaTp.trim()
    const nomor = parseInt(form.nomorTp, 10)
    if (!namaTp) return show('Nama TP wajib diisi.', true)
    // Seni Budaya: disiplin dari pilihan di editor, bila kosong ikut tab yang dibuka. TP BARU wajib punya disiplin.
    const disiplinSimpan = isSeniBudaya ? normalisasiDisiplinSeni(form.disiplinSeni) || disiplinTab : undefined
    if (isSeniBudaya && !form.id && !disiplinSimpan) return show('Pilih disiplin seni untuk TP Seni Budaya ini.', true)
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
        disiplinSeni: disiplinSimpan,
      })
      if (form.id) {
        setAntrianAi([])
        const berikut = lanjut ? tetanggaTp(listTampil, form.id).berikutnya : undefined
        if (berikut) {
          const f = formDariTp(berikut)
          bukaForm(f, JSON.stringify(f))
          show(`TP ${nomor} diperbarui. Lanjut ke TP ${berikut.nomorTp}.`)
        } else {
          // Editor tetap terbuka pada TP yang sama; hanya penanda "belum disimpan" yang hilang.
          setSnapshotForm(JSON.stringify(form))
          const pindah = disiplinSimpan && disiplinTab && disiplinSimpan !== disiplinTab
          show(
            (lanjut ? `TP ${nomor} diperbarui. Ini TP terakhir di daftar.` : 'TP diperbarui.') +
              (pindah ? ` Dipindah ke ${disiplinSimpan} (tidak lagi tampil di tab ini).` : ''),
          )
        }
      } else if (antrianAi.length) {
        const [berikut, ...sisa] = antrianAi
        setAntrianAi(sisa)
        bukaForm(
          {
            nomorTp: String(berikut.nomor),
            namaTp: berikut.namaTp,
            cp: berikut.cp,
            tipe: berikut.tipe,
            bobotSlm: String(berikut.bobotSlm),
            bobotSas: String(berikut.bobotSas),
            levels: LEVEL_RANGE_DEFAULT.map((l) => ({ min: String(l.min), maks: String(l.maks), deskripsi: '' })),
            cpTerkunci: true,
            ...(berikut.disiplinSeni ? { disiplinSeni: berikut.disiplinSeni } : {}),
          },
          null,
        )
        show(`TP ditambahkan. ${sisa.length + 1} TP antrean tersisa — isi KKTP lalu Simpan lagi.`)
      } else {
        show('TP ditambahkan.')
        tutupFormPaksa()
      }
      // Muat ulang TANPA mengosongkan daftar, supaya posisi scroll dan pilihan tidak hilang.
      await muat(true)
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
      if (form?.id === tp.id) tutupFormPaksa()
      await muat(true)
    } catch (e) {
      console.error(e)
      show('Gagal menghapus TP.', true)
    }
  }

  const setLevel = (i: number, k: 'min' | 'maks' | 'deskripsi', v: string) =>
    setForm((f) => (f ? { ...f, levels: f.levels.map((l, j) => (j === i ? { ...l, [k]: v } : l)) } : f))
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f))

  // ---- Turunan untuk tampilan ---------------------------------------
  const semuaTp = listTampil ?? []
  const tpTampil = saringTp(semuaTp, { cari: cariTp, filter: filterTp })
  const jumlahKktpKurang = semuaTp.filter((tp) => jumlahKktpTerisi(tp) < JUMLAH_LEVEL_KKTP).length
  /** Baris di panel penetapan disiplin (semua TP kelas ini; bawaan hanya yang belum ada disiplin). */
  const barisDisiplin = (list ?? []).filter((tp) => !hanyaTanpaDisiplin || !normalisasiDisiplinSeni(tp.disiplinSeni))
  const perubahanDisiplin = Object.entries(rancangDisiplin).filter(([id, d]) => {
    const tp = (list ?? []).find((t) => t.id === id)
    return Boolean(tp) && Boolean(d) && d !== normalisasiDisiplinSeni(tp!.disiplinSeni)
  })
  const semuaTerbuka = tpTampil.length > 0 && tpTampil.every((tp) => bacaTerbuka.has(tp.id))
  const toggleSemuaBaca = () => setBacaTerbuka(semuaTerbuka ? new Set() : new Set(tpTampil.map((tp) => tp.id)))
  const { indeks: indeksAktif, sebelumnya: tpSebelumnya, berikutnya: tpBerikutnya } = tetanggaTp(listTampil, form?.id)
  const tpAktif = form?.id ? semuaTp.find((t) => t.id === form.id) : undefined
  const labelTipe = (t: TipeTp) => (t === 'kinerja' ? 'Kinerja' : 'Pengetahuan')

  /** Ringkasan alokasi semester sebuah TP (diatur di menu Bobot Semester, bukan di sini). */
  const badgeSemester = (tp: TujuanPembelajaran) => {
    const alokasi = normalisasiAlokasiTp(tp)
    const keys = (Object.keys(alokasi) as ('1' | '2')[]).sort()
    if (!keys.length) return <Badge tone="peach">Semester &amp; bobot belum diatur</Badge>
    return <Badge>{keys.map((s) => `Sem ${s} ${alokasi[s]}%`).join(' · ')}</Badge>
  }

  /** Badge disiplin Seni Budaya; TP tanpa disiplin diberi penanda mencolok karena tidak tampil di tab disiplin. */
  const badgeDisiplin = (tp: { disiplinSeni?: string }) => {
    if (!isSeniBudaya) return null
    const d = normalisasiDisiplinSeni(tp.disiplinSeni)
    return d ? (
      <Badge tone="peach">{d}</Badge>
    ) : (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-900">
        Disiplin belum ditentukan
      </span>
    )
  }

  const tanpaDisiplinSemua = isSeniBudaya ? jumlahTanpaDisiplin(list) : 0

  const teksKosong =
    isSeniBudaya && tabSeni !== 'semua' && tabSeni !== 'setup'
      ? `Belum ada TP untuk ${tabSeni} di kelas ${kelas}. Tambahkan TP di tab ini.`
      : `Belum ada TP untuk ${mapel} kelas ${kelas}. Tambahkan TP pertama.`

  const kelasTabSeni = (aktif: boolean, tebal = false) =>
    `rounded-full px-3 py-1.5 text-[12px] ${tebal ? 'font-semibold' : 'font-medium'} transition ${
      aktif ? 'bg-muh-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/akademik/setup-tp', label: 'Pilih mata pelajaran' }}
        eyebrow={`Kelas ${kelas} · Fase ${faseDariTingkatan(tingkatan)}`}
        title={tulis ? `TP & KKTP — ${mapel}` : `Tujuan Pembelajaran — ${mapel}`}
        subtitle={
          isSeniBudaya
            ? 'Seni Budaya punya tab khusus: atur disiplin aktif per semester, lalu susun TP per cabang seni (rupa, musik, tari, teater).'
            : tulis
              ? 'TP & KKTP dipakai bersama di kelas ini untuk mapel ini — guru kelas dan guru bidang studi yang mengampu melihat data yang sama. Semester & bobot diatur di menu Bobot Semester.'
              : 'Mode lihat. TP dan KKTP disusun oleh guru kelas dan guru bidang studi; administrator hanya membaca.'
        }
      />

      {isSeniBudaya && (
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          <button type="button" onClick={() => gantiTabSeni('setup')} className={kelasTabSeni(tabSeni === 'setup', true)}>
            Setup Seni Budaya
          </button>
          {DISIPLIN_SENI.map((d) => (
            <button key={d} type="button" onClick={() => gantiTabSeni(d)} className={kelasTabSeni(tabSeni === d)}>
              TP {d.replace('Seni ', '')}
            </button>
          ))}
          <button type="button" onClick={() => gantiTabSeni('semua')} className={kelasTabSeni(tabSeni === 'semua')}>
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
          {tulis && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={sibuk} onClick={bukaTpBaru}>
                + Tambah TP
              </button>
              <button type="button" className={btnGhost} onClick={() => setPanelImpor((v) => !v)}>
                {panelImpor ? 'Tutup panel' : 'Impor / Ekspor'}
              </button>
              {kelasParalelSalin.length > 0 && (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={!list?.length}
                  onClick={() => {
                    setPanelSalin((v) => !v)
                    if (!panelSalin) setKelasSalinDipilih([])
                  }}
                  title={list?.length ? 'Salin TP, KKTP, dan bobot ke kelas paralel setingkat' : 'Belum ada TP untuk disalin'}
                >
                  {panelSalin ? 'Tutup salin' : 'Salin ke kelas lain'}
                </button>
              )}
              <Link
                to={`/akademik/bobot-semester?mapel=${encodeURIComponent(mapel)}&kelas=${encodeURIComponent(kelas)}`}
                className={`${btnGhost} no-underline`}
              >
                Atur semester &amp; bobot
              </Link>
              {isSeniBudaya && tabSeni !== 'setup' && (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={sibuk}
                  aria-pressed={panelDisiplin}
                  onClick={panelDisiplin ? tutupPanelDisiplin : () => setPanelDisiplin(true)}
                >
                  {panelDisiplin
                    ? 'Tutup penetapan disiplin'
                    : `Tetapkan disiplin${tanpaDisiplinSemua ? ` (${tanpaDisiplinSemua})` : ''}`}
                </button>
              )}
              <button
                type="button"
                className={`${btnGhost} ml-auto`}
                aria-pressed={modeBaca}
                disabled={sibuk}
                onClick={modeBaca ? tampilkanEditor : sembunyikanEditor}
              >
                {modeBaca ? 'Tampilkan editor' : 'Sembunyikan editor'}
              </button>
            </div>
          )}

          {isSeniBudaya && tabSeni !== 'setup' && list !== null && tanpaDisiplinSemua > 0 && !panelDisiplin && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-950">
              <span>
                {tanpaDisiplinSemua} TP Seni Budaya belum punya disiplin, jadi tidak muncul di tab Rupa/Musik/Tari/Teater
                (hanya di “Semua TP”).
              </span>
              {tulis && (
                <button type="button" className={btnGhostSm} onClick={() => setPanelDisiplin(true)}>
                  Tetapkan disiplin
                </button>
              )}
            </div>
          )}

          {tulis && isSeniBudaya && tabSeni !== 'setup' && panelDisiplin && list !== null && (
            <section className="card-soft space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold text-slate-900">
                    Tetapkan disiplin TP Seni Budaya — kelas {kelas}
                  </h2>
                  <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted">
                    Setiap TP Seni Budaya perlu satu disiplin (Rupa, Musik, Tari, atau Teater) agar muncul di tab
                    disiplinnya. Pilihan baru baru berlaku setelah “Terapkan”. “Isi saran otomatis” hanya menebak dari
                    kata kunci pada rumusan TP, jadi periksa hasilnya.
                  </p>
                </div>
                <button type="button" className={btnGhostSm} disabled={busyDisiplin} onClick={tutupPanelDisiplin}>
                  Tutup
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busyDisiplin || barisDisiplin.length === 0}
                  onClick={isiSaranDisiplin}
                >
                  Isi saran otomatis
                </button>
                <label className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600">
                  Semua yang kosong →
                  <select
                    className={`${inputSempitCls} w-auto`}
                    value=""
                    disabled={busyDisiplin}
                    onChange={(e) => semuaKosongKeDisiplin(e.target.value)}
                  >
                    <option value="">pilih disiplin…</option>
                    {DISIPLIN_SENI_NAMA.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={hanyaTanpaDisiplin}
                    onChange={(e) => setHanyaTanpaDisiplin(e.target.checked)}
                  />
                  Hanya yang belum ada disiplin
                </label>
              </div>
              {barisDisiplin.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-3 text-[12.5px] text-muted">
                  Semua TP sudah punya disiplin. Hilangkan centang di atas untuk melihat dan mengubahnya.
                </p>
              ) : (
                <div className="max-h-[26rem] overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-[34rem] text-left text-[12.5px]">
                    <thead className="sticky top-0 bg-slate-50 text-[11.5px] uppercase tracking-wide text-muted">
                      <tr>
                        <th className="w-14 px-3 py-2 font-semibold">No</th>
                        <th className="px-3 py-2 font-semibold">Rumusan TP</th>
                        <th className="w-48 px-3 py-2 font-semibold">Disiplin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {barisDisiplin.map((tp) => {
                        const nilai = rancangDisiplin[tp.id] ?? normalisasiDisiplinSeni(tp.disiplinSeni)
                        const saran = disaranIds.has(tp.id)
                        return (
                          <tr key={tp.id} className={nilai && nilai !== normalisasiDisiplinSeni(tp.disiplinSeni) ? 'bg-muh-50/40' : ''}>
                            <td className="tabular px-3 py-2 align-top font-semibold text-slate-700">{tp.nomorTp}</td>
                            <td className="px-3 py-2 align-top text-slate-800">
                              {tp.namaTp}
                              {saran && (
                                <span className="mt-0.5 block text-[11.5px] text-amber-800">
                                  Saran otomatis ({sarankanDisiplinSeni(tp.namaTp, tp.cp).alasan.join(', ')}) — periksa.
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                aria-label={`Disiplin TP ${tp.nomorTp}`}
                                className={`${inputSempitCls} w-full`}
                                value={nilai}
                                disabled={busyDisiplin}
                                onChange={(e) => pilihDisiplin(tp.id, e.target.value)}
                              >
                                <option value="">Belum ditentukan</option>
                                {DISIPLIN_SENI_NAMA.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busyDisiplin || perubahanDisiplin.length === 0}
                  onClick={() => void terapkanDisiplin()}
                >
                  {busyDisiplin ? 'Menyimpan…' : `Terapkan ${perubahanDisiplin.length} perubahan`}
                </button>
                <span className="text-[12px] text-muted">
                  {perubahanDisiplin.length === 0 ? 'Belum ada pilihan baru.' : `${perubahanDisiplin.length} TP akan ditetapkan.`}
                </span>
              </div>
            </section>
          )}

          {panelImpor && tulis && (
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
                      disiplinSeni: tp.disiplinSeni,
                      levels:
                        tp.levels?.length === 4
                          ? tp.levels
                          : [
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
                          Cocok untuk {mapel} kelas {kelas}: {cocok.length} dari {pratinjauImpor.items.length} TP di
                          file
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
                        {isSeniBudaya &&
                          cocok.length > 0 &&
                          (() => {
                            const tanpa = cocok.filter((it) => !normalisasiDisiplinSeni(it.disiplinSeni)).length
                            return (
                              <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-amber-950">
                                <p>
                                  Disiplin seni: {cocok.length - tanpa} TP sudah tercantum di file, {tanpa} belum.
                                </p>
                                {tanpa > 0 && (
                                  <label className="flex flex-wrap items-center gap-2">
                                    TP tanpa disiplin ditetapkan sebagai:
                                    <select
                                      className={`${inputSempitCls} w-auto`}
                                      value={disiplinImporDefault ?? disiplinTab ?? ''}
                                      onChange={(e) => setDisiplinImporDefault(e.target.value)}
                                    >
                                      <option value="">Belum ditentukan (tetapkan nanti)</option>
                                      {DISIPLIN_SENI_NAMA.map((d) => (
                                        <option key={d} value={d}>
                                          {d}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                {modeImpor === 'tambah' && (
                                  <p className="text-[11.5px]">
                                    TP yang sudah ada di sistem tanpa disiplin akan dilengkapi bila file mencantumkan
                                    disiplinnya (disiplin yang sudah ada tidak diubah).
                                  </p>
                                )}
                              </div>
                            )
                          })()}
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

          {panelSalin && tulis && kelasParalelSalin.length > 0 && (
            <section className="card-soft space-y-3 p-4">
              <h2 className="text-[14px] font-semibold text-slate-900">
                Salin TP &amp; KKTP — {mapel} kelas {kelas} → kelas paralel
              </h2>
              <p className="text-[12.5px] leading-relaxed text-muted">
                Salin seluruh Tujuan Pembelajaran, deskripsi KKTP, dan (opsional) bobot semester ke kelas
                paralel setingkat yang Anda ajar. Hanya kelas tingkat {tingkatan} yang ditampilkan agar
                tidak tersalin ke tingkat lain. Nilai siswa tidak ikut disalin.
              </p>
              {!list?.length ? (
                <Notice>Belum ada TP di kelas sumber. Susun TP dulu sebelum menyalin.</Notice>
              ) : (
                <>
                  <fieldset className="space-y-2">
                    <legend className="text-[12.5px] font-medium text-slate-800">Pilih kelas tujuan</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {kelasParalelSalin.map((k) => {
                        const checked = kelasSalinDipilih.includes(k)
                        return (
                          <label key={k} className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={checked}
                              onChange={() =>
                                setKelasSalinDipilih((prev) =>
                                  checked ? prev.filter((x) => x !== k) : [...prev, k],
                                )
                              }
                            />
                            <span className="font-medium text-slate-900">{k}</span>
                          </label>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        className={btnGhostSm}
                        onClick={() => setKelasSalinDipilih([...kelasParalelSalin])}
                      >
                        Pilih semua
                      </button>
                      <button type="button" className={btnGhostSm} onClick={() => setKelasSalinDipilih([])}>
                        Kosongkan
                      </button>
                    </div>
                  </fieldset>

                  <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="modeSalin"
                        checked={modeSalin === 'tambah'}
                        onChange={() => setModeSalin('tambah')}
                      />
                      Tambah (lewati nomor/nama yang sudah ada)
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="modeSalin"
                        checked={modeSalin === 'ganti'}
                        onChange={() => setModeSalin('ganti')}
                      />
                      Ganti (hapus TP di tujuan dulu)
                    </label>
                  </div>

                  <label className="inline-flex items-center gap-2 text-[12.5px]">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={termasukBobotSalin}
                      onChange={(e) => setTermasukBobotSalin(e.target.checked)}
                    />
                    Sertakan bobot semester (bobotPerSemester)
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busySalin || !kelasSalinDipilih.length || !list?.length}
                      onClick={() => void jalankanSalin()}
                    >
                      {busySalin
                        ? 'Menyalin…'
                        : `Salin ${list.length} TP ke ${kelasSalinDipilih.length || '…'} kelas`}
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={busySalin}
                      onClick={() => {
                        setPanelSalin(false)
                        setKelasSalinDipilih([])
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {list === null || listTampil === null ? (
            <Spinner />
          ) : !tulis ? (
            // Admin: hanya melihat. Tidak ada editor, jadi rincian dibuka di tempat.
            listTampil.length === 0 ? (
              <Notice>{teksKosong}</Notice>
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
                            {badgeDisiplin(tp)}
                            <Badge>
                              SLM {tp.bobotSlm ?? 60}% · SAS {tp.bobotSas ?? 40}%
                            </Badge>
                            {badgeSemester(tp)}
                          </span>
                        </span>
                      </button>
                      {buka && (
                        <div className="space-y-3 border-t border-border p-3.5">
                          {tp.cp && <p className="text-[12.5px] text-slate-600">{tp.cp}</p>}
                          <ul className="space-y-1.5">
                            {(tp.levels || []).map((l, i) => (
                              <li key={i} className="flex gap-2 text-[12.5px]">
                                <span
                                  className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${LEVEL_WARNA[i]}`}
                                >
                                  {LEVEL_LABEL[tp.tipe][i]} {l.min}–{l.maks}
                                </span>
                                <span className="text-slate-600">{l.deskripsi || 'Belum diisi'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )
          ) : (
            <div className={`grid items-start gap-4 ${modeBaca ? '' : 'xl:grid-cols-[22rem_minmax(0,1fr)]'}`}>
              {/* ===== Kiri: daftar TP ===== */}
              <section
                className={`card-soft min-h-0 flex-col ${
                  modeBaca
                    ? 'flex'
                    : `xl:sticky xl:top-[4.25rem] xl:max-h-[max(28rem,calc(100vh-14rem))] ${
                        detailTampilDiKecil ? 'hidden xl:flex' : 'flex'
                      }`
                }`}
              >
                <div className="shrink-0 space-y-2.5 border-b border-border p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[14px] font-semibold text-slate-900">
                      Daftar TP <span className="tabular font-normal text-muted">({semuaTp.length})</span>
                    </h2>
                    <div className="flex items-center gap-1.5">
                      {modeBaca && semuaTp.length > 0 && (
                        <button type="button" className={btnGhostSm} onClick={toggleSemuaBaca}>
                          {semuaTerbuka ? 'Tutup semua rincian' : 'Buka semua rincian'}
                        </button>
                      )}
                      {akunAi && !modeBaca && (
                        <button type="button" className={`${btnGhostSm} xl:hidden`} onClick={tampilkanTabCp}>
                          Capaian Pembelajaran
                        </button>
                      )}
                    </div>
                  </div>
                  {modeBaca && form && dirty && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-950">
                      <span>{form.id ? `TP ${form.nomorTp}` : 'TP baru'} belum disimpan.</span>
                      <button type="button" className={btnGhostSm} onClick={tampilkanEditor}>
                        Kembali ke editor
                      </button>
                    </div>
                  )}
                  {semuaTp.length > 0 && (
                    <>
                      <input
                        type="search"
                        className={inputCls}
                        placeholder="Cari nomor atau nama TP…"
                        value={cariTp}
                        onChange={(e) => setCariTp(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <ChipToggle active={filterTp === 'semua'} count={semuaTp.length} onClick={() => setFilterTp('semua')}>
                          Semua
                        </ChipToggle>
                        <ChipToggle
                          active={filterTp === 'kktp-kurang'}
                          count={jumlahKktpKurang}
                          perhatian
                          onClick={() => setFilterTp('kktp-kurang')}
                        >
                          KKTP belum lengkap
                        </ChipToggle>
                        {isSeniBudaya && (
                          <ChipToggle
                            active={filterTp === 'tanpa-disiplin'}
                            count={jumlahTanpaDisiplin(semuaTp)}
                            perhatian
                            onClick={() => setFilterTp('tanpa-disiplin')}
                          >
                            Belum ada disiplin
                          </ChipToggle>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {semuaTp.length === 0 ? (
                    <p className="p-4 text-[13px] leading-relaxed text-muted">{teksKosong}</p>
                  ) : tpTampil.length === 0 ? (
                    <div className="space-y-2 p-4 text-[13px] text-muted">
                      <p>Tidak ada TP yang cocok dengan pencarian atau saringan.</p>
                      <button
                        type="button"
                        className={btnGhostSm}
                        onClick={() => {
                          setCariTp('')
                          setFilterTp('semua')
                        }}
                      >
                        Hapus pencarian
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {tpTampil.map((tp) => {
                        const aktif = form?.id === tp.id
                        const terisi = jumlahKktpTerisi(tp)
                        if (modeBaca) {
                          const buka = bacaTerbuka.has(tp.id)
                          return (
                            <li key={tp.id} id={`tp-baris-${tp.id}`}>
                              <button
                                type="button"
                                aria-expanded={buka}
                                onClick={() => toggleBaca(tp.id)}
                                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                              >
                                <span className="tabular mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11.5px] font-semibold text-slate-700">
                                  {tp.nomorTp}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13.5px] font-medium leading-snug text-slate-900">
                                    {tp.namaTp}
                                  </span>
                                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <Badge tone="green">{labelTipe(tp.tipe)}</Badge>
                                    {badgeDisiplin(tp)}
                                    {terisi >= JUMLAH_LEVEL_KKTP ? (
                                      <Badge>KKTP {terisi}/{JUMLAH_LEVEL_KKTP}</Badge>
                                    ) : (
                                      <Badge tone="peach">KKTP {terisi}/{JUMLAH_LEVEL_KKTP}</Badge>
                                    )}
                                    <Badge>
                                      SLM {tp.bobotSlm ?? 60}% · SAS {tp.bobotSas ?? 40}%
                                    </Badge>
                                    {badgeSemester(tp)}
                                  </span>
                                </span>
                                <span aria-hidden="true" className="mt-1 text-[11px] text-muted">
                                  {buka ? '▲' : '▼'}
                                </span>
                              </button>
                              {buka && (
                                <div className="space-y-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:pl-[3.25rem]">
                                  {tp.cp && (
                                    <p className="max-w-4xl text-[12.5px] leading-relaxed text-slate-600">{tp.cp}</p>
                                  )}
                                  <ul className="max-w-4xl space-y-1.5">
                                    {(tp.levels || []).map((l, i) => (
                                      <li key={i} className="flex gap-2 text-[12.5px]">
                                        <span
                                          className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${LEVEL_WARNA[i]}`}
                                        >
                                          {LEVEL_LABEL[tp.tipe][i]} {l.min}–{l.maks}
                                        </span>
                                        <span className="text-slate-700">{l.deskripsi || 'Belum diisi'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <button type="button" className={btnGhostSm} disabled={sibuk} onClick={() => bukaTp(tp)}>
                                    Edit TP ini
                                  </button>
                                </div>
                              )}
                            </li>
                          )
                        }
                        return (
                          <li key={tp.id} id={`tp-baris-${tp.id}`}>
                            <button
                              type="button"
                              disabled={sibuk}
                              aria-current={aktif ? 'true' : undefined}
                              onClick={() => bukaTp(tp)}
                              className={`flex w-full items-start gap-2.5 border-l-[3px] px-3.5 py-2.5 text-left transition disabled:opacity-60 ${
                                aktif ? 'border-muh-600 bg-muh-50' : 'border-transparent hover:bg-slate-50'
                              }`}
                            >
                              <span className="tabular mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11.5px] font-semibold text-slate-700">
                                {tp.nomorTp}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 block text-[13px] font-medium leading-snug text-slate-900">
                                  {tp.namaTp}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-1">
                                  <Badge tone="green">{labelTipe(tp.tipe)}</Badge>
                                  {badgeDisiplin(tp)}
                                  {terisi >= JUMLAH_LEVEL_KKTP ? (
                                    <Badge>KKTP {terisi}/{JUMLAH_LEVEL_KKTP}</Badge>
                                  ) : (
                                    <Badge tone="peach">KKTP {terisi}/{JUMLAH_LEVEL_KKTP}</Badge>
                                  )}
                                  {aktif && dirty && (
                                    <span className="text-[11px] font-medium text-peach-500">● belum disimpan</span>
                                  )}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </section>

              {/* ===== Kanan: editor (+ tab daftar CP untuk akun AI) ===== */}
              <section
                className={`card-soft min-h-0 flex-col ${
                  modeBaca
                    ? 'hidden'
                    : `xl:sticky xl:top-[4.25rem] xl:h-[max(28rem,calc(100vh-14rem))] ${
                        detailTampilDiKecil ? 'flex' : 'hidden xl:flex'
                      }`
                }`}
              >
                <div className="shrink-0 space-y-2 border-b border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-[12px] font-medium text-muh-700 hover:underline disabled:opacity-60 xl:hidden"
                      disabled={sibuk}
                      onClick={kembaliKeDaftar}
                    >
                      ← Daftar TP
                    </button>
                    <button
                      type="button"
                      className={`${btnGhostSm} ml-auto hidden xl:inline-flex`}
                      disabled={sibuk}
                      onClick={sembunyikanEditor}
                      title="Lebarkan daftar TP untuk membaca; editor bisa ditampilkan lagi kapan saja"
                    >
                      Sembunyikan editor
                    </button>
                  </div>
                  {akunAi ? (
                    <Segmented
                      value={tabKanan}
                      onChange={(v) => (v === 'cp' ? tampilkanTabCp() : setTabKanan('editor'))}
                      options={[
                        { value: 'editor', label: form ? (form.id ? `Edit TP ${form.nomorTp}` : 'TP baru') : 'Editor TP' },
                        { value: 'cp', label: `Capaian Pembelajaran${daftarCp.length ? ` (${daftarCp.length})` : ''}` },
                      ]}
                    />
                  ) : (
                    <h2 className="text-[14px] font-semibold text-slate-900">
                      {form ? (form.id ? `Edit TP ${form.nomorTp}` : 'TP baru') : 'Editor TP'}
                    </h2>
                  )}
                </div>

                {akunAi && tabKanan === 'cp' ? (
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
                    <p className="text-[12px] leading-snug text-muted">
                      Pilih CP untuk menyusun TP. Teks resmi tidak boleh diubah.
                      {isSeniBudaya && !disiplinTab ? ' Buka tab disiplin dulu.' : ''}
                    </p>
                    {daftarCp.length === 0 ? (
                      <p className="text-[12.5px] text-muted">
                        {isSeniBudaya && !disiplinTab
                          ? 'Belum ada elemen yang ditampilkan.'
                          : `Tidak ada CP untuk ${mapel} fase ${faseCp}.`}
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] text-muted">
                            {daftarCpTampil.length}/{daftarCp.length}
                          </span>
                          {daftarCp.some((cp) => cpSelesai.has(kunciCp(cp))) && (
                            <button
                              type="button"
                              className={`${btnGhost} py-1 text-[12px]`}
                              onClick={() => setTampilkanCpSelesai((v) => !v)}
                            >
                              {tampilkanCpSelesai ? 'Sembunyikan selesai' : 'Tampilkan selesai'}
                            </button>
                          )}
                        </div>
                        <ul className="space-y-1.5">
                          {daftarCpTampil.map((cp) => {
                            const selesai = cpSelesai.has(kunciCp(cp))
                            return (
                              <li
                                key={`${cp.elemen}-${cp.disiplinSeni || ''}`}
                                className={`rounded-lg border px-2.5 py-2 ${
                                  selesai ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-muh-600"
                                    checked={selesai}
                                    title={selesai ? 'Tampilkan lagi' : 'Tandai selesai dan sembunyikan'}
                                    onChange={() => {
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
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-slate-900">
                                      {cp.elemen}
                                      {selesai ? <span className="font-normal text-muted"> · selesai</span> : null}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{cp.teks}</p>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className={`${btnGhost} px-2.5 py-1 text-[12px]`}
                                    disabled={sibuk}
                                    onClick={() => bukaFormDariCp(cp)}
                                  >
                                    Pakai
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg bg-muh-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-muh-700 disabled:opacity-50"
                                    disabled={busyAi !== null}
                                    onClick={() => void jalankanGenerateTp('gemini', cp)}
                                  >
                                    {busyAi === 'tp' ? '…' : 'Gemini'}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg border-2 border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                    disabled={busyAi !== null}
                                    onClick={() => void jalankanGenerateTp('openai', cp)}
                                  >
                                    OpenAI
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                        {daftarCpTampil.length === 0 && (
                          <p className="text-[12px] text-muted">
                            Semua CP ditandai selesai. Tekan “Tampilkan selesai” untuk melihat lagi.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : !form ? (
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
                    <h2 className="text-[15px] font-semibold text-slate-900">Belum ada TP yang dibuka</h2>
                    <p className="max-w-md text-[13px] leading-relaxed text-muted">
                      Pilih TP di daftar untuk mengedit, atau tambah yang baru. Setelah satu TP disimpan Anda bisa
                      langsung lanjut ke TP berikutnya tanpa kembali ke daftar.
                    </p>
                    {semuaTp.length > 0 && (
                      <p className="text-[12.5px] text-slate-600">
                        {semuaTp.length} TP ·{' '}
                        {jumlahKktpKurang > 0
                          ? `${jumlahKktpKurang} TP KKTP-nya belum lengkap`
                          : 'semua KKTP sudah lengkap'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnPrimary} disabled={sibuk} onClick={bukaTpBaru}>
                        + Tambah TP
                      </button>
                      {akunAi && (
                        <button type="button" className={btnGhost} onClick={tampilkanTabCp}>
                          Susun dari Capaian Pembelajaran
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
                      <p className="text-[12px] text-muted">
                        {form.id
                          ? indeksAktif >= 0
                            ? `TP ke-${indeksAktif + 1} dari ${semuaTp.length}`
                            : 'Edit TP'
                          : antrianAi.length
                            ? `TP baru · ${antrianAi.length} TP antrean AI menunggu`
                            : 'TP baru'}
                      </p>
                      {form.id && (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className={btnGhostSm}
                            disabled={!tpSebelumnya || sibuk}
                            onClick={() => tpSebelumnya && bukaTp(tpSebelumnya)}
                          >
                            ‹ Sebelumnya
                          </button>
                          <button
                            type="button"
                            className={btnGhostSm}
                            disabled={!tpBerikutnya || sibuk}
                            onClick={() => tpBerikutnya && bukaTp(tpBerikutnya)}
                          >
                            Berikutnya ›
                          </button>
                        </div>
                      )}
                    </div>

                    <div ref={badanEditorRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                      {tpAktif && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {badgeDisiplin(tpAktif)}
                          {badgeSemester(tpAktif)}
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                        <label className="block text-[12px] font-medium text-slate-600">
                          Nomor TP
                          <input
                            className={`${inputCls} mt-1`}
                            inputMode="numeric"
                            value={form.nomorTp}
                            onChange={(e) => setField('nomorTp', e.target.value)}
                          />
                        </label>
                        <label className="block text-[12px] font-medium text-slate-600">
                          Nama TP
                          <input
                            className={`${inputCls} mt-1`}
                            value={form.namaTp}
                            onChange={(e) => setField('namaTp', e.target.value)}
                            placeholder="Rumusan tujuan pembelajaran"
                          />
                        </label>
                      </div>
                      {isSeniBudaya && (
                        <label className="block text-[12px] font-medium text-slate-600">
                          Disiplin seni
                          <select
                            className={`${inputCls} mt-1`}
                            value={form.disiplinSeni ?? ''}
                            onChange={(e) => setField('disiplinSeni', e.target.value)}
                          >
                            {!form.disiplinSeni && <option value="">Belum ditentukan — pilih disiplin</option>}
                            {DISIPLIN_SENI_NAMA.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          {!form.disiplinSeni && (
                            <span className="mt-1 block text-[11.5px] text-muted">
                              TP tanpa disiplin tidak tampil di tab Rupa/Musik/Tari/Teater.
                            </span>
                          )}
                        </label>
                      )}
                      <label className="block text-[12px] font-medium text-slate-600">
                        Capaian Pembelajaran (opsional)
                        <textarea
                          className={`${inputCls} mt-1`}
                          rows={2}
                          value={form.cp}
                          readOnly={Boolean(form.cpTerkunci)}
                          onChange={(e) => setField('cp', e.target.value)}
                          placeholder="Kalimat CP dari mapel ini untuk fase terkait"
                        />
                        {form.cpTerkunci && (
                          <span className="mt-1 block text-[11.5px] text-muted">
                            Teks CP resmi terkunci (dari dokumen pemerintah).
                          </span>
                        )}
                      </label>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[12px] font-medium text-slate-600">Jenis penilaian</p>
                          <div className="mt-1 flex gap-1.5">
                            {(['pengetahuan', 'kinerja'] as TipeTp[]).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setField('tipe', t)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-medium capitalize ${
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
                              setForm((f) =>
                                f
                                  ? {
                                      ...f,
                                      bobotSlm: v,
                                      bobotSas:
                                        Number.isFinite(n) && n >= 0 && n <= 100 && v !== '' ? String(100 - n) : f.bobotSas,
                                    }
                                  : f,
                              )
                            }}
                          />
                        </label>
                        <label className="block text-[12px] font-medium text-slate-600">
                          Bobot SAS (%)
                          <input
                            className={`${inputCls} mt-1`}
                            inputMode="numeric"
                            value={form.bobotSas}
                            onChange={(e) => setField('bobotSas', e.target.value)}
                          />
                        </label>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-muted">
                        Dipakai kalau SAS TP ini diisi. Kalau SAS kosong, nilai akhir TP = SLM saja.
                      </p>

                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[12px] font-medium text-slate-600">
                            Empat level KKTP — rentang nilai dan deskripsi capaian
                          </p>
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
                                aria-label={`Nilai minimum level ${i + 1}`}
                                className={`${inputSempitCls} w-16 text-center`}
                                inputMode="numeric"
                                value={l.min}
                                onChange={(e) => setLevel(i, 'min', e.target.value)}
                              />
                              <span className="text-muted">–</span>
                              <input
                                aria-label={`Nilai maksimum level ${i + 1}`}
                                className={`${inputSempitCls} w-16 text-center`}
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

                      {tpAktif && (
                        <div className="space-y-2 border-t border-border pt-3">
                          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Tindakan lain</p>
                          <button
                            type="button"
                            className={btnDangerGhostSm}
                            disabled={busy}
                            onClick={() => void hapus(tpAktif)}
                          >
                            Hapus TP ini
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-white p-3 max-xl:sticky max-xl:bottom-[4.25rem] max-xl:z-10 max-xl:rounded-b-xl">
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busy || (Boolean(form.id) && !dirty)}
                        onClick={() => void simpan()}
                      >
                        {busy ? 'Menyimpan…' : antrianAi.length ? `Simpan TP (${antrianAi.length} menunggu)` : 'Simpan TP'}
                      </button>
                      {form.id && dirty && tpBerikutnya && (
                        <button type="button" className={btnGhost} disabled={busy} onClick={() => void simpan(true)}>
                          Simpan &amp; berikutnya ›
                        </button>
                      )}
                      <button type="button" className={btnGhost} disabled={busy} onClick={kembaliKeDaftar}>
                        {dirty ? 'Batal' : 'Tutup'}
                      </button>
                      <span className="ml-auto text-[11.5px] text-muted">
                        {dirty ? (
                          <span className="font-medium text-peach-500">● Belum disimpan</span>
                        ) : form.id ? (
                          'Tidak ada perubahan'
                        ) : null}
                        <span className="hidden xl:inline"> · Ctrl+S simpan</span>
                      </span>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {node}
      {dialogNode}
    </div>
  )
}
