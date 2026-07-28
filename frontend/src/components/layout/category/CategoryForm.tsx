import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type Props = {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  onSubmit: () => void
}

const CategoryForm = ({
  name,
  setName,
  description,
  setDescription,
  onSubmit,
}: Props) => (
  <div className="space-y-3 border-b px-5 py-4">
    <div className="space-y-2">
      <Label>Category Name</Label>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Coffee Shops"
      />
    </div>
    <div className="space-y-2">
      <Label>Description</Label>
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional"
      />
    </div>
    <Button onClick={onSubmit} className="w-full">
      Add Category
    </Button>
  </div>
)

export default CategoryForm
