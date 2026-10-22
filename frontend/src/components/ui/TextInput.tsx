import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './ui-utils'

export function TextInput({ className, ...props }: ComponentPropsWithoutRef<'input'> & { className?: string }) {
  return <input className={cx('ui-input', className)} {...props} />
}
