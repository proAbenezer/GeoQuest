import { Link } from "react-router-dom"
import { ArrowLeft, Mail, AtSign, Pencil } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const ProfilePage = () => {
  const { user } = useAuth()

  if (!user) return null

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()

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
          Manage your account information.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-transparent" />
        <CardContent className="relative px-6 pb-6">
          <Avatar className="absolute -top-10 h-20 w-20 border-4 border-background">
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex items-start justify-between pt-12">
            <div>
              <h2 className="text-xl font-semibold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
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
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfilePage
