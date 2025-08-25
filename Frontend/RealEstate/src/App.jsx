import './App.css'
import { useEffect, useState } from 'react'
import LandingPage from './pages/LandingPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import { apiFetch, clearAuthTokens, getAccessToken } from './api/client.js'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAccessToken())
  const [profile, setProfile] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard') // 'dashboard' or 'ai-assistant'

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
    setCurrentPage('dashboard')
  }

  const navigateToPage = (page) => {
    setCurrentPage(page)
  }

  if (!isAuthenticated) {
    return <LandingPage onLogin={handleLogin} />
  }

  // Navigation bar component
  const NavigationBar = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="text-xl font-bold text-slate-100">
              RealEstate Pro
            </div>
            <nav className="flex space-x-4">
              <button
                onClick={() => navigateToPage('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'dashboard'
                    ? 'bg-blue-900/50 text-blue-200 border border-blue-700'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigateToPage('ai-assistant')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  currentPage === 'ai-assistant'
                    ? 'bg-purple-900/50 text-purple-200 border border-purple-700'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                🤖 AI Assistant
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-slate-300 text-sm">
              Welcome, {profile?.username || 'User'}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-red-900/50 hover:bg-red-800/50 text-red-200 rounded-md text-sm font-medium border border-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Render current page with navigation
  return (
    <div className="min-h-screen bg-slate-900">
      <NavigationBar />
      <div className="pt-16">
        {currentPage === 'dashboard' && (
          <Dashboard profile={profile} onLogout={handleLogout} />
        )}
        {currentPage === 'ai-assistant' && (
          <AIAssistant />
        )}
      </div>
    </div>
  )
}
