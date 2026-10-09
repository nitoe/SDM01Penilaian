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
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('INVALID_LOGIN')) {
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
    <div className="flex min-h-full items-center justify-center bg-surface-2 px-4 py-8">
      <div className="w-full max-w-[360px]">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-muh-600 text-xs font-bold text-white">
            SD
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900">SDM 01 Kukusan</h1>
          <p className="mt-0.5 text-[11px] text-muted">Sistem Penilaian · Portal Guru</p>
        </div>

        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          {!isFirebaseConfigured && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
              Firebase belum dikonfigurasi. Isi file <code className="font-mono">.env</code>.
            </div>
          )}

          <h2 className="text-[13px] font-semibold text-slate-900">Masuk</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Gunakan akun yang didaftarkan admin.
          </p>

          <form onSubmit={handleSubmit} className="mt-3.5 space-y-2.5">
            <div>
              <label htmlFor="email" className="mb-1 block text-[11px] font-medium text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-muh-500 focus:ring-2 focus:ring-muh-500/20"
                placeholder="nama@sekolah.sch.id"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-[11px] font-medium text-slate-600">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-muh-500 focus:ring-2 focus:ring-muh-500/20"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-muh-600 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-muh-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Memproses…' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted">
          SD Muhammadiyah 01 Kukusan · Internal
        </p>
      </div>
    </div>
  )
}
