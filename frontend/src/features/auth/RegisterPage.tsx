import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthField } from './AuthField'
import { AuthLayout } from './AuthLayout'
import { registerAccount } from './auth-service'
import { validateRegistration } from './auth-validation'
import type { FieldErrors, RegisterValues } from './auth-validation'

const initialValues: RegisterValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors<RegisterValues>>({})
  const [formError, setFormError] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateRegistration(values)
    setErrors(nextErrors)
    setFormError('')
    setFormMessage('')

    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await registerAccount(values)
      setFormMessage(
        'Account created. Your role must be assigned by an administrator before workspace access.',
      )
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Unable to create account.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="New account"
      title="Create your account"
      description="Use your work details. Access is assigned by an administrator."
      footer={
        <p>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="register-name"
          label="Full name"
          autoComplete="name"
          placeholder="Your full name"
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              fullName: event.target.value,
            }))
          }
        />
        <AuthField
          id="register-email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={values.email}
          error={errors.email}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
        />
        <AuthField
          id="register-password"
          label="Password"
          hint="8+ characters"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={values.password}
          error={errors.password}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
        <AuthField
          id="register-confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              confirmPassword: event.target.value,
            }))
          }
        />

        {formError ? (
          <div className="form-alert" role="alert">
            {formError}
          </div>
        ) : null}
        {formMessage ? (
          <div className="form-success" role="status">
            {formMessage}
          </div>
        ) : null}

        <button className="submit-button" type="submit" disabled={submitting}>
          <span>{submitting ? 'Creating account...' : 'Create account'}</span>
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </form>
    </AuthLayout>
  )
}