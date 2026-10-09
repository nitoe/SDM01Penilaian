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

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-muh-800 to-muh-950 p-6 text-white shadow-lg shadow-muh-900/20 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-muh-200">
          Selamat datang
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {profile.nama}
        </h1>
        <p className="mt-2 text-sm text-muh-100">
          {ROLE_LABEL[profile.role]}
          {profile.kelasAmpu && profile.kelasAmpu.length > 0
            ? ` · Kelas: ${profile.kelasAmpu.join(', ')}`
            : ''}
        </p>
      </section>

      {/* Modul cards */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Modul
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {isGuruTahsin && (
            <Link
              to="/tahsin"
              className="group flex items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-muh-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muh-50 text-muh-700 ring-1 ring-muh-100 transition group-hover:bg-muh-100">
                <span className="text-lg font-extrabold">ط</span>
              </div>
              <div>
                <div className="font-bold text-slate-900">Tahsin & Tahfizh</div>
                <p className="mt-0.5 text-sm text-muted">
                  Input setoran, target hafalan, riwayat, dan laporan.
                </p>
              </div>
            </Link>
          )}

          {isGuruAkademik && (
            <Link
              to="/akademik"
              className="group flex items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-muh-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700 ring-1 ring-gold-100 transition group-hover:bg-gold-100">
                <span className="text-lg font-extrabold">A</span>
              </div>
              <div>
                <div className="font-bold text-slate-900">Akademik & Rapor</div>
                <p className="mt-0.5 text-sm text-muted">
                  Setup TP, input nilai, absensi, ekstrakurikuler, dan rapor.
                </p>
              </div>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className="group flex items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:border-muh-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition group-hover:bg-slate-200">
                <span className="text-lg font-extrabold">⚙</span>
              </div>
              <div>
                <div className="font-bold text-slate-900">Administrasi</div>
                <p className="mt-0.5 text-sm text-muted">
                  Kelola siswa, akun guru, dan pengaturan sistem.
                </p>
              </div>
            </Link>
          )}
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        Scaffold awal · Halaman modul akan dimigrasikan bertahap dari versi HTML.
      </p>
    </div>
  )
}
