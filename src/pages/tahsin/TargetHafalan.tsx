import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppUser } from '../../types/user'
import { SEMUA_KELAS } from '../../types/tahsin'
import { getTargetHafalan, saveTargetHafalan } from '../../lib/tahsinData'
import { usePeriodeAkademik } from '../../lib/usePeriodeAkademik'
import { SURAH_LIST } from '../../lib/quranSurah'
import {
  SURAH_JUZ_29,
  SURAH_JUZ_30,
  bangunTarget,
  jenjangKelas,
  type TargetHafalan as Target,
} from '../../lib/target'

interface Props {
  profile: AppUser
}

const ringkasTarget = (t: Target | null | undefined): string => {
  if (!t) return 'Belum diatur'
  if (t.jenjang === 'iqro') return `Iqro ${t.targetJilid ?? 1} · hal. ${t.targetHalaman ?? 1}`
  const n = t.targetSurah?.length ?? 0
  return n ? `${n} surah` : 'Belum diatur'
}

/** Target hafalan per kelas: Iqro (jilid + halaman) untuk kelas 1–2, daftar surah untuk kelas 3–6. Format data sama dengan v2. */
export default function TargetHafalan({ profile }: Props) {
  const periodeAk = usePeriodeAkademik()
  const kelasOptions = useMemo(() => {
    if (profile.role === 'admin') return [...SEMUA_KELAS]
    return profile.kelasAmpu?.length ? profile.kelasAmpu : [...SEMUA_KELAS]
  }, [profile])

  const [kelas, setKelas] = useState<string>(kelasOptions[0] ?? '1A')
  const [semua, setSemua] = useState<Record<string, Target | null>>({})
  const [memuat, setMemuat] = useState(true)

  const [labelSemester, setLabelSemester] = useState('')
  const [surah, setSurah] = useState<Set<number>>(new Set())
  const [jilid, setJilid] = useState(1)
  const [halaman, setHalaman] = useState(1)
  const [menyimpan, setMenyimpan] = useState(false)
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)

  const jenjang = jenjangKelas(kelas)

  const tampilkan = useCallback((msg: string, error = false) => {
    setToast({ msg, error })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // Ringkasan target semua kelas untuk periode aktif.
  useEffect(() => {
    let batal = false
    setMemuat(true)
    const scope = periodeAk.ready
      ? { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester }
      : null
    Promise.all(kelasOptions.map((k) => getTargetHafalan(k, scope).catch(() => null))).then((hasil) => {
      if (batal) return
      setSemua(Object.fromEntries(kelasOptions.map((k, i) => [k, hasil[i] ?? null])))
      setMemuat(false)
    })
    return () => {
      batal = true
    }
  }, [kelasOptions, periodeAk.ready, periodeAk.tahunAjaran, periodeAk.semester])

  // Pilih kelas → isi formulir dari target tersimpan.
  useEffect(() => {
    const t = semua[kelas]
    setLabelSemester(t?.labelSemester ?? '')
    setSurah(new Set(t?.targetSurah ?? []))
    setJilid(t?.targetJilid ?? 1)
    setHalaman(t?.targetHalaman ?? 1)
  }, [kelas, semua])

  const totalAyat = useMemo(
    () => SURAH_LIST.filter((s) => surah.has(s.no)).reduce((n, s) => n + s.ayat, 0),
    [surah],
  )

  function alih(no: number) {
    setSurah((lama) => {
      const baru = new Set(lama)
      if (baru.has(no)) baru.delete(no)
      else baru.add(no)
      return baru
    })
  }

  async function simpan() {
    if (jenjang === 'quran' && surah.size === 0) {
      tampilkan('Pilih minimal satu surah target.', true)
      return
    }
    setMenyimpan(true)
    try {
      if (!periodeAk.ready) {
        tampilkan('Pilih periode akademik dulu (login ulang atau header).', true)
        return
      }
      const scope = { tahunAjaran: periodeAk.tahunAjaran, semester: periodeAk.semester }
      const data = bangunTarget(kelas, { labelSemester, surah, jilid, halaman })
      await saveTargetHafalan(kelas, data, scope)
      setSemua((lama) => ({
        ...lama,
        [kelas]: { ...data, kelas, tahunAjaran: scope.tahunAjaran, semester: scope.semester },
      }))
      tampilkan(`Target kelas ${kelas} · ${periodeAk.label} tersimpan.`)
    } catch (e) {
      console.error(e)
      tampilkan('Gagal menyimpan target. Anda hanya dapat mengubah target kelas yang Anda ampu.', true)
    } finally {
      setMenyimpan(false)
    }
  }

  const label = 'mb-1 block text-[11px] font-medium text-slate-500'
  const kontrol =
    'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none transition focus:border-muh-500 focus:ring-2 focus:ring-muh-500/20'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <Link to="/tahsin" className="text-[12px] font-medium text-muh-700 hover:underline">
            ← Tahsin-Tahfizh
          </Link>
          <h1 className="text-[18px] font-semibold tracking-tight text-slate-900">Target Hafalan</h1>
        </div>
        <p className="hidden text-[12px] text-muted md:block">{periodeAk.ready ? `Target per kelas · ${periodeAk.label}` : "Pilih periode dulu — target terikat tahun ajaran & semester"}</p>
      </div>

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
        {/* Daftar kelas + ringkasan target */}
        <aside className="card-soft p-3.5 lg:sticky lg:top-24" aria-label="Pilih kelas">
          <h2 className="text-[13px] font-semibold text-slate-800">Kelas</h2>
          <ul className="mt-2.5 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {kelasOptions.map((k) => {
              const aktif = k === kelas
              const t = semua[k]
              return (
                <li key={k}>
                  <button
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => setKelas(k)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                      aktif ? 'border-muh-300 bg-muh-50' : 'border-border bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-[13px] font-semibold ${aktif ? 'text-muh-700' : 'text-slate-800'}`}>{k}</span>
                    <span className={`text-[11px] ${t ? 'text-slate-600' : 'text-amber-700'}`}>
                      {memuat ? '…' : ringkasTarget(t)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Formulir target */}
        <div className="min-w-0 space-y-3">
          <section className="card-soft p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  Kelas {kelas}{' '}
                  <span className="font-normal text-muted">· {jenjang === 'iqro' ? 'Iqro' : "Al-Qur'an"}</span>
                </h2>
                <p className="text-[12px] text-muted">
                  {jenjang === 'iqro'
                    ? 'Tentukan jilid dan halaman yang ditargetkan.'
                    : 'Centang surah yang menjadi target hafalan kelas ini.'}
                </p>
              </div>
              <div className="w-full sm:w-72">
                <label htmlFor="label-semester" className={label}>
                  Label semester
                </label>
                <input
                  id="label-semester"
                  type="text"
                  value={labelSemester}
                  onChange={(e) => setLabelSemester(e.target.value)}
                  placeholder="Semester Ganjil 2026/2027"
                  className={kontrol}
                />
              </div>
            </div>

            {jenjang === 'iqro' ? (
              <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                <div>
                  <label htmlFor="target-jilid" className={label}>
                    Target jilid
                  </label>
                  <select
                    id="target-jilid"
                    value={jilid}
                    onChange={(e) => setJilid(Number(e.target.value))}
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
                  <label htmlFor="target-halaman" className={label}>
                    Target halaman
                  </label>
                  <input
                    id="target-halaman"
                    type="number"
                    min={1}
                    value={halaman}
                    onChange={(e) => setHalaman(Number(e.target.value) || 1)}
                    className={kontrol}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSurah(new Set(SURAH_JUZ_30))}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-muh-400"
                  >
                    Isi Juz 30 (An-Naba–An-Nas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurah(new Set(SURAH_JUZ_29))}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-muh-400"
                  >
                    Isi Juz 29 (Al-Mulk–Al-Mursalat)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurah(new Set())}
                    className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Kosongkan
                  </button>
                  <p className="ml-auto text-[12px] font-medium text-slate-600" aria-live="polite">
                    {surah.size} surah · {totalAyat} ayat
                  </p>
                </div>

                <ul className="mt-3 grid max-h-[28rem] grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-3 xl:grid-cols-4">
                  {SURAH_LIST.map((s) => (
                    <li key={s.no}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition ${
                          surah.has(s.no) ? 'bg-muh-50 text-muh-800' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={surah.has(s.no)}
                          onChange={() => alih(s.no)}
                          className="h-4 w-4 rounded border-border text-muh-600 focus:ring-muh-500"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {s.no}. {s.nama}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted">{s.ayat}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="sticky bottom-[4.25rem] z-20 md:bottom-3">
            <div className="card-soft flex items-center justify-between gap-3 p-3 shadow-lg">
              <p className="hidden text-[12px] text-muted sm:block">
                Target disimpan per kelas dan dipakai di Ringkasan Riwayat Siswa.
              </p>
              <button
                type="button"
                disabled={menyimpan}
                onClick={() => void simpan()}
                className="ml-auto whitespace-nowrap rounded-xl bg-muh-600 px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-muh-700 disabled:opacity-60"
              >
                {menyimpan ? 'Menyimpan…' : `Simpan target kelas ${kelas}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
