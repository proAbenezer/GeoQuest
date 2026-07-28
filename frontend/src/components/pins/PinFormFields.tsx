import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const PinFormFields = ({
  name,
  setName,
  categoryId,
  setCategoryId,
  description,
  setDescription,
  imageUrl,
  setImageUrl,
}: Props) => (
  <>
    <div className="space-y-2">
      <Label>Pin Name</Label>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My favorite place"
      />
    </div>

    <div className="space-y-2">
      <Label>Category</Label>
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="anime">Anime</SelectItem>
          <SelectItem value="gyms">Gyms</SelectItem>
          <SelectItem value="tech">Tech</SelectItem>
          <SelectItem value="workshops">Workshops</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-2">
      <Label>Description</Label>
      <Textarea
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </div>

    <div className="space-y-2">
      <Label>Photo URL (optional)</Label>
      <Input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="https://..."
      />
    </div>
  </>
)

export default PinFormFields
