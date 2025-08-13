import { useState } from 'react'
import { saveAuthTokens, loginApi } from '../api/client'

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await loginApi(username, password)
      saveAuthTokens({ access: data.access, refresh: data.refresh })
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:'linear-gradient(180deg,#070b12 0%, #090e18 100%)'}}>
      <div className="w-full max-w-sm card" style={{borderRadius:'1rem', padding:'1.5rem'}}>
        <h1 className="text-xl font-semibold text-slate-100 mb-4">Login</h1>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input className="input" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} required />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}


