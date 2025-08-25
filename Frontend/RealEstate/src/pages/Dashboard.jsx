import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch, clearAuthTokens, logoutApi } from '../api/client.js'
import PropertyMap from '../components/PropertyMap.jsx'
import PropertyValuation from '../components/PropertyValuation.jsx'
import DealPipeline from '../components/DealPipeline.jsx'
import Portfolio from '../components/Portfolio.jsx'

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

function PropertyCard({ property, onAddToWatchlist, onOpenValuation }) {
  const { metrics } = property
  
  return (
    <div className="card hover:border-slate-600 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-slate-100 font-semibold">{property.address}</h3>
          <p className="text-slate-400 text-sm">{property.city}, {property.state} {property.zip_code}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onOpenValuation && onOpenValuation(property)}
            className="text-blue-400 hover:text-blue-300 text-sm bg-blue-900/20 hover:bg-blue-900/30 px-2 py-1 rounded"
            title="AI Valuation"
          >
            🤖
          </button>
          <button 
            onClick={() => onAddToWatchlist(property.id)}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ⭐
          </button>
        </div>
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
      
      <div className="grid grid-cols-3 gap-2 mb-3" style={metrics?.roi ? {gridTemplateColumns: 'repeat(4, 1fr)'} : {}}>
        <div className="text-center">
          <div className="text-xs text-slate-400">Score</div>
          <div className="text-sm font-bold text-green-400">
            {metrics?.investment_score ? metrics.investment_score.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400">Cap Rate</div>
          <div className="text-sm font-bold text-blue-400">
            {metrics?.cap_rate ? `${metrics.cap_rate.toFixed(1)}%` : 'N/A'}
          </div>
        </div>
        {metrics?.roi && (
          <div className="text-center">
            <div className="text-xs text-slate-400">ROI</div>
            <div className="text-sm font-bold text-purple-400">
              {metrics.roi.toFixed(1)}%
            </div>
          </div>
        )}
        <div className="text-center">
          <div className="text-xs text-slate-400">Yield</div>
          <div className="text-sm font-bold text-yellow-400">
            {metrics?.gross_rental_yield ? `${metrics.gross_rental_yield.toFixed(1)}%` : 'N/A'}
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
  // Removed unused dataSource state
  const [filters, setFilters] = useState({
    property_type: '',
    sort_by: 'investment_score',
    order: 'desc'
  })
  const [advancedFilters, setAdvancedFilters] = useState({
    ordering: '-metrics__investment_score',
    min_cap_rate: '',
    max_cap_rate: '',
    min_roi: '',
    max_roi: '',
    min_cash_on_cash_return: '',
    max_cash_on_cash_return: '',
    min_price: '',
    max_price: '',
    min_noi: '',
    max_noi: '',
    property_type: '',
    has_metrics: true,
    is_profitable: false,
    high_cap_rate: false,
    good_cash_flow: false
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [bestDeals, setBestDeals] = useState([])
  const [bestDealsLoading, setBestDealsLoading] = useState(false)
  const [filterOptions, setFilterOptions] = useState({
    sort_options: [],
    property_types: []
  })
  const [syncing, setSyncing] = useState(false)
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [showAddPropertyForm, setShowAddPropertyForm] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' or 'map'
  
  // Valuation modal state
  const [showValuationModal, setShowValuationModal] = useState(false)
  const [selectedPropertyForValuation, setSelectedPropertyForValuation] = useState(null)

  const fetchDashboardStats = useCallback(async () => {
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
  }, [])

  const fetchProperties = useCallback(async () => {
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
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    } finally {
      setPropertiesLoading(false)
    }
  }, [filters])

  const fetchBestDeals = useCallback(async () => {
    setBestDealsLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(advancedFilters).forEach(([key, value]) => {
        if (value !== '' && value !== false) {
          params.append(key, value)
        }
      })
      
      const res = await apiFetch(`/api/best-deals/?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBestDeals(data.results || [])
        setFilterOptions(data.filter_options || { sort_options: [], property_types: [] })
      }
    } catch (error) {
      console.error('Failed to fetch best deals:', error)
    } finally {
      setBestDealsLoading(false)
    }
  }, [advancedFilters])

  useEffect(() => {
    fetchDashboardStats()
    fetchProperties()
    fetchBestDeals()
  }, [fetchDashboardStats, fetchProperties, fetchBestDeals])

  // Fetch functions moved up as useCallback hooks

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
        fetchBestDeals()
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

  const handleOpenValuation = (property) => {
    setSelectedPropertyForValuation(property)
    setShowValuationModal(true)
  }

  const handleCloseValuation = () => {
    setShowValuationModal(false)
    setSelectedPropertyForValuation(null)
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
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              📊 Dashboard & Analytics
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'map'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              🗺️ Interactive Bar Chart Map
            </button>
            <button
              onClick={() => setActiveTab('deals')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'deals'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              🏢 Deal Pipeline
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'portfolio'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              📂 Portfolio Review
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <>
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
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                showAdvancedFilters 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              🔍 Best Deals Filter
            </button>
          </div>
          
          <button
            onClick={() => setShowAddPropertyForm(!showAddPropertyForm)}
            className="btn-primary text-sm"
          >
            Add Property from ATTOM
          </button>
        </div>

        {/* Advanced Best Deals Filtering */}
        {showAdvancedFilters && (
          <div className="mb-8 glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">🎯 Best Investment Deals Filter</h3>
            <div className="text-sm text-slate-400 mb-4">
              Apply advanced filters to find the best investment opportunities based on your criteria.
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Sorting */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Sort By</label>
                <select
                  value={advancedFilters.ordering}
                  onChange={(e) => setAdvancedFilters(prev => ({...prev, ordering: e.target.value}))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  {filterOptions.sort_options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Cap Rate Range */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Cap Rate (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.min_cap_rate}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, min_cap_rate: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.max_cap_rate}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, max_cap_rate: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* ROI Range */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">ROI (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.min_roi}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, min_roi: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.max_roi}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, max_roi: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cash-on-Cash Return Range */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Cash-on-Cash Return (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.min_cash_on_cash_return}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, min_cash_on_cash_return: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.max_cash_on_cash_return}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, max_cash_on_cash_return: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min $"
                    value={advancedFilters.min_price}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, min_price: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max $"
                    value={advancedFilters.max_price}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, max_price: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* NOI Range */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Net Operating Income</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min $"
                    value={advancedFilters.min_noi}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, min_noi: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max $"
                    value={advancedFilters.max_noi}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, max_noi: e.target.value}))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Quick Filters</h4>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={advancedFilters.is_profitable}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, is_profitable: e.target.checked}))}
                    className="rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Profitable Only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={advancedFilters.high_cap_rate}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, high_cap_rate: e.target.checked}))}
                    className="rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">High Cap Rate (≥8%)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={advancedFilters.good_cash_flow}
                    onChange={(e) => setAdvancedFilters(prev => ({...prev, good_cash_flow: e.target.checked}))}
                    className="rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Positive Cash Flow</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  // Reset filters
                  setAdvancedFilters({
                    ordering: '-metrics__investment_score',
                    min_cap_rate: '',
                    max_cap_rate: '',
                    min_roi: '',
                    max_roi: '',
                    min_cash_on_cash_return: '',
                    max_cash_on_cash_return: '',
                    min_price: '',
                    max_price: '',
                    min_noi: '',
                    max_noi: '',
                    property_type: '',
                    has_metrics: true,
                    is_profitable: false,
                    high_cap_rate: false,
                    good_cash_flow: false
                  })
                }}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

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

        {/* Best Investment Deals (Filtered Results) */}
        {showAdvancedFilters && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">🎯 Best Investment Deals ({bestDeals.length} found)</h2>
            {bestDealsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => <LoadingCard key={i} />)}
              </div>
            ) : bestDeals.length > 0 ? (
              <div className="space-y-4">
                {bestDeals.slice(0, 10).map((property, index) => (
                  <div key={property.id} className="glass rounded-xl p-6 hover:border-slate-600 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-100">{property.address}</h3>
                          <p className="text-slate-400">{property.city}, {property.state}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-400">
                          {property.metrics?.investment_score?.toFixed(1) || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Investment Score</div>
                      </div>
                    </div>
                    
                    <div className={`grid grid-cols-2 gap-4 ${property.metrics?.roi ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-slate-100">
                          ${property.current_price?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Purchase Price</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-400">
                          {property.metrics?.cap_rate?.toFixed(1) || 'N/A'}%
                        </div>
                        <div className="text-xs text-slate-400">Cap Rate</div>
                      </div>
                      {property.metrics?.roi && (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-purple-400">
                            {property.metrics.roi.toFixed(1)}%
                          </div>
                          <div className="text-xs text-slate-400">ROI</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400">
                          ${property.estimated_rent?.toLocaleString() || 'N/A'}/mo
                        </div>
                        <div className="text-xs text-slate-400">Monthly Rent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-yellow-400">
                          ${property.metrics?.net_operating_income?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Annual NOI</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">
                          💰 Potential Profit: <span className="text-green-400 font-semibold">
                            ${property.metrics?.estimated_profit?.toLocaleString() || 'N/A'}
                          </span>
                        </span>
                        <span className="text-slate-400">
                          💵 Cash-on-Cash: <span className="text-blue-400 font-semibold">
                            {property.metrics?.cash_on_cash_return?.toFixed(1) || 'N/A'}%
                          </span>
                        </span>
                        <span className="text-slate-400">
                          🏠 {property.bedrooms}bd/{property.bathrooms}ba • {property.square_feet?.toLocaleString() || 'N/A'} sqft
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                No properties match your advanced filter criteria. Try adjusting your filters.
              </div>
            )}
          </div>
        )}

        {/* Top Investment Opportunities */}
        {!showAdvancedFilters && properties.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">🏆 Top Investment Opportunities</h2>
            <div className="space-y-4">
              {properties
                .filter(p => p.metrics?.investment_score && p.current_price && p.estimated_rent)
                .sort((a, b) => (b.metrics?.investment_score || 0) - (a.metrics?.investment_score || 0))
                .slice(0, 5)
                .map((property, index) => (
                  <div key={property.id} className="glass rounded-xl p-6 hover:border-slate-600 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-100">{property.address}</h3>
                          <p className="text-slate-400">{property.city}, {property.state}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-400">
                          {property.metrics.investment_score.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-400">Investment Score</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-slate-100">
                          ${property.current_price.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400">Purchase Price</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-400">
                          {property.metrics.cap_rate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-slate-400">Cap Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400">
                          ${property.estimated_rent.toLocaleString()}/mo
                        </div>
                        <div className="text-xs text-slate-400">Monthly Rent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-400">
                          ${property.metrics.net_operating_income?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Annual NOI</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">
                          💰 Potential Profit: <span className="text-green-400 font-semibold">
                            ${property.metrics.estimated_profit ? property.metrics.estimated_profit.toLocaleString() : 'N/A'}
                          </span>
                        </span>
                        <span className="text-slate-400">
                          🏠 {property.bedrooms}bd/{property.bathrooms}ba • {property.square_feet?.toLocaleString() || 'N/A'} sqft
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            
            {properties.filter(p => p.metrics?.investment_score).length === 0 && (
              <div className="text-center py-8 text-slate-400">
                No investment metrics available yet. Add properties with complete pricing data to see opportunities.
              </div>
            )}
          </div>
        )}

        {/* All Properties Portfolio */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-100">
              Property Portfolio ({properties.length})
            </h2>
            <div className="text-sm text-slate-400">
              {properties.filter(p => p.metrics?.investment_score).length} properties analyzed • Real-time ATTOM data
            </div>
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
                  onOpenValuation={handleOpenValuation}
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
          </>
        )}

        {/* Map Content */}
        {activeTab === 'map' && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-100 mb-2">Interactive Property Bar Chart Map</h1>
              <p className="text-slate-400 mb-6">Visualize your property portfolio with bar graphs - bar height shows metric value, color indicates profitability category</p>
            </div>
            
            {/* Map Filters */}
            <div className="mb-6 flex flex-wrap gap-4 items-center">
              <div className="flex flex-wrap gap-3">
                <input
                  type="text" 
                  placeholder="Filter by city..."
                  className="input text-sm w-40"
                  onChange={(e) => {
                    // Update filters for map
                    setFilters(prev => ({...prev, city: e.target.value}))
                  }}
                />
                <input
                  type="text" 
                  placeholder="Filter by state..."
                  className="input text-sm w-40"
                  onChange={(e) => {
                    setFilters(prev => ({...prev, state: e.target.value}))
                  }}
                />
                <input
                  type="number" 
                  placeholder="Min score..."
                  className="input text-sm w-32"
                  onChange={(e) => {
                    setFilters(prev => ({...prev, min_investment_score: e.target.value}))
                  }}
                />
              </div>
              
              <button
                onClick={() => setShowAddPropertyForm(!showAddPropertyForm)}
                className="btn-primary text-sm"
              >
                Add Property from ATTOM
              </button>
            </div>

            {/* Add Property Form for Map Tab */}
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

            {/* Property Map Component */}
            <PropertyMap 
              filters={filters}
              className="mb-8"
            />
          </>
        )}

        {/* Deals Content */}
        {activeTab === 'deals' && (
          <DealPipeline />
        )}

        {activeTab === 'portfolio' && (
          <Portfolio />
        )}
      </div>
      
      {/* Valuation Modal */}
      {showValuationModal && selectedPropertyForValuation && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">
                  AI Property Valuation
                </h2>
                <p className="text-slate-400 text-sm">
                  {selectedPropertyForValuation.address}, {selectedPropertyForValuation.city}, {selectedPropertyForValuation.state}
                </p>
              </div>
              <button
                onClick={handleCloseValuation}
                className="text-slate-400 hover:text-slate-200 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <PropertyValuation 
                propertyId={selectedPropertyForValuation.id}
                className="text-slate-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
