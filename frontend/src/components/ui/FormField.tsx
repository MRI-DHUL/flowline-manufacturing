import type { ReactNode } from 'react'
import { cx } from './ui-utils'

export function FormField({ label, error, hint, required = false, className, children }: { label: string; error?: string; hint?: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={cx('ui-field', error && 'invalid', className)}>
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
      {error ? <small className="ui-field-error">{error}</small> : null}
      {hint ? <small className="ui-field-hint">{hint}</small> : null}
    </label>
  )
}
