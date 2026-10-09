import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'

interface LayoutProps {
  profile: AppUser
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition',
    isActive
      ? 'bg-muh-600 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
    <div className="flex min-h-full flex-col bg-surface-2">
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="mx-auto flex h-11 max-w-5xl items-center justify-between gap-3 px-3 sm:px-4">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muh-600 text-[10px] font-bold tracking-wide text-white">
              SD
            </div>
            <div className="leading-none">
              <div className="text-[13px] font-semibold text-slate-900">
                SDM 01 Kukusan
              </div>
              <div className="mt-0.5 text-[10px] text-muted">Sistem Penilaian</div>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <div className="text-[12px] font-medium text-slate-800">{profile.nama}</div>
              <div className="text-[10px] text-muted">{ROLE_LABEL[profile.role]}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-4 px-3 py-3 sm:px-4 sm:py-4">
        <aside className="hidden w-40 shrink-0 md:block">
          <nav className="sticky top-14 space-y-0.5 rounded-lg border border-border bg-white p-1.5">
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
                Akademik
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-white md:hidden">
          <nav className="mx-auto flex max-w-5xl justify-around px-1 py-1">
            <NavLink to="/" end className={navClass}>
              Beranda
            </NavLink>
            {isGuruTahsin && (
              <NavLink to="/tahsin" className={navClass}>
                Tahsin
              </NavLink>
            )}
            {isGuruAkademik && (
              <NavLink to="/akademik" className={navClass}>
                Akademik
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
        </div>

        <main className="min-w-0 flex-1 pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>

      <footer className="hidden border-t border-border py-2 text-center text-[10px] text-muted md:block">
        SD Muhammadiyah 01 Kukusan
      </footer>
    </div>
  )
}
