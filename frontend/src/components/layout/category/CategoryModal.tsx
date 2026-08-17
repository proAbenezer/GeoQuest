import { X } from "lucide-react"
import CategoryForm from "@/components/layout/category/CategoryForm"

type Props = {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  onSubmit: () => void
  onClose: () => void
  title?: string
  message?: string
}

const CategoryModal = ({
  name,
  setName,
  description,
  setDescription,
  onSubmit,
  onClose,
  title = "Manage Categories",
  message,
}: Props) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {message && (
        <p className="px-5 pt-4 text-sm text-muted-foreground">{message}</p>
      )}
      <CategoryForm
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        onSubmit={onSubmit}
      />
    </div>
  </div>
)

export default CategoryModal
