import React, { useState, useEffect } from 'react'
import { apiFetch } from '../api/client.js'

// Simple SVG-based map component
function PropertyMap({ filters = {}, className = "" }) {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [mapView, setMapView] = useState('investment') // 'investment', 'price', 'rent'

  const fetchMapData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const res = await apiFetch(`/api/properties-map-data/?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMapData(data)
      }
    } catch (error) {
      console.error('Failed to fetch map data:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchMapData()
  }, [fetchMapData])

  // Convert lat/lng to SVG coordinates within the map bounds
  const coordinateToSVG = (lat, lng, bounds, svgWidth = 800, svgHeight = 600) => {
    if (!bounds) return { x: 0, y: 0 }
    
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * svgWidth
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * svgHeight
    
    return { x, y }
  }

  const getColorForView = (property) => {
    switch (mapView) {
      case 'price':
        if (!property.current_price) return 'url(#grayGradient)'
        if (property.current_price > 500000) return 'url(#redGradient)'
        if (property.current_price > 300000) return 'url(#yellowGradient)'
        return 'url(#greenGradient)'
      case 'rent':
        if (!property.estimated_rent) return 'url(#grayGradient)'
        if (property.estimated_rent > 3000) return 'url(#greenGradient)'
        if (property.estimated_rent > 2000) return 'url(#yellowGradient)'
        return 'url(#redGradient)'
      case 'investment':
      default:
        // Use gradient based on original category
        if (property.category === 'high') return 'url(#greenGradient)'
        if (property.category === 'medium') return 'url(#yellowGradient)'
        if (property.category === 'low') return 'url(#redGradient)'
        return 'url(#grayGradient)'
    }
  }

  // Get bar height based on the selected metric
  const getBarHeight = (property, maxHeight = 40) => {
    let value = 0
    let maxValue = 100

    switch (mapView) {
      case 'price':
        value = property.current_price || 0
        maxValue = Math.max(...mapData.properties.map(p => p.current_price || 0))
        break
      case 'rent':
        value = property.estimated_rent || 0
        maxValue = Math.max(...mapData.properties.map(p => p.estimated_rent || 0))
        break
      case 'investment':
      default:
        value = property.investment_score || 0
        maxValue = Math.max(...mapData.properties.map(p => p.investment_score || 0))
        break
    }

    if (maxValue === 0) return 5 // minimum height
    return Math.max(5, (value / maxValue) * maxHeight) // minimum 5px height
  }

  // Get formatted value for display
  const getDisplayValue = (property) => {
    switch (mapView) {
      case 'price':
        return property.current_price ? `$${(property.current_price / 1000).toFixed(0)}k` : 'N/A'
      case 'rent':
        return property.estimated_rent ? `$${property.estimated_rent.toLocaleString()}/mo` : 'N/A'
      case 'investment':
      default:
        return property.investment_score ? property.investment_score.toFixed(1) : 'N/A'
    }
  }

  if (loading) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-400">Loading map...</div>
        </div>
      </div>
    )
  }

  if (!mapData || !mapData.properties || mapData.properties.length === 0) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-slate-100 mb-4">🗺️ Property Map</h3>
        <div className="flex items-center justify-center h-96 text-slate-400">
          No properties with coordinates found
        </div>
      </div>
    )
  }

  const svgWidth = 800
  const svgHeight = 600

  return (
    <div className={`glass rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">📊 Property Bar Chart Map ({mapData.count})</h3>
          <p className="text-sm text-slate-400">Bar height represents metric value, color shows profitability category</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={mapView}
            onChange={(e) => setMapView(e.target.value)}
            className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="investment">Investment Score</option>
            <option value="price">Property Price</option>
            <option value="rent">Rental Income</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        {mapView === 'investment' && mapData.color_legend && (
          <>
            {Object.entries(mapData.color_legend).map(([key, legend]) => (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: legend.color }}
                ></div>
                <span className="text-slate-300">{legend.label}</span>
              </div>
            ))}
          </>
        )}
        {mapView === 'price' && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-300">$0-300k</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-slate-300">$300k-500k</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span className="text-slate-300">$500k+</span>
            </div>
          </>
        )}
        {mapView === 'rent' && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span className="text-slate-300">$0-2k</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-slate-300">$2k-3k</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-300">$3k+</span>
            </div>
          </>
        )}
      </div>

      {/* Map Container */}
      <div className="relative bg-slate-900 rounded-lg overflow-hidden">
        <svg 
          width="100%" 
          height="600" 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="border border-slate-700"
        >
          {/* Grid lines and gradients for reference */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#374151" strokeWidth="1" opacity="0.3"/>
            </pattern>
            
            {/* Gradient definitions for 3D bar effect */}
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: '#10B981', stopOpacity: 0.9}} />
              <stop offset="50%" style={{stopColor: '#10B981', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: '#065F46', stopOpacity: 0.9}} />
            </linearGradient>
            
            <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: '#F59E0B', stopOpacity: 0.9}} />
              <stop offset="50%" style={{stopColor: '#F59E0B', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: '#92400E', stopOpacity: 0.9}} />
            </linearGradient>
            
            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: '#EF4444', stopOpacity: 0.9}} />
              <stop offset="50%" style={{stopColor: '#EF4444', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: '#991B1B', stopOpacity: 0.9}} />
            </linearGradient>
            
            <linearGradient id="grayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: '#6B7280', stopOpacity: 0.9}} />
              <stop offset="50%" style={{stopColor: '#6B7280', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: '#374151', stopOpacity: 0.9}} />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Property bar charts */}
          {mapData.properties.map((property) => {
            const { x, y } = coordinateToSVG(
              property.latitude, 
              property.longitude, 
              mapData.bounds, 
              svgWidth, 
              svgHeight
            )
            
            const color = getColorForView(property)
            const isSelected = selectedProperty?.id === property.id
            const barHeight = getBarHeight(property)
            const barWidth = isSelected ? 12 : 8
            const displayValue = getDisplayValue(property)
            
            return (
              <g key={property.id}>
                {/* Bar base (ground line) */}
                <rect
                  x={x - barWidth/2}
                  y={y + 2}
                  width={barWidth}
                  height={2}
                  fill="#374151"
                  className="cursor-pointer"
                  onClick={() => setSelectedProperty(selectedProperty?.id === property.id ? null : property)}
                />
                
                {/* Property bar */}
                <rect
                  x={x - barWidth/2}
                  y={y + 2 - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="2"
                  ry="2"
                  fill={color}
                  stroke={isSelected ? '#FFFFFF' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  className="cursor-pointer transition-all duration-300 hover:scale-110"
                  onClick={() => setSelectedProperty(selectedProperty?.id === property.id ? null : property)}
                  style={{
                    filter: isSelected ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
                    transformOrigin: `${x}px ${y + 2}px`
                  }}
                >
                  <animate
                    attributeName="height"
                    values={`5;${barHeight};${barHeight}`}
                    dur="0.8s"
                    begin="0s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="y"
                    values={`${y - 3};${y + 2 - barHeight};${y + 2 - barHeight}`}
                    dur="0.8s"
                    begin="0s"
                    fill="freeze"
                  />
                </rect>
                
                {/* Value label on top of bar */}
                {(isSelected || barHeight > 20) && (
                  <text
                    x={x}
                    y={y + 2 - barHeight - 4}
                    textAnchor="middle"
                    className="fill-slate-100 text-xs font-semibold pointer-events-none"
                    style={{ 
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                      fontSize: isSelected ? '11px' : '9px'
                    }}
                  >
                    {displayValue}
                  </text>
                )}
                
                {/* Property address label for selected */}
                {isSelected && (
                  <text
                    x={x}
                    y={y + 18}
                    textAnchor="middle"
                    className="fill-slate-300 text-xs pointer-events-none"
                    style={{ 
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                      fontSize: '8px'
                    }}
                  >
                    {property.address.length > 20 ? `${property.address.substring(0, 20)}...` : property.address}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        
        {/* Property tooltip/details */}
        {selectedProperty && (
          <div className="absolute top-4 right-4 w-80 bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-xl">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-slate-100 font-semibold text-sm">{selectedProperty.address}</h4>
                <p className="text-slate-400 text-xs">{selectedProperty.city}, {selectedProperty.state}</p>
              </div>
              <button 
                onClick={() => setSelectedProperty(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Investment Score:</span>
                <span className="text-slate-100 text-xs font-semibold">
                  {selectedProperty.investment_score?.toFixed(1) || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Price:</span>
                <span className="text-slate-100 text-xs">
                  ${selectedProperty.current_price?.toLocaleString() || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Est. Rent:</span>
                <span className="text-slate-100 text-xs">
                  ${selectedProperty.estimated_rent?.toLocaleString() || 'N/A'}/mo
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Cap Rate:</span>
                <span className="text-slate-100 text-xs">
                  {selectedProperty.cap_rate?.toFixed(1) || 'N/A'}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Property Type:</span>
                <span className="text-slate-100 text-xs">{selectedProperty.property_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Size:</span>
                <span className="text-slate-100 text-xs">
                  {selectedProperty.bedrooms}bd/{selectedProperty.bathrooms}ba
                </span>
              </div>
              {selectedProperty.estimated_profit && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Est. Profit:</span>
                  <span className="text-green-400 text-xs font-semibold">
                    ${selectedProperty.estimated_profit.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Statistics */}
      <div className="mt-4">
        <div className="mb-3 text-center">
          <div className="text-sm text-slate-400">
            Currently showing: <span className="text-slate-200 font-semibold">
              {mapView === 'investment' ? 'Investment Score' : 
               mapView === 'price' ? 'Property Price' : 'Monthly Rent'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-slate-100">{mapData.count}</div>
            <div className="text-xs text-slate-400">Total Properties</div>
          </div>
          {mapData.properties.length > 0 && (
            <>
              <div>
                <div className="text-lg font-semibold text-green-400">
                  {mapData.properties.filter(p => p.category === 'high').length}
                </div>
                <div className="text-xs text-slate-400">High Performers</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-yellow-400">
                  {mapData.properties.filter(p => p.category === 'medium').length}
                </div>
                <div className="text-xs text-slate-400">Medium Performers</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-red-400">
                  {mapData.properties.filter(p => p.category === 'low').length}
                </div>
                <div className="text-xs text-slate-400">Lower Performers</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-400">
                  {(() => {
                    const avg = mapData.properties.reduce((sum, p) => {
                      const value = mapView === 'investment' ? (p.investment_score || 0) :
                                   mapView === 'price' ? (p.current_price || 0) :
                                   (p.estimated_rent || 0)
                      return sum + value
                    }, 0) / mapData.properties.length
                    
                    if (mapView === 'investment') return avg.toFixed(1)
                    if (mapView === 'price') return `$${(avg / 1000).toFixed(0)}k`
                    return `$${avg.toFixed(0)}`
                  })()}
                </div>
                <div className="text-xs text-slate-400">
                  Average {mapView === 'investment' ? 'Score' : 
                          mapView === 'price' ? 'Price' : 'Rent'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PropertyMap
