// context/VisitedCountriesContext.tsx
import { createContext, useContext, type ReactNode } from "react"
import { useVisitedCountriesPlaces } from "@/hooks/useVisitedCountriesPlaces"
import { useUnlockedEntries } from "@/hooks/useUnlockedEntries"

interface VisitedCountriesContextValue {
  visitedIso2: Set<string>
}

const VisitedCountriesContext = createContext<VisitedCountriesContextValue | undefined>(undefined)

export function VisitedCountriesProvider({ children }: { children: ReactNode }) {
  const { unlockedEntries } = useUnlockedEntries()
  const { visitedIso2 } = useVisitedCountriesPlaces(null, unlockedEntries)

  return (
    <VisitedCountriesContext.Provider value={{ visitedIso2 }}>
      {children}
    </VisitedCountriesContext.Provider>
  )
}

export function useVisitedCountries() {
  const context = useContext(VisitedCountriesContext)
  if (!context) {
    throw new Error("useVisitedCountries must be used within a VisitedCountriesProvider")
  }
  return context
}
