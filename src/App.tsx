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

function LoadingScreen() {
  return (
    <div className="flex min-h-full items-center justify-center bg-surface-2">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-muh-200 border-t-muh-700" />
        <p className="text-sm font-medium text-muted">Memuat…</p>
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
        {/* Public */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protected — butuh login + profil Firestore */}
        <Route
          element={
            isAuthenticated && profile ? (
              <Layout profile={profile} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            path="/"
            element={profile ? <Home profile={profile} /> : null}
          />

          {/* Tahsin-Tahfizh */}
          <Route path="/tahsin" element={<TahsinHub />} />
          <Route path="/tahsin/*" element={<Placeholder />} />

          {/* Akademik */}
          <Route path="/akademik" element={<AkademikHub />} />
          <Route path="/akademik/*" element={<Placeholder />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminHub />} />
          <Route path="/admin/*" element={<Placeholder />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
