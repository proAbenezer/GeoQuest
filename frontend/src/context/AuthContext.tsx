import { createContext, useContext, useEffect, useState } from "react"
import {
  getMe,
  login as loginApi,
  signup as signupApi,
  logout as logoutApi,
  updateProfile as updateProfileApi, // new
} from "@/api/auth"

type User = {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  profileImage?: string  // added
  bannerImage?: string   // added
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (
    email: string,
    username: string,
    firstName: string,
    lastName: string,
    password: string
  ) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>      // new
  updateProfile: (data: Partial<User>) => Promise<void> // new
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const user = await getMe()
      setUser(user)
      setLoading(false)
    }
    check()
  }, [])

  async function login(email: string, password: string) {
    const user = await loginApi(email, password)
    setUser(user)
  }

  async function signup(
    email: string,
    username: string,
    firstName: string,
    lastName: string,
    password: string
  ) {
    const user = await signupApi(email, username, firstName, lastName, password)
    setUser(user)
  }

  async function logout() {
    await logoutApi()
    setUser(null)
  }

  async function refreshUser() {
    const user = await getMe()
    setUser(user)
  }

  // NEW: update profile and update state
  async function updateProfile(data: Partial<User>) {
    const updated = await updateProfileApi(data)
    setUser(updated)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be inside AuthProvider")
  }
  return context
}
