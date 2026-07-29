const API_URL = "http://localhost:4000"

type User = {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error)
  }
  return data.user
}

export async function signup(
  email: string,
  username: string,
  firstName: string,
  lastName: string,
  password: string
): Promise<User> {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, firstName, lastName, password }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error)
  }
  return data.user
}

export async function getMe(): Promise<User | null> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
  })

  if (!response.ok) {
    return null
  }
  const data = await response.json()
  return data.user
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Failed to log out")
  }
}
