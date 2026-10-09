import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'

interface LayoutProps {
  profile: AppUser
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
    isActive
      ? 'bg-muh-50 text-muh-800'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
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

  const initials = profile.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-full bg-surface-2">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-border bg-white md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-muh-600 to-muh-800 text-[11px] font-bold text-white shadow-sm">
            SD
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold text-slate-900">
              SDM 01 Kukusan
            </div>
            <div className="text-[10px] text-muted">Sistem Penilaian</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-1">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Menu
          </p>
          <NavLink to="/" end className={navClass}>
            <span className="text-[14px] opacity-70">⌂</span>
            Beranda
          </NavLink>
          {isGuruTahsin && (
            <NavLink to="/tahsin" className={navClass}>
              <span className="text-[14px] opacity-70">ق</span>
              Tahsin-Tahfizh
            </NavLink>
          )}
          {isGuruAkademik && (
            <NavLink to="/akademik" className={navClass}>
              <span className="text-[14px] opacity-70">☰</span>
              Akademik
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              <span className="text-[14px] opacity-70">⚙</span>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muh-100 text-[11px] font-semibold text-muh-800">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-slate-800">
                {profile.nama}
              </div>
              <div className="truncate text-[10px] text-muted">
                {ROLE_LABEL[profile.role]}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full rounded-xl px-3 py-1.5 text-left text-[12px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-white/90 px-3 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muh-600 text-[10px] font-bold text-white">
              SD
            </div>
            <span className="text-[13px] font-semibold text-slate-900">SDM 01</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-slate-600"
          >
            Keluar
          </button>
        </header>

        <main className="flex-1 overflow-auto p-3 pb-20 sm:p-5 md:pb-5">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border bg-white/95 px-1 py-1 backdrop-blur md:hidden">
          <NavLink to="/" end className={navClass + ' flex-1 justify-center'}>
            Beranda
          </NavLink>
          {isGuruTahsin && (
            <NavLink to="/tahsin" className={navClass + ' flex-1 justify-center'}>
              Tahsin
            </NavLink>
          )}
          {isGuruAkademik && (
            <NavLink to="/akademik" className={navClass + ' flex-1 justify-center'}>
              Akademik
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navClass + ' flex-1 justify-center'}>
              Admin
            </NavLink>
          )}
        </nav>
      </div>
    </div>
  )
}
