import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { ringkasKelas } from '../lib/kelasSaya'
import { canAkademik, canTahsin, isAdminRole } from '../lib/roles'
import type { AppUser } from '../types/user'
import { ROLE_LABEL } from '../types/user'
import { usePeriode } from '../context/PeriodeContext'
import { labelPeriode } from '../types/periode'
import Icon, { type IconName } from './Icon'

interface LayoutProps {
  profile: AppUser
}

interface NavItem {
  to: string
  label: string
  short: string
  icon: IconName
  end?: boolean
  show: boolean
}

/** Halaman kerja harian yang memakai lebar layar penuh (dua kolom di PC); lainnya tetap berlebar baca. */
/** Halaman data/tabel — pakai lebar penuh shell (bukan kolom sempit). */
const HALAMAN_LEBAR = [
  '/akademik',
  '/admin',
  '/tahsin',
]

/** Halaman form ringkas — kolom terbaca, tidak melebar sia-sia. */
const HALAMAN_SEMPIT = ['/profil']

function sectionTitle(pathname: string): string {
  if (pathname.startsWith('/tahsin')) return 'Tahsin & Tahfizh'
  if (pathname.startsWith('/akademik')) return 'Akademik & Rapor'
  if (pathname.startsWith('/admin')) return 'Administrasi'
  return 'Beranda'
}

const TANGGAL = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const sideLink = ({ isActive }: { isActive: boolean }) =>
  [
    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors',
    isActive
      ? 'bg-muh-50 text-muh-800 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-muh-600'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ')

const tabLink = ({ isActive }: { isActive: boolean }) =>
  [
    'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
    isActive ? 'text-muh-700' : 'text-slate-500',
  ].join(' ')

export default function Layout({ profile }: LayoutProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { periode, daftar, setPeriodeId, isAdmin } = usePeriode()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const items: NavItem[] = [
    { to: '/', label: 'Beranda', short: 'Beranda', icon: 'home', end: true, show: true },
    {
      to: '/akademik',
      label: 'Akademik & Rapor',
      short: 'Akademik',
      icon: 'clipboard',
      show: canAkademik(profile.role),
    },
    {
      to: '/tahsin',
      label: 'Tahsin-Tahfizh',
      short: 'Tahsin',
      icon: 'quran',
      show: canTahsin(profile.role),
    },
    {
      to: '/admin',
      label: 'Administrasi',
      short: 'Admin',
      icon: 'settings',
      show: isAdminRole(profile.role),
    },
  ]
  const visible = items.filter((i) => i.show)

  const initials = profile.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-full bg-surface-2 md:p-2 print:bg-white print:p-0">
      <div className="app-shell flex min-h-full w-full bg-white md:min-h-[calc(100vh-1.5rem)] md:overflow-clip md:border md:border-border print:rounded-none print:border-0 print:shadow-none">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-white px-3.5 py-4 md:flex md:h-[calc(100vh-1.5rem)] print:hidden">
          <Link to="/" className="flex items-center gap-2.5 px-1.5 no-underline">
            <img src="/favicon-32.png" alt="" className="h-8 w-8 rounded-lg" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-semibold text-slate-900">
                SDM 01 Kukusan
              </div>
              <div className="text-[11px] text-muted">Sistem Penilaian</div>
            </div>
          </Link>

          <nav className="mt-6 flex-1 space-y-0.5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Menu
            </p>
            {visible.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={sideLink}>
                <Icon name={i.icon} />
                {i.label}
              </NavLink>
            ))}
          </nav>

          <div className="hero-banner rounded-[var(--radius-card)] p-3.5 text-white">
            <p className="text-[11px] text-muh-100/85">Masuk sebagai</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold">
              {profile.nama}
              {profile.gelar ? `, ${profile.gelar}` : ''}
            </p>
            <p className="mt-0.5 text-[11px] text-muh-100/85">
              {ROLE_LABEL[profile.role]}
              {ringkasKelas(profile) ? ` · ${ringkasKelas(profile)}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="logout" />
            Keluar
          </button>
        </aside>

        {/* Kolom utama */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface-2/50">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-white/95 px-4 py-2.5 backdrop-blur sm:px-5 md:py-3 print:hidden">
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-900 sm:text-[18px]">
                {sectionTitle(pathname)}
              </h2>
              <p className="text-[12px] text-muted">{TANGGAL.format(new Date())}</p>
            </div>

            <div className="flex items-center gap-2">
              {periode && (
                <div className="hidden sm:block">
                  {isAdmin && daftar.length > 1 ? (
                    <select
                      value={periode.id}
                      onChange={(e) => setPeriodeId(e.target.value)}
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-muh-500"
                    >
                      {daftar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {labelPeriode(p)}
                          {!p.aktif ? ' (nonaktif)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-md bg-muh-50 px-2.5 py-1 text-[12px] font-medium text-muh-800">
                      {labelPeriode(periode)}
                    </span>
                  )}
                </div>
              )}
              <div className="hidden min-w-0 text-right sm:block">
                <div className="truncate text-[13px] font-medium text-slate-800">
                  {profile.nama}
                  {profile.gelar ? `, ${profile.gelar}` : ''}
                </div>
                <div className="text-[11px] text-muted">{ROLE_LABEL[profile.role]}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muh-50 text-[12px] font-semibold text-muh-700">
                {initials}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Keluar"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-slate-50 md:hidden"
              >
                <Icon name="logout" />
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 sm:p-5 md:pb-5 print:p-0">
            <div
              className={`mx-auto w-full ${
                HALAMAN_SEMPIT.some((p) => pathname.startsWith(p))
                  ? 'max-w-xl'
                  : HALAMAN_LEBAR.some((p) => pathname.startsWith(p))
                    ? 'max-w-[1600px]'
                    : 'max-w-6xl'
              }`}
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Navigasi bawah (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white/95 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden print:hidden">
        {visible.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={tabLink}>
            <Icon name={i.icon} className="h-5 w-5" />
            {i.short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
