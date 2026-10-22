import { Fragment, type ReactNode } from 'react'
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
  expandedRowKey,
  renderExpanded,
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  emptyMessage?: string
  className?: string
  expandedRowKey?: string | null
  renderExpanded?: (row: Row) => ReactNode
}) {
  return (
    <div className={cx('ui-table-wrap', className)}>
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            const expanded = expandedRowKey === key && renderExpanded
            return (
              <Fragment key={key}>
                <tr key={key}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                </tr>
                {expanded ? (
                  <tr key={`${key}-expanded`} className="ui-table-expanded-row">
                    <td colSpan={columns.length}>{renderExpanded(row)}</td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
          {!rows.length ? (
            <tr>
              <td colSpan={columns.length} className="ui-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
