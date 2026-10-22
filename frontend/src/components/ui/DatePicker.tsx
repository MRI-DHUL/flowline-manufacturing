import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './ui-utils'

export function DatePicker({ className, ...props }: Omit<ComponentPropsWithoutRef<'input'>, 'type'> & { className?: string }) {
  return <input type="date" className={cx('ui-input', 'ui-date-picker', className)} {...props} />
}
