import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client.js'

// Simple chart components (will be replaced with Recharts when installed)
function SimpleBarChart({ data, dataKey, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">{title}</h3>
        <div className="text-slate-400 text-center py-8">No data available</div>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(item => item[dataKey]))

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-24 text-sm text-slate-300 truncate">
              {item.property || item.month || item.type}
            </div>
            <div className="flex-1 bg-slate-700 rounded-full h-6 relative">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-6 rounded-full flex items-center justify-end pr-2"
                style={{ width: `${(item[dataKey] / maxValue) * 100}%` }}
              >
                <span className="text-xs text-white font-medium">
                  {typeof item[dataKey] === 'number' ? 
                    (dataKey === 'count' || title.includes('Distribution') ? 
                      item[dataKey].toString() :
                      (dataKey.includes('cash_flow') || dataKey.includes('income') || dataKey.includes('expenses') || 
                       dataKey.includes('price') || dataKey.includes('value') || dataKey.includes('appreciation') ? 
                        (item[dataKey] > 1000 ? `$${(item[dataKey] / 1000).toFixed(1)}k` : `$${item[dataKey].toFixed(0)}`) :
                        item[dataKey].toString()
                      )
                    ) :
                    item[dataKey]
                  }
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ title, value, subtitle, trend, icon }) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-400 uppercase tracking-wider">{title}</div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-slate-100 mb-1">{value}</div>
      {subtitle && <div className="text-sm text-slate-400">{subtitle}</div>}
      {trend && (
        <div className={`text-sm mt-2 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend > 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

function PropertyCard({ property, onEdit, onViewTransactions }) {
  const appreciationColor = property.appreciation >= 0 ? 'text-green-400' : 'text-red-400'
  
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">{property.address}</h3>
          <p className="text-slate-400 text-sm">{property.city}, {property.state}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewTransactions(property.id)}
            className="px-3 py-1 text-xs bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition-colors"
          >
            Transactions
          </button>
          <button
            onClick={() => onEdit(property)}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-slate-400">Purchase Price</div>
          <div className="text-lg font-semibold text-slate-200">
            ${property.purchase_price?.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Current Value</div>
          <div className="text-lg font-semibold text-slate-200">
            ${property.current_estimated_value?.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Equity</div>
          <div className="text-lg font-semibold text-slate-200">
            ${property.equity?.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Appreciation</div>
          <div className={`text-lg font-semibold ${appreciationColor}`}>
            ${property.appreciation?.toLocaleString()} ({property.appreciation_percent?.toFixed(1)}%)
          </div>
        </div>
      </div>
      
      {property.monthly_rent && (
        <div className="pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-400">Monthly Rent</div>
          <div className="text-lg font-semibold text-green-400">
            ${property.monthly_rent.toLocaleString()}/month
          </div>
        </div>
      )}
      
      <div className="mt-4 flex items-center gap-2">
        <span className={`px-2 py-1 text-xs rounded-full ${
          property.status === 'rented' ? 'bg-green-900 text-green-300' :
          property.status === 'vacant' ? 'bg-yellow-900 text-yellow-300' :
          'bg-blue-900 text-blue-300'
        }`}>
          {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
        </span>
        {property.property_type && (
          <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
            {property.property_type}
          </span>
        )}
      </div>
    </div>
  )
}

function EditPropertyModal({ isOpen, onClose, onSubmit, property }) {
  const [formData, setFormData] = useState({
    custom_address: '',
    custom_city: '',
    custom_state: '',
    current_estimated_value: '',
    monthly_rent: '',
    status: 'owned'
  })

  useEffect(() => {
    if (property) {
      setFormData({
        custom_address: property.address || '',
        custom_city: property.city || '',
        custom_state: property.state || '',
        current_estimated_value: property.current_estimated_value || '',
        monthly_rent: property.monthly_rent || '',
        status: property.status || 'owned'
      })
    }
  }, [property])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(property.id, formData)
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-200">Edit Property</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Address
            </label>
            <input
              type="text"
              name="custom_address"
              value={formData.custom_address}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                name="custom_city"
                value={formData.custom_city}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                State
              </label>
              <input
                type="text"
                name="custom_state"
                value={formData.custom_state}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Current Estimated Value
            </label>
            <input
              type="number"
              name="current_estimated_value"
              value={formData.current_estimated_value}
              onChange={handleChange}
              step="0.01"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Monthly Rent
            </label>
            <input
              type="number"
              name="monthly_rent"
              value={formData.monthly_rent}
              onChange={handleChange}
              step="0.01"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="owned">Owned</option>
              <option value="rented">Rented Out</option>
              <option value="vacant">Vacant</option>
              <option value="selling">For Sale</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Update Property
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TransactionsModal({ isOpen, onClose, propertyId, propertyAddress }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddTransactionForm, setShowAddTransactionForm] = useState(false)
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'income',
    category: 'rent',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  })

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch(`/api/portfolio/transactions/?property_id=${propertyId}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  const handleAddTransaction = async (e) => {
    e.preventDefault()
    try {
      const res = await apiFetch('/api/portfolio/transactions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transactionForm,
          property_id: propertyId
        })
      })

      if (res.ok) {
        setShowAddTransactionForm(false)
        setTransactionForm({
          transaction_type: 'income',
          category: 'rent',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: ''
        })
        loadTransactions()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error || 'Failed to add transaction'}`)
      }
    } catch (error) {
      console.error('Error adding transaction:', error)
      alert('Error adding transaction')
    }
  }

  const handleTransactionFormChange = (e) => {
    const { name, value } = e.target
    
    // Reset category when transaction type changes
    if (name === 'transaction_type') {
      setTransactionForm({ 
        ...transactionForm, 
        [name]: value,
        category: value === 'income' ? 'rent' : 'mortgage'
      })
    } else {
      setTransactionForm({ ...transactionForm, [name]: value })
    }
  }

  useEffect(() => {
    if (isOpen && propertyId) {
      loadTransactions()
    }
  }, [isOpen, propertyId, loadTransactions])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl p-6 max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-200">Transaction History</h2>
            <p className="text-slate-400 text-sm">{propertyAddress}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddTransactionForm(!showAddTransactionForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              + Add Transaction
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Add Transaction Form */}
        {showAddTransactionForm && (
          <div className="mb-6 p-4 bg-slate-800 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Add New Transaction</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                  <select
                    name="transaction_type"
                    value={transactionForm.transaction_type}
                    onChange={handleTransactionFormChange}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                  <select
                    name="category"
                    value={transactionForm.category}
                    onChange={handleTransactionFormChange}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {transactionForm.transaction_type === 'income' ? (
                      <>
                        <option value="rent">Rent Payment</option>
                        <option value="late_fee">Late Fee</option>
                        <option value="pet_fee">Pet Fee</option>
                        <option value="other_income">Other Income</option>
                      </>
                    ) : (
                      <>
                        <option value="mortgage">Mortgage Payment</option>
                        <option value="insurance">Insurance</option>
                        <option value="taxes">Property Taxes</option>
                        <option value="maintenance">Maintenance & Repairs</option>
                        <option value="utilities">Utilities</option>
                        <option value="management">Property Management</option>
                        <option value="advertising">Advertising/Marketing</option>
                        <option value="legal">Legal Fees</option>
                        <option value="hoa">HOA Fees</option>
                        <option value="other_expense">Other Expense</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
                  <input
                    type="number"
                    name="amount"
                    value={transactionForm.amount}
                    onChange={handleTransactionFormChange}
                    step="0.01"
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={transactionForm.date}
                    onChange={handleTransactionFormChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  value={transactionForm.description}
                  onChange={handleTransactionFormChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTransactionForm(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="text-slate-400">Loading transactions...</div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-slate-400">No transactions found for this property</div>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      transaction.transaction_type === 'income' 
                        ? 'bg-green-900 text-green-300' 
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {transaction.transaction_type}
                    </span>
                    <span className="text-slate-300">{transaction.category.replace('_', ' ')}</span>
                  </div>
                  <div className="text-slate-400 text-sm mt-1">{transaction.description}</div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${
                    transaction.transaction_type === 'income' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {transaction.transaction_type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString()}
                  </div>
                  <div className="text-slate-400 text-sm">{transaction.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AddPropertyModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    custom_address: '',
    custom_city: '',
    custom_state: '',
    custom_property_type: '',
    purchase_price: '',
    purchase_date: '',
    down_payment: '',
    loan_amount: '',
    interest_rate: '',
    loan_term_years: '',
    current_estimated_value: '',
    monthly_rent: '',
    status: 'owned'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validation for required fields
    if (!formData.custom_address.trim()) {
      alert('Please enter a property address')
      return
    }
    
    if (!formData.purchase_price || parseFloat(formData.purchase_price) <= 0) {
      alert('Please enter a valid purchase price')
      return
    }
    
    if (!formData.purchase_date) {
      alert('Please select a purchase date')
      return
    }
    
    // Optional but recommended field validation
    if (!formData.custom_city.trim()) {
      if (!confirm('City is not specified. Continue without city information?')) {
        return
      }
    }
    
    if (!formData.custom_state.trim()) {
      if (!confirm('State is not specified. Continue without state information?')) {
        return
      }
    }
    
    onSubmit(formData)
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-200">Add Property to Portfolio</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Address *
              </label>
              <input
                type="text"
                name="custom_address"
                value={formData.custom_address}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                name="custom_city"
                value={formData.custom_city}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                State
              </label>
              <input
                type="text"
                name="custom_state"
                value={formData.custom_state}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Property Type
              </label>
              <select
                name="custom_property_type"
                value={formData.custom_property_type}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type</option>
                <option value="Single Family">Single Family</option>
                <option value="Multi Family">Multi Family</option>
                <option value="Condo">Condo</option>
                <option value="Townhouse">Townhouse</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Purchase Price *
              </label>
              <input
                type="number"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                required
                step="0.01"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Down Payment
              </label>
              <input
                type="number"
                name="down_payment"
                value={formData.down_payment}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Loan Amount
              </label>
              <input
                type="number"
                name="loan_amount"
                value={formData.loan_amount}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Interest Rate (%)
              </label>
              <input
                type="number"
                name="interest_rate"
                value={formData.interest_rate}
                onChange={handleChange}
                step="0.001"
                min="0"
                max="30"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Loan Term (Years)
              </label>
              <input
                type="number"
                name="loan_term_years"
                value={formData.loan_term_years}
                onChange={handleChange}
                min="1"
                max="50"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Current Estimated Value
              </label>
              <input
                type="number"
                name="current_estimated_value"
                value={formData.current_estimated_value}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Monthly Rent
              </label>
              <input
                type="number"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Property
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Portfolio() {
  const [portfolioData, setPortfolioData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTransactionsModal, setShowTransactionsModal] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState(null)
  const [activeSubTab, setActiveSubTab] = useState('overview')

  useEffect(() => {
    loadPortfolioData()
  }, [])

  const loadPortfolioData = async () => {
    try {
      setLoading(true)
      
      // Load portfolio properties, metrics, and chart data in parallel
      const [portfolioRes, metricsRes, chartRes] = await Promise.all([
        apiFetch('/api/portfolio/'),
        apiFetch('/api/portfolio/metrics/'),
        apiFetch('/api/portfolio/chart-data/')
      ])

      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json()
        setPortfolioData(portfolioData)
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setMetrics(metricsData)
      }

      if (chartRes.ok) {
        const chartData = await chartRes.json()
        setChartData(chartData)
      }
    } catch (error) {
      console.error('Error loading portfolio data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddProperty = async (formData) => {
    try {
      const res = await apiFetch('/api/portfolio/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowAddModal(false)
        loadPortfolioData() // Reload data
      } else {
        const error = await res.json()
        alert(`Error: ${error.error || 'Failed to add property'}`)
      }
    } catch (error) {
      console.error('Error adding property:', error)
      alert('Error adding property')
    }
  }

  const handleEditProperty = (property) => {
    setSelectedProperty(property)
    setShowEditModal(true)
  }

  const handleUpdateProperty = async (propertyId, formData) => {
    try {
      const res = await apiFetch(`/api/portfolio/${propertyId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowEditModal(false)
        setSelectedProperty(null)
        loadPortfolioData() // Reload data
      } else {
        const error = await res.json()
        alert(`Error: ${error.error || 'Failed to update property'}`)
      }
    } catch (error) {
      console.error('Error updating property:', error)
      alert('Error updating property')
    }
  }

  const handleViewTransactions = (propertyId, propertyAddress) => {
    setSelectedPropertyId(propertyId)
    setSelectedProperty({ address: propertyAddress })
    setShowTransactionsModal(true)
  }

  const formatCurrency = (value) => {
    if (!value) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-slate-400">Loading portfolio data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-200">Portfolio Review</h1>
          <p className="text-slate-400 mt-1">Track your owned properties, investment performance, and preferences</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Property
        </button>
      </div>

      {/* Sub-navigation */}
      <div className="flex space-x-1 bg-slate-900 rounded-lg p-1">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeSubTab === 'overview'
              ? 'bg-slate-700 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          📊 Portfolio Overview
        </button>
        <button
          onClick={() => setActiveSubTab('properties')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeSubTab === 'properties'
              ? 'bg-slate-700 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          🏠 My Properties
        </button>
        <button
          onClick={() => setActiveSubTab('performance')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeSubTab === 'performance'
              ? 'bg-slate-700 text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          📈 Performance Analytics
        </button>
      </div>

      {/* Portfolio Overview */}
      {activeSubTab === 'overview' && metrics && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Properties"
              value={metrics.total_properties}
              icon="🏠"
            />
            <MetricCard
              title="Portfolio Value"
              value={formatCurrency(metrics.portfolio_value)}
              subtitle="Current estimated value"
              icon="💰"
            />
            <MetricCard
              title="Total Equity"
              value={formatCurrency(metrics.total_equity)}
              subtitle="Property value - loans"
              icon="📈"
            />
            <MetricCard
              title="Monthly Cash Flow"
              value={formatCurrency(metrics.monthly_cash_flow)}
              subtitle="Income - expenses"
              trend={metrics.monthly_cash_flow}
              icon="💵"
            />
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Investment"
              value={formatCurrency(metrics.total_investment)}
              subtitle="Purchase prices"
            />
            <MetricCard
              title="Appreciation"
              value={formatCurrency(metrics.total_appreciation)}
              subtitle={`${metrics.appreciation_percentage.toFixed(1)}% gain`}
              trend={metrics.appreciation_percentage}
            />
            <MetricCard
              title="Cash-on-Cash Return"
              value={`${metrics.cash_on_cash_return.toFixed(1)}%`}
              subtitle="Annual return"
            />
            <MetricCard
              title="Portfolio Cap Rate"
              value={`${metrics.portfolio_cap_rate.toFixed(1)}%`}
              subtitle="NOI / Property value"
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Monthly Income"
              value={formatCurrency(metrics.total_monthly_income)}
              subtitle="Rental income"
            />
            <MetricCard
              title="Monthly Expenses"
              value={formatCurrency(metrics.total_monthly_expenses)}
              subtitle="Property expenses"
            />
            <MetricCard
              title="Diversification Score"
              value={`${metrics.diversification_score}/10`}
              subtitle="Property & location diversity"
            />
          </div>
        </div>
      )}

      {/* My Properties */}
      {activeSubTab === 'properties' && (
        <div className="space-y-6">
          {portfolioData.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">🏠</div>
              <h3 className="text-xl font-semibold text-slate-200 mb-2">No Properties Yet</h3>
              <p className="text-slate-400 mb-6">Add your first property to start tracking your portfolio</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Your First Property
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {portfolioData.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onEdit={handleEditProperty}
                  onViewTransactions={(id) => handleViewTransactions(id, property.address)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Performance Analytics */}
      {activeSubTab === 'performance' && chartData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleBarChart
              data={chartData.property_performance}
              dataKey="current_value"
              title="Property Values"
            />
            <SimpleBarChart
              data={chartData.cash_flow_timeline.slice(-6)}
              dataKey="net_cash_flow"
              title="Cash Flow (Last 6 Months)"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleBarChart
              data={chartData.property_performance}
              dataKey="appreciation"
              title="Property Appreciation"
            />
            <SimpleBarChart
              data={chartData.property_type_distribution}
              dataKey="count"
              title="Property Type Distribution"
            />
          </div>
        </div>
      )}

      {/* Add Property Modal */}
      <AddPropertyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddProperty}
      />

      {/* Edit Property Modal */}
      <EditPropertyModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedProperty(null)
        }}
        onSubmit={handleUpdateProperty}
        property={selectedProperty}
      />

      {/* Transactions Modal */}
      <TransactionsModal
        isOpen={showTransactionsModal}
        onClose={() => {
          setShowTransactionsModal(false)
          setSelectedPropertyId(null)
          setSelectedProperty(null)
        }}
        propertyId={selectedPropertyId}
        propertyAddress={selectedProperty?.address}
      />
    </div>
  )
}
