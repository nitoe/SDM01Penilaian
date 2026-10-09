import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import type {
  JenisSetoran,
  StatusHafalan,
  SiswaTahsin,
} from '../../types/tahsin'
import { SEMUA_KELAS } from '../../types/tahsin'
import { getSiswaList, saveSetoran, updateTamatIqro } from '../../lib/tahsinData'
import { SURAH_LIST, surahByNo, hitungTotalAyat } from '../../lib/quranSurah'

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
        detailAyat: [],
        detailBacaanIqro: null,
        statusHafalan: jenis === 'tahsin' ? null : statusHafalan,
        catatan: catatan.trim(),
        createdByNama: profile.nama,
      })

      showToast(`Setoran ${selected.nama.split(' ')[0]} tersimpan.`)
      setCatatan('')
      setStatusHafalan('lulus')
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
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/tahsin"
            className="text-xs font-bold text-muh-700 hover:underline"
          >
            ← Tahsin-Tahfizh
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900">
            Input Setoran
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Catat setoran bacaan / hafalan siswa.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
            toast.error
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-muh-200 bg-muh-50 text-muh-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Pilih siswa */}
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-extrabold text-slate-800">1. Pilih siswa</h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {kelasOptions.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKelasFilter(k)
                setSelected(null)
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                kelasFilter === k
                  ? 'bg-muh-700 text-white'
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
          className="mt-3 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-muh-500 focus:ring-4 focus:ring-muh-500/15"
        />

        <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-border">
          {loadingSiswa ? (
            <p className="p-4 text-center text-sm text-muted">Memuat siswa…</p>
          ) : filteredSiswa.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">
              Tidak ada siswa di kelas {kelasFilter}.
              <br />
              <span className="text-xs">
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
                className={`flex w-full items-center gap-3 border-b border-border px-3.5 py-2.5 text-left transition last:border-0 ${
                  selected?.id === s.id
                    ? 'bg-muh-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muh-100 text-xs font-extrabold text-muh-800">
                  {s.nama
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {s.nama}
                  </div>
                  <div className="text-[11px] text-muted">
                    {s.kelas} · {s.jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"}
                    {s.nis ? ` · ${s.nis}` : ''}
                  </div>
                </div>
                {selected?.id === s.id && (
                  <span className="text-xs font-bold text-muh-700">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {selected && selected.jenjang === 'iqro' && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(selected.tamatIqro)}
              onChange={(e) => void handleTamatIqro(e.target.checked)}
              className="h-4 w-4 rounded border-border text-muh-700 focus:ring-muh-500"
            />
            <span className="font-medium">Sudah tamat Iqro (materi Al-Qur&apos;an)</span>
          </label>
        )}
      </section>

      {/* Form setoran — aktif setelah pilih siswa */}
      {selected && (
        <>
          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-extrabold text-slate-800">
              2. Jenis & materi
            </h2>
            <p className="mt-1 text-xs text-muted">
              Siswa: <strong>{selected.nama}</strong> ({selected.kelas})
            </p>

            {/* Jenis */}
            <div className="mt-3 flex flex-wrap gap-2">
              {JENIS_OPTIONS.map((opt) => {
                const locked =
                  isIqroMurni && opt.value !== 'tahsin'
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={locked}
                    onClick={() => setJenis(opt.value)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      jenis === opt.value
                        ? 'bg-muh-700 text-white'
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
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      Surah awal
                    </label>
                    <select
                      value={surahAwal}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        setSurahAwal(n)
                        setSurahAkhir(n)
                        setAyatMulai(1)
                        setAyatAkhir(Math.min(7, surahByNo(n).ayat))
                      }}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      {SURAH_LIST.map((s) => (
                        <option key={s.no} value={s.no}>
                          {s.no}. {s.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      Surah akhir
                    </label>
                    <select
                      value={surahAkhir}
                      onChange={(e) => setSurahAkhir(Number(e.target.value))}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      {SURAH_LIST.filter((s) => s.no >= surahAwal).map((s) => (
                        <option key={s.no} value={s.no}>
                          {s.no}. {s.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      Ayat mulai
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={surahByNo(surahAwal).ayat}
                      value={ayatMulai}
                      onChange={(e) => setAyatMulai(Number(e.target.value) || 1)}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      Ayat akhir
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={surahByNo(surahAkhir).ayat}
                      value={ayatAkhir}
                      onChange={(e) => setAyatAkhir(Number(e.target.value) || 1)}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted">
                  Total: {totalAyatNote} ayat
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">
                    Buku Iqro
                  </label>
                  <select
                    value={bukuIqro}
                    onChange={(e) => setBukuIqro(Number(e.target.value))}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        Iqro Jilid {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      Halaman mulai
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={halMulai}
                      onChange={(e) => setHalMulai(Number(e.target.value) || 1)}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      Halaman akhir
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={halAkhir}
                      onChange={(e) => setHalAkhir(Number(e.target.value) || 1)}
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-extrabold text-slate-800">
              3. Penilaian & catatan
            </h2>

            {jenis !== 'tahsin' && (
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-bold text-slate-500">
                  Status hafalan
                </label>
                <select
                  value={statusHafalan}
                  onChange={(e) =>
                    setStatusHafalan(e.target.value as StatusHafalan)
                  }
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <option value="lulus">Lulus</option>
                  <option value="mengulang">Mengulang</option>
                  <option value="belum">Belum</option>
                </select>
              </div>
            )}

            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-bold text-slate-500">
                Catatan guru (opsional)
              </label>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={3}
                placeholder="Catatan singkat…"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-muh-500 focus:ring-4 focus:ring-muh-500/15"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSimpan()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-muh-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-muh-800 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan Setoran'}
            </button>
          </section>
        </>
      )}
    </div>
  )
}
