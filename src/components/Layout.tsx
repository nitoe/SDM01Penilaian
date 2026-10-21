import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout } from '../lib/auth'
import { ringkasKelas } from '../lib/kelasSaya'
import { canAkademik, canTahsin, isAdminRole, isStaff } from '../lib/roles'
import { hitungBaru } from '../lib/notifikasi'
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
  if (pathname.startsWith('/notifikasi')) return admin ? 'Notifikasi' : 'Laporan ke Admin'
  if (pathname.startsWith('/admin')) return 'Administrasi'
  if (pathname.startsWith('/profil')) return 'Pengaturan akun'
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
  const [laporanBaru, setLaporanBaru] = useState(0)

  // Lonceng admin: jumlah laporan baru. Disegarkan tiap pindah halaman; gagal = diam (tidak mengganggu).
  useEffect(() => {
    if (!isAdminRole(profile.role)) return
    let batal = false
    hitungBaru()
      .then((n) => !batal && setLaporanBaru(n))
      .catch(() => undefined)
    return () => {
      batal = true
    }
  }, [profile.role, pathname])

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

          <Link
            to="/profil"
            className="hero-banner block rounded-[var(--radius-card)] p-3.5 text-white no-underline transition hover:opacity-95"
            title="Pengaturan akun — ubah nama & password"
          >
            <p className="text-[11px] text-muh-100/85">Masuk sebagai</p>
            <p className="mt-0.5 truncate text-[13px] font-semibold">
              {profile.nama}
              {profile.gelar ? `, ${profile.gelar}` : ''}
            </p>
            <p className="mt-0.5 text-[11px] text-muh-100/85">
              {ROLE_LABEL[profile.role]}
              {ringkasKelas(profile) ? ` · ${ringkasKelas(profile)}` : ''}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muh-100/90">
              <Icon name="key" className="h-3.5 w-3.5" />
              Pengaturan akun
            </p>
          </Link>

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
                {sectionTitle(pathname, isAdminRole(profile.role))}
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
              {isStaff(profile.role) && (
                <Link
                  to="/notifikasi"
                  aria-label={
                    laporanBaru > 0 ? `Notifikasi, ${laporanBaru} laporan baru` : 'Notifikasi dan laporan'
                  }
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-slate-50"
                >
                  <Icon name="bell" />
                  {laporanBaru > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-white">
                      {laporanBaru > 99 ? '99+' : laporanBaru}
                    </span>
                  )}
                </Link>
              )}
              <Link
                to="/profil"
                className="hidden min-w-0 text-right no-underline sm:block"
                title="Pengaturan akun"
              >
                <div className="truncate text-[13px] font-medium text-slate-800 hover:text-muh-800">
                  {profile.nama}
                  {profile.gelar ? `, ${profile.gelar}` : ''}
                </div>
                <div className="text-[11px] text-muted">Pengaturan · {ROLE_LABEL[profile.role]}</div>
              </Link>
              <Link
                to="/profil"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-muh-50 text-[12px] font-semibold text-muh-700 no-underline transition hover:bg-muh-100"
                title="Pengaturan akun"
                aria-label="Pengaturan akun"
              >
                {initials}
              </Link>
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
        <Link
          to="/profil"
          className={[
            'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
            pathname.startsWith('/profil') ? 'text-muh-700' : 'text-slate-500',
          ].join(' ')}
        >
          <Icon name="key" className="h-5 w-5" />
          Akun
        </Link>
      </nav>
    </div>
  )
}
