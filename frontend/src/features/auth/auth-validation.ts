export type LoginValues = {
  email: string
  password: string
}

export type RegisterValues = LoginValues & {
  fullName: string
  confirmPassword: string
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {}

  if (!values.email.trim()) {
    errors.email = 'Enter your work email.'
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.password) {
    errors.password = 'Enter your password.'
  }

  return errors
}

export function validateRegistration(
  values: RegisterValues,
): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {
    ...validateLogin(values),
  }

  if (!values.fullName.trim()) {
    errors.fullName = 'Enter your full name.'
  }

  if (values.password && values.password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}