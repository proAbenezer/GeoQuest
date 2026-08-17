import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, ImageIcon, X, Loader2 } from "lucide-react"
import { useCategories } from "@/context/useCategories"
import { useImageUpload } from "@/hooks/useImageUpload"
import CategoryForm from "@/components/layout/category/CategoryForm"

type Props = {
  name: string
  setName: (v: string) => void
  categoryId: string
  setCategoryId: (v: string) => void
  description: string
  setDescription: (v: string) => void
  imageUrl: string
  setImageUrl: (v: string) => void
}

const ADD_CATEGORY_VALUE = "__add_category__"

const PinFormFields = ({
  name,
  setName,
  categoryId,
  setCategoryId,
  description,
  setDescription,
  imageUrl,
  setImageUrl,
}: Props) => {
  const { categories, addCategory } = useCategories()
  const { uploadImage, uploading, error: uploadError } = useImageUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  function handleSelectChange(value: string) {
    if (value === ADD_CATEGORY_VALUE) {
      setCategoryDialogOpen(true)
      return
    }
    setCategoryId(value)
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return setCategoryError("Category name is required")
    setCreatingCategory(true)
    setCategoryError(null)
    try {
      const category = await addCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || "No description",
      })
      setCategoryId(category.id)
      setNewCategoryName("")
      setNewCategoryDescription("")
      setCategoryDialogOpen(false)
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Failed to create category")
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) setImageUrl(url)
    e.target.value = "" // allow re-selecting the same file later
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Your name for this place (optional)</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My favorite place"
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select category">
              {categories.find((c) => c.id === categoryId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
            <SelectItem value={ADD_CATEGORY_VALUE}>
              <span className="flex items-center gap-1.5 text-primary">
                <Plus className="h-3.5 w-3.5" />
                Add category
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Your notes (optional)</Label>
        <Textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Photo (optional)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border">
            <img src={imageUrl} alt="Pin preview" className="h-40 w-full object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1 hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Choose photo
              </>
            )}
          </Button>
        )}

        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <CategoryForm
            name={newCategoryName}
            setName={setNewCategoryName}
            description={newCategoryDescription}
            setDescription={setNewCategoryDescription}
            onSubmit={handleCreateCategory}
          />
          {categoryError && (
            <p className="text-sm text-destructive">{categoryError}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PinFormFields
