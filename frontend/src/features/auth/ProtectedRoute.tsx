import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingScreen } from '../../components/loading/LoadingScreen'
import { getCurrentSession } from './auth-service'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  useEffect(() => {
    void getCurrentSession()
      .then(() => setState('authenticated'))
      .catch(() => setState('unauthenticated'))
  }, [])

  if (state === 'loading') return <LoadingScreen />
  if (state === 'unauthenticated') return <Navigate to="/login" replace />
  return children
}
