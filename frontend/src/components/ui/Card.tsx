import type { HTMLAttributes } from 'react'
import { cx } from './ui-utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLElement> & { className?: string }) {
  return <article className={cx('ui-card', className)} {...props}>{children}</article>
}
