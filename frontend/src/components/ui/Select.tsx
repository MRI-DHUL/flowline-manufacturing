import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from './ui-utils'

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<'select'> & { className?: string; children?: ReactNode }) {
  return <select className={cx('ui-select', className)} {...props}>{children}</select>
}
