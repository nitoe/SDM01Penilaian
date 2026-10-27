import { useRef, useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { pesanGalatUbahPassword, ubahPasswordSendiri } from '../lib/auth'
import { hapusTtdSendiri, unggahTtdSendiri } from '../lib/tandaTangan'
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
  const [nbm, setNbm] = useState(profile.nbm ?? '')
  const [busyProfil, setBusyProfil] = useState(false)
  const [msgProfil, setMsgProfil] = useState<string | null>(null)

  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [passwordKonfirmasi, setPasswordKonfirmasi] = useState('')
  const [busySandi, setBusySandi] = useState(false)
  const [msgSandi, setMsgSandi] = useState<string | null>(null)
  const [errSandi, setErrSandi] = useState<string | null>(null)

  const [ttdUrl, setTtdUrl] = useState(profile.ttdUrl ?? '')
  const [busyTtd, setBusyTtd] = useState(false)
  const [msgTtd, setMsgTtd] = useState<string | null>(null)
  const [errTtd, setErrTtd] = useState<string | null>(null)
  const inputTtdRef = useRef<HTMLInputElement>(null)

  const staf = profile.role !== 'orangtua'

  async function handleSaveProfil(e: FormEvent) {
    e.preventDefault()
    setBusyProfil(true)
    setMsgProfil(null)
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        nama: nama.trim(),
        gelar: gelar.trim() || null,
        nbm: nbm.trim() || null,
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

  async function handleUnggahTtd(file: File | null) {
    if (!file) return
    setBusyTtd(true)
    setMsgTtd(null)
    setErrTtd(null)
    try {
      const url = await unggahTtdSendiri(file)
      setTtdUrl(url)
      setMsgTtd('Tanda tangan tersimpan. Akan muncul otomatis di cetak Rapor STS.')
    } catch (err) {
      setErrTtd(err instanceof Error ? err.message : 'Gagal mengunggah tanda tangan.')
    } finally {
      setBusyTtd(false)
      if (inputTtdRef.current) inputTtdRef.current.value = ''
    }
  }

  async function handleHapusTtd() {
    if (!confirm('Hapus tanda tangan digital Anda?')) return
    setBusyTtd(true)
    setMsgTtd(null)
    setErrTtd(null)
    try {
      await hapusTtdSendiri()
      setTtdUrl('')
      setMsgTtd('Tanda tangan dihapus.')
    } catch (err) {
      setErrTtd(err instanceof Error ? err.message : 'Gagal menghapus.')
    } finally {
      setBusyTtd(false)
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        title="Pengaturan akun"
        subtitle="Perbarui nama di rapor, tanda tangan digital (STS), dan password login."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-soft space-y-3 p-4 sm:p-5">
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
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">
                NBM (opsional, tercetak di rapor STS)
              </span>
              <input
                className={field}
                value={nbm}
                onChange={(e) => setNbm(e.target.value)}
                placeholder="contoh: 1167327"
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

        {staf && (
          <section className="card-soft space-y-3 p-4 sm:p-5">
            <h3 className="text-[14px] font-semibold text-slate-900">Tanda tangan digital</h3>
            <p className="text-[12px] leading-snug text-muted">
              Dipakai otomatis di cetak <strong>Rapor STS</strong> (pelaporan online). Unggah foto
              tanda tangan di kertas putih atau hasil scan (PNG/JPG). Gambar akan diperkecil
              otomatis.
            </p>
            {ttdUrl ? (
              <div className="flex flex-col items-start gap-2">
                <img
                  src={ttdUrl}
                  alt="Pratinjau tanda tangan"
                  className="max-h-20 max-w-[200px] rounded border border-border bg-white object-contain p-2"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyTtd}
                    className="rounded-xl border border-border bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-slate-50 disabled:opacity-60"
                    onClick={() => inputTtdRef.current?.click()}
                  >
                    Ganti gambar
                  </button>
                  <button
                    type="button"
                    disabled={busyTtd}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                    onClick={() => void handleHapusTtd()}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busyTtd}
                className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
                onClick={() => inputTtdRef.current?.click()}
              >
                {busyTtd ? 'Mengunggah…' : 'Unggah tanda tangan'}
              </button>
            )}
            <input
              ref={inputTtdRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => void handleUnggahTtd(e.target.files?.[0] ?? null)}
            />
            {msgTtd && <p className="text-[12px] font-medium text-muh-800">{msgTtd}</p>}
            {errTtd && <p className="text-[12px] font-medium text-red-700">{errTtd}</p>}
          </section>
        )}

        <section className={`card-soft space-y-3 p-4 sm:p-5 ${staf ? 'lg:col-span-2' : ''}`}>
          <h3 className="text-[14px] font-semibold text-slate-900">Ubah password</h3>
          <p className="text-[12px] leading-snug text-muted">
            Masukkan password saat ini, lalu password baru (minimal 8 karakter). Password tidak
            disimpan di Firestore — hanya di Firebase Authentication.
          </p>

          <form onSubmit={handleUbahPassword} className="grid max-w-xl gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
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
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busySandi}
                className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
              >
                {busySandi ? 'Mengubah…' : 'Ubah password'}
              </button>
            </div>
          </form>
          {msgSandi && <p className="text-[12px] font-medium text-muh-800">{msgSandi}</p>}
          {errSandi && <p className="text-[12px] font-medium text-red-700">{errSandi}</p>}
        </section>
      </div>
    </div>
  )
}
