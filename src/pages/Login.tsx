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
      // Pesan Firebase yang lebih ramah
      if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
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

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-br from-muh-950 via-muh-900 to-muh-800 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-extrabold text-gold-400 ring-1 ring-white/15 backdrop-blur">
            SD
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            SDM 01 Kukusan
          </h1>
          <p className="mt-1 text-sm font-medium text-muh-200">
            Sistem Penilaian · Portal Guru & Admin
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          {!isFirebaseConfigured && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              Firebase belum dikonfigurasi. Isi file <code className="font-mono">.env</code>{' '}
              sesuai panduan di <code className="font-mono">docs/SETUP_FIREBASE.md</code>.
            </div>
          )}

          <h2 className="text-lg font-extrabold text-slate-900">Masuk</h2>
          <p className="mt-1 text-sm text-muted">
            Gunakan akun email yang sudah didaftarkan admin.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-muh-500 focus:ring-4 focus:ring-muh-500/15"
                placeholder="nama@sekolah.sch.id"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-bold text-slate-600"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-muh-500 focus:ring-4 focus:ring-muh-500/15"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-muh-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-muh-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Memproses…
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-muh-300">
          SD Muhammadiyah 01 Kukusan · Internal
        </p>
      </div>
    </div>
  )
}
