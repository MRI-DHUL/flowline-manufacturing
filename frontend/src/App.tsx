import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingScreen } from './components/loading/LoadingScreen'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'

const WorkflowDashboardPage = lazy(() =>
  import('./features/dashboard/WorkflowDashboardPage').then((module) => ({
    default: module.WorkflowDashboardPage,
  })),
)

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard/*"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <ProtectedRoute>
              <WorkflowDashboardPage />
            </ProtectedRoute>
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
