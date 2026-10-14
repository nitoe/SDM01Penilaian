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
const HALAMAN_LEBAR = ['/tahsin/input-setoran', '/tahsin/riwayat', '/tahsin/target', '/tahsin/menulis', '/admin/siswa', '/admin/users', '/akademik/laporan-slm', '/akademik/nilai-sts', '/akademik/nilai-slm']

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
    'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-medium transition-colors',
    isActive
      ? 'bg-peach-50 text-peach-500'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ')

const tabLink = ({ isActive }: { isActive: boolean }) =>
  [
    'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors',
    isActive ? 'text-peach-500' : 'text-slate-500',
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
    <div className="flex min-h-full bg-surface-2 md:p-3 print:bg-white print:p-0">
      <div className="flex min-h-full w-full bg-white md:overflow-clip md:min-h-[calc(100vh-1.5rem)] md:rounded-[28px] md:border md:border-border md:shadow-[0_8px_30px_rgba(15,23,42,0.06)] print:rounded-none print:border-0 print:shadow-none">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-white px-4 py-5 md:flex md:h-[calc(100vh-1.5rem)] print:hidden">
          <Link to="/" className="flex items-center gap-3 px-1 no-underline">
            <img src="/favicon-32.png" alt="" className="h-9 w-9 rounded-xl" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold text-slate-900">
                SDM 01 Kukusan
              </div>
              <div className="text-[11px] text-muted">Sistem Penilaian</div>
            </div>
          </Link>

          <nav className="mt-7 flex-1 space-y-1">
            <p className="mb-2 px-3.5 text-[11px] font-semibold text-slate-400">Menu</p>
            {visible.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={sideLink}>
                <Icon name={i.icon} />
                {i.label}
              </NavLink>
            ))}
          </nav>

          <div className="hero-banner rounded-2xl p-4 text-white">
            <p className="text-[11px] text-muh-100/85">Masuk sebagai</p>
            <p className="mt-0.5 truncate text-[13.5px] font-semibold">
              {profile.nama}{profile.gelar ? `, ${profile.gelar}` : ''}
            </p>
            <p className="mt-0.5 text-[11.5px] text-muh-100/85">
              {ROLE_LABEL[profile.role]}
              {ringkasKelas(profile) ? ` · ${ringkasKelas(profile)}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="logout" />
            Keluar
          </button>
        </aside>

        {/* Kolom utama */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface-2/60">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur sm:px-6 md:py-4 print:hidden">
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-semibold tracking-tight text-slate-900 sm:text-[20px]">
                {sectionTitle(pathname)}
              </h2>
              <p className="text-[12px] text-muted">{TANGGAL.format(new Date())}</p>
            </div>

            <div className="flex items-center gap-2.5">
              {periode && (
                <div className="hidden sm:block">
                  {isAdmin && daftar.length > 1 ? (
                    <select
                      value={periode.id}
                      onChange={(e) => setPeriodeId(e.target.value)}
                      className="rounded-xl border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-muh-500"
                    >
                      {daftar.map((p) => (
                        <option key={p.id} value={p.id}>
                          {labelPeriode(p)}
                          {!p.aktif ? ' (nonaktif)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full bg-muh-50 px-2.5 py-1 text-[11.5px] font-medium text-muh-800">
                      {labelPeriode(periode)}
                    </span>
                  )}
                </div>
              )}
              <div className="hidden min-w-0 text-right sm:block">
                <div className="truncate text-[13px] font-medium text-slate-800">
                  {profile.nama}{profile.gelar ? `, ${profile.gelar}` : ''}
                </div>
                <div className="text-[11px] text-muted">{ROLE_LABEL[profile.role]}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-peach-100 text-[13px] font-semibold text-peach-500">
                {initials}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Keluar"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-slate-500 transition hover:bg-slate-50 md:hidden"
              >
                <Icon name="logout" />
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6 print:p-0">
            <div className={`mx-auto ${HALAMAN_LEBAR.some((p) => pathname.startsWith(p)) ? 'max-w-[1500px]' : 'max-w-5xl'}`}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Navigasi bawah (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden print:hidden">
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
