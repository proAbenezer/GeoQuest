import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Category, Pin } from "@/types"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

interface CategoriesContextValue {
  categories: Category[]
  loading: boolean
  addCategory: (category: Omit<Category, "id">) => Promise<Category>
  removeCategory: (id: string, pins: Pin[]) => { success: boolean; message?: string }
  isManagingCategories: boolean
  setIsManagingCategories: (value: boolean) => void
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isManagingCategories, setIsManagingCategories] = useState(false)

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE}/categories`, { credentials: "include" })
        const data = await res.json()
        setCategories(data.categories)
      } finally {
        setLoading(false)
      }
    }
    loadCategories()
  }, [])

  async function addCategory(newCategory: Omit<Category, "id">): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCategory),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to create category")
    }
    setCategories((prev) => [...prev, data.category])
    return data.category
  }

  // Local-only removal for now — no DELETE /categories/:id route exists yet.
  // This still works client-side but won't persist across reload. Flagging
  // this as a known gap rather than silently pretending it's fully wired.
  const removeCategory = (id: string, pins: Pin[]) => {
    const pinsUsingCategory = pins.filter((p) => p.categoryId === id).length
    if (pinsUsingCategory > 0) {
      return {
        success: false,
        message: `Can't delete — ${pinsUsingCategory} pin(s) still use this category.`,
      }
    }
    setCategories((prev) => prev.filter((c) => c.id !== id))
    return { success: true }
  }

  return (
    <CategoriesContext.Provider
      value={{ categories, loading, addCategory, removeCategory, isManagingCategories, setIsManagingCategories }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoriesContext)
  if (!context) {
    throw new Error("useCategories must be used within a CategoriesProvider")
  }
  return context
}
