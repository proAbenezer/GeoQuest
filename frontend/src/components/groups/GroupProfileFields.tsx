// components/groups/GroupProfileFields.tsx
// The editable "profile" of a co-traveler group: an avatar photo (uploaded the
// same way pin photos are), the group name, and an optional linked place — one
// of the CREATOR's public pins that the group is about (members see it as a card
// they can open on the map). Shared by the new-group page (create) and the chat
// header's edit dialog (creator only) so both flows stay identical.
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Camera,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  Users,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { useImageUpload } from "@/hooks/useImageUpload"
import { fetchPublicPinsFor } from "@/hooks/usePublicPins"
import type { LinkedGroupPin, PublicPin } from "@/types/community"

// The full editable profile, owned by the caller (page or dialog) so submit can
// read it in one place.
export type GroupProfileValue = {
  name: string
  imageUrl: string | null
  pin: LinkedGroupPin | null
}

const NAME_MAX = 80

function pinLabel(p: PublicPin): string {
  return p.customName || p.name
}

function toLinkedPin(p: PublicPin): LinkedGroupPin {
  return {
    id: p.id,
    name: pinLabel(p),
    imageUrl: p.imageUrl,
    latitude: p.latitude,
    longitude: p.longitude,
  }
}

export default function GroupProfileFields({
  value,
  onChange,
}: {
  value: GroupProfileValue
  onChange: (next: GroupProfileValue) => void
}) {
  const { user } = useAuth()
  const { uploadImage, uploading: imageUploading, error: uploadError } = useImageUpload()
  const fileRef = useRef<HTMLInputElement | null>(null)
  // The place picker loads lazily (my public pins), so it opens on demand and
  // re-fetches each time it's opened.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [myPins, setMyPins] = useState<PublicPin[]>([])
  const [loadingPins, setLoadingPins] = useState(false)

  const loadMyPins = useCallback(async () => {
    if (!user) return
    setLoadingPins(true)
    const pins = await fetchPublicPinsFor(user.id)
    setMyPins(pins)
    setLoadingPins(false)
  }, [user])

  useEffect(() => {
    if (pickerOpen && user) void loadMyPins()
  }, [pickerOpen, user, loadMyPins])

  const pickFile = async (file: File | undefined | null) => {
    if (!file) return
    const url = await uploadImage(file)
    if (url) onChange({ ...value, imageUrl: url })
  }

  const setPin = (p: PublicPin | null) => {
    onChange({ ...value, pin: p ? toLinkedPin(p) : null })
    setPickerOpen(false)
  }

  return (
    <div className="space-y-4">
      {/* ---- Avatar photo ---- */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-16 w-16 rounded-full bg-muted text-lg text-muted-foreground">
            <AvatarImage src={value.imageUrl ?? undefined} alt={value.name || "Group"} />
            <AvatarFallback className="bg-transparent">
              <Users className="h-7 w-7" />
            </AvatarFallback>
          </Avatar>
          {value.imageUrl && (
            <button
              type="button"
              onClick={() => onChange({ ...value, imageUrl: null })}
              aria-label="Remove group photo"
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pickFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={imageUploading}
            onClick={() => fileRef.current?.click()}
          >
            {imageUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {value.imageUrl ? "Change photo" : "Add group photo"}
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Optional — a photo makes the group easy to spot in your chats.
          </p>
          {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
        </div>
      </div>

      {/* ---- Name ---- */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group name
        </label>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Iceland road trip"
          maxLength={NAME_MAX}
          className="w-full rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
        />
      </div>

      {/* ---- Linked place ---- */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Linked place
          </label>
          {value.pin ? (
            <button
              type="button"
              onClick={() => onChange({ ...value, pin: null })}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">Optional</span>
          )}
        </div>

        {value.pin ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/50 p-2.5">
            {value.pin.imageUrl ? (
              <img
                src={value.pin.imageUrl}
                alt={value.pin.name}
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{value.pin.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {value.pin.latitude.toFixed(4)}, {value.pin.longitude.toFixed(4)}
              </p>
            </div>
          </div>
        ) : pickerOpen ? (
          <div className="rounded-xl border border-border/40 bg-card/50">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <p className="text-xs font-medium text-foreground">Your public pins</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={() => {
                  setPickerOpen(false)
                  void loadMyPins()
                }}
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
            {loadingPins ? (
              <div className="flex items-center justify-center py-5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : myPins.length === 0 ? (
              <div className="flex items-start gap-2 px-3 py-3 text-xs leading-snug text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  You don't have any public pins yet. Link a place members can open on
                  the map — set a pin to <span className="font-medium text-foreground">Public</span>{" "}
                  in Add New Pin, or on the pin's popup, then come back here.
                </span>
              </div>
            ) : (
              <ul className="max-h-52 divide-y divide-border/30 overflow-y-auto">
                {myPins.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPin(p)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={pinLabel(p)}
                          className="h-8 w-8 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {pinLabel(p)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("gap-1.5 text-muted-foreground")}
            onClick={() => setPickerOpen(true)}
          >
            <MapPin className="h-3.5 w-3.5" />
            Link a place
          </Button>
        )}
      </div>
    </div>
  )
}
