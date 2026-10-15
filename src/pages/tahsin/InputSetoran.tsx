import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppUser } from '../../types/user'
import type {
  JenisKata,
  JenisSetoran,
  SetoranRecord,
  StatusHafalan,
  SiswaTahsin,
} from '../../types/tahsin'
import { JENIS_LABEL, SEMUA_KELAS, STATUS_LABEL } from '../../types/tahsin'
import {
  formatTanggal,
  getRiwayatSetoran,
  getSiswaList,
  saveSetoran,
  updateTamatIqro,
} from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { rentangLanjutan } from '../../lib/lanjutan'
import { SURAH_LIST, surahByNo, hitungTotalAyat } from '../../lib/quranSurah'
import {
  bangunDetailAyat,
  bangunDetailIqro,
  ketukKata,
  selaraskanRentang,
  tandaKosong,
  type TandaPerAyat,
} from '../../lib/bacaTandai'
import { BacaTandai, KartuKataIqro } from '../../components/BacaTandai'
import PanelSiswa from '../../components/PanelSiswa'
import { PageHeader } from '../../components/ui'

interface Props {
  profile: AppUser
}

const JENIS_OPTIONS: { value: JenisSetoran; label: string }[] = [
  { value: 'ziyadah', label: "Ziyadah" },
  { value: 'murojaah', label: "Muroja'ah" },
  { value: 'tahsin', label: 'Tahsin' },
]

