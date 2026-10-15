import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ambilNoticeLogin } from '../lib/akunGuru'
import { loginWithEmail, logout } from '../lib/auth'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
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

  const submitDisabled =
    loading || periodeLoading || (periodeList.length > 0 && !periodeTerpilih)

  return (
    <div className="auth-shell">
      {/* ── Left brand panel ───────────────────────────────────────── */}
      <aside className="auth-brand hidden lg:flex">
        <div className="auth-brand-glow" aria-hidden />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          <div className="flex items-center gap-3">
            <span className="auth-logo-tile">
              <img src="/favicon-32.png" alt="" className="h-7 w-7" />
            </span>
            <div>
              <p className="text-[15px] font-medium tracking-tight text-white">SDM 01 Kukusan</p>
              <p className="text-[12px] font-light text-white/70">Sistem Penilaian</p>
            </div>
          </div>

          <div className="max-w-[360px]">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
              Portal internal
            </p>
            <h1 className="auth-display text-white">
              Satu tempat untuk
              <br />
              penilaian &amp; rapor
            </h1>
            <p className="mt-5 text-[15px] font-light leading-relaxed text-white/78">
              Catat nilai harian, pantau progres siswa, dan siapkan rapor semester — dengan
              periode akademik yang jelas.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                'Nilai SLM, STS, dan SAS per mapel',
                'Setoran Tahsin & target hafalan',
                'Rapor siap cetak untuk wali kelas',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13.5px] font-light text-white/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] font-light text-white/50">
            Khusus guru &amp; orang tua terdaftar · SD Muhammadiyah 01 Kukusan
          </p>
        </div>
      </aside>

      {/* ── Right form panel ───────────────────────────────────────── */}
      <main className="auth-form-panel">
        <div className="auth-form-card">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="auth-logo-tile auth-logo-tile--light">
              <img src="/favicon-32.png" alt="" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[14px] font-medium text-[#0d253d]">SDM 01 Kukusan</p>
              <p className="text-[12px] font-light text-[#64748d]">Sistem Penilaian</p>
            </div>
          </div>

          {!isFirebaseConfigured && (
            <div className="auth-alert auth-alert--warn mb-5">
              Firebase belum dikonfigurasi. Isi file <code className="font-mono text-[12px]">.env</code>.
            </div>
          )}

          <header className="mb-7">
            <h2 className="auth-display auth-display--sm text-[#0d253d]">Masuk</h2>
            <p className="mt-2 text-[14px] font-light leading-relaxed text-[#64748d]">
              Pilih tahun ajaran &amp; semester, lalu masuk dengan akun terdaftar.
            </p>
          </header>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="auth-field">
                <label htmlFor="tahun">Tahun ajaran</label>
                <select
                  id="tahun"
                  value={tahunPilih}
                  disabled={periodeLoading || daftarTahun.length === 0}
                  onChange={(e) => setTahunPilih(e.target.value)}
                  required={periodeList.length > 0}
                >
                  {periodeLoading && <option value="">Memuat…</option>}
                  {!periodeLoading && daftarTahun.length === 0 && (
                    <option value="">Belum ada</option>
                  )}
                  {daftarTahun.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="auth-field">
                <label htmlFor="semester">Semester</label>
                <select
                  id="semester"
                  value={semesterPilih}
                  disabled={periodeLoading || daftarSemester.length === 0}
                  onChange={(e) => setSemesterPilih(e.target.value as '1' | '2' | '')}
                  required={periodeList.length > 0}
                >
                  {daftarSemester.length === 0 && <option value="">—</option>}
                  {daftarSemester.includes('1') && <option value="1">1 · Ganjil</option>}
                  {daftarSemester.includes('2') && <option value="2">2 · Genap</option>}
                </select>
              </div>
            </div>

            {!periodeLoading && periodeList.length === 0 && (
              <div className="auth-alert auth-alert--warn">
                Belum ada periode akademik aktif. Minta admin membuatnya di{' '}
                <strong>Administrasi → Periode Akademik</strong>, lalu muat ulang halaman ini.
              </div>
            )}

            {periodeTerpilih && (
              <p className="rounded-lg bg-[#f6f9fc] px-3 py-2 text-[12.5px] font-light text-[#64748d]">
                Periode aktif:{' '}
                <span className="font-medium text-[#0d253d]">{labelPeriode(periodeTerpilih)}</span>
                {periodeTerpilih.isDefault ? (
                  <span className="ml-1.5 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-medium text-[#4434d4]">
                    default
                  </span>
                ) : null}
              </p>
            )}

            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sekolah.sch.id"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-ghost-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="auth-alert auth-alert--error">
                {error}
              </div>
            )}

            <button type="submit" className="auth-btn-primary" disabled={submitDisabled}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="auth-spinner" aria-hidden />
                  Memproses…
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-3">
            <button
              type="button"
              className="auth-link"
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
            >
              Lupa password?
            </button>
            {resetMsg && <p className="text-[13px] font-medium text-[#4434d4]">{resetMsg}</p>}
          </div>

          <div className="auth-divider" />

          <p className="text-center text-[13.5px] font-light text-[#64748d]">
            Belum punya akun?{' '}
            <Link to="/register" className="auth-link">
              Daftar sebagai guru
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
