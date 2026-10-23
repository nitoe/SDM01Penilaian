import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppUser } from '../../types/user'
import type {
  AspekMenulis,
  JenisTugasMenulis,
  KesalahanMenulis,
  MateriSetoran,
  MenulisRecord,
  SiswaTahsin,
} from '../../types/tahsin'
import { JENIS_TUGAS_MENULIS_LABEL, KESALAHAN_MENULIS_LABEL, SEMUA_KELAS } from '../../types/tahsin'
import {
  deleteMenulis,
  formatTanggal,
  getMenulisLog,
  getSiswaList,
  saveMenulis,
} from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { SURAH_LIST, hitungTotalAyat, surahByNo } from '../../lib/quranSurah'
import { maxHalamanIqro } from '../../lib/iqroText'
import {
  ASPEK_INTI,
  ASPEK_KERAPIAN,
  LEVEL_MENULIS_LABEL,
  SKOR_AWAL,
  URUTAN_KESALAHAN,
  bangunKesalahan,
  bangunPenilaian,
  levelDariRata,
  rataInti,
  ringkasMenulis,
  urutTerbaru,
} from '../../lib/menulis'
import PanelSiswa from '../../components/PanelSiswa'
import { PageHeader } from '../../components/ui'

interface Props {
  profile: AppUser
}

const JENIS_TUGAS: { value: JenisTugasMenulis; label: string; hint: string }[] = [
  { value: 'salin', label: JENIS_TUGAS_MENULIS_LABEL.salin, hint: 'Siswa menyalin dari teks' },
  { value: 'dikte', label: JENIS_TUGAS_MENULIS_LABEL.dikte, hint: 'Guru mendiktekan, siswa menulis' },
  { value: 'hafalan', label: JENIS_TUGAS_MENULIS_LABEL.hafalan, hint: 'Siswa menulis dari hafalan' },
]

type SkorAspek = Record<AspekMenulis, number>

const SKOR_DEFAULT: SkorAspek = {
  hurufSambungan: SKOR_AWAL,
  harakat: SKOR_AWAL,
  keutuhanTeks: SKOR_AWAL,
}

