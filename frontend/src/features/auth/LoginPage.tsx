import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useToast } from '../../components/toast/useToast'
import { AuthField } from './AuthField'
import { AuthLayout } from './AuthLayout'
import { signIn } from './auth-service'
import { validateLogin } from './auth-validation'
import type { FieldErrors, LoginValues } from './auth-validation'

const initialValues: LoginValues = {
  email: '',
  password: '',
}

export function LoginPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateLogin(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await signIn(values)
      showToast({
        title: 'Signed in successfully',
        message: 'Opening your workspace.',
        tone: 'success',
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.'
      showToast({ title: 'Sign in failed', message, tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Workspace access"
      title="Welcome back"
      description="Sign in with your approved 5Star account."
      footer={
        <p>
          Need an account? <Link to="/register">Create one</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="login-email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
        />
        <AuthField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          error={errors.password}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
        <Button variant="primary" className="submit-button" type="submit" disabled={submitting}>
          <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
          <ArrowRight size={19} aria-hidden="true" />
        </Button>
      </form>
    </AuthLayout>
  )
}
