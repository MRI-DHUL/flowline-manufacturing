import type { ComponentPropsWithRef } from 'react'
import { cx } from './ui-utils'

export function TextArea({ className, ...props }: ComponentPropsWithRef<'textarea'> & { className?: string }) {
  return <textarea className={cx('ui-textarea', className)} {...props} />
}
