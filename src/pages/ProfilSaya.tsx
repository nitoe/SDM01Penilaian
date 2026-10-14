import { useState, type FormEvent } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppUser } from '../types/user'
import { namaDenganGelar } from '../types/user'
import { PageHeader } from '../components/ui'

interface Props {
  profile: AppUser
}

export default function ProfilSaya({ profile }: Props) {
  const [nama, setNama] = useState(profile.nama)
  const [gelar, setGelar] = useState(profile.gelar ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        nama: nama.trim(),
        gelar: gelar.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      setMsg('Profil berhasil diperbarui. Muat ulang halaman jika perlu.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500 focus:ring-2 focus:ring-muh-500/15'

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <PageHeader title="Profil Saya" subtitle="Perbarui nama dan data kontak Anda." />
      <p className="text-[12px] text-muted">
        Nama lengkap dengan gelar yang akan muncul di rapor: <strong>{namaDenganGelar({ nama, gelar })}</strong>
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Nama</span>
          <input className={field} value={nama} onChange={(e) => setNama(e.target.value)} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">Gelar pendidikan terakhir</span>
          <input
            className={field}
            value={gelar}
            onChange={(e) => setGelar(e.target.value)}
            placeholder="contoh: S.Pd"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-muh-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-muh-700 disabled:opacity-60"
        >
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>
      {msg && <p className="text-[12px] text-muh-800">{msg}</p>}
    </div>
  )
}