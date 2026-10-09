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
      desc: 'Setoran, target hafalan, riwayat, dan laporan kemajuan',
      icon: 'ق',
      tone: 'from-muh-600 to-muh-800',
    },
    isGuruAkademik && {
      to: '/akademik',
      title: 'Akademik & Rapor',
      desc: 'TP, nilai mapel, siswa, rapor, absensi, ekskul',
      icon: 'A',
      tone: 'from-amber-500 to-amber-700',
    },
    isAdmin && {
      to: '/admin',
      title: 'Administrasi',
      desc: 'Kelola akun guru, data siswa, dan pengaturan',
      icon: '⚙',
      tone: 'from-slate-500 to-slate-700',
    },
  ].filter(Boolean) as {
    to: string
    title: string
    desc: string
    icon: string
    tone: string
  }[]

  return (
    <div className="space-y-4">
      <div className="card-soft overflow-hidden">
        <div className="bg-gradient-to-r from-muh-700 to-muh-900 px-5 py-5 text-white sm:px-6">
          <p className="text-[11px] font-medium text-muh-100/90">Selamat datang</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{profile.nama}</h1>
          <p className="mt-1 text-[12px] text-muh-100/80">
            {ROLE_LABEL[profile.role]}
            {profile.kelasAmpu?.length ? ` · Kelas ${profile.kelasAmpu.join(', ')}` : ''}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Modul
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="card-soft group flex gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${m.tone} text-sm font-bold text-white shadow-sm`}
              >
                {m.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-slate-900 group-hover:text-muh-800">
                  {m.title}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-muted">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
