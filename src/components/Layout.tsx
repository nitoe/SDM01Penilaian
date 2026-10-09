import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'

interface LayoutProps {
  profile: AppUser
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
    isActive
      ? 'bg-muh-700 text-white shadow-sm'
      : 'text-slate-600 hover:bg-muh-50 hover:text-muh-800',
  ].join(' ')

export default function Layout({ profile }: LayoutProps) {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const isAdmin = profile.role === 'admin'
  const isGuruTahsin =
    isAdmin || profile.role === 'guru' || profile.role === 'guru_tahsin_tahfizh'
  const isGuruAkademik =
    isAdmin || profile.role === 'guru' || profile.role === 'guru_akademik'

  return (
    <div className="min-h-full flex flex-col bg-surface-2">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muh-700 text-sm font-extrabold text-white shadow-sm">
              SD
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-muh-800 tracking-tight">
                SDM 01 Kukusan
              </div>
              <div className="text-[11px] font-medium text-muted">Sistem Penilaian</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-slate-800">{profile.nama}</div>
              <div className="text-[11px] text-muted">{ROLE_LABEL[profile.role]}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-muh-300 hover:text-muh-800"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 md:w-56">
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-2xl border border-border bg-white p-2 md:flex-col">
            <NavLink to="/" end className={navClass}>
              Beranda
            </NavLink>

            {isGuruTahsin && (
              <NavLink to="/tahsin" className={navClass}>
                Tahsin-Tahfizh
              </NavLink>
            )}

            {isGuruAkademik && (
              <NavLink to="/akademik" className={navClass}>
                Akademik & Rapor
              </NavLink>
            )}

            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
        </aside>

        {/* Konten halaman */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-border py-4 text-center text-[11px] text-muted">
        SD Muhammadiyah 01 Kukusan · Sistem Penilaian
      </footer>
    </div>
  )
}
