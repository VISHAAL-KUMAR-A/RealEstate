import { useState, useEffect } from 'react'
import { apiFetch, clearAuthTokens, logoutApi } from '../api/client.js'

function StatCard({ label, value, subtitle, loading }) {
  return (
    <div className="glass rounded-xl px-4 py-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      {loading ? (
        <div className="mt-1 h-6 bg-slate-700 animate-pulse rounded"></div>
      ) : (
        <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      )}
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  )
}

function PropertyCard({ property, onAddToWatchlist }) {
  const { metrics } = property
  
  return (
    <div className="card hover:border-slate-600 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-slate-100 font-semibold">{property.address}</h3>
          <p className="text-slate-400 text-sm">{property.city}, {property.state} {property.zip_code}</p>
        </div>
        <button 
          onClick={() => onAddToWatchlist(property.id)}
          className="text-slate-400 hover:text-slate-200 text-sm"
        >
          ⭐
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-400">Price</div>
          <div className="text-slate-100 font-semibold">
            ${property.current_price ? property.current_price.toLocaleString() : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Est. Rent</div>
          <div className="text-slate-100 font-semibold">
            ${property.estimated_rent ? property.estimated_rent.toLocaleString() : 'N/A'}/mo
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-xs text-slate-400">Score</div>
          <div className="text-lg font-bold text-green-400">
            {metrics.investment_score ? metrics.investment_score.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400">Cap Rate</div>
          <div className="text-lg font-bold text-blue-400">
            {metrics.cap_rate ? `${metrics.cap_rate.toFixed(1)}%` : 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400">Yield</div>
          <div className="text-lg font-bold text-purple-400">
            {metrics.gross_rental_yield ? `${metrics.gross_rental_yield.toFixed(1)}%` : 'N/A'}
          </div>
        </div>
      </div>
      
      <div className="text-xs text-slate-500 flex justify-between">
        <span>{property.property_type} • {property.bedrooms}bd {property.bathrooms}ba</span>
        <span>{property.square_feet ? property.square_feet.toLocaleString() : 'N/A'} sqft</span>
      </div>
    </div>
  )
}

function LoadingCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-slate-700 rounded mb-2"></div>
      <div className="h-3 bg-slate-700 rounded w-2/3 mb-4"></div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="h-8 bg-slate-700 rounded"></div>
        <div className="h-8 bg-slate-700 rounded"></div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="h-6 bg-slate-700 rounded"></div>
        <div className="h-6 bg-slate-700 rounded"></div>
        <div className="h-6 bg-slate-700 rounded"></div>
      </div>
    </div>
  )
}

export default function Dashboard({ profile, onLogout }) {
  const [dashboardStats, setDashboardStats] = useState(null)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [propertiesLoading, setPropertiesLoading] = useState(true)
  const [dataSource, setDataSource] = useState(null)
  const [filters, setFilters] = useState({
    property_type: '',
    sort_by: 'investment_score',
    order: 'desc'
  })
  const [syncing, setSyncing] = useState(false)
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [showAddPropertyForm, setShowAddPropertyForm] = useState(false)

  useEffect(() => {
    fetchDashboardStats()
    fetchProperties()
  }, [])

  useEffect(() => {
    fetchProperties()
  }, [filters])

  const fetchDashboardStats = async () => {
    try {
      const res = await apiFetch('/api/dashboard-stats/')
      if (res.ok) {
        const data = await res.json()
        setDashboardStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProperties = async () => {
    setPropertiesLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const res = await apiFetch(`/api/investment-opportunities/?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProperties(data.results || [])
        setDataSource(data)
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    } finally {
      setPropertiesLoading(false)
    }
  }

  const handleSyncData = async (address1, address2) => {
    if (!address1 || !address2) {
      alert('Please provide both street address and city/state')
      return
    }
    
    setSyncing(true)
    try {
      const res = await apiFetch('/api/sync-property-data/', {
        method: 'POST',
        body: JSON.stringify({
          address1: address1.trim(),
          address2: address2.trim()
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        // Clear form and hide it
        setAddress1('')
        setAddress2('')
        setShowAddPropertyForm(false)
        // Show success message
        alert(`✅ Property added successfully!\n${data.property.address}\nPrice: $${data.property.current_price?.toLocaleString() || 'N/A'}`)
        // Refresh data
        fetchDashboardStats()
        fetchProperties()
      } else {
        const error = await res.json()
        alert(`❌ Failed to add property: ${error.error || error.details}`)
      }
    } catch (error) {
      console.error('Failed to sync data:', error)
      alert('Failed to sync data')
    } finally {
      setSyncing(false)
    }
  }

  const handleAddToWatchlist = async (propertyId) => {
    try {
      const res = await apiFetch('/api/watchlist/', {
        method: 'POST',
        body: JSON.stringify({ property_id: propertyId })
      })
      
      if (res.ok) {
        const data = await res.json()
        alert(data.message)
      }
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
      alert('Failed to add to watchlist')
    }
  }

  const handleLogout = async () => {
    await logoutApi()
    clearAuthTokens()
    onLogout()
  }

  return (
    <div className="min-h-screen" style={{background:'linear-gradient(180deg,#070b12 0%, #090e18 100%)'}}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800" style={{backdropFilter:'blur(8px)', background:'rgba(7,11,18,0.8)'}}>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{background:'#0ea5e9', boxShadow:'0 0 30px rgba(56,189,248,0.35)'}} />
            <span className="text-sm font-semibold tracking-wide text-slate-200">Atlas REI AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">Welcome, {profile?.username}</span>
            <button 
              onClick={handleLogout}
              className="btn-secondary text-sm"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Dashboard Stats */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Investment Dashboard</h1>
          <p className="text-slate-400 mb-6">Add specific property addresses to get real-time data from ATTOM API and analyze investment opportunities</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              label="Total Properties" 
              value={dashboardStats?.total_properties || 0} 
              loading={loading}
            />
            <StatCard 
              label="With Metrics" 
              value={dashboardStats?.properties_with_metrics || 0} 
              loading={loading}
            />
            <StatCard 
              label="Avg Investment Score" 
              value={dashboardStats?.average_metrics?.investment_score?.toFixed(1) || '0.0'} 
              loading={loading}
            />
            <StatCard 
              label="Avg Cap Rate" 
              value={dashboardStats?.average_metrics?.cap_rate ? `${dashboardStats.average_metrics.cap_rate.toFixed(1)}%` : '0.0%'} 
              loading={loading}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.sort_by}
              onChange={(e) => setFilters(prev => ({...prev, sort_by: e.target.value}))}
              className="input text-sm w-40"
            >
              <option value="investment_score">Investment Score</option>
              <option value="cap_rate">Cap Rate</option>
              <option value="gross_rental_yield">Rental Yield</option>
              <option value="current_price">Price</option>
            </select>
            <select
              value={filters.order}
              onChange={(e) => setFilters(prev => ({...prev, order: e.target.value}))}
              className="input text-sm w-32"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
          
          <button
            onClick={() => setShowAddPropertyForm(!showAddPropertyForm)}
            className="btn-primary text-sm"
          >
            Add Property from ATTOM
          </button>
        </div>

        {/* Add Property Form */}
        {showAddPropertyForm && (
          <div className="mb-8 glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Add Property from ATTOM API</h3>
            <div className="text-sm text-slate-400 mb-4">
              ATTOM API requires specific property addresses. Enter the exact street address and city/state.
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder="e.g., 4529 Winona Court"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  City, State
                </label>
                <input
                  type="text"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="e.g., Denver, CO"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSyncData(address1, address2)}
                  disabled={syncing || !address1 || !address2}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Adding Property...' : 'Add Property'}
                </button>
                <button
                  onClick={() => {
                    setShowAddPropertyForm(false)
                    setAddress1('')
                    setAddress2('')
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs text-slate-500">
                <strong>Examples:</strong><br/>
                • 4529 Winona Court, Denver, CO<br/>
                • 468 Sequoia Dr, Smyrna, DE<br/>
                • 123 Main Street, Atlanta, GA
              </div>
            </div>
          </div>
        )}

        {/* Top Properties */}
        {dashboardStats?.top_properties?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Top Performers</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {dashboardStats.top_properties.map((prop, index) => (
                <div key={index} className="card text-center">
                  <div className="text-xs text-slate-400 mb-1">#{index + 1}</div>
                  <div className="text-sm font-semibold text-slate-100 mb-1">{prop.address}</div>
                  <div className="text-xs text-slate-400 mb-2">{prop.city}, {prop.state}</div>
                  <div className="text-lg font-bold text-green-400">{prop.investment_score.toFixed(1)}</div>
                  <div className="text-xs text-slate-400">{prop.cap_rate.toFixed(1)}% Cap Rate</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investment Opportunities */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-100">
              Investment Opportunities ({properties.length})
            </h2>
            {dataSource && (
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Real-time Data</span>
                </div>
                <span className="text-slate-400">from {dataSource.search_location}</span>
              </div>
            )}
          </div>
          
          {propertiesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <LoadingCard key={i} />)}
            </div>
          ) : properties.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <PropertyCard 
                  key={property.id} 
                  property={property} 
                  onAddToWatchlist={handleAddToWatchlist}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">No properties found. Add specific property addresses to get real ATTOM data.</div>
              <button 
                onClick={() => setShowAddPropertyForm(true)} 
                className="btn-primary"
              >
                Add Property from ATTOM
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
