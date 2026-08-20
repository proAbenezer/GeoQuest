// hooks/useImageUpload.ts
import { useState } from "react"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("image", file)

      const response = await fetch(`${API_BASE}/uploads`, {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed")
      }
      return data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading, error }
}