function hariIni(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const labelCls = 'mb-1 block text-[11px] font-medium text-slate-500'
const kontrolCls =
  'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/20'

/** Empat tombol skor 1–4 (opsional: satu tombol "–" untuk tidak dinilai). */
function PilihSkor({
  nilai,
  onChange,
  nama,
  bolehKosong = false,
}: {
  nilai: number | null
  onChange: (v: number | null) => void
  nama: string
  bolehKosong?: boolean
}) {
  const pilihan: (number | null)[] = bolehKosong ? [null, 1, 2, 3, 4] : [1, 2, 3, 4]
  return (
    <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label={nama}>
      {pilihan.map((n) => {
        const aktif = nilai === n
        return (
          <button
            key={n === null ? 'kosong' : n}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onChange(n)}
            className={`min-w-[2.6rem] rounded-lg px-3 py-1.5 text-center transition ${
              aktif ? 'bg-muh-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="block text-[14px] font-semibold leading-tight">{n === null ? '–' : n}</span>
            <span className="hidden text-[9.5px] leading-tight opacity-80 sm:block">
              {n === null ? 'tidak' : LEVEL_MENULIS_LABEL[n as 1 | 2 | 3 | 4]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function CatatMenulis({ profile }: Props) {
  const periodeAk = usePeriodeAkademik()
  const scope = useMemo(() => ({ role: profile.role, kelasAmpu: profile.kelasAmpu }), [profile])
  const kelasOptions = useMemo(
    () => (profile.kelasAmpu?.length ? profile.kelasAmpu : [...SEMUA_KELAS]),
    [profile],
  )

  const [kelasFilter, setKelasFilter] = useState<string>(kelasOptions[0] || '1A')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[]>([])
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SiswaTahsin | null>(null)
  const [ganti, setGanti] = useState(true)

  const [jenisTugas, setJenisTugas] = useState<JenisTugasMenulis>('salin')
  const [tanggal, setTanggal] = useState(hariIni)

  // Materi Al-Qur'an (satu surah) atau Iqro
  const [surah, setSurah] = useState(1)
  const [ayatMulai, setAyatMulai] = useState(1)
  const [ayatAkhir, setAyatAkhir] = useState(7)
  const [bukuIqro, setBukuIqro] = useState(1)
  const [halMulai, setHalMulai] = useState(1)
  const [halAkhir, setHalAkhir] = useState(1)

  const [skor, setSkor] = useState<SkorAspek>(SKOR_DEFAULT)
  const [kerapian, setKerapian] = useState<number | null>(null)
  const [kesalahan, setKesalahan] = useState<KesalahanMenulis[]>([])
  const [catatan, setCatatan] = useState('')
  const [panduan, setPanduan] = useState(false)
  const [tampilKesalahan, setTampilKesalahan] = useState(false)

  const [riwayat, setRiwayat] = useState<MenulisRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [hapusId, setHapusId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 3200)
  }

  const loadSiswa = useCallback(async () => {
    setLoadingSiswa(true)
    try {
      setSiswaList(await getSiswaList(kelasFilter, scope))
    } catch (err) {
      console.error(err)
      showToast('Gagal memuat daftar siswa. Periksa rules & data koleksi siswa.', true)
      setSiswaList([])
    } finally {
      setLoadingSiswa(false)
    }
  }, [kelasFilter, scope])

  useEffect(() => {
    void loadSiswa()
  }, [loadSiswa])

  const filteredSiswa = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return siswaList
    return siswaList.filter((s) => s.nama.toLowerCase().includes(q) || (s.nis && s.nis.includes(q)))
  }, [siswaList, search])

  /** true = materi Al-Qur'an; Iqro hanya untuk siswa yang belum tamat Iqro. */
  const bacaQuran = selected ? selected.jenjang !== 'iqro' || Boolean(selected.tamatIqro) : true

  // Batasi ayat dan halaman sesuai data surah / jilid.
  useEffect(() => {
    const maks = surahByNo(surah).ayat
    if (ayatMulai > maks) setAyatMulai(1)
    if (ayatAkhir > maks) setAyatAkhir(maks)
    if (ayatAkhir < ayatMulai) setAyatAkhir(ayatMulai)
  }, [surah, ayatMulai, ayatAkhir])

  useEffect(() => {
    const maks = maxHalamanIqro(bukuIqro)
    if (halMulai > maks) setHalMulai(1)
    if (halAkhir > maks) setHalAkhir(maks)
    if (halAkhir < halMulai) setHalAkhir(halMulai)
  }, [bukuIqro, halMulai, halAkhir])

  const muatRiwayat = useCallback(async (s: SiswaTahsin | null) => {
    if (!s) {
      setRiwayat([])
      return [] as MenulisRecord[]
    }
    try {
      const list = urutTerbaru(await getMenulisLog(s.id, s.kelas))
      setRiwayat(list)
      return list
    } catch (err) {
      console.error(err)
      setRiwayat([])
      return [] as MenulisRecord[]
    }
  }, [])

  function kosongkanIsian() {
    setSkor(SKOR_DEFAULT)
    setKerapian(null)
    setKesalahan([])
    setCatatan('')
  }

  /** Mulai dari materi catatan terakhir supaya guru tidak mengetik ulang. */
  function isiDariTerakhir(terakhir: MenulisRecord | undefined) {
    const m = terakhir?.materi as
      | { tipe?: string; surahAwal?: number; ayatMulai?: number; ayatAkhir?: number; buku?: number; halamanMulai?: number; halamanAkhir?: number }
      | undefined
    if (m?.tipe === 'quran' && m.surahAwal && m.ayatMulai && m.ayatAkhir) {
      const maks = surahByNo(m.surahAwal).ayat
      const panjang = m.ayatAkhir - m.ayatMulai
      const mulai = m.ayatAkhir < maks ? m.ayatAkhir + 1 : m.ayatMulai
      setSurah(m.surahAwal)
      setAyatMulai(mulai)
      setAyatAkhir(Math.min(maks, mulai + panjang))
    } else if (m?.tipe === 'iqro' && m.buku) {
      setBukuIqro(m.buku)
      setHalMulai(m.halamanMulai ?? 1)
      setHalAkhir(m.halamanAkhir ?? m.halamanMulai ?? 1)
    }
  }

  async function pilihSiswa(s: SiswaTahsin) {
    setSelected(s)
    setGanti(false)
    kosongkanIsian()
    const list = await muatRiwayat(s)
    isiDariTerakhir(list[0])
  }

  const rataLive = rataInti(skor)
  const levelLive = rataLive != null ? levelDariRata(rataLive) : null

  const ringkasan = useMemo(
    () =>
      ringkasMenulis(
        riwayat,
        periodeAk.ready ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester } : null,
      ),
    [riwayat, periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester],
  )

  function bangunMateri(): MateriSetoran {
    if (bacaQuran) {
      return {
        tipe: 'quran',
        surahAwal: surah,
        ayatMulai,
        surahAkhir: surah,
        ayatAkhir,
        totalAyat: hitungTotalAyat(surah, ayatMulai, surah, ayatAkhir),
        label: `${surahByNo(surah).nama} ayat ${ayatMulai}-${ayatAkhir}`,
      }
    }
    return {
      tipe: 'iqro',
      buku: bukuIqro,
      halamanMulai: halMulai,
      halamanAkhir: halAkhir,
      label: `Iqro ${bukuIqro} — Hal. ${halMulai}${halAkhir !== halMulai ? '–' + halAkhir : ''}`,
    }
  }

  async function handleSimpan(berikutnya = false) {
    if (!selected) {
      showToast('Pilih siswa terlebih dahulu.', true)
      return
    }
    if (!periodeAk.ready) {
      showToast('Pilih periode akademik dulu (login ulang atau header).', true)
      return
    }
    if (!tanggal || tanggal > hariIni()) {
      showToast('Tanggal pemeriksaan tidak boleh kosong atau di masa depan.', true)
      return
    }
    if (bacaQuran ? ayatAkhir < ayatMulai : halAkhir < halMulai) {
      showToast(bacaQuran ? 'Ayat akhir tidak boleh lebih kecil dari ayat mulai.' : 'Halaman akhir tidak boleh lebih kecil dari halaman mulai.', true)
      return
    }
    setSaving(true)
    try {
      await saveMenulis({
        siswaId: selected.id,
        siswaNama: selected.nama,
        kelas: selected.kelas,
        jenjang: selected.jenjang,
        materi: bangunMateri(),
        jenisTugas,
        penilaian: bangunPenilaian({ ...skor, kerapian }),
        kesalahan: bangunKesalahan(kesalahan),
        catatan: catatan.trim(),
        tanggalPeriksa: tanggal,
        createdByNama: profile.nama,
        tahunAjaran: periodeAk.tahunAjaran,
        semester: periodeAk.semester,
      })
      showToast(`Penilaian menulis ${selected.nama.split(' ')[0]} tersimpan.`)
      kosongkanIsian()
      const idx = filteredSiswa.findIndex((x) => x.id === selected.id)
      const berikut = berikutnya ? filteredSiswa[idx + 1] : undefined
      if (berikut) void pilihSiswa(berikut)
      else {
        const list = await muatRiwayat(selected)
        isiDariTerakhir(list[0])
      }
    } catch (err) {
      console.error(err)
      showToast('Gagal menyimpan penilaian menulis. Coba lagi.', true)
    } finally {
      setSaving(false)
    }
  }

  async function handleHapus(r: MenulisRecord) {
    if (!window.confirm('Hapus catatan menulis ini? Tindakan ini tidak bisa dibatalkan.')) return
    setHapusId(r.id)
    try {
      await deleteMenulis(r.id)
      setRiwayat((prev) => prev.filter((x) => x.id !== r.id))
      showToast('Catatan dihapus.')
    } catch (err) {
      console.error(err)
      showToast('Gagal menghapus. Mungkin ini bukan catatan milik Anda sendiri.', true)
    } finally {
      setHapusId(null)
    }
  }

  function ubahKesalahan(k: KesalahanMenulis) {
    setKesalahan((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
  }

  const idxSelected = selected ? filteredSiswa.findIndex((x) => x.id === selected.id) : -1
  const adaBerikutnya = idxSelected >= 0 && idxSelected < filteredSiswa.length - 1

  return (
    <div className="space-y-3">
      <PageHeader
        back={{ to: '/tahsin', label: 'Tahsin-Tahfizh' }}
        title="Catat Menulis"
        subtitle={
          periodeAk.ready
            ? `Nilai tulisan siswa: huruf, harakat, dan kelengkapan · Periode ${periodeAk.label}`
            : 'Pilih periode di header atau login ulang agar penilaian tersimpan ke semester yang benar.'
        }
      />

      {toast && (
        <div
          role="status"
          className={`rounded-xl px-3.5 py-2 text-[12.5px] font-medium ${
            toast.error
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-muh-200 bg-muh-50 text-muh-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className={`lg:sticky lg:top-24 ${selected && !ganti ? 'hidden lg:block' : ''}`}>
          <PanelSiswa
            kelasOptions={kelasOptions}
            kelasFilter={kelasFilter}
            onKelas={(k) => {
              setKelasFilter(k)
              setSelected(null)
              setRiwayat([])
              setGanti(true)
            }}
            search={search}
            onSearch={setSearch}
            memuat={loadingSiswa}
            daftar={filteredSiswa}
            terpilih={selected}
            onPilih={(s) => void pilihSiswa(s)}
          />
        </aside>

        <div className="min-w-0 space-y-3">
          {!selected ? (
            <div className="card-soft flex min-h-[18rem] flex-col items-center justify-center px-6 py-12 text-center">
              <p className="text-[15px] font-semibold text-slate-900">Pilih siswa untuk mulai</p>
              <p className="mt-1 max-w-sm text-[12.5px] text-muted">
                Nilai tulisan dengan tiga aspek. Semua aspek sudah terisi “Baik”; ubah hanya yang berbeda.
              </p>
            </div>
          ) : (
            <>
              {/* Siswa + ringkasan periode */}
              <section className="card-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-semibold text-slate-900">{selected.nama}</h2>
                    <p className="text-[12px] text-muted">
                      Kelas {selected.kelas} · {bacaQuran ? "Al-Qur'an" : 'Iqro'}
                      {selected.nis ? ` · ${selected.nis}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGanti(true)}
                    className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-semibold text-muh-700 lg:hidden"
                  >
                    Ganti siswa
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px]">
                  <span className="text-muted">Periode ini:</span>
                  {ringkasan.jumlah === 0 ? (
                    <span className="text-slate-600">belum ada penilaian menulis</span>
                  ) : (
                    <>
                      <strong className="font-semibold text-slate-800">{ringkasan.jumlah} penilaian</strong>
                      {ringkasan.rata != null && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muh-700 ring-1 ring-border">
                          Rata-rata {ringkasan.rata}/4 · {levelDariRata(ringkasan.rata)}
                        </span>
                      )}
                      {ringkasan.tren && ringkasan.tren !== 'tetap' && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            ringkasan.tren === 'naik' ? 'bg-muh-50 text-muh-700' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {ringkasan.tren === 'naik' ? 'Naik dari sebelumnya' : 'Turun dari sebelumnya'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Konteks tugas dan materi */}
              <section className="card-soft p-4">
                <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                  <div>
                    <p className={labelCls}>Jenis tugas</p>
                    <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Jenis tugas menulis">
                      {JENIS_TUGAS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={jenisTugas === o.value}
                          title={o.hint}
                          onClick={() => setJenisTugas(o.value)}
                          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                            jenisTugas === o.value ? 'bg-white text-muh-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="tgl-periksa" className={labelCls}>
                      Tanggal diperiksa
                    </label>
                    <input
                      id="tgl-periksa"
                      type="date"
                      max={hariIni()}
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={`${kontrolCls} w-auto`}
                    />
                  </div>
                </div>

                {bacaQuran ? (
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-[minmax(0,2fr)_5.5rem_5.5rem]">
                    <div className="col-span-2 md:col-span-1">
                      <label htmlFor="menulis-surah" className={labelCls}>
                        Surah
                      </label>
                      <select
                        id="menulis-surah"
                        value={surah}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          setSurah(n)
                          setAyatMulai(1)
                          setAyatAkhir(Math.min(5, surahByNo(n).ayat))
                        }}
                        className={kontrolCls}
                      >
                        {SURAH_LIST.map((x) => (
                          <option key={x.no} value={x.no}>
                            {x.no}. {x.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="menulis-ayat-mulai" className={labelCls}>
                        Ayat mulai
                      </label>
                      <input
                        id="menulis-ayat-mulai"
                        type="number"
                        min={1}
                        max={surahByNo(surah).ayat}
                        value={ayatMulai}
                        onChange={(e) => setAyatMulai(Number(e.target.value) || 1)}
                        className={kontrolCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="menulis-ayat-akhir" className={labelCls}>
                        Ayat akhir
                      </label>
                      <input
                        id="menulis-ayat-akhir"
                        type="number"
                        min={1}
                        max={surahByNo(surah).ayat}
                        value={ayatAkhir}
                        onChange={(e) => setAyatAkhir(Number(e.target.value) || 1)}
                        className={kontrolCls}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5 md:max-w-xl">
                    <div>
                      <label htmlFor="menulis-iqro" className={labelCls}>
                        Buku Iqro
                      </label>
                      <select
                        id="menulis-iqro"
                        value={bukuIqro}
                        onChange={(e) => setBukuIqro(Number(e.target.value))}
                        className={kontrolCls}
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            Iqro Jilid {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="menulis-hal-mulai" className={labelCls}>
                        Halaman mulai
                      </label>
                      <input
                        id="menulis-hal-mulai"
                        type="number"
                        min={1}
                        max={maxHalamanIqro(bukuIqro)}
                        value={halMulai}
                        onChange={(e) => setHalMulai(Number(e.target.value) || 1)}
                        className={kontrolCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="menulis-hal-akhir" className={labelCls}>
                        Halaman akhir
                      </label>
                      <input
                        id="menulis-hal-akhir"
                        type="number"
                        min={1}
                        max={maxHalamanIqro(bukuIqro)}
                        value={halAkhir}
                        onChange={(e) => setHalAkhir(Number(e.target.value) || 1)}
                        className={kontrolCls}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Tiga aspek inti */}
              <section className="card-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14px] font-semibold text-slate-900">Penilaian</h2>
                  <div className="flex items-center gap-2">
                    {rataLive != null && levelLive && (
                      <span className="rounded-full bg-muh-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-muh-800">
                        Rata-rata {rataLive}/4 · {levelLive}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-expanded={panduan}
                      onClick={() => setPanduan((v) => !v)}
                      className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {panduan ? 'Tutup panduan' : 'Panduan skor'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 divide-y divide-border">
                  {ASPEK_INTI.map((a) => (
                    <div key={a.key} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 max-w-md">
                          <p className="text-[13px] font-semibold text-slate-900">{a.label}</p>
                          <p className="text-[11.5px] leading-snug text-muted">{a.periksa}</p>
                        </div>
                        <PilihSkor
                          nama={a.label}
                          nilai={skor[a.key]}
                          onChange={(v) => v != null && setSkor((prev) => ({ ...prev, [a.key]: v }))}
                        />
                      </div>
                      <p className="mt-1.5 text-[11.5px] font-medium text-muh-800">
                        {LEVEL_MENULIS_LABEL[skor[a.key] as 1 | 2 | 3 | 4]}: {a.level[skor[a.key] - 1]}
                      </p>
                    </div>
                  ))}
                </div>

                {panduan && (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[640px] text-left text-[11.5px]">
                      <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-2.5 py-2">Aspek</th>
                          {([4, 3, 2, 1] as const).map((n) => (
                            <th key={n} className="px-2.5 py-2">
                              {n} · {LEVEL_MENULIS_LABEL[n]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ASPEK_INTI.map((a) => (
                          <tr key={a.key} className="border-t border-border align-top">
                            <td className="px-2.5 py-2 font-semibold text-slate-800">{a.label}</td>
                            {[3, 2, 1, 0].map((i) => (
                              <td key={i} className="px-2.5 py-2 text-slate-600">
                                {a.level[i]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Aspek pelengkap */}
                <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0 max-w-md">
                    <p className="text-[12.5px] font-semibold text-slate-800">{ASPEK_KERAPIAN.label}</p>
                    <p className="text-[11.5px] leading-snug text-muted">{ASPEK_KERAPIAN.periksa}</p>
                    {kerapian != null && (
                      <p className="mt-1 text-[11.5px] font-medium text-slate-700">
                        {LEVEL_MENULIS_LABEL[kerapian as 1 | 2 | 3 | 4]}: {ASPEK_KERAPIAN.level[kerapian - 1]}
                      </p>
                    )}
                  </div>
                  <PilihSkor nama={ASPEK_KERAPIAN.label} nilai={kerapian} onChange={setKerapian} bolehKosong />
                </div>

                {/* Kesalahan umum (opsional) */}
                <div className="mt-3">
                  <button
                    type="button"
                    aria-expanded={tampilKesalahan}
                    onClick={() => setTampilKesalahan((v) => !v)}
                    className="text-[12px] font-semibold text-muh-700 hover:underline"
                  >
                    {tampilKesalahan || kesalahan.length ? '− Kesalahan umum' : '+ Kesalahan umum (opsional)'}
                    {kesalahan.length ? ` · ${kesalahan.length} dipilih` : ''}
                  </button>
                  {(tampilKesalahan || kesalahan.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Kesalahan umum">
                      {URUTAN_KESALAHAN.map((k) => {
                        const aktif = kesalahan.includes(k)
                        return (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={aktif}
                            onClick={() => ubahKesalahan(k)}
                            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                              aktif ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {KESALAHAN_MENULIS_LABEL[k]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Catatan sebelumnya */}
              {riwayat.length > 0 && (
                <section className="card-soft p-4">
                  <h2 className="text-[13px] font-semibold text-slate-800">Catatan sebelumnya</h2>
                  <ul className="mt-2 divide-y divide-border">
                    {riwayat.slice(0, 5).map((r) => {
                      const rata = rataInti(r.penilaian)
                      const milikSendiri = Boolean(r.createdBy) && r.createdBy === profile.uid
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {(r.materi as { label?: string } | undefined)?.label || 'Catatan menulis'}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              {r.jenisTugas ? `${JENIS_TUGAS_MENULIS_LABEL[r.jenisTugas]} · ` : ''}
                              {r.tanggalPeriksa || formatTanggal(r.createdAt)}
                              {rata != null ? ` · Rata-rata ${rata}/4` : ''}
                            </p>
                          </div>
                          {milikSendiri && (
                            <button
                              type="button"
                              disabled={hapusId === r.id}
                              onClick={() => void handleHapus(r)}
                              className="rounded-lg border border-red-200 px-2 py-0.5 text-[10.5px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {/* Bilah simpan: selalu terlihat (ANTIREGRESI §11.5) */}
              <div className="sticky bottom-[4.25rem] z-20 md:bottom-3">
                <div className="card-soft flex flex-col gap-2 p-2.5 shadow-lg lg:flex-row lg:items-end lg:gap-3 lg:p-3">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="catatan-menulis" className={`${labelCls} sr-only lg:not-sr-only`}>
                      Catatan guru (opsional)
                    </label>
                    <textarea
                      id="catatan-menulis"
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !saving) void handleSimpan()
                      }}
                      rows={1}
                      placeholder="Catatan guru (opsional)…"
                      title="Tekan Ctrl+Enter untuk menyimpan"
                      className={`${kontrolCls} field-sizing-content max-h-28 min-h-[2.4rem] resize-none`}
                    />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {adaBerikutnya && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSimpan(true)}
                        className="flex-1 whitespace-nowrap rounded-xl border border-muh-300 bg-white px-3 py-2 text-[12.5px] font-semibold text-muh-700 transition hover:bg-muh-50 disabled:opacity-60 lg:flex-none lg:px-4 lg:py-2.5 lg:text-[13px]"
                      >
                        Simpan &amp; berikutnya
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSimpan()}
                      className="flex-1 whitespace-nowrap rounded-xl bg-muh-600 px-5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-60 lg:flex-none lg:px-6 lg:py-2.5 lg:text-[13px]"
                    >
                      {saving ? 'Menyimpan…' : 'Simpan penilaian'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
