import { CircleAlert, ClipboardList, Download, Edit3, FileText, RefreshCw, Search, Send } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/toast/useToast'
import { SegmentedTabs, Select, TextInput } from '../../components/ui'
import { CsrOrderForm } from './CsrOrderForm'
import { downloadCsrAttachment, getCsrOrder, listCsrOrders, respondToCsrClarification, submitCsrOrder } from './csr-order-service'
import type { CsrOrderDetail, CsrOrderSummary } from './csr-order-service'
import './csr-orders.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : dateFormatter.format(date)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusTone(status: string) {
  if (status === 'Delivered') return 'success'
  if (status === 'On Hold' || status === 'Rework Required') return 'danger'
  if (status === 'Scheduled' || status === 'In Production') return 'warning'
  return 'neutral'
}

function OrderDetails({
  order,
  onEdit,
  onUpdated,
}: {
  order: CsrOrderDetail
  onEdit: () => void
  onUpdated: (order: CsrOrderDetail) => void
}) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'overview' | 'activity'>('overview')
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const openClarification = order.clarifications.find((item) => item.status === 'OPEN')
  const rejectedForRecovery = order.status === 'Cancelled' && order.activity.some((item) => item.action === 'RD_REJECTED')
  const editable = order.status === 'Draft' || Boolean(openClarification) || rejectedForRecovery

  async function submit() {
    setBusy(true)
    try {
      const updated = await submitCsrOrder(order.id)
      onUpdated(updated)
      showToast({ title: 'Order submitted', message: `${order.orderNumber} is in R&D review.`, tone: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit the order.'
      showToast({ title: 'Submission failed', message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function respond() {
    if (!openClarification || !response.trim()) return
    setBusy(true)
    try {
      const updated = await respondToCsrClarification(order.id, openClarification.id, response)
      onUpdated(updated)
      setResponse('')
      showToast({ title: 'Clarification response recorded', tone: 'success' })
    } catch (error) {
      showToast({ title: 'Response failed', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="csr-detail">
      <SegmentedTabs
        className="workflow-tabs"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'activity', label: 'Activity' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
      />

      {tab === 'overview' ? (
        <div className="csr-detail-content" role="tabpanel">
          <header>
            <div>
              <span className="workflow-status" data-tone={statusTone(order.status)}>
                {order.status}
              </span>
              <h2>{order.productName ?? 'Product not set'}</h2>
              <p>
                {order.orderNumber} · {order.customerName ?? 'Customer not set'}
              </p>
            </div>
            <div className="csr-detail-actions">
              {editable ? (
                <button type="button" onClick={onEdit}>
                  <Edit3 size={16} />
                  Edit
                </button>
              ) : null}
              {order.status === 'Draft' || rejectedForRecovery ? (
                <button type="button" onClick={() => void submit()} disabled={busy}>
                  <Send size={16} />
                  {rejectedForRecovery ? 'Resubmit for review' : 'Submit'}
                </button>
              ) : null}
            </div>
          </header>

          {openClarification ? (
            <section className="csr-clarification" aria-labelledby="clarification-title">
              <CircleAlert size={20} />
              <div>
                <h3 id="clarification-title">Clarification requested by {openClarification.stage}</h3>
                <p>{openClarification.question}</p>
                <textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Record your response" />
                <button type="button" onClick={() => void respond()} disabled={busy || !response.trim()}>
                  Send response
                </button>
              </div>
            </section>
          ) : null}

          <dl className="csr-spec-grid">
            <div>
              <dt>Packaging</dt>
              <dd>{order.packagingType ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>{order.material ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{order.dimensions ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Print colors</dt>
              <dd>{order.printColors ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{order.requestedQuantity?.toLocaleString('en-IN') ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Requested delivery</dt>
              <dd>{formatDate(order.requestedDeliveryDate)}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{order.destination ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{order.priority ?? 'Normal'}</dd>
            </div>
            <div>
              <dt>R&amp;D reviewer</dt>
              <dd>{order.assignedReviewer?.displayName ?? 'Not assigned'}</dd>
            </div>
          </dl>

          <section className="csr-notes">
            <h3>Product description</h3>
            <p>{order.productDescription || 'No description recorded.'}</p>
            <h3>Technical notes</h3>
            <p>{order.technicalNotes || 'No technical notes recorded.'}</p>
          </section>

          <section className="csr-attachments" aria-labelledby="attachments-title">
            <h3 id="attachments-title">Supporting files</h3>
            {order.attachments.length ? (
              <ul>
                {order.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <FileText size={17} />
                    <span>
                      <strong>{attachment.fileName}</strong>
                      <small>{Math.ceil(attachment.sizeBytes / 1024)} KB</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => void downloadCsrAttachment(order.id, attachment.id, attachment.fileName)}
                      aria-label={`Download ${attachment.fileName}`}
                    >
                      <Download size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No supporting files uploaded.</p>
            )}
          </section>
        </div>
      ) : (
        <div className="csr-activity" role="tabpanel">
          {order.activity.length ? (
            <ol>
              {order.activity.map((event) => (
                <li key={event.id}>
                  <span />
                  <div>
                    <strong>{event.action.replaceAll('_', ' ')}</strong>
                    <time>{formatDateTime(event.occurredAt)}</time>
                    {event.reason ? <p>{event.reason}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="csr-empty-detail">
              <ClipboardList size={24} />
              <p>No activity recorded.</p>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export function CsrOrdersWorkspace({
  mode,
  orderId,
  onBackToOrders,
}: {
  mode: 'list' | 'new' | 'edit'
  orderId: string | null
  onBackToOrders: () => void
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [orders, setOrders] = useState<CsrOrderSummary[]>([])
  const [selectedId, setSelectedId] = useState(orderId)
  const [detail, setDetail] = useState<CsrOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [status, setStatus] = useState('All')

  function refreshList() {
    return listCsrOrders().then(setOrders)
  }

  useEffect(() => {
    let cancelled = false
    listCsrOrders()
      .then((items) => {
        if (cancelled) return
        setOrders(items)
        setSelectedId((current) => current ?? items[0]?.id ?? null)
      })
      .catch((error: unknown) => {
        if (!cancelled)
          showToast({ title: 'Orders could not be loaded', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    getCsrOrder(selectedId)
      .then((order) => {
        if (!cancelled) setDetail(order)
      })
      .catch((error: unknown) => {
        if (!cancelled)
          showToast({ title: 'Order details unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, showToast])

  if (mode === 'new' || mode === 'edit') {
    if (mode === 'edit' && !detail) {
      return (
        <div className="csr-workspace-loading">
          <RefreshCw className="spin" />
          <span>Loading draft...</span>
        </div>
      )
    }
    return (
      <CsrOrderForm
        order={mode === 'edit' ? detail : null}
        onCancel={onBackToOrders}
        onComplete={(saved) => {
          setDetail(saved)
          void refreshList()
          navigate(`/dashboard/orders/${saved.id}`, { replace: true })
        }}
      />
    )
  }

  const statuses = ['All', ...new Set(orders.map((order) => order.status))]
  const visible = orders.filter((order) => {
    const matchesStatus = status === 'All' || order.status === status
    const haystack = `${order.orderNumber} ${order.customerName ?? ''} ${order.productName ?? ''}`.toLowerCase()
    return matchesStatus && (!deferredSearch || haystack.includes(deferredSearch))
  })

  function choose(order: CsrOrderSummary) {
    setSelectedId(order.id)
    navigate(`/dashboard/orders/${order.id}`)
  }

  return (
    <section className="workflow-workbench csr-workbench" aria-label="CSR order workspace">
      <aside className="workflow-queue">
        <div className="workflow-queue-title">
          <div>
            <p>Customer service workspace</p>
            <h2>My requests</h2>
          </div>
          <strong>{visible.length}</strong>
        </div>
        <div className="workflow-filters">
          <label>
            <span>Search orders</span>
            <div>
              <Search size={16} />
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order, customer, product"
              />
            </div>
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
        <div className="workflow-order-list">
          {visible.map((order) => (
            <button key={order.id} type="button" aria-current={selectedId === order.id} onClick={() => choose(order)}>
              <div>
                <span className="workflow-status" data-tone={statusTone(order.status)}>
                  {order.status}
                </span>
                {order.openClarifications ? (
                  <small>{order.openClarifications} clarification</small>
                ) : (
                  <small>{order.priority ?? 'Normal'} priority</small>
                )}
              </div>
              <strong>{order.productName ?? 'Product not set'}</strong>
              <p>
                {order.orderNumber} · {order.customerName ?? 'Customer not set'}
              </p>
              <footer>
                <span>{formatDate(order.requestedDeliveryDate)}</span>
                <span>{formatDateTime(order.updatedAt)}</span>
              </footer>
            </button>
          ))}
          {!loading && !visible.length ? (
            <div className="workflow-queue-empty">
              <ClipboardList size={22} />
              <strong>No matching orders</strong>
              <p>Create a draft to begin the order lifecycle.</p>
            </div>
          ) : null}
        </div>
      </aside>

      {selectedId && detail ? (
        <OrderDetails
          order={detail}
          onEdit={() => navigate(`/dashboard/orders/${detail.id}/edit`)}
          onUpdated={(updated) => {
            setDetail(updated)
            void refreshList()
          }}
        />
      ) : (
        <article className="csr-detail">
          <div className="csr-empty-detail">
            <ClipboardList size={28} />
            <h2>No order selected</h2>
            <p>Select an order or create a new draft.</p>
          </div>
        </article>
      )}
    </section>
  )
}
