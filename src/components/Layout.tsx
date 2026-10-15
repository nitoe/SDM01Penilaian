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

function sectionTitle(pathname: string, admin: boolean): string {
  if (pathname.startsWith('/tahsin')) return admin ? 'Pantauan Tahsin & Tahfizh' : 'Tahsin & Tahfizh'
  if (pathname.startsWith('/akademik')) return admin ? 'Pantauan Akademik' : 'Akademik & Rapor'
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
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors',
    isActive
      ? 'bg-white/14 text-white'
      : 'text-white/75 hover:bg-white/8 hover:text-white',
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
      label: isAdminRole(profile.role) ? 'Pantauan Akademik' : 'Akademik & Rapor',
      short: isAdminRole(profile.role) ? 'Pantauan' : 'Akademik',
      icon: 'clipboard',
      show: canAkademik(profile.role),
    },
    {
      to: '/tahsin',
      label: isAdminRole(profile.role) ? 'Pantauan Tahsin' : 'Tahsin-Tahfizh',
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
    <div className="flex min-h-full bg-surface-2 print:bg-white">
      <div className="app-shell flex min-h-full w-full print:rounded-none print:border-0 print:shadow-none">
        {/* Sidebar desktop: biru tua sekolah */}
        <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col bg-muh-800 px-3 py-4 text-white md:flex print:hidden">
          <Link to="/" className="flex items-center gap-3 px-2 py-1 no-underline">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
              <img src="/logo-sdm.png" alt="" className="h-7 w-auto" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-semibold text-white">SDM 01 Kukusan</div>
              <div className="text-[11.5px] text-white/65">Sistem Penilaian</div>
            </div>
          </Link>

          <nav className="mt-7 flex-1 space-y-0.5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Menu
            </p>
            {visible.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={sideLink}>
                <Icon name={i.icon} />
                {i.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/12 pt-3">
            <div className="flex items-center gap-2.5 px-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/14 text-[12px] font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-medium text-white">
                  {profile.nama}
                  {profile.gelar ? `, ${profile.gelar}` : ''}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-white/65">{ROLE_LABEL[profile.role]}</p>
                {ringkasKelas(profile) && (
                  <p className="truncate text-[11.5px] text-white/65">{ringkasKelas(profile)}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-white/75 transition hover:bg-white/8 hover:text-white"
            >
              <Icon name="logout" />
              Keluar
            </button>
          </div>
        </aside>

        {/* Kolom utama */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 md:py-3 print:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/logo-sdm.png" alt="" className="h-8 w-auto shrink-0 md:hidden" />
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-900 sm:text-[18px]">
                  {sectionTitle(pathname, isAdminRole(profile.role))}
                </h2>
                <p className="text-[12px] text-muted">{TANGGAL.format(new Date())}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {periode && (
                <div className="hidden sm:block">
                  {isAdmin && daftar.length > 1 ? (
                    <select
                      value={periode.id}
                      onChange={(e) => setPeriodeId(e.target.value)}
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-muh-600"
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muh-50 text-[12px] font-semibold text-muh-700 md:hidden">
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

          <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6 print:p-0">
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
