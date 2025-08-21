import './App.css'
import { useEffect, useState } from 'react'
import LandingPage from './pages/LandingPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { apiFetch, clearAuthTokens, getAccessToken } from './api/client.js'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAccessToken())
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    ;(async () => {
      const res = await apiFetch('/api/auth/me/')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      } else if (res.status === 401) {
        setIsAuthenticated(false)
        clearAuthTokens()
      }
    })()
  }, [isAuthenticated])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setProfile(null)
  }

  if (!isAuthenticated) {
    return <LandingPage onLogin={handleLogin} />
  }

  return <Dashboard profile={profile} onLogout={handleLogout} />
}
