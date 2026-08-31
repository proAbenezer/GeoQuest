import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCategories } from "@/context/useCategories"
import { usePins } from "@/context/usePins"
import CategoryForm from "./CategoryForm"
import CategoryListItem from "./CategoryListItem"

const CategoryManagerDialog = () => {
  const {
    categories,
    addCategory,
    removeCategory,
    isManagingCategories,
    setIsManagingCategories,
  } = useCategories()
  const { pins } = usePins()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [icons, setIcons] = useState<string[]>([])
  const [errorId, setErrorId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  function handleAdd() {
    if (!name.trim()) return
    addCategory({ name: name.trim(), description: description.trim(), icons })
    setName("")
    setDescription("")
    setIcons([])
  }

  function handleDelete(id: string) {
    const result = removeCategory(id, pins)
    if (!result.success) {
      setErrorId(id)
      setErrorMsg(result.message ?? "Can't delete this category.")
    } else {
      setErrorId(null)
    }
  }

  return (
    <Dialog open={isManagingCategories} onOpenChange={setIsManagingCategories}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>
        <CategoryForm
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          icons={icons}
          setIcons={setIcons}
          onSubmit={handleAdd}
        />
        <div className="rounded-md border">
          {categories.map((c) => (
            <CategoryListItem
              key={c.id}
              category={c}
              error={errorId === c.id ? errorMsg : undefined}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CategoryManagerDialog
