import { useState } from "react"

import { createId } from "./id"

export type ToastItem = {
  id: string
  message: string
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const notify = (message: string, duration = 2600) => {
    const id = createId()
    setToasts((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, duration)
  }

  return { toasts, notify }
}
