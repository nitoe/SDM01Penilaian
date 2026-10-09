import { Link } from 'react-router-dom'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'

interface HomeProps {
  profile: AppUser
}

export default function Home({ profile }: HomeProps) {
  const isAdmin = profile.role === 'admin'
  const isGuruTahsin =
    isAdmin || profile.role === 'guru' || profile.role === 'guru_tahsin_tahfizh'
  const isGuruAkademik =
    isAdmin || profile.role === 'guru' || profile.role === 'guru_akademik'

  const modules = [
    isGuruTahsin && {
      to: '/tahsin',
      title: 'Tahsin & Tahfizh',
      desc: 'Setoran, target hafalan, riwayat, laporan',
      accent: 'border-l-muh-600',
    },
    isGuruAkademik && {
      to: '/akademik',
      title: 'Akademik & Rapor',
      desc: 'TP, nilai, siswa, rapor, absensi',
      accent: 'border-l-gold-500',
    },
    isAdmin && {
      to: '/admin',
      title: 'Administrasi',
      desc: 'Akun, data siswa, pengaturan',
      accent: 'border-l-slate-400',
    },
  ].filter(Boolean) as { to: string; title: string; desc: string; accent: string }[]

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-white px-3.5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
          Selamat datang
        </p>
        <h1 className="mt-0.5 text-[15px] font-semibold text-slate-900">{profile.nama}</h1>
        <p className="mt-0.5 text-[11px] text-muted">
          {ROLE_LABEL[profile.role]}
          {profile.kelasAmpu && profile.kelasAmpu.length > 0
            ? ` · ${profile.kelasAmpu.join(', ')}`
            : ''}
        </p>
      </div>

      <div>
        <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Modul
        </h2>
        <div className="space-y-1.5">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={`block rounded-lg border border-border border-l-[3px] bg-white px-3 py-2.5 transition hover:bg-slate-50 ${m.accent}`}
            >
              <div className="text-[13px] font-semibold text-slate-900">{m.title}</div>
              <p className="mt-0.5 text-[11px] text-muted">{m.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
