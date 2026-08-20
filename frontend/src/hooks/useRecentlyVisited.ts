// hooks/useRecentlyVisited.ts
import { useState, useEffect, useCallback } from 'react'
import { usePins } from '@/context/usePins'

// ✅ Use the same API_BASE pattern as your api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

export interface RecentlyVisitedItem {
  id: string
  placeId: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  visitedAt: string
  isPin: boolean
  pinId: string | null
  type: 'pin' | 'unlocked'
  categoryId: string | null
  imageUrl: string | null
  visitCount: number | null
}

export const useRecentlyVisited = () => {
  const [items, setItems] = useState<RecentlyVisitedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { pins } = usePins()

  const loadRecentlyVisited = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // ✅ Use the correct path - matches your server route
      const response = await fetch(`${API_BASE}/recently-visited`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to load recently visited: ${response.status}`)
      }
      
      const data = await response.json()
      setItems(data.items || [])
    } catch (error) {
      console.error('Failed to load recently visited:', error)
      setError(error instanceof Error ? error.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const trackVisitedPlace = useCallback(async (input: {
    placeId: string
    name: string
    address?: string
    latitude?: number
    longitude?: number
  }) => {
    try {
      const response = await fetch(`${API_BASE}/recently-visited`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      
      if (response.ok) {
        await loadRecentlyVisited()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to track visited place:', error)
      return false
    }
  }, [loadRecentlyVisited])

  const markAsPinned = useCallback(async (recentlyVisitedId: string, pinId: string) => {
    try {
      const response = await fetch(`${API_BASE}/recently-visited/${recentlyVisitedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: true, pinId })
      })
      
      if (response.ok) {
        await loadRecentlyVisited()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to mark as pinned:', error)
      return false
    }
  }, [loadRecentlyVisited])

  const removeFromRecentlyVisited = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/recently-visited/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        setItems(prev => prev.filter(item => item.id !== id))
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to remove from recently visited:', error)
      return false
    }
  }, [])

  useEffect(() => {
    loadRecentlyVisited()
  }, [loadRecentlyVisited, pins])

  return {
    items,
    loading,
    error,
    trackVisitedPlace,
    markAsPinned,
    removeFromRecentlyVisited,
    refresh: loadRecentlyVisited
  }
}
