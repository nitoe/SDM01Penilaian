import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type {
  JenisKata,
  JenisSetoran,
  StatusHafalan,
  SiswaTahsin,
} from '../../types/tahsin'
import { SEMUA_KELAS } from '../../types/tahsin'
import { getSiswaList, saveSetoran, updateTamatIqro } from '../../lib/tahsinData'
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

interface Props {
  profile: AppUser
}

const JENIS_OPTIONS: { value: JenisSetoran; label: string }[] = [
  { value: 'ziyadah', label: "Ziyadah" },
  { value: 'murojaah', label: "Muroja'ah" },
  { value: 'tahsin', label: 'Tahsin' },
]

export default function InputSetoran({ profile }: Props) {
  const scope = useMemo(
    () => ({ role: profile.role, kelasAmpu: profile.kelasAmpu }),
    [profile],
  )

  const kelasOptions = useMemo(() => {
    if (profile.role === 'admin') return [...SEMUA_KELAS]
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

  async function handleSimpan() {
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
      })

      showToast(`Setoran ${selected.nama.split(' ')[0]} tersimpan.`)
      setCatatan('')
      setStatusHafalan('lulus')
      // Siswa tetap terpilih (lanjut ayat berikutnya); tanda dan latihan dikosongkan.
      setTanda(bisaBacaTandai ? selaraskanRentang({}, ayatMulai, ayatAkhir) : {})
      setIqroTeks('')
      setIqroKata({})
    } catch (err) {
      console.error(err)
      showToast('Gagal menyimpan setoran. Coba lagi.', true)
    } finally {
      setSaving(false)
    }
  }

  const totalAyatNote =
    bacaQuran &&
    hitungTotalAyat(surahAwal, ayatMulai, surahAkhir, ayatAkhir)

  return (
    <div className="mx-auto max-w-xl space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/tahsin"
            className="text-[11px] font-medium text-muh-700 hover:underline"
          >
            ← Tahsin-Tahfizh
          </Link>
          <h1 className="mt-0.5 text-[15px] font-semibold text-slate-900">
            Input Setoran
          </h1>
          <p className="mt-0.5 text-[10.5px] text-muted">
            Catat setoran bacaan / hafalan siswa.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium ${
            toast.error
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-muh-200 bg-muh-50 text-muh-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Pilih siswa */}
      <section className="rounded-lg border border-border bg-white p-3">
        <h2 className="text-[12.5px] font-semibold text-slate-800">1. Pilih siswa</h2>

        <div className="mt-2 flex flex-wrap gap-1">
          {kelasOptions.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKelasFilter(k)
                setSelected(null)
              }}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                kelasFilter === k
                  ? 'bg-muh-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau NIS…"
          className="mt-2 w-full rounded-md border border-border px-2.5 py-1.5 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/20"
        />

        <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border">
          {loadingSiswa ? (
            <p className="p-3 text-center text-[12px] text-muted">Memuat siswa…</p>
          ) : filteredSiswa.length === 0 ? (
            <p className="p-3 text-center text-[12px] text-muted">
              Tidak ada siswa di kelas {kelasFilter}.
              <br />
              <span className="text-[11px]">
                Pastikan koleksi Firestore <code className="font-mono">siswa</code> terisi
                (field: nama, kelas, jenjang, aktif).
              </span>
            </p>
          ) : (
            filteredSiswa.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className={`flex w-full items-center gap-2 border-b border-border px-2.5 py-1.5 text-left transition last:border-0 ${
                  selected?.id === s.id
                    ? 'bg-muh-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muh-50 text-[10px] font-semibold text-muh-700">
                  {s.nama
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-slate-900">
                    {s.nama}
                  </div>
                  <div className="text-[10.5px] text-muted">
                    {s.kelas} · {s.jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"}
                    {s.nis ? ` · ${s.nis}` : ''}
                  </div>
                </div>
                {selected?.id === s.id && (
                  <span className="text-[11px] font-bold text-muh-700">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {selected && selected.jenjang === 'iqro' && (
          <label className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(selected.tamatIqro)}
              onChange={(e) => void handleTamatIqro(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-muh-600 focus:ring-muh-500"
            />
            <span className="font-medium">Sudah tamat Iqro (materi Al-Qur&apos;an)</span>
          </label>
        )}
      </section>

      {/* Form setoran — aktif setelah pilih siswa */}
      {selected && (
        <>
          <section className="rounded-lg border border-border bg-white p-3">
            <h2 className="text-[12.5px] font-semibold text-slate-800">
              2. Jenis & materi
            </h2>
            <p className="mt-1 text-[10.5px] text-muted">
              Siswa: <strong>{selected.nama}</strong> ({selected.kelas})
            </p>

            {/* Jenis */}
            <div className="mt-2 flex flex-wrap gap-1">
              {JENIS_OPTIONS.map((opt) => {
                const locked =
                  isIqroMurni && opt.value !== 'tahsin'
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={locked}
                    onClick={() => setJenis(opt.value)}
                    className={`rounded-xl px-3.5 py-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      jenis === opt.value
                        ? 'bg-muh-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Materi Quran */}
            {bacaQuran ? (
              <div className="mt-2.5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="surah-awal" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
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
                      className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                    >
                      {SURAH_LIST.map((s) => (
                        <option key={s.no} value={s.no}>
                          {s.no}. {s.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="surah-akhir" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                      Surah akhir
                    </label>
                    <select
                  id="surah-akhir"
                      value={surahAkhir}
                      onChange={(e) => setSurahAkhir(Number(e.target.value))}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                    >
                      {SURAH_LIST.filter((s) => s.no >= surahAwal).map((s) => (
                        <option key={s.no} value={s.no}>
                          {s.no}. {s.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="ayat-mulai" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                      Ayat mulai
                    </label>
                    <input
                  id="ayat-mulai"
                      type="number"
                      min={1}
                      max={surahByNo(surahAwal).ayat}
                      value={ayatMulai}
                      onChange={(e) => setAyatMulai(Number(e.target.value) || 1)}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="ayat-akhir" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                      Ayat akhir
                    </label>
                    <input
                  id="ayat-akhir"
                      type="number"
                      min={1}
                      max={surahByNo(surahAkhir).ayat}
                      value={ayatAkhir}
                      onChange={(e) => setAyatAkhir(Number(e.target.value) || 1)}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                    />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-muted">
                  Total: {totalAyatNote} ayat
                </p>
              </div>
            ) : (
              <div className="mt-2.5 space-y-2">
                <div>
                  <label htmlFor="buku-iqro" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                    Buku Iqro
                  </label>
                  <select
                  id="buku-iqro"
                    value={bukuIqro}
                    onChange={(e) => setBukuIqro(Number(e.target.value))}
                    className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        Iqro Jilid {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="hal-mulai" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                      Halaman mulai
                    </label>
                    <input
                  id="hal-mulai"
                      type="number"
                      min={1}
                      value={halMulai}
                      onChange={(e) => setHalMulai(Number(e.target.value) || 1)}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="hal-akhir" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                      Halaman akhir
                    </label>
                    <input
                  id="hal-akhir"
                      type="number"
                      min={1}
                      value={halAkhir}
                      onChange={(e) => setHalAkhir(Number(e.target.value) || 1)}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {bacaQuran ? (
            <section className="rounded-lg border border-border bg-white p-3">
              <h2 className="text-[12.5px] font-semibold text-slate-800">3. Baca &amp; Tandai</h2>
              {bisaBacaTandai ? (
                <div className="mt-2">
                  <BacaTandai
                    surah={surahAwal}
                    mulai={ayatMulai}
                    akhir={ayatAkhir}
                    tanda={tanda}
                    onChange={setTanda}
                  />
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted">
                  {surahAwal !== surahAkhir
                    ? 'Baca & Tandai hanya tersedia untuk rentang dalam satu surah.'
                    : 'Ayat akhir harus sama dengan atau lebih besar dari ayat mulai.'}
                </p>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-border bg-white p-3">
              <h2 className="text-[12.5px] font-semibold text-slate-800">
                3. Latihan membaca{' '}
                <span className="font-normal text-muted">(opsional)</span>
              </h2>
              <div className="mt-2">
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
              </div>
            </section>
          )}

          <section className="rounded-lg border border-border bg-white p-3">
            <h2 className="text-[12.5px] font-semibold text-slate-800">
              4. Penilaian & catatan
            </h2>

            {jenis !== 'tahsin' && (
              <div className="mt-2">
                <label htmlFor="status-hafalan" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                  Status hafalan
                </label>
                <select
                  id="status-hafalan"
                  value={statusHafalan}
                  onChange={(e) =>
                    setStatusHafalan(e.target.value as StatusHafalan)
                  }
                  className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px]"
                >
                  <option value="lulus">Lulus — lanjut materi berikutnya</option>
                  <option value="ulang">Perlu diulang</option>
                </select>
              </div>
            )}

            <div className="mt-2">
              <label htmlFor="catatan-guru" className="mb-0.5 block text-[10.5px] font-medium text-slate-500">
                Catatan guru (opsional)
              </label>
              <textarea
                  id="catatan-guru"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                placeholder="Catatan singkat…"
                className="w-full rounded-md border border-border px-2 py-1.5 text-[12.5px] outline-none focus:border-muh-500 focus:ring-4 focus:ring-muh-500/15"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSimpan()}
              className="mt-2.5 flex w-full items-center justify-center rounded-md bg-muh-600 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan Setoran'}
            </button>
          </section>
        </>
      )}
    </div>
  )
}
