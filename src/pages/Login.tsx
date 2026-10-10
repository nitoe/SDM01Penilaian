import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithEmail } from '../lib/auth'
import { isFirebaseConfigured } from '../lib/firebase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { profile } = await loginWithEmail(email, password)
      if (!profile) {
        setError(
          'Akun Auth berhasil, tetapi profil di Firestore belum ada. Minta admin membuat dokumen users/{uid}.',
        )
        return
      }
      if (profile.role === 'orangtua' && profile.status !== 'approved') {
        setError('Akun orang tua belum disetujui admin.')
        return
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
    'w-full rounded-2xl border border-border bg-slate-50/80 px-3.5 py-2.5 text-[14px] outline-none transition focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15'

  return (
    <div className="flex min-h-full items-stretch bg-surface-2 md:p-3">
      <div className="mx-auto flex w-full max-w-5xl overflow-hidden bg-white md:rounded-[28px] md:border md:border-border md:shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        {/* Panel merek (desktop) */}
        <div className="hero-banner hidden w-[44%] flex-col justify-between p-8 text-white lg:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
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
            <p className="mt-3 max-w-xs text-[13.5px] text-muh-100/85">
              Catat penilaian, pantau perkembangan siswa, dan siapkan rapor dalam satu tempat.
            </p>
          </div>
          <p className="text-[12px] text-muh-100/70">Khusus guru dan orang tua terdaftar</p>
        </div>

        {/* Formulir */}
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[380px]">
            <div className="mb-7 lg:hidden">
              <img src="/favicon-32.png" alt="" className="mb-3 h-11 w-11 rounded-2xl" />
              <p className="text-[15px] font-semibold text-slate-900">SDM 01 Kukusan</p>
              <p className="text-[12.5px] text-muted">Sistem Penilaian</p>
            </div>

            {!isFirebaseConfigured && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] font-medium text-amber-800">
                Firebase belum dikonfigurasi. Isi file <code className="font-mono">.env</code>.
              </div>
            )}

            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Masuk</h2>
            <p className="mt-1 text-[13px] text-muted">Gunakan akun yang didaftarkan admin.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-slate-600">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-medium text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-muh-600 px-3 py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-muh-700 disabled:opacity-60"
              >
                {loading ? 'Memproses…' : 'Masuk'}
              </button>
            </form>

            <p className="mt-8 text-center text-[12px] text-muted lg:text-left">
              SD Muhammadiyah 01 Kukusan · Internal
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
