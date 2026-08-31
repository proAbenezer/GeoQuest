import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type NotificationVariant = "locked" | "info" | "success" | "error"

interface Notification {
  id: string
  message: string
  variant: NotificationVariant
}

interface NotificationContextValue {
  notifications: Notification[]
  notify: (message: string, variant?: NotificationVariant, duration?: number) => void
  dismiss: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, variant: NotificationVariant = "info", duration = 4000) => {
      const id = crypto.randomUUID()
      setNotifications((prev) => [...prev, { id, message, variant }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss]
  )

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider")
  return ctx
}
