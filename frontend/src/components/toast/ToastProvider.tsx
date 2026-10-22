import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ToastContext } from './toast-context'
import type { ToastInput, ToastTone } from './toast-context'
import './toast.css'

type ToastRecord = Required<Pick<ToastInput, 'title' | 'tone' | 'duration'>> & {
  id: string
  message?: string
}

const iconByTone: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord
  onDismiss: (id: string) => void
}) {
  const Icon = iconByTone[toast.tone]

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast.duration, toast.id])

  return (
    <article
      className="toast-item"
      data-tone={toast.tone}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      style={{ '--toast-duration': `${toast.duration}ms` } as CSSProperties}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div>
        <strong>{toast.title}</strong>
        {toast.message ? <p>{toast.message}</p> : null}
      </div>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <X size={17} aria-hidden="true" />
      </button>
      <span className="toast-timer" aria-hidden="true" />
    </article>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID()
    const toast: ToastRecord = {
      id,
      title: input.title,
      message: input.message,
      tone: input.tone ?? 'info',
      duration: input.duration ?? 4200,
    }
    setToasts((current) => [...current, toast].slice(-4))
    return id
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <section className="toast-viewport" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </section>
    </ToastContext.Provider>
  )
}