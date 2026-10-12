import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TandaTanganGuru from '../../components/TandaTanganGuru'
import { listAkunStaf, type AkunStaf } from '../../lib/akunGuruData'
import { SEMUA_KELAS } from '../../types/tahsin'
import type { AppUser } from '../../types/user'
import { namaDenganGelar } from '../../types/user'

interface Props {
  profile: AppUser
}

export default function Rapor({ profile }: Props) {
  const [kelas, setKelas] = useState(profile.waliKelas?.[0] || '1A')
  const [wali, setWali] = useState<AkunStaf | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let batal = false
    setLoading(true)
    listAkunStaf()
      .then((list) => {
        if (batal) return
        const ketemu = list.find((u) => (u.waliKelas ?? []).includes(kelas) && u.status !== 'pending')
        setWali(ketemu ?? null)
      })
      .catch(() => setWali(null))
      .finally(() => setLoading(false))
    return () => {
      batal = true
    }
  }, [kelas])

  const namaSaya = namaDenganGelar(profile)

  return (
    <div className="space-y-4">
      <div>
        <Link to="/akademik" className="text-[11px] font-medium text-muh-700 hover:underline">
          ← Akademik & Rapor
        </Link>
        <h1 className="mt-0.5 text-lg font-semibold tracking-tight">Pratinjau Rapor — Tanda Tangan</h1>
        <p className="text-[12px] text-muted">
          Nama guru ditampilkan dengan gelar pendidikan terakhir untuk penandatanganan rapor.
        </p>
      </div>

      <div className="card-soft p-4">
        <label className="block text-[11px] font-medium text-slate-600">Pilih kelas (untuk melihat wali kelas)</label>
        <select
          value={kelas}
          onChange={(e) => setKelas(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-muh-500"
        >
          {SEMUA_KELAS.map((k) => (
            <option key={k} value={k}>
              Kelas {k}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tanda tangan saya */}
        <section className="card-soft p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-slate-800">Tanda tangan Anda</h2>
          <p className="mb-4 text-[11px] text-muted">
            Dipakai jika Anda menjadi guru mapel atau wali kelas. Saat ini: <strong>{namaSaya}</strong>
          </p>
          <div className="rounded-xl border border-dashed border-border bg-slate-50/60 p-4">
            <TandaTanganGuru
              nama={profile.nama}
              gelar={profile.gelar}
              jabatan={profile.waliKelas?.length ? 'Wali Kelas' : 'Guru Mapel'}
            />
          </div>
          {!profile.gelar && (
            <p className="mt-3 text-[11px] text-amber-700">
              Anda belum mengisi gelar. <Link to="/profil" className="font-medium underline">Isi di Profil Saya</Link> agar muncul di rapor.
            </p>
          )}
        </section>

        {/* Wali kelas terpilih */}
        <section className="card-soft p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-slate-800">Wali Kelas {kelas}</h2>
          {loading ? (
            <p className="text-[12px] text-muted">Memuat…</p>
          ) : wali ? (
            <>
              <p className="mb-4 text-[11px] text-muted">
                Nama resmi: <strong>{namaDenganGelar(wali)}</strong>
              </p>
              <div className="rounded-xl border border-dashed border-border bg-slate-50/60 p-4">
                <TandaTanganGuru nama={wali.nama} gelar={wali.gelar} jabatan="Wali Kelas" />
              </div>
            </>
          ) : (
            <p className="text-[12px] text-muted">Belum ada wali kelas yang ditetapkan untuk {kelas}.</p>
          )}
        </section>
      </div>

      <div className="card-soft p-4 text-[12px] text-muted">
        <p className="font-medium text-slate-700">Catatan</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Komponen <code>TandaTanganGuru</code> siap dipakai di halaman cetak rapor nantinya.</li>
          <li>Format tetap: <em>Nama Lengkap, Gelar</em> (contoh: Arif Azwar Anas, S.Pd).</li>
          <li>Gelar diisi guru sendiri di menu Profil, atau oleh admin di Kelola Akun.</li>
        </ul>
      </div>
    </div>
  )
}
