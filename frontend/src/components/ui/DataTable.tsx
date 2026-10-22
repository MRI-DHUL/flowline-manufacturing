import type { ReactNode } from 'react'
import { cx } from './ui-utils'

type Column<Row> = {
  key: string
  header: string
  render: (row: Row) => ReactNode
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records found.',
  className,
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  emptyMessage?: string
  className?: string
}) {
  return (
    <div className={cx('ui-table-wrap', className)}>
      <table className="ui-table">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}</tr>)}
          {!rows.length ? <tr><td colSpan={columns.length} className="ui-table-empty">{emptyMessage}</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}
