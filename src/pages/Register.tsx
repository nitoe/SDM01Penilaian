import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { GURU_RESMI, adalahNamaResmi } from '../lib/dataGuruResmi'

export default function Register() {
  const navigate = useNavigate()
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gelar, setGelar] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sukses, setSukses] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!adalahNamaResmi(nama)) {
      setError('Pilih nama guru dari daftar yang tersedia.')
      return
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.')
      return
    }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: email.trim().toLowerCase(),
        nama: nama.trim(),
        gelar: gelar.trim() || undefined,
        role: 'guru', // sementara, admin akan menyesuaikan peran
        status: 'pending',
        aktif: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setSukses(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftar'
      if (msg.includes('email-already-in-use')) {
        setError('Email ini sudah terdaftar.')
      } else if (msg.includes('weak-password')) {
        setError('Password terlalu lemah.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const field =
    'w-full rounded-2xl border border-border bg-slate-50/80 px-3.5 py-2.5 text-[14px] outline-none transition focus:border-muh-500 focus:bg-white focus:ring-2 focus:ring-muh-500/15'

  if (sukses) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface-2 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Pendaftaran berhasil</h2>
          <p className="mt-2 text-[13px] text-muted">
            Akun Anda menunggu persetujuan admin. Setelah disetujui, Anda dapat masuk.
          </p>
          <Link to="/login" className="mt-4 inline-block rounded-xl bg-muh-600 px-4 py-2 text-sm font-semibold text-white">
            Ke halaman masuk
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-2 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Akun Guru</h2>
        <p className="mt-1 text-[12px] text-muted">
          Pilih nama Anda dari daftar resmi agar konsisten. Admin akan menyetujui akun ini.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Nama guru</label>
            <select
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className={field}
            >
              <option value="">— Pilih nama —</option>
              {GURU_RESMI.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
              placeholder="nama@sekolah.sch.id"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field + ' pr-20'}
                placeholder="Minimal 8 karakter"
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

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-slate-600">
              Gelar pendidikan terakhir <span className="text-muted">(opsional)</span>
            </label>
            <input
              type="text"
              value={gelar}
              onChange={(e) => setGelar(e.target.value)}
              className={field}
              placeholder="contoh: S.Pd"
            />
            <p className="mt-1 text-[11px] text-muted">
              Akan muncul di penandatanganan rapor, mis. “Arif Azwar Anas, S.Pd”.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-muh-600 px-3 py-3 text-[14px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            {loading ? 'Mendaftar…' : 'Daftar'}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-muted">
          Sudah punya akun? <Link to="/login" className="font-medium text-muh-700">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
