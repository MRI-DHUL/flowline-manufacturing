import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  hint?: string
}

export function AuthField({
  id,
  label,
  error,
  hint,
  type = 'text',
  ...inputProps
}: AuthFieldProps) {
  const isPassword = type === 'password'
  const [passwordVisible, setPasswordVisible] = useState(false)
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="field-group">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        {hint && !error ? <span id={`${id}-hint`}>{hint}</span> : null}
      </div>
      <div className="input-shell" data-invalid={Boolean(error)}>
        <input
          {...inputProps}
          id={id}
          type={isPassword && passwordVisible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
        />
        {isPassword ? (
          <button
            className="visibility-button"
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
          >
            {passwordVisible ? (
              <EyeOff size={19} aria-hidden="true" />
            ) : (
              <Eye size={19} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}