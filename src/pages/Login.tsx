import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ambilNoticeLogin } from '../lib/akunGuru'
import { loginWithEmail, logout } from '../lib/auth'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { isFirebaseConfigured } from '../lib/firebase'
import { listPeriodeAktif } from '../lib/periode'
import type { PeriodeAkademik } from '../types/periode'
import { labelPeriode } from '../types/periode'

const STORAGE_KEY = 'sdm01.periodeId'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  const [periodeList, setPeriodeList] = useState<PeriodeAkademik[]>([])
  const [periodeLoading, setPeriodeLoading] = useState(true)
  const [tahunPilih, setTahunPilih] = useState('')
  const [semesterPilih, setSemesterPilih] = useState<'1' | '2' | ''>('')

  useEffect(() => {
    const notice = ambilNoticeLogin()
    if (notice) setError(notice)
  }, [])

  // Muat periode aktif di form login (tanpa auth) agar user memilih tahun + semester
  useEffect(() => {
    let batal = false
    setPeriodeLoading(true)
    void listPeriodeAktif()
      .then((list) => {
        if (batal) return
        setPeriodeList(list)
        const saved = localStorage.getItem(STORAGE_KEY)
        const fromSaved = list.find((p) => p.id === saved)
        const def = fromSaved ?? list.find((p) => p.isDefault) ?? list[0]
        if (def) {
          setTahunPilih(def.tahunAjaran)
          setSemesterPilih(def.semester)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!batal) setPeriodeList([])
      })
      .finally(() => {
        if (!batal) setPeriodeLoading(false)
      })
    return () => {
      batal = true
    }
  }, [])

  const daftarTahun = useMemo(() => {
    const set = new Set(periodeList.map((p) => p.tahunAjaran))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [periodeList])

  const daftarSemester = useMemo(() => {
    if (!tahunPilih) return [] as Array<'1' | '2'>
    const set = new Set(
      periodeList.filter((p) => p.tahunAjaran === tahunPilih).map((p) => p.semester),
    )
    return (Array.from(set) as Array<'1' | '2'>).sort()
  }, [periodeList, tahunPilih])

  const periodeTerpilih = useMemo(() => {
    if (!tahunPilih || !semesterPilih) return null
    return (
      periodeList.find((p) => p.tahunAjaran === tahunPilih && p.semester === semesterPilih) ?? null
    )
  }, [periodeList, tahunPilih, semesterPilih])

  // Jika tahun diganti dan semester tidak tersedia, reset semester
  useEffect(() => {
    if (!tahunPilih) return
    if (semesterPilih && !daftarSemester.includes(semesterPilih)) {
      setSemesterPilih(daftarSemester[0] ?? '')
    }
  }, [tahunPilih, daftarSemester, semesterPilih])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResetMsg(null)

    if (periodeList.length > 0 && !periodeTerpilih) {
      setError('Pilih tahun ajaran dan semester terlebih dahulu.')
      return
    }

    setLoading(true)
    try {
      const { profile } = await loginWithEmail(email, password)
      if (!profile) {
        setError(
          'Akun Auth berhasil, tetapi profil di Firestore belum ada. Minta admin membuat dokumen users/{uid}.',
        )
        return
      }
      if (profile.status === 'pending') {
        setError('Akun Anda belum disetujui admin. Tunggu persetujuan terlebih dahulu.')
        await logout()
        return
      }
      if (profile.status === 'rejected') {
        setError('Pendaftaran akun Anda ditolak. Hubungi administrator.')
        await logout()
        return
      }
      if (profile.role === 'orangtua' && profile.status !== 'approved') {
        setError('Akun orang tua belum disetujui admin.')
        await logout()
        return
      }
      if (profile.aktif === false) {
        ambilNoticeLogin()
        await logout()
        setError('Akun ini dinonaktifkan. Hubungi administrator.')
        return
      }

      if (periodeTerpilih) {
        localStorage.setItem(STORAGE_KEY, periodeTerpilih.id)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal masuk. Periksa email dan password.'
      if (
        msg.includes('invalid-credential') ||
        msg.includes('wrong-password') ||
        msg.includes('INVALID_LOGIN')
      ) {
        setError('Email atau password salah.')
      } else if (msg.includes('user-not-found')) {
        setError('Akun tidak ditemukan.')
      } else if (msg.includes('too-many-requests')) {
        setError('Terlalu banyak percobaan. Coba lagi nanti.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const field =
    'w-full rounded-lg border border-border bg-slate-50/80 px-3.5 py-2.5 text-[14px] outline-none transition focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15'

  return (
    <div className="flex min-h-full items-stretch bg-surface-2 md:p-3">
      <div className="mx-auto flex w-full max-w-5xl overflow-hidden bg-white md:rounded-2xl md:border md:border-border md:shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
        <div className="hero-banner hidden w-[44%] flex-col justify-between p-8 text-white lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <img src="/favicon-32.png" alt="" className="h-7 w-7" />
            </span>
            <span className="text-[15px] font-semibold">SDM 01 Kukusan</span>
          </div>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
              Sistem Penilaian
              <br />
              SD Muhammadiyah 01 Kukusan
            </h1>
            <p className="mt-3 max-w-xs text-[13px] text-muh-100/85">
              Catat penilaian, pantau perkembangan siswa, dan siapkan rapor dalam satu tempat.
              Pilih tahun ajaran dan semester saat masuk.
            </p>
          </div>
          <p className="text-[12px] text-muh-100/70">Khusus guru dan orang tua terdaftar</p>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[380px]">
            <div className="mb-7 lg:hidden">
              <img src="/favicon-32.png" alt="" className="mb-3 h-11 w-11 rounded-lg" />
              <p className="text-[15px] font-semibold text-slate-900">SDM 01 Kukusan</p>
              <p className="text-[12px] text-muted">Sistem Penilaian</p>
            </div>

            {!isFirebaseConfigured && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] font-medium text-amber-800">
                Firebase belum dikonfigurasi. Isi file <code className="font-mono">.env</code>.
              </div>
            )}

            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Masuk</h2>
            <p className="mt-1 text-[13px] text-muted">
              Pilih tahun ajaran & semester, lalu masuk dengan akun terdaftar.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
              {/* Periode: tahun + semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="tahun"
                    className="mb-1.5 block text-[12px] font-medium text-slate-600"
                  >
                    Tahun ajaran
                  </label>
                  <select
                    id="tahun"
                    className={field}
                    value={tahunPilih}
                    disabled={periodeLoading || daftarTahun.length === 0}
                    onChange={(e) => setTahunPilih(e.target.value)}
                    required={periodeList.length > 0}
                  >
                    {periodeLoading && <option value="">Memuat…</option>}
                    {!periodeLoading && daftarTahun.length === 0 && (
                      <option value="">Belum ada periode</option>
                    )}
                    {daftarTahun.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="semester"
                    className="mb-1.5 block text-[12px] font-medium text-slate-600"
                  >
                    Semester
                  </label>
                  <select
                    id="semester"
                    className={field}
                    value={semesterPilih}
                    disabled={periodeLoading || daftarSemester.length === 0}
                    onChange={(e) => setSemesterPilih(e.target.value as '1' | '2' | '')}
                    required={periodeList.length > 0}
                  >
                    {daftarSemester.length === 0 && <option value="">—</option>}
                    {daftarSemester.includes('1') && <option value="1">1 (Ganjil)</option>}
                    {daftarSemester.includes('2') && <option value="2">2 (Genap)</option>}
                  </select>
                </div>
              </div>

              {!periodeLoading && periodeList.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
                  Belum ada periode akademik aktif. Minta admin membuatnya di{' '}
                  <strong>Administrasi → Periode Akademik</strong>, lalu muat ulang halaman ini.
                </div>
              )}

              {periodeTerpilih && (
                <p className="text-[12px] text-muted">
                  Periode: <strong className="text-slate-700">{labelPeriode(periodeTerpilih)}</strong>
                  {periodeTerpilih.isDefault ? ' · default sekolah' : ''}
                </p>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-[12px] font-medium text-slate-600">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={field}
                  placeholder="nama@sekolah.sch.id"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[12px] font-medium text-slate-600"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={field + ' pr-20'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-muh-700"
                  >
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || periodeLoading || (periodeList.length > 0 && !periodeTerpilih)}
                className="flex w-full items-center justify-center rounded-lg bg-muh-600 px-3 py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-muh-700 disabled:opacity-60"
              >
                {loading ? 'Memproses…' : 'Masuk'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={async () => {
                  if (!email.trim()) {
                    setError('Isi email terlebih dahulu untuk mengatur ulang password.')
                    return
                  }
                  try {
                    await sendPasswordResetEmail(auth, email.trim().toLowerCase())
                    setResetMsg('Tautan atur ulang password telah dikirim ke email Anda.')
                    setError(null)
                  } catch {
                    setError('Gagal mengirim tautan. Periksa email.')
                  }
                }}
                className="text-[12px] font-medium text-muh-700 hover:underline"
              >
                Lupa password?
              </button>
              {resetMsg && <p className="mt-2 text-[12px] text-muh-800">{resetMsg}</p>}
            </div>

            <p className="mt-6 text-center text-[12px] text-muted">
              Belum punya akun?{' '}
              <Link to="/register" className="font-medium text-muh-700">
                Daftar sebagai guru
              </Link>
            </p>

            <p className="mt-4 text-center text-[12px] text-muted lg:text-left">
              SD Muhammadiyah 01 Kukusan · Internal
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
