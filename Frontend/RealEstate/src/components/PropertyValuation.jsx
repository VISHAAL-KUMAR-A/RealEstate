import React, { useState, useEffect } from 'react'
import { apiFetch } from '../api/client.js'

function PropertyValuation({ propertyId, className = "" }) {
  const [valuationData, setValuationData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [previousValuations, setPreviousValuations] = useState([])
  
  const fetchPreviousValuations = async () => {
    try {
      const res = await apiFetch(`/api/properties/${propertyId}/valuations/`)
      if (res.ok) {
        const data = await res.json()
        setPreviousValuations(data.valuations || [])
      }
    } catch (error) {
      console.error('Failed to fetch previous valuations:', error)
    }
  }
  
  useEffect(() => {
    fetchPreviousValuations()
  }, [propertyId])
  
  const generateValuation = async () => {
    setLoading(true)
    setError('')
    setValuationData(null)
    
    try {
      const res = await apiFetch('/api/property-valuation/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property_id: propertyId
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setValuationData(data)
        setShowDetails(true)
        // Refresh previous valuations
        fetchPreviousValuations()
      } else {
        setError(data.error || 'Valuation failed')
      }
    } catch (error) {
      setError('Failed to generate valuation')
      console.error('Valuation error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  const formatPercent = (percent) => {
    if (!percent) return 'N/A'
    return `${parseFloat(percent).toFixed(1)}%`
  }

  const calculateCapRate = (data) => {
    // Cap Rate = (Annual NOI / Fair Market Value) * 100
    if (data.annual_noi && data.fair_market_value) {
      return (data.annual_noi / data.fair_market_value) * 100
    }
    return null
  }
  
  const getRecommendationColor = (recommendation) => {
    if (!recommendation) return 'gray'
    const rec = recommendation.toLowerCase()
    if (rec.includes('strong buy') || rec.includes('buy')) return 'green'
    if (rec.includes('hold')) return 'yellow'
    if (rec.includes('pass')) return 'red'
    return 'gray'
  }
  
  const renderValuationResults = (valuation) => {
    if (!valuation.valuation_data) return null
    
    const data = valuation.valuation_data
    
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-600 p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            🤖 AI Property Valuation Results
          </h3>
          <span className="text-sm text-slate-400">
            {new Date(valuation.generated_at).toLocaleDateString()}
          </span>
        </div>
        
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-900/20 border border-blue-800/30 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-400">Fair Market Value</div>
            <div className="text-2xl font-bold text-blue-300">
              {formatCurrency(data.fair_market_value)}
            </div>
          </div>
          
          <div className="bg-green-900/20 border border-green-800/30 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-400">Annual NOI</div>
            <div className="text-2xl font-bold text-green-300">
              {formatCurrency(data.annual_noi)}
            </div>
          </div>
          
          <div className="bg-purple-900/20 border border-purple-800/30 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-400">5-Year ROI</div>
            <div className="text-2xl font-bold text-purple-300">
              {formatPercent(data.five_year_roi_percent)}
            </div>
          </div>
        </div>
        
        {/* Investment Recommendation */}
        {data.investment_recommendation && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-slate-300">Investment Recommendation:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-${getRecommendationColor(data.investment_recommendation)}-500`}>
                {data.investment_recommendation}
              </span>
            </div>
          </div>
        )}
        
        {/* Analysis Summary */}
        {data.analysis_summary && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-200 mb-2">Analysis Summary</h4>
            <p className="text-slate-300 text-sm leading-relaxed">
              {data.analysis_summary}
            </p>
          </div>
        )}
        
        {/* Detailed Assumptions - Collapsible */}
        {showDetails && (
          <div className="space-y-4">
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-sm font-medium text-slate-200 mb-3">Financial Assumptions</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Monthly Rent:</span>
                  <div className="font-medium text-slate-200">{formatCurrency(data.monthly_gross_rent)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Annual OpEx:</span>
                  <div className="font-medium text-slate-200">{formatCurrency(data.annual_operating_expenses)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Appreciation Rate:</span>
                  <div className="font-medium text-slate-200">{formatPercent(data.annual_appreciation_rate)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Cap Rate:</span>
                  <div className="font-medium text-slate-200">{formatPercent(valuation.cap_rate || calculateCapRate(data))}</div>
                </div>
              </div>
            </div>
            
            {data.key_assumptions && (
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-200 mb-2">Key Assumptions</h4>
                <p className="text-slate-300 text-sm whitespace-pre-line">
                  {data.key_assumptions}
                </p>
              </div>
            )}
            
            {valuation.attom_endpoints_used && valuation.attom_endpoints_used.length > 0 && (
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-200 mb-2">Data Sources</h4>
                <div className="text-xs text-slate-400">
                  <div>🏠 ATTOM Data API endpoints: {valuation.attom_endpoints_used.join(', ')}</div>
                  <div>🤖 OpenAI GPT-4 analysis</div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            {showDetails ? '▼ Hide Details' : '▶ Show Details'}
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`property-valuation ${className}`}>
      {/* Generate Valuation Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">AI Property Valuation</h2>
        <button
          onClick={generateValuation}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-slate-400 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Analyzing...
            </>
          ) : (
            <>
              🤖 Generate AI Valuation
            </>
          )}
        </button>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 text-red-400 px-4 py-3 rounded-lg mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Current Valuation Results */}
      {valuationData && renderValuationResults(valuationData)}
      
      {/* Previous Valuations */}
      {previousValuations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Previous Valuations</h3>
          <div className="space-y-6">
            {previousValuations.slice(0, 3).map((valuation, index) => {
              if (!valuation.valuation_successful) {
                return (
                  <div key={valuation.id} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-300">
                        Valuation #{previousValuations.length - index}
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(valuation.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-red-400 text-sm">
                      ❌ Valuation failed: {valuation.error_message}
                    </div>
                  </div>
                )
              }

              // Create a mock valuation object that matches the structure expected by renderValuationResults
              const mockValuation = {
                generated_at: valuation.created_at,
                valuation_data: {
                  fair_market_value: valuation.fair_market_value,
                  annual_noi: valuation.annual_noi,
                  five_year_roi_percent: valuation.five_year_roi_percent,
                  monthly_gross_rent: valuation.monthly_gross_rent,
                  annual_operating_expenses: valuation.annual_operating_expenses,
                  annual_appreciation_rate: valuation.annual_appreciation_rate,
                  investment_recommendation: valuation.investment_recommendation,
                  analysis_summary: valuation.analysis_summary,
                  key_assumptions: valuation.key_assumptions
                },
                cap_rate: valuation.cap_rate,
                attom_endpoints_used: valuation.attom_endpoints_used
              }

              return (
                <div key={valuation.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-slate-300">
                      Valuation #{previousValuations.length - index}
                    </span>
                    <span className="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded">
                      Previous
                    </span>
                  </div>
                  {renderValuationResults(mockValuation)}
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
        <p className="text-sm text-yellow-300">
          <strong>Disclaimer:</strong> AI valuations are estimates based on available data and market analysis. 
          They should be used as a starting point for investment decisions, not as definitive property values. 
          Always consult with a licensed real estate professional and conduct your own due diligence.
        </p>
      </div>
    </div>
  )
}

export default PropertyValuation
