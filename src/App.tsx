import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router-dom'
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
import KelengkapanRapor from './pages/akademik/KelengkapanRapor'
import KelolaEkstrakurikuler from './pages/admin/KelolaEkstrakurikuler'
import LaporanTahsin from './pages/tahsin/LaporanTahsin'
import EksporNilai from './pages/tahsin/EksporNilai'
import ImporNilaiV2 from './pages/tahsin/ImporNilaiV2'
import Home from './pages/Home'
import TahsinHub from './pages/TahsinHub'
import AkademikHub from './pages/AkademikHub'
import AdminHub from './pages/AdminHub'
import Placeholder from './pages/Placeholder'
import InputSetoran from './pages/tahsin/InputSetoran'
import CatatMenulis from './pages/tahsin/CatatMenulis'
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
import LaporanNilai from './pages/akademik/LaporanNilai'
import Leger from './pages/akademik/Leger'
import Rapor from './pages/akademik/Rapor'
import InputEkskul from './pages/akademik/InputEkskul'
import Kokurikuler from './pages/akademik/Kokurikuler'
import ProyekStemDetail from './pages/akademik/ProyekStemDetail'
import MutasiSiswa from './pages/akademik/MutasiSiswa'
import PublikasiSts from './pages/akademik/PublikasiSts'
import MutasiSiswaAdmin from './pages/admin/MutasiSiswaAdmin'

/** Menjaga rute per role di sisi UI. Penegakan sebenarnya tetap di firestore.rules. */
function RoleGate({ allow, to = '/' }: { allow: boolean; to?: string }) {
  return allow ? <Outlet /> : <Navigate to={to} replace />
}

/** Alihkan /akademik/laporan-slm → /akademik/laporan?jenis=slm (bookmark lama). */
function RedirectLaporanSlm() {
  const [params] = useSearchParams()
  const q = new URLSearchParams(params)
  q.set('jenis', 'slm')
  const s = q.toString()
  return <Navigate to={s ? `/akademik/laporan?${s}` : '/akademik/laporan?jenis=slm'} replace />
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
              <Route
                path="/tahsin/menulis"
                element={profile ? <CatatMenulis profile={profile} /> : null}
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
            <Route path="/tahsin/ekspor" element={profile ? <EksporNilai profile={profile} /> : null} />
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
            {/* Laporan terpadu (tab SLM | STS | SAS) per mapel */}
            <Route path="/akademik/laporan" element={profile ? <LaporanNilai profile={profile} /> : null} />
            {/* Alias lama — jangan putus bookmark */}
            <Route path="/akademik/laporan-slm" element={<RedirectLaporanSlm />} />
            {/* Leger: seluruh siswa × seluruh mapel + total/rata-rata/peringkat */}
            <Route path="/akademik/leger" element={profile ? <Leger profile={profile} /> : null} />
            {/* Rapor terpadu: toggle STS/SAS di dalam halaman; /rapor-sas tetap jalan */}
            <Route path="/akademik/rapor" element={profile ? <Rapor profile={profile} /> : null} />
            <Route path="/akademik/rapor-sas" element={profile ? <Rapor profile={profile} jenis="sas" /> : null} />
            <Route path="/akademik/kelengkapan-rapor" element={profile ? <KelengkapanRapor profile={profile} /> : null} />
            <Route path="/akademik/publikasi-sts" element={profile ? <PublikasiSts profile={profile} /> : null} />
            {/* Ekstrakurikuler: pengampu ekskul atau wali kelas */}
            <Route path="/akademik/ekskul" element={profile ? <InputEkskul profile={profile} /> : null} />
            <Route path="/akademik/kokurikuler" element={profile ? <Kokurikuler profile={profile} /> : null} />
            <Route
              path="/akademik/kokurikuler/proyek/:proyekId"
              element={profile ? <ProyekStemDetail profile={profile} /> : null}
            />
            {/* Mutasi: hanya wali kelas yang mengajukan (bukan admin) */}
            <Route path="/akademik/mutasi" element={profile ? <MutasiSiswa profile={profile} /> : null} />
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
            <Route
              path="/admin/ekstrakurikuler"
              element={profile ? <KelolaEkstrakurikuler profile={profile} /> : <KelolaEkstrakurikuler />}
            />
            {/* Migrasi sementara penilaian-v2 → hapus setelah semua kelas selesai */}
            <Route
              path="/admin/impor-nilai-v2"
              element={profile ? <ImporNilaiV2 profile={profile} /> : null}
            />
            <Route
              path="/admin/mutasi"
              element={profile ? <MutasiSiswaAdmin profile={profile} /> : null}
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
