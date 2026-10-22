import { createContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastInput = {
  title: string
  message?: string
  tone?: ToastTone
  duration?: number
}

export type ToastContextValue = {
  showToast: (input: ToastInput) => string
  dismissToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
