import type { ButtonHTMLAttributes } from 'react'
import { cx } from './ui-utils'

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <button className={cx('ui-button', `ui-button-${variant}`, `ui-button-${size}`, className)} {...props}>
      {children}
    </button>
  )
}
