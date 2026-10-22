import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './ui-utils'

export function TextArea({ className, ...props }: ComponentPropsWithoutRef<'textarea'> & { className?: string }) {
  return <textarea className={cx('ui-textarea', className)} {...props} />
}