export default function InputSetoran({ profile }: Props) {
  const periodeAk = usePeriodeAkademik()
  const scope = useMemo(
    () => ({ role: profile.role, kelasAmpu: profile.kelasAmpu }),
    [profile],
  )

  const kelasOptions = useMemo(() => {
    return profile.kelasAmpu?.length ? profile.kelasAmpu : [...SEMUA_KELAS]
  }, [profile])

  const [kelasFilter, setKelasFilter] = useState<string>(kelasOptions[0] || '1A')
  const [siswaList, setSiswaList] = useState<SiswaTahsin[]>([])
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SiswaTahsin | null>(null)

  const [jenis, setJenis] = useState<JenisSetoran>('ziyadah')
  const [statusHafalan, setStatusHafalan] = useState<StatusHafalan>('lulus')
  const [catatan, setCatatan] = useState('')

  // Materi Quran
  const [surahAwal, setSurahAwal] = useState(1)
  const [ayatMulai, setAyatMulai] = useState(1)
  const [surahAkhir, setSurahAkhir] = useState(1)
  const [ayatAkhir, setAyatAkhir] = useState(7)

  // Materi Iqro
  const [bukuIqro, setBukuIqro] = useState(1)
  const [halMulai, setHalMulai] = useState(1)
  const [halAkhir, setHalAkhir] = useState(1)

  // Baca & Tandai (Al-Qur'an, satu surah) dan Latihan Membaca (Iqro)
  const [tanda, setTanda] = useState<TandaPerAyat>({})
  const [iqroTeks, setIqroTeks] = useState('')
  const [iqroKata, setIqroKata] = useState<Record<number, JenisKata>>({})

  // Mobile: daftar siswa diciutkan setelah memilih; setoran terakhir siswa untuk melanjutkan
  const [ganti, setGanti] = useState(true)
  const [terakhir, setTerakhir] = useState<SetoranRecord | null>(null)

  const [tampilCatatan, setTampilCatatan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 3200)
  }

  const loadSiswa = useCallback(async () => {
    setLoadingSiswa(true)
    try {
      const list = await getSiswaList(kelasFilter, scope)
      setSiswaList(list)
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

  // Batasi ayat saat ganti surah
  useEffect(() => {
    const maxA = surahByNo(surahAwal).ayat
    if (ayatMulai > maxA) setAyatMulai(1)
  }, [surahAwal, ayatMulai])

  useEffect(() => {
    const maxB = surahByNo(surahAkhir).ayat
    if (ayatAkhir > maxB) setAyatAkhir(maxB)
  }, [surahAkhir, ayatAkhir])

  const filteredSiswa = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return siswaList
    return siswaList.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        (s.nis && s.nis.includes(q)),
    )
  }, [siswaList, search])

  /** true = form pakai materi Al-Qur'an */
  const bacaQuran = selected
    ? selected.jenjang !== 'iqro' || Boolean(selected.tamatIqro)
    : true

  /** Kelas 1–2 (iqro murni) dikunci ke Tahsin */
  const isIqroMurni = selected?.jenjang === 'iqro' && !selected.tamatIqro

  useEffect(() => {
    if (isIqroMurni) setJenis('tahsin')
  }, [isIqroMurni])

  /** Baca & Tandai hanya untuk rentang dalam satu surah (sama dengan v2). */
  const bisaBacaTandai = bacaQuran && surahAwal === surahAkhir && ayatAkhir >= ayatMulai

  // Ganti siswa atau surah → tanda lama tidak berlaku lagi.
  useEffect(() => {
    setTanda({})
    setIqroTeks('')
    setIqroKata({})
  }, [selected?.id, surahAwal, surahAkhir])

  // Geser rentang ayat → tanda ayat yang masih ada di rentang dipertahankan.
  useEffect(() => {
    setTanda((prev) => (bisaBacaTandai ? selaraskanRentang(prev, ayatMulai, ayatAkhir) : {}))
  }, [bisaBacaTandai, ayatMulai, ayatAkhir])

  const muatTerakhir = useCallback(async (s: SiswaTahsin | null) => {
    if (!s) {
      setTerakhir(null)
      return
    }
    try {
      const scope =
        periodeAk.ready
          ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester }
          : null
      const list = await getRiwayatSetoran(s.id, s.kelas, scope)
      setTerakhir(list[0] ?? null)
    } catch (err) {
      console.error(err)
      setTerakhir(null)
    }
  }, [periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester])

  useEffect(() => {
    void muatTerakhir(selected)
  }, [selected?.id, muatTerakhir, periodeAk.tahunAjaran, periodeAk.semester]) // eslint-disable-line react-hooks/exhaustive-deps

  function pilihSiswa(s: SiswaTahsin) {
    setSelected(s)
    setGanti(false)
  }

  const usulan = useMemo(() => (bacaQuran ? rentangLanjutan(terakhir) : null), [bacaQuran, terakhir])

  function terapkanUsulan() {
    if (!usulan) return
    setSurahAwal(usulan.surah)
    setSurahAkhir(usulan.surah)
    setAyatMulai(usulan.mulai)
    setAyatAkhir(usulan.akhir)
    if (!isIqroMurni && terakhir && terakhir.jenis !== 'tahsin') setJenis(terakhir.jenis)
  }

  async function handleTamatIqro(checked: boolean) {
    if (!selected) return
    const ok = window.confirm(
      checked
        ? `Tandai ${selected.nama} sudah tamat Iqro? Form akan beralih ke materi Al-Qur'an.`
        : `Batalkan status tamat Iqro untuk ${selected.nama}?`,
    )
    if (!ok) return
    try {
      await updateTamatIqro(selected.id, checked)
      const updated = { ...selected, tamatIqro: checked }
      setSelected(updated)
      setSiswaList((prev) =>
        prev.map((s) => (s.id === selected.id ? updated : s)),
      )
      showToast(
        checked
          ? `${selected.nama.split(' ')[0]} ditandai tamat Iqro.`
          : 'Status tamat Iqro dibatalkan.',
      )
    } catch (err) {
      console.error(err)
      showToast('Gagal mengubah status tamat Iqro.', true)
    }
  }

  async function handleSimpan(berikutnya = false) {
    if (!selected) {
      showToast('Pilih siswa terlebih dahulu.', true)
      return
    }
    if (bacaQuran && surahAwal === surahAkhir && ayatAkhir < ayatMulai) {
      showToast('Ayat akhir tidak boleh lebih kecil dari ayat mulai.', true)
      return
    }
    setSaving(true)
    try {
      const materi = bacaQuran
        ? {
            tipe: 'quran' as const,
            surahAwal,
            ayatMulai,
            surahAkhir,
            ayatAkhir,
            totalAyat: hitungTotalAyat(surahAwal, ayatMulai, surahAkhir, ayatAkhir),
            label:
              surahAwal === surahAkhir
                ? `${surahByNo(surahAwal).nama} ayat ${ayatMulai}-${ayatAkhir}`
                : `${surahByNo(surahAwal).nama}:${ayatMulai} — ${surahByNo(surahAkhir).nama}:${ayatAkhir}`,
          }
        : {
            tipe: 'iqro' as const,
            buku: bukuIqro,
            halamanMulai: halMulai,
            halamanAkhir: halAkhir,
            label: `Iqro ${bukuIqro} — Hal. ${halMulai}${
              halAkhir !== halMulai ? '–' + halAkhir : ''
            }`,
          }

      if (!periodeAk.ready) {
        showToast('Pilih periode akademik dulu (login ulang atau header).', true)
        return
      }
      await saveSetoran({
        siswaId: selected.id,
        siswaNama: selected.nama,
        kelas: selected.kelas,
        jenjang: selected.jenjang,
        jenis,
        materi,
        detailAyat: bisaBacaTandai ? bangunDetailAyat(tanda) : [],
        detailBacaanIqro: bacaQuran ? null : bangunDetailIqro(iqroTeks, iqroKata),
        statusHafalan: jenis === 'tahsin' ? null : statusHafalan,
        catatan: catatan.trim(),
        createdByNama: profile.nama,
        tahunAjaran: periodeAk.tahunAjaran,
        semester: periodeAk.semester,
      })

      showToast(`Setoran ${selected.nama.split(' ')[0]} tersimpan.`)
      setCatatan('')
      setStatusHafalan('lulus')
      // Siswa tetap terpilih (lanjut ayat berikutnya); tanda dan latihan dikosongkan.
      setTanda(bisaBacaTandai ? selaraskanRentang({}, ayatMulai, ayatAkhir) : {})
      setIqroTeks('')
      setIqroKata({})
      const idx = filteredSiswa.findIndex((x) => x.id === selected.id)
      const berikut = berikutnya ? filteredSiswa[idx + 1] : undefined
      if (berikut) pilihSiswa(berikut)
      else void muatTerakhir(selected)
    } catch (err) {
      console.error(err)
      showToast('Gagal menyimpan setoran. Coba lagi.', true)
    } finally {
      setSaving(false)
    }
  }

  const totalAyatNote =
    bacaQuran && hitungTotalAyat(surahAwal, ayatMulai, surahAkhir, ayatAkhir)

  const idxSelected = selected ? filteredSiswa.findIndex((x) => x.id === selected.id) : -1
  const adaBerikutnya = idxSelected >= 0 && idxSelected < filteredSiswa.length - 1

  const label = 'mb-1 block text-[11px] font-medium text-slate-500'
  const kontrol =
    'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/20'

  return (
    <div className="space-y-3">
      <PageHeader
        back={{ to: '/tahsin', label: 'Tahsin-Tahfizh' }}
        title="Input Setoran"
        subtitle={
          periodeAk.ready
            ? `Catat setoran bacaan dan hafalan · Periode ${periodeAk.label}`
            : 'Pilih periode di header atau login ulang agar setoran tersimpan ke semester yang benar.'
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
        {/* Kiri: pilih siswa (HP: diciutkan setelah memilih) */}
        <aside className={`lg:sticky lg:top-24 ${selected && !ganti ? 'hidden lg:block' : ''}`}>
          <PanelSiswa
            kelasOptions={kelasOptions}
            kelasFilter={kelasFilter}
            onKelas={(k) => {
              setKelasFilter(k)
              setSelected(null)
              setGanti(true)
            }}
            search={search}
            onSearch={setSearch}
            memuat={loadingSiswa}
            daftar={filteredSiswa}
            terpilih={selected}
            onPilih={pilihSiswa}
          />
        </aside>

        {/* Kanan: area kerja */}
        <div className="min-w-0 space-y-3">
          {!selected ? (
            <div className="card-soft flex min-h-[18rem] flex-col items-center justify-center px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muh-50 text-muh-700">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
                  <path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                  <path d="M21 20v-1a4 4 0 0 0-3-3.87M16 4.13a3.5 3.5 0 0 1 0 6.74" />
                </svg>
              </span>
              <p className="mt-4 text-[15px] font-semibold text-slate-900">Pilih siswa untuk mulai</p>
              <p className="mt-1 max-w-xs text-[12.5px] text-muted">
                Pilih kelas dan siswa di daftar. Teks ayat, terjemahan, dan audio muncul di sini.
              </p>
            </div>
          ) : (
            <>
              {/* Siswa + setoran terakhir */}
              <section className="card-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muh-600 text-[14px] font-semibold text-white">
                      {selected.nama.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-semibold text-slate-900">{selected.nama}</h2>
                      <p className="text-[12px] text-muted">
                        Kelas {selected.kelas} · {bacaQuran ? "Al-Qur'an" : 'Iqro'}
                        {selected.nis ? ` · ${selected.nis}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGanti(true)}
                    className="rounded-lg border border-border px-2.5 py-1 text-[12px] font-semibold text-muh-700 lg:hidden"
                  >
                    Ganti siswa
                  </button>
                  {selected.jenjang === 'iqro' && (
                    <label className="flex w-full items-center gap-2 text-[12.5px] text-slate-700 lg:w-auto">
                      <input
                        type="checkbox"
                        checked={Boolean(selected.tamatIqro)}
                        onChange={(e) => void handleTamatIqro(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-muh-600 focus:ring-muh-500"
                      />
                      <span className="font-medium">Sudah tamat Iqro (materi Al-Qur&apos;an)</span>
                    </label>
                  )}
                </div>

                {terakhir && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px]">
                    <span className="text-muted">Setoran terakhir:</span>
                    <strong className="font-semibold text-slate-800">{terakhir.materi?.label ?? '—'}</strong>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 ring-1 ring-border">
                      {JENIS_LABEL[terakhir.jenis]}
                    </span>
                    {terakhir.statusHafalan && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                          terakhir.statusHafalan === 'lulus' ? 'bg-muh-50 text-muh-700' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {STATUS_LABEL[terakhir.statusHafalan]}
                      </span>
                    )}
                    <span className="text-muted">{formatTanggal(terakhir.createdAt)}</span>
                    {usulan && (
                      <button
                        type="button"
                        onClick={terapkanUsulan}
                        className="ml-auto rounded-lg bg-muh-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-muh-700"
                      >
                        {terakhir.statusHafalan === 'ulang' ? 'Ulangi' : 'Lanjutkan'}: {surahByNo(usulan.surah).nama}{' '}
                        {usulan.mulai}–{usulan.akhir}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* Jenis & materi */}
              <section className="card-soft p-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div>
                    <p className={label}>Jenis setoran</p>
                    <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Jenis setoran">
                      {JENIS_OPTIONS.map((opt) => {
                        const locked = isIqroMurni && opt.value !== 'tahsin'
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={locked}
                            aria-pressed={jenis === opt.value}
                            onClick={() => setJenis(opt.value)}
                            className={`rounded-lg px-4 py-1.5 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              jenis === opt.value
                                ? 'bg-white text-muh-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {bacaQuran && (
                    <p className="ml-auto self-end text-[12px] font-medium text-muted">Total: {totalAyatNote} ayat</p>
                  )}
                </div>

                {bacaQuran ? (
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_5.5rem_5.5rem]">
                    <div>
                      <label htmlFor="surah-awal" className={label}>
                        Surah awal
                      </label>
                      <select
                        id="surah-awal"
                        value={surahAwal}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          setSurahAwal(n)
                          setSurahAkhir(n)
                          setAyatMulai(1)
                          setAyatAkhir(Math.min(7, surahByNo(n).ayat))
                        }}
                        className={kontrol}
                      >
                        {SURAH_LIST.map((x) => (
                          <option key={x.no} value={x.no}>
                            {x.no}. {x.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="surah-akhir" className={label}>
                        Surah akhir
                      </label>
                      <select
                        id="surah-akhir"
                        value={surahAkhir}
                        onChange={(e) => setSurahAkhir(Number(e.target.value))}
                        className={kontrol}
                      >
                        {SURAH_LIST.filter((x) => x.no >= surahAwal).map((x) => (
                          <option key={x.no} value={x.no}>
                            {x.no}. {x.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ayat-mulai" className={label}>
                        Ayat mulai
                      </label>
                      <input
                        id="ayat-mulai"
                        type="number"
                        min={1}
                        max={surahByNo(surahAwal).ayat}
                        value={ayatMulai}
                        onChange={(e) => setAyatMulai(Number(e.target.value) || 1)}
                        className={kontrol}
                      />
                    </div>
                    <div>
                      <label htmlFor="ayat-akhir" className={label}>
                        Ayat akhir
                      </label>
                      <input
                        id="ayat-akhir"
                        type="number"
                        min={1}
                        max={surahByNo(surahAkhir).ayat}
                        value={ayatAkhir}
                        onChange={(e) => setAyatAkhir(Number(e.target.value) || 1)}
                        className={kontrol}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5 md:max-w-xl">
                    <div>
                      <label htmlFor="buku-iqro" className={label}>
                        Buku Iqro
                      </label>
                      <select
                        id="buku-iqro"
                        value={bukuIqro}
                        onChange={(e) => setBukuIqro(Number(e.target.value))}
                        className={kontrol}
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            Iqro Jilid {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="hal-mulai" className={label}>
                        Halaman mulai
                      </label>
                      <input
                        id="hal-mulai"
                        type="number"
                        min={1}
                        value={halMulai}
                        onChange={(e) => setHalMulai(Number(e.target.value) || 1)}
                        className={kontrol}
                      />
                    </div>
                    <div>
                      <label htmlFor="hal-akhir" className={label}>
                        Halaman akhir
                      </label>
                      <input
                        id="hal-akhir"
                        type="number"
                        min={1}
                        value={halAkhir}
                        onChange={(e) => setHalAkhir(Number(e.target.value) || 1)}
                        className={kontrol}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Baca & Tandai / Latihan membaca */}
              <section className="card-soft p-4">
                {bacaQuran ? (
                  <>
                    <h2 className="mb-3 text-[14px] font-semibold text-slate-900">Baca &amp; Tandai</h2>
                    {bisaBacaTandai ? (
                      <BacaTandai
                        surah={surahAwal}
                        mulai={ayatMulai}
                        akhir={ayatAkhir}
                        tanda={tanda}
                        onChange={setTanda}
                      />
                    ) : (
                      <p className="text-[12.5px] text-muted">
                        {surahAwal !== surahAkhir
                          ? 'Baca & Tandai hanya tersedia untuk rentang dalam satu surah.'
                          : 'Ayat akhir harus sama dengan atau lebih besar dari ayat mulai.'}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="mb-3 text-[14px] font-semibold text-slate-900">
                      Latihan membaca <span className="font-normal text-muted">(opsional)</span>
                    </h2>
                    <KartuKataIqro
                      teks={iqroTeks}
                      kata={iqroKata}
                      onBuat={(t) => {
                        setIqroTeks(t)
                        setIqroKata({})
                      }}
                      onKetuk={(i) => {
                        const hasil = ketukKata({ ...tandaKosong(), kata: iqroKata }, i)
                        setIqroKata(hasil.kata)
                      }}
                    />
                  </>
                )}
              </section>

              {/* Bilah simpan: selalu terlihat, tanpa menggulir ke bawah */}
              <div className="sticky bottom-[4.25rem] z-20 md:bottom-3">
                <div className="card-soft flex flex-col gap-2 p-2.5 shadow-lg lg:flex-row lg:items-end lg:gap-3 lg:p-3">
                  <div className="flex items-end justify-between gap-2 lg:contents">
                    {jenis !== 'tahsin' && (
                      <div className="shrink-0">
                        <p className={`${label} sr-only lg:not-sr-only`}>Status hafalan</p>
                        <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Status hafalan">
                          {(['lulus', 'ulang'] as StatusHafalan[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              role="radio"
                              aria-checked={statusHafalan === st}
                              onClick={() => setStatusHafalan(st)}
                              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition lg:px-3.5 ${
                                statusHafalan === st
                                  ? st === 'lulus'
                                    ? 'bg-muh-600 text-white shadow-sm'
                                    : 'bg-amber-500 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {STATUS_LABEL[st]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setTampilCatatan((v) => !v)}
                      aria-expanded={tampilCatatan || Boolean(catatan)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 lg:hidden"
                    >
                      {tampilCatatan || catatan ? 'Catatan ▲' : '+ Catatan'}
                    </button>
                  </div>
                  <div className={`min-w-0 flex-1 ${tampilCatatan || catatan ? '' : 'hidden'} lg:block`}>
                    <label htmlFor="catatan-guru" className={`${label} sr-only lg:not-sr-only`}>
                      Catatan guru (opsional)
                    </label>
                    <textarea
                      id="catatan-guru"
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !saving) void handleSimpan()
                      }}
                      rows={1}
                      placeholder="Catatan guru (opsional)…"
                      title="Tekan Ctrl+Enter untuk menyimpan"
                      className={`${kontrol} field-sizing-content max-h-28 min-h-[2.4rem] resize-none`}
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
                      {saving ? 'Menyimpan…' : 'Simpan setoran'}
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