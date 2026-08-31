import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconStack } from "@/components/ui/icon-stack"
import { getIconList, getCategoryIcon } from "@/lib/categoryDisplay"
import type { Category } from "@/types"

type Props = {
  category: Category
  error?: string
  onDelete: (id: string) => void
}

const CategoryListItem = ({ category, error, onDelete }: Props) => (
  <div className="border-b px-5 py-3 last:border-b-0">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <IconStack
          icons={getIconList(category.icons, getCategoryIcon(category.id))}
          size="h-3.5 w-3.5"
          max={2}
          className="text-primary shrink-0"
        />
        <div>
          <p className="text-sm font-medium">{category.name}</p>
          {category.description && (
            <p className="text-xs text-muted-foreground">
              {category.description}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete(category.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
)

export default CategoryListItem
