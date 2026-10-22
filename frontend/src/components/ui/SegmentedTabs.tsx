import { cx } from './ui-utils'

export function SegmentedTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cx('ui-segmented-tabs', className)} role="tablist">
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
