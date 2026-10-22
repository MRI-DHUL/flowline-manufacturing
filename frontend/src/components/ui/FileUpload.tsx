import type { ChangeEvent } from 'react'
import { cx } from './ui-utils'

export function FileUpload({
  label = 'Add supporting files',
  hint = 'Maximum 5 MB per file',
  multiple = true,
  accept,
  onFilesSelected,
  className,
}: {
  label?: string
  hint?: string
  multiple?: boolean
  accept?: string
  onFilesSelected: (files: File[]) => void
  className?: string
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  return (
    <label className={cx('ui-file-upload', className)}>
      <span className="ui-file-upload-icon" aria-hidden="true">
        +
      </span>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input type="file" multiple={multiple} accept={accept} onChange={handleChange} />
    </label>
  )
}
