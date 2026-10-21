import { useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { pesanGalatUbahPassword, ubahPasswordSendiri } from '../lib/auth'
import type { AppUser } from '../types/user'
import { namaDenganGelar } from '../types/user'
import { PageHeader } from '../components/ui'

interface Props {
  profile: AppUser
}

const field =
  'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

export default function ProfilSaya({ profile }: Props) {
  const [nama, setNama] = useState(profile.nama)
  const [gelar, setGelar] = useState(profile.gelar ?? '')
  const [busyProfil, setBusyProfil] = useState(false)
  const [msgProfil, setMsgProfil] = useState<string | null>(null)

  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [passwordKonfirmasi, setPasswordKonfirmasi] = useState('')
  const [busySandi, setBusySandi] = useState(false)
  const [msgSandi, setMsgSandi] = useState<string | null>(null)
  const [errSandi, setErrSandi] = useState<string | null>(null)

  async function handleSaveProfil(e: FormEvent) {
    e.preventDefault()
    setBusyProfil(true)
    setMsgProfil(null)
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        nama: nama.trim(),
        gelar: gelar.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      setMsgProfil('Profil berhasil diperbarui. Muat ulang halaman jika perlu.')
    } catch (err) {
      setMsgProfil(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setBusyProfil(false)
    }
  }

  async function handleUbahPassword(e: FormEvent) {
    e.preventDefault()
    setMsgSandi(null)
    setErrSandi(null)
    if (passwordBaru.trim().length < 8) {
      setErrSandi('Password baru minimal 8 karakter.')
      return
    }
    if (passwordBaru !== passwordKonfirmasi) {
      setErrSandi('Konfirmasi password baru tidak cocok.')
      return
    }
    setBusySandi(true)
    try {
      await ubahPasswordSendiri(passwordLama, passwordBaru)
      setPasswordLama('')
      setPasswordBaru('')
      setPasswordKonfirmasi('')
      setMsgSandi('Password berhasil diubah. Gunakan password baru saat masuk berikutnya.')
    } catch (err) {
      setErrSandi(pesanGalatUbahPassword(err))
    } finally {
      setBusySandi(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <PageHeader
        title="Pengaturan akun"
        subtitle="Perbarui nama yang tampil di rapor dan ubah password login Anda."
      />

      {/* —— Profil —— */}
      <section className="card-soft space-y-3 p-4">
        <h3 className="text-[14px] font-semibold text-slate-900">Data profil</h3>
        <p className="text-[12px] text-muted">
          Nama lengkap dengan gelar yang akan muncul di rapor:{' '}
          <strong className="text-slate-800">{namaDenganGelar({ nama, gelar })}</strong>
        </p>
        <p className="text-[12px] text-muted">
          Email login: <strong className="text-slate-700">{profile.email || '—'}</strong>
        </p>

        <form onSubmit={handleSaveProfil} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">Nama</span>
            <input
              className={field}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">
              Gelar pendidikan terakhir
            </span>
            <input
              className={field}
              value={gelar}
              onChange={(e) => setGelar(e.target.value)}
              placeholder="contoh: S.Pd"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={busyProfil}
            className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            {busyProfil ? 'Menyimpan…' : 'Simpan profil'}
          </button>
        </form>
        {msgProfil && <p className="text-[12px] text-muh-800">{msgProfil}</p>}
      </section>

      {/* —— Password —— */}
      <section className="card-soft space-y-3 p-4">
        <h3 className="text-[14px] font-semibold text-slate-900">Ubah password</h3>
        <p className="text-[12px] leading-snug text-muted">
          Masukkan password saat ini, lalu password baru (minimal 8 karakter). Password tidak
          disimpan di Firestore — hanya di Firebase Authentication.
        </p>

        <form onSubmit={handleUbahPassword} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">Password lama</span>
            <input
              type="password"
              className={field}
              value={passwordLama}
              onChange={(e) => setPasswordLama(e.target.value)}
              required
              autoComplete="current-password"
              minLength={1}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">Password baru</span>
            <input
              type="password"
              className={field}
              value={passwordBaru}
              onChange={(e) => setPasswordBaru(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-600">
              Konfirmasi password baru
            </span>
            <input
              type="password"
              className={field}
              value={passwordKonfirmasi}
              onChange={(e) => setPasswordKonfirmasi(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          <button
            type="submit"
            disabled={busySandi}
            className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
          >
            {busySandi ? 'Mengubah…' : 'Ubah password'}
          </button>
        </form>
        {msgSandi && <p className="text-[12px] font-medium text-muh-800">{msgSandi}</p>}
        {errSandi && <p className="text-[12px] font-medium text-red-700">{errSandi}</p>}
      </section>
    </div>
  )
}
