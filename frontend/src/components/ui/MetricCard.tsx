import type { ComponentType } from 'react'
import { Card } from './Card'
import { cx } from './ui-utils'

export function MetricCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: string | number
  icon: ComponentType<{ size?: number }>
  className?: string
}) {
  return (
    <Card className={cx('ui-metric-card', className)}>
      <div><small>{label}</small><strong>{value}</strong></div>
      <Icon size={21} />
    </Card>
  )
}
