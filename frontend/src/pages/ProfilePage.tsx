import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Mail, AtSign, Pencil, Camera, Loader2, Check, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useImageUpload } from "@/hooks/useImageUpload"

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/

const ProfilePage = () => {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()

  const { uploadImage: uploadAvatar, uploading: uploadingAvatar } = useImageUpload()
  const { uploadImage: uploadBanner, uploading: uploadingBanner } = useImageUpload()

  const [error, setError] = useState<string | null>(null)
  const [, setUpdating] = useState(false)

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [formFirstName, setFormFirstName] = useState("")
  const [formLastName, setFormLastName] = useState("")
  const [formUsername, setFormUsername] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) navigate("/login")
  }, [user, navigate])

  if (!user) return null

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()

  const startEditing = () => {
    setFormFirstName(user.firstName)
    setFormLastName(user.lastName)
    setFormUsername(user.username)
    setSaveError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setSaveError(null)
  }

  const handleImageUpload = async (
    file: File,
    type: "profileImage" | "bannerImage"
  ) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB")
      return
    }

    setError(null)
    setUpdating(true)

    try {
      const uploadFn = type === "profileImage" ? uploadAvatar : uploadBanner
      const url = await uploadFn(file)
      if (!url) throw new Error("Upload failed")

      // Persist the uploaded URL to the user's profile (also updates auth state)
      await updateProfile({ [type]: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update image")
    } finally {
      setUpdating(false)
    }
  }

  const handleSave = async () => {
    setSaveError(null)

    const firstName = formFirstName.trim()
    const lastName = formLastName.trim()
    const username = formUsername.trim()

    if (!firstName || !lastName) {
      setSaveError("First and last name are required")
      return
    }
    if (username.length < 3 || username.length > 20) {
      setSaveError("Username must be between 3 and 20 characters")
      return
    }
    if (!USERNAME_REGEX.test(username)) {
      setSaveError("Username can only contain letters, numbers, and underscores")
      return
    }

    setSaving(true)
    try {
      await updateProfile({ firstName, lastName, username })
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.click()
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to map
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account information and photos.
        </p>
      </div>

      <Card className="overflow-hidden">
        {/* Banner */}
        <div
          className={`relative h-32 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-transparent ${
            editing ? "cursor-pointer group" : ""
          }`}
          onClick={() => editing && triggerFileInput(bannerInputRef)}
        >
          {user.bannerImage ? (
            <img
              src={user.bannerImage}
              alt="Banner"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/20">
              <span className="text-sm text-muted-foreground">
                {editing ? "Click to add banner image" : "No banner image"}
              </span>
            </div>
          )}
          {editing && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-8 w-8 text-white" />
            </div>
          )}
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file, "bannerImage")
              e.target.value = ""
            }}
          />
          {uploadingBanner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>

        <CardContent className="relative px-6 pb-6">
          {/* Avatar */}
          <div
            className={`absolute -top-10 h-20 w-20 ${editing ? "cursor-pointer group" : ""}`}
            onClick={() => editing && triggerFileInput(avatarInputRef)}
          >
            <Avatar className="h-20 w-20 border-4 border-background transition-opacity group-hover:opacity-80">
              <AvatarImage src={user.profileImage || undefined} />
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            {editing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, "profileImage")
                e.target.value = ""
              }}
            />
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>

          {editing ? (
            <div className="flex flex-col gap-4 pt-12">
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, and underscores only (3–20 characters).
                </p>
              </div>

              {saveError && <p className="text-sm text-destructive">{saveError}</p>}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save changes
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: click your photo or banner above to change them.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between pt-12">
                <div>
                  <h2 className="text-xl font-semibold">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={startEditing}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>

              <div className="mt-6 space-y-3 border-t pt-6">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email</span>
                  <span className="ml-auto">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Username</span>
                  <span className="ml-auto">{user.username}</span>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 text-sm text-destructive">{error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfilePage
