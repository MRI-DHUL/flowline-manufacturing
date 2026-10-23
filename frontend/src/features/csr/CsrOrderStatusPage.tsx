import { ClipboardClock, RefreshCw } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, Card, DataTable, Select, TextInput } from '../../components/ui'
import { listCsrOrderStatuses } from './csr-order-service'
import type { CsrOrderStatusRow } from './csr-order-service'
import './csr-order-status.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : dateFormatter.format(date)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : dateTimeFormatter.format(date)
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return 'First status'
  const totalMinutes = Math.max(0, Math.floor(seconds / 60))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function statusTone(status: string) {
  if (status === 'Delivered' || status === 'Planning Review') return 'success'
  if (status === 'On Hold' || status === 'Cancelled' || status === 'Rework Required') return 'danger'
  if (status === 'R&D Review' || status === 'In Production') return 'warning'
  return 'neutral'
}

export function CsrOrderStatusPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<CsrOrderStatusRow[]>([])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [status, setStatus] = useState('All')
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listCsrOrderStatuses()
      .then((items) => {
        if (cancelled) return
        setRows(items)
        setSelectedOrderId(items[0]?.orderId ?? null)
      })
      .catch((error) => {
        if (!cancelled) showToast({ title: 'Order status unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const orderHistory = new Map<string, CsrOrderStatusRow[]>()
  for (const row of rows) orderHistory.set(row.orderId, [...(orderHistory.get(row.orderId) ?? []), row])
  const statuses = ['All', ...new Set([...orderHistory.values()].map((history) => history[0]?.currentStatus).filter((item): item is string => Boolean(item)))]
  const visibleOrderHistory = new Map(
    [...orderHistory].filter(([, history]) => {
      const currentStatus = history[0]?.currentStatus
      const haystack = history
        .map((row) => `${row.orderNumber} ${row.orderName ?? ''} ${row.completedBy} ${row.status} ${row.comments ?? ''}`)
        .join(' ')
        .toLowerCase()
      return (status === 'All' || currentStatus === status) && (!deferredSearch || haystack.includes(deferredSearch))
    }),
  )
  const summaryRows = [...visibleOrderHistory.values()].map((history) => history[0]).filter((row): row is CsrOrderStatusRow => Boolean(row))
  const selectedRows = orderHistory.get(selectedOrderId ?? '') ?? []

  function renderHistory(rows: CsrOrderStatusRow[]) {
    return (
      <div className="csr-inline-status-detail" id="csr-order-status-detail">
        <div className="csr-inline-status-detail-header">
          <strong>Complete status history</strong>
          <Button variant="quiet" size="sm" type="button" onClick={() => setSelectedOrderId(null)}>
            Close
          </Button>
        </div>
        <ol>
          {rows.map((row) => (
            <li key={row.eventId} className={row.current ? 'current' : ''}>
              <div className="csr-order-status-detail-marker" />
              <div>
                <strong>{row.status}</strong>
                <small>
                  {row.completedBy} · {formatDateTime(row.completedAt)}
                </small>
                <p>
                  Time in status: {formatDuration(row.statusDurationSeconds)}
                  {row.transitionDurationSeconds === null ? '' : ` · Transition: ${formatDuration(row.transitionDurationSeconds)}`}
                </p>
                <span>{row.comments || row.action.replaceAll('_', ' ')}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <section className="csr-order-status-page" aria-labelledby="csr-order-status-title">
      <Card className="csr-order-status-card">
        <header className="csr-order-status-header">
          <div>
            <p>Customer service workspace</p>
            <h2 id="csr-order-status-title">Order Status</h2>
            <span>Track every order handoff, owner, status duration, and comment.</span>
          </div>
          <ClipboardClock size={28} aria-hidden="true" />
        </header>
        <div className="csr-order-status-filters">
          <label>
            <span>Search order history</span>
            <TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, product, completed by" />
          </label>
          <label>
            <span>Status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </label>
        </div>
        {loading ? (
          <div className="csr-order-status-empty">
            <RefreshCw className="spin" />
            <span>Loading order history...</span>
          </div>
        ) : (
          <DataTable
            className="csr-order-status-table"
            rows={summaryRows}
            rowKey={(row) => row.orderId}
            expandedRowKey={selectedOrderId}
            renderExpanded={() => renderHistory(selectedRows)}
            emptyMessage="No order status history found."
            columns={[
              {
                key: 'order',
                header: 'Order',
                render: (row) => (
                  <a
                    className="csr-order-status-anchor"
                    href="#csr-order-status-detail"
                    onClick={(event) => {
                      event.preventDefault()
                      setSelectedOrderId((current) => (current === row.orderId ? null : row.orderId))
                    }}
                  >
                    <strong>{row.orderName ?? 'Product not set'}</strong>
                    <small>{row.orderNumber}</small>
                  </a>
                ),
              },
              { key: 'placed', header: 'Order placed', render: (row) => formatDate(row.orderPlacedAt) },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <span className="csr-status-badge" data-tone={statusTone(row.currentStatus)}>
                    {row.currentStatus} · Current
                  </span>
                ),
              },
              {
                key: 'completedBy',
                header: 'Completed by',
                render: (row) => (
                  <span>
                    <strong>{row.completedBy}</strong>
                    <small>{formatDateTime(row.completedAt)}</small>
                  </span>
                ),
              },
              { key: 'transition', header: 'Between statuses', render: (row) => formatDuration(row.transitionDurationSeconds) },
              { key: 'duration', header: 'Time in status', render: (row) => formatDuration(row.statusDurationSeconds) },
              {
                key: 'comments',
                header: 'Comments',
                render: (row) => <span className="csr-status-comment">{row.comments || row.action.replaceAll('_', ' ')}</span>,
              },
            ]}
          />
        )}
      </Card>
    </section>
  )
}
