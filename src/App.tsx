import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { User } from 'firebase/auth'
import { subscribeAuth } from './lib/auth'
import type { AppUser } from './types/user'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import TahsinHub from './pages/TahsinHub'
import AkademikHub from './pages/AkademikHub'
import AdminHub from './pages/AdminHub'
import Placeholder from './pages/Placeholder'
import InputSetoran from './pages/tahsin/InputSetoran'

function LoadingScreen() {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface-2">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muh-200 border-t-muh-600" />
        <p className="text-[11px] text-muted">Memuat…</p>
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
      setUser(u)
      setProfile(p)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  if (loading) return <LoadingScreen />

  const isAuthenticated = Boolean(user && profile)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
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

          <Route path="/tahsin" element={<TahsinHub />} />
          <Route
            path="/tahsin/input-setoran"
            element={profile ? <InputSetoran profile={profile} /> : null}
          />
          <Route path="/tahsin/*" element={<Placeholder />} />

          <Route path="/akademik" element={<AkademikHub />} />
          <Route path="/akademik/*" element={<Placeholder />} />

          <Route path="/admin" element={<AdminHub />} />
          <Route path="/admin/*" element={<Placeholder />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
