import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { subscribeAuth, logout } from './lib/auth'
import { simpanNoticeLogin } from './lib/akunGuru'
import { canAkademik, canTahsin, isAdminRole, isGuruTahsinRole, isStaff } from './lib/roles'
import type { AppUser } from './types/user'
import { PeriodeProvider } from './context/PeriodeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ProfilSaya from './pages/ProfilSaya'
import Notifikasi from './pages/Notifikasi'
import LaporanTahsin from './pages/tahsin/LaporanTahsin'
import Home from './pages/Home'
import TahsinHub from './pages/TahsinHub'
import AkademikHub from './pages/AkademikHub'
import AdminHub from './pages/AdminHub'
import Placeholder from './pages/Placeholder'
import InputSetoran from './pages/tahsin/InputSetoran'
import RiwayatSiswa from './pages/tahsin/RiwayatSiswa'
import TargetHafalan from './pages/tahsin/TargetHafalan'
import DataSiswa from './pages/admin/DataSiswa'
import KelolaAkun from './pages/admin/KelolaAkun'
import SetupMapel from './pages/admin/Mapel'
import TahunAjaran from './pages/admin/TahunAjaran'
import KelolaPeriode from './pages/admin/KelolaPeriode'
import SetupTp from './pages/akademik/SetupTp'
import BobotSemester from './pages/akademik/BobotSemester'
import NilaiSlm from './pages/akademik/NilaiSlm'
import NilaiStsSas from './pages/akademik/NilaiStsSas'
import LaporanSlm from './pages/akademik/LaporanSlm'
import Rapor from './pages/akademik/Rapor'

/** Menjaga rute per role di sisi UI. Penegakan sebenarnya tetap di firestore.rules. */
function RoleGate({ allow, to = '/' }: { allow: boolean; to?: string }) {
  return allow ? <Outlet /> : <Navigate to={to} replace />
}

function LoadingScreen() {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface-2">
      <div className="flex flex-col items-center gap-2">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muh-200 border-t-muh-600" />
        <p className="text-[12px] text-muted">Memuat…</p>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeAuth((u, p) => {
      if (u && p?.aktif === false) {
        simpanNoticeLogin('Akun ini dinonaktifkan. Hubungi administrator.')
        void logout()
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      // Profil dihapus dari Kelola Akun — Auth mungkin masih ada
      if (u && !p) {
        simpanNoticeLogin('Profil akun tidak ditemukan atau sudah dihapus. Hubungi administrator.')
        void logout()
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(u)
      setProfile(p)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  if (loading) return <LoadingScreen />

  const isAuthenticated = Boolean(user && profile)

  const admin = profile ? isAdminRole(profile.role) : false

  return (
    <BrowserRouter>
      <PeriodeProvider isAdmin={admin}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
        />

        <Route
          element={
            isAuthenticated && profile ? (
              <Layout profile={profile} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/" element={profile ? <Home profile={profile} /> : null} />
          <Route path="/profil" element={profile ? <ProfilSaya profile={profile} /> : null} />

          <Route element={<RoleGate allow={profile ? isStaff(profile.role) : false} />}>
            <Route path="/notifikasi" element={profile ? <Notifikasi profile={profile} /> : null} />
          </Route>

          <Route element={<RoleGate allow={profile ? canTahsin(profile.role) : false} />}>
            <Route path="/tahsin" element={<TahsinHub admin={profile ? isAdminRole(profile.role) : false} />} />
            <Route
              element={
                <RoleGate allow={profile ? isGuruTahsinRole(profile.role) : false} to="/tahsin" />
              }
            >
              <Route
                path="/tahsin/input-setoran"
                element={profile ? <InputSetoran profile={profile} /> : null}
              />
            </Route>
            <Route
              path="/tahsin/riwayat"
              element={profile ? <RiwayatSiswa profile={profile} /> : null}
            />
            <Route
              path="/tahsin/target"
              element={profile ? <TargetHafalan profile={profile} /> : null}
            />
            <Route path="/tahsin/laporan" element={profile ? <LaporanTahsin profile={profile} /> : null} />
            <Route path="/tahsin/*" element={<Placeholder />} />
          </Route>

          <Route element={<RoleGate allow={profile ? canAkademik(profile.role) : false} />}>
            <Route path="/akademik" element={<AkademikHub admin={profile ? isAdminRole(profile.role) : false} />} />
            <Route path="/akademik/setup-tp" element={profile ? <SetupTp profile={profile} /> : null} />
            <Route
              path="/akademik/bobot-semester"
              element={profile ? <BobotSemester profile={profile} /> : null}
            />
            <Route path="/akademik/nilai-slm" element={profile ? <NilaiSlm profile={profile} /> : null} />
            <Route path="/akademik/nilai-sts" element={profile ? <NilaiStsSas profile={profile} /> : null} />
            <Route path="/akademik/laporan-slm" element={profile ? <LaporanSlm profile={profile} /> : null} />
            <Route path="/akademik/rapor" element={profile ? <Rapor profile={profile} /> : null} />
            <Route path="/akademik/*" element={<Placeholder />} />
          </Route>

          <Route element={<RoleGate allow={profile ? isAdminRole(profile.role) : false} />}>
            <Route path="/admin" element={<AdminHub />} />
            <Route
              path="/admin/siswa"
              element={profile ? <DataSiswa profile={profile} /> : null}
            />
            <Route
              path="/admin/users"
              element={profile ? <KelolaAkun profile={profile} /> : null}
            />
            <Route
              path="/admin/mapel"
              element={profile ? <SetupMapel profile={profile} /> : null}
            />
            <Route
              path="/admin/tahun-ajaran"
              element={profile ? <TahunAjaran profile={profile} /> : null}
            />
            <Route
              path="/admin/periode"
              element={profile ? <KelolaPeriode profile={profile} /> : null}
            />
            <Route path="/admin/*" element={<Placeholder />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />}
        />
      </Routes>
      </PeriodeProvider>
    </BrowserRouter>
  )
}
