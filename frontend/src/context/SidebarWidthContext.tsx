// lib/SidebarWidthContext.tsx
import { createContext, useContext, ReactNode } from "react"

const SidebarWidthContext = createContext<number>(0)

export function SidebarWidthProvider({ children, width }: { children: ReactNode; width: number }) {
  return (
    <SidebarWidthContext.Provider value={width}>
      {children}
    </SidebarWidthContext.Provider>
  )
}

export function useSidebarWidth() {
  return useContext(SidebarWidthContext)
}
