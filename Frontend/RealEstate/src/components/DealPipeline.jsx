import React, { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiFetch } from '../api/client.js'

// Priority color mapping
const priorityColors = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30'
}

// Deal type color mapping
const dealTypeColors = {
  rezoning: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  distressed: 'bg-red-500/20 text-red-400 border-red-500/30',
  arbitrage: 'bg-green-500/20 text-green-400 border-green-500/30',
  flip: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  rental: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  development: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  wholesale: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  brrr: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  commercial: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  land: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

// Deal Card Component
function DealCard({ deal, onEdit, onDelete, dealTypes = [] }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: {
      type: 'deal',
      deal,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="card border-slate-600 bg-slate-800/50 opacity-50"
      >
        <div className="h-24"></div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="card hover:border-slate-600 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div 
          {...listeners}
          className="flex-1 cursor-grab active:cursor-grabbing"
        >
          <h4 className="text-slate-100 font-semibold text-sm">{deal.title}</h4>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onEdit(deal)
            }}
            className="text-blue-400 hover:text-blue-300 text-xs p-1 hover:bg-slate-700 rounded transition-colors"
            title="Edit Deal"
            type="button"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onDelete(deal.id)
            }}
            className="text-red-400 hover:text-red-300 text-xs p-1 hover:bg-slate-700 rounded transition-colors"
            title="Delete Deal"
            type="button"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div {...listeners} className="cursor-grab active:cursor-grabbing">
        {deal.description && (
          <p className="text-slate-400 text-xs mb-2 line-clamp-2">
            {deal.description}
          </p>
        )}
        
        {deal.property && (
          <div className="mb-2 p-2 bg-slate-800/50 rounded text-xs">
            <div className="text-slate-300 font-medium">{deal.property.address}</div>
            <div className="text-slate-400">{deal.property.city}, {deal.property.state}</div>
            {deal.property.current_price && (
              <div className="text-green-400 font-semibold">
                ${deal.property.current_price.toLocaleString()}
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-2 mb-2">
          <div className="flex justify-between items-center">
            <span className={`px-2 py-1 text-xs rounded border ${priorityColors[deal.priority]}`}>
              {deal.priority.toUpperCase()}
            </span>
            {deal.expected_purchase_price && (
              <span className="text-slate-300 text-xs font-semibold">
                ${deal.expected_purchase_price.toLocaleString()}
              </span>
            )}
          </div>
          {deal.deal_type && (
            <div className="flex">
              <span className={`px-2 py-1 text-xs rounded border ${dealTypeColors[deal.deal_type] || dealTypeColors.other}`}>
                {dealTypes.find(type => type.key === deal.deal_type)?.label || deal.deal_type.toUpperCase()}
              </span>
            </div>
          )}
        </div>
        
        {deal.target_close_date && (
          <div className="text-xs text-slate-400 mb-2">
            Target: {new Date(deal.target_close_date).toLocaleDateString()}
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>{deal.days_in_stage} days in stage</span>
          {deal.assigned_to && <span>👤 {deal.assigned_to}</span>}
        </div>
      </div>
    </div>
  )
}

// Sortable Container for each stage
function DroppableStage({ stage, deals, onEdit, onDelete, dealTypes = [] }) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: stage.name,
    data: {
      type: 'stage',
      stage,
    },
  })

  return (
    <div className="flex-1 min-w-80">
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: stage.color }}
            ></div>
            <h3 className="text-slate-100 font-semibold">{stage.display_name}</h3>
            <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">
              {deals.length}
            </span>
          </div>
        </div>
        
        <div
          ref={setNodeRef}
          className={`space-y-3 min-h-32 p-2 rounded-lg transition-colors ${
            isOver ? 'bg-slate-800/50 border-2 border-dashed border-slate-600' : ''
          }`}
        >
          <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
            {deals.map((deal) => (
              <DealCard 
                key={deal.id} 
                deal={deal} 
                onEdit={onEdit}
                onDelete={onDelete}
                dealTypes={dealTypes}
              />
            ))}
          </SortableContext>
          
          {deals.length === 0 && (
            <div className="text-center text-slate-500 py-8 text-sm">
              No deals in {stage.display_name.toLowerCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Deal Form Modal
function DealForm({ deal, isOpen, onClose, onSubmit, properties = [], dealTypes = [] }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deal_type: '',
    expected_purchase_price: '',
    estimated_profit: '',
    target_close_date: '',
    property_id: '',
    notes: ''
  })

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        description: deal.description || '',
        priority: deal.priority || 'medium',
        deal_type: deal.deal_type || '',
        expected_purchase_price: deal.expected_purchase_price || '',
        estimated_profit: deal.estimated_profit || '',
        target_close_date: deal.target_close_date || '',
        property_id: deal.property?.id || '',
        notes: deal.notes || ''
      })
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        deal_type: '',
        expected_purchase_price: '',
        estimated_profit: '',
        target_close_date: '',
        property_id: '',
        notes: ''
      })
    }
  }, [deal])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass rounded-xl p-6 w-full max-w-md mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-slate-100 font-semibold">
            {deal ? 'Edit Deal' : 'New Deal'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-300 text-sm mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 h-20"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div>
              <label className="block text-slate-300 text-sm mb-1">Target Close Date</label>
              <input
                type="date"
                value={formData.target_close_date}
                onChange={(e) => setFormData({ ...formData, target_close_date: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-slate-300 text-sm mb-1">
              Deal Type
            </label>
            <select
              value={formData.deal_type}
              onChange={(e) => setFormData({ ...formData, deal_type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
            >
              <option value="">Select deal type...</option>
              {dealTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1">Expected Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.expected_purchase_price}
                onChange={(e) => setFormData({ ...formData, expected_purchase_price: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
                placeholder="0.00"
              />
            </div>
            
            <div>
              <label className="block text-slate-300 text-sm mb-1">Est. Profit</label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_profit}
                onChange={(e) => setFormData({ ...formData, estimated_profit: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
                placeholder="0.00"
              />
            </div>
          </div>
          
          {properties.length > 0 && (
            <div>
              <label className="block text-slate-300 text-sm mb-1">Link Property</label>
              <select
                value={formData.property_id}
                onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100"
              >
                <option value="">No property selected</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.address} - {property.city}, {property.state}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-slate-300 text-sm mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 h-16"
              rows={2}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              {deal ? 'Update' : 'Create'} Deal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Main Deal Pipeline Component
export default function DealPipeline() {
  const [deals, setDeals] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeDeal, setActiveDeal] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState(null)
  const [properties, setProperties] = useState([])
  const [dealTypes, setDealTypes] = useState([])
  const [selectedDealType, setSelectedDealType] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load deals and properties
  const loadDeals = async () => {
    try {
      setLoading(true)
      
      // Build deals URL with filters
      const dealsUrl = selectedDealType 
        ? `/api/deals/?deal_type=${selectedDealType}`
        : '/api/deals/'
      
      const [dealsResponse, propertiesResponse, dealTypesResponse] = await Promise.all([
        apiFetch(dealsUrl).then(res => res.json()),
        apiFetch('/api/properties/?limit=100').then(res => res.json()),
        apiFetch('/api/deal-types/').then(res => res.json())
      ])
      
      setDeals(dealsResponse)
      if (propertiesResponse.results) {
        setProperties(propertiesResponse.results)
      }
      setDealTypes(dealTypesResponse)
      setError(null)
    } catch (err) {
      console.error('Error loading deals:', err)
      setError('Failed to load deals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDeals()
  }, [selectedDealType])

  const handleDragStart = (event) => {
    const { active } = event
    const deal = active.data.current?.deal
    console.log('Drag started:', { activeId: active.id, deal })
    setActiveDeal(deal)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    console.log('Drag ended:', { 
      activeId: active.id, 
      overId: over?.id, 
      overData: over?.data?.current 
    })
    setActiveDeal(null)

    if (!over) {
      console.log('No drop target found')
      return
    }

    const activeDeal = active.data.current?.deal
    const overId = over.id
    const overData = over.data.current

    if (!activeDeal) {
      console.log('No active deal found')
      return
    }

    // Determine if we're dropping on a stage or another deal
    let targetStageName = null
    let targetPosition = 0

    if (overData?.type === 'stage') {
      // Dropped on a stage - use the stage name directly
      targetStageName = overData.stage.name
      targetPosition = 0
    } else if (overData?.type === 'deal') {
      // Dropped on another deal - find its stage and position
      const overDeal = overData.deal
      
      // Find the stage containing this deal
      for (const [stageName, stageData] of Object.entries(deals)) {
        const dealIndex = stageData.deals.findIndex(d => d.id === overDeal.id)
        if (dealIndex !== -1) {
          targetStageName = stageName
          targetPosition = dealIndex
          break
        }
      }
    }

    if (!targetStageName) {
      console.log('No target stage found', { overId, overData })
      return
    }

    // If dropping on the same deal, do nothing
    if (activeDeal.id === overId) return

    // If dropping on the same stage and same position, do nothing
    if (activeDeal.stage === targetStageName && targetPosition === 0 && overData?.type === 'stage') {
      return
    }

    console.log('Moving deal:', { 
      dealId: activeDeal.id, 
      from: activeDeal.stage, 
      to: targetStageName, 
      position: targetPosition 
    })

    try {
      // Always move the deal, even within the same stage for reordering
      const response = await apiFetch('/api/deals/move/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: activeDeal.id,
          target_stage: targetStageName,
          target_position: targetPosition
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Move deal error:', errorData)
        throw new Error(`Failed to move deal: ${errorData.error || 'Unknown error'}`)
      }

      // Reload deals to reflect changes
      await loadDeals()
    } catch (error) {
      console.error('Error moving deal:', error)
      setError(`Failed to move deal: ${error.message}`)
    }
  }

  const handleCreateDeal = async (formData) => {
    try {
      const response = await apiFetch('/api/deals/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to create deal')
      }
      
      await loadDeals()
      setShowForm(false)
    } catch (error) {
      console.error('Error creating deal:', error)
      setError('Failed to create deal')
    }
  }

  const handleUpdateDeal = async (formData) => {
    try {
      const response = await apiFetch(`/api/deals/${editingDeal.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update deal')
      }
      
      await loadDeals()
      setShowForm(false)
      setEditingDeal(null)
    } catch (error) {
      console.error('Error updating deal:', error)
      setError('Failed to update deal')
    }
  }

  const handleDeleteDeal = async (dealId) => {
    if (!confirm('Are you sure you want to delete this deal?')) return
    
    try {
      const response = await apiFetch(`/api/deals/${dealId}/`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete deal')
      }
      
      await loadDeals()
    } catch (error) {
      console.error('Error deleting deal:', error)
      setError('Failed to delete deal')
    }
  }

  const openEditForm = (deal) => {
    setEditingDeal(deal)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingDeal(null)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-100">Deal Pipeline</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-700 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-20 bg-slate-700 rounded"></div>
                  <div className="h-20 bg-slate-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-red-400 text-center py-8">
          <div className="text-4xl mb-2">⚠️</div>
          <div>{error}</div>
          <button
            onClick={loadDeals}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Extract stage order from the deals data
  const sortedStages = Object.entries(deals)
    .sort(([, a], [, b]) => a.stage_info.order - b.stage_info.order)
    .map(([stageName, stageData]) => ({
      name: stageName,
      ...stageData.stage_info,
      deals: stageData.deals
    }))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Deal Pipeline</h2>
          <p className="text-slate-400 text-sm mt-1">
            Drag and drop deals between stages to manage your pipeline
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          + New Deal
        </button>
      </div>

      {/* Deal Type Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-300 text-sm font-medium">Filter by type:</span>
        <button
          onClick={() => setSelectedDealType('')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            selectedDealType === '' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          All Types
        </button>
        {dealTypes.map((type) => (
          <button
            key={type.key}
            onClick={() => setSelectedDealType(type.key)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedDealType === type.key 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 overflow-x-auto">
          {sortedStages.map((stage) => (
            <DroppableStage
              key={stage.name}
              stage={stage}
              deals={stage.deals}
              onEdit={openEditForm}
              onDelete={handleDeleteDeal}
              dealTypes={dealTypes}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <div className="card border-blue-500 bg-slate-800 opacity-95">
              <div className="text-slate-100 font-semibold text-sm">{activeDeal.title}</div>
              <div className="text-slate-400 text-xs mt-1">{activeDeal.description}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DealForm
        deal={editingDeal}
        isOpen={showForm}
        onClose={closeForm}
        onSubmit={editingDeal ? handleUpdateDeal : handleCreateDeal}
        properties={properties}
        dealTypes={dealTypes}
      />
    </div>
  )
}
