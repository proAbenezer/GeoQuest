import { useState, useEffect, useRef } from "react"
import type { Suggestion, SelectedLocation } from "@/types/location"
import { fetchSuggestions, retrieveLocation } from "@/lib/mapboxSearch"

export function useLocationSearch(prefill: SelectedLocation | null) {
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [location, setLocation] = useState<SelectedLocation | null>(null)
  const sessionTokenRef = useRef(crypto.randomUUID())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!prefill) return
    setLocation(prefill)
    setSearchQuery(prefill.placeName)
  }, [prefill])

  useEffect(() => {
    if (!searchQuery.trim() || location) {
      setSuggestions([])
      return
    }
    const id = setTimeout(async () => {
      const results = await fetchSuggestions(
        searchQuery,
        sessionTokenRef.current
      )
      setSuggestions(results)
      setShowSuggestions(true)
    }, 300)
    return () => clearTimeout(id)
  }, [searchQuery, location])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  async function selectSuggestion(s: Suggestion) {
    const result = await retrieveLocation(s.mapbox_id, sessionTokenRef.current)
    if (!result) return
    setLocation(result)
    setSearchQuery(result.placeName)
    setSuggestions([])
    setShowSuggestions(false)
    sessionTokenRef.current = crypto.randomUUID()
  }

  function onInputChange(value: string) {
    setSearchQuery(value)
    if (location) setLocation(null)
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (suggestions.length > 0) selectSuggestion(suggestions[0])
    }
  }

  function reset() {
    setSearchQuery("")
    setLocation(null)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return {
    searchQuery,
    suggestions,
    showSuggestions,
    location,
    containerRef,
    onInputChange,
    onInputKeyDown,
    selectSuggestion,
    setShowSuggestions,
    reset,
  }
}
