import { createContext, useContext, useState, type ReactNode } from "react"
import type { Category, Pin } from "@/types"
import { categories as initialCategories } from "@/data/Categories"

interface CategoriesContextValue {
  categories: Category[]
  addCategory: (category: Omit<Category, "id">) => Category
  removeCategory: (
    id: string,
    pins: Pin[]
  ) => { success: boolean; message?: string }
  isManagingCategories: boolean
  setIsManagingCategories: (value: boolean) => void
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(
  undefined
)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [isManagingCategories, setIsManagingCategories] = useState(false)

  const addCategory = (newCategory: Omit<Category, "id">): Category => {
    const categoryWithId: Category = {
      ...newCategory,
      id: `category-${Date.now()}`,
    }
    setCategories((prev) => [...prev, categoryWithId])
    return categoryWithId
  }

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
      value={{
        categories,
        addCategory,
        removeCategory,
        isManagingCategories,
        setIsManagingCategories,
      }}
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
