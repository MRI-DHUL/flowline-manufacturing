import { CheckCircle2, CircleAlert, Download, FileText, RefreshCw, Send } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, Card, FormField, Select, TextArea, TextInput } from '../../components/ui'
import { ReportIssueButton } from '../issues/ReportIssueButton'
import { HoldControls } from '../holds/HoldControls'
import { downloadRdAttachment, getRdOrder, listPlanningUsers, listRdOrders, RdRequestError, submitRdDecision } from './rd-service'
import type { PlanningUser, RdDecisionInput, RdOrderDetail, RdOrderSummary } from './rd-service'
import './rd-workspace.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : dateFormatter.format(date)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : dateTimeFormatter.format(date)
}

function statusTone(status: string) {
  if (status === 'On Hold') return 'warning'
  if (status === 'Cancelled') return 'danger'
  return 'neutral'
}

const emptyDecision: RdDecisionInput = {
  decision: 'APPROVED',
  planningUserAuthUserId: '',
  technicalComments: '',
  toolingRequirements: '',
  materialRecommendation: '',
  constraintsAndRisks: '',
  clarificationQuestion: '',
}

function OrderDetail({
  order,
  planners,
  onUpdated,
}: {
  order: RdOrderDetail
  planners: PlanningUser[]
  onUpdated: (order: RdOrderDetail) => void
}) {
  const { showToast } = useToast()
  const [values, setValues] = useState(emptyDecision)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const canDecide = order.status === 'R&D Review'

  function update<K extends keyof RdDecisionInput>(field: K, value: RdDecisionInput[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => current.filter((item) => item !== field))
  }

  async function decide() {
    const missing = ['technicalComments'].filter((field) => !values[field as keyof RdDecisionInput].trim())
    if (values.decision === 'APPROVED' && !values.planningUserAuthUserId) missing.push('planningUserAuthUserId')
    if (values.decision === 'CLARIFICATION_REQUESTED' && !values.clarificationQuestion.trim()) missing.push('clarificationQuestion')
    if (missing.length) {
      setFieldErrors(missing)
      showToast({ title: 'Technical decision is incomplete', message: 'Complete the required review fields.', tone: 'error' })
      return
    }
    setBusy(true)
    try {
      const updated = await submitRdDecision(order.id, values)
      onUpdated(updated)
      setValues(emptyDecision)
      showToast({ title: 'R&D decision recorded', message: `${order.orderNumber} is now ${updated.status}.`, tone: 'success' })
    } catch (error) {
      if (error instanceof RdRequestError) setFieldErrors(error.fields)
      showToast({ title: 'Decision could not be recorded', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rd-detail">
      <header className="rd-detail-header">
        <div>
          <span className="workflow-status" data-tone={statusTone(order.status)}>
            {order.status}
          </span>
          <h2>{order.productName ?? 'Product not set'}</h2>
          <p>
            {order.orderNumber} · {order.customerName ?? 'Customer not set'}
          </p>
        </div>
        <div className="rd-detail-header-actions">
          <ReportIssueButton orderId={order.id} orderNumber={order.orderNumber} />
          <HoldControls
            orderId={order.id}
            orderNumber={order.orderNumber}
            status={order.status}
            stage={order.stage}
            defaultTeam="R&amp;D"
          />
          <div className="workflow-owner">
            <small>Technical owner</small>
            <strong>R&amp;D</strong>
          </div>
        </div>
      </header>
      <div className="rd-detail-content">
        <dl className="rd-spec-grid">
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
            <dt>Order type</dt>
            <dd>{order.orderType ?? 'Not set'}</dd>
          </div>
        </dl>

        <section className="rd-section">
          <h3>Product description</h3>
          <p>{order.productDescription || 'No description recorded.'}</p>
        </section>
        <section className="rd-section">
          <h3>Technical notes from CSR</h3>
          <p>{order.technicalNotes || 'No technical notes recorded.'}</p>
        </section>

        <section className="rd-section" aria-labelledby="rd-files-title">
          <h3 id="rd-files-title">Supporting files</h3>
          {order.attachments.length ? (
            <ul className="rd-files">
              {order.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <FileText size={17} />
                  <span>
                    <strong>{attachment.fileName}</strong>
                    <small>{Math.ceil(attachment.sizeBytes / 1024)} KB</small>
                  </span>
                  <Button
                    variant="quiet"
                    size="sm"
                    type="button"
                    aria-label={`Download ${attachment.fileName}`}
                    onClick={() => void downloadRdAttachment(order.id, attachment.id, attachment.fileName)}
                  >
                    <Download size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No supporting files uploaded.</p>
          )}
        </section>

        {order.technicalReviews.length ? (
          <section className="rd-section">
            <h3>Technical decision history</h3>
            <ul className="rd-history">
              {order.technicalReviews.map((review) => (
                <li key={review.id}>
                  <strong>
                    {review.decision.replaceAll('_', ' ')} · {review.reviewerName}
                  </strong>
                  <time>{formatDateTime(review.decidedAt)}</time>
                  <p>{review.technicalComments}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {canDecide ? (
          <section className="rd-decision" aria-labelledby="rd-decision-title">
            <h3 id="rd-decision-title">Record feasibility decision</h3>
            <div className="rd-decision-grid">
              <FormField label="Decision" required>
                <Select value={values.decision} onChange={(event) => update('decision', event.target.value as RdDecisionInput['decision'])}>
                  <option value="APPROVED">Approve feasibility</option>
                  <option value="CLARIFICATION_REQUESTED">Request clarification</option>
                  <option value="REJECTED">Reject as not feasible</option>
                  <option value="ON_HOLD">Place on hold</option>
                </Select>
              </FormField>
              {values.decision === 'APPROVED' ? (
                <FormField
                  label="Assign to Planning user"
                  required
                  className="wide"
                  hint={!planners.length ? 'No active Planning users are available.' : undefined}
                >
                  <Select
                    value={values.planningUserAuthUserId}
                    onChange={(event) => update('planningUserAuthUserId', event.target.value)}
                    aria-invalid={fieldErrors.includes('planningUserAuthUserId')}
                  >
                    <option value="">Select an active Planning user</option>
                    {planners.map((planner) => (
                      <option key={planner.authUserId} value={planner.authUserId}>
                        {planner.displayName} ({planner.email})
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}
              <FormField label="Technical comments" required className="wide">
                <TextArea
                  value={values.technicalComments}
                  onChange={(event) => update('technicalComments', event.target.value)}
                  aria-invalid={fieldErrors.includes('technicalComments')}
                  placeholder="Explain the feasibility decision and evidence."
                />
              </FormField>
              <FormField label="Tooling requirements">
                <TextInput value={values.toolingRequirements} onChange={(event) => update('toolingRequirements', event.target.value)} />
              </FormField>
              <FormField label="Material recommendation">
                <TextInput
                  value={values.materialRecommendation}
                  onChange={(event) => update('materialRecommendation', event.target.value)}
                />
              </FormField>
              <FormField label="Constraints and risks" className="wide">
                <TextArea value={values.constraintsAndRisks} onChange={(event) => update('constraintsAndRisks', event.target.value)} />
              </FormField>
              {values.decision === 'CLARIFICATION_REQUESTED' ? (
                <FormField label="Clarification question" required className="wide">
                  <TextArea
                    value={values.clarificationQuestion}
                    onChange={(event) => update('clarificationQuestion', event.target.value)}
                    aria-invalid={fieldErrors.includes('clarificationQuestion')}
                    placeholder="Tell CSR exactly what must be confirmed or corrected."
                  />
                </FormField>
              ) : null}
            </div>
            <div className="rd-decision-actions">
              <Button variant="primary" type="button" onClick={() => void decide()} disabled={busy}>
                <Send size={16} />
                {busy ? 'Recording...' : 'Record decision'}
              </Button>
            </div>
          </section>
        ) : (
          <section className="rd-section">
            <p>
              <CheckCircle2 size={16} /> This order already has a recorded technical decision.
            </p>
          </section>
        )}
      </div>
    </Card>
  )
}

export function RdWorkspace() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<RdOrderSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RdOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [status, setStatus] = useState('All')
  const [planners, setPlanners] = useState<PlanningUser[]>([])

  function refreshQueue() {
    return listRdOrders().then((items) => {
      setOrders(items)
      setSelectedId((current) => {
        const nextId = current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? null)
        if (nextId !== current) setDetail(null)
        return nextId
      })
    })
  }

  useEffect(() => {
    let cancelled = false
    listRdOrders()
      .then((items) => {
        if (cancelled) return
        setOrders(items)
        setSelectedId(items[0]?.id ?? null)
      })
      .catch((error) => {
        if (!cancelled)
          showToast({ title: 'R&D queue unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  useEffect(() => {
    let cancelled = false
    listPlanningUsers()
      .then((items) => {
        if (!cancelled) setPlanners(items)
      })
      .catch((error) => {
        if (!cancelled)
          showToast({ title: 'Planning users unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    getRdOrder(selectedId)
      .then((item) => {
        if (!cancelled) setDetail(item)
      })
      .catch((error) => {
        if (!cancelled)
          showToast({ title: 'R&D order unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, showToast])

  const statuses = ['All', ...new Set(orders.map((order) => order.status))]
  const visible = orders.filter((order) => {
    const haystack = `${order.orderNumber} ${order.customerName ?? ''} ${order.productName ?? ''}`.toLowerCase()
    return (status === 'All' || order.status === status) && (!deferredSearch || haystack.includes(deferredSearch))
  })

  return (
    <section className="workflow-workbench rd-workspace" aria-label="R&D technical review workspace">
      <aside className="workflow-queue">
        <div className="workflow-queue-title">
          <div>
            <p>Technical workspace</p>
            <h2>Review queue</h2>
          </div>
          <strong>{visible.length}</strong>
        </div>
        <div className="workflow-filters">
          <label>
            <span>Search orders</span>
            <TextInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order, customer, product"
            />
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
            <Button
              key={order.id}
              variant="quiet"
              className="rd-order-button"
              type="button"
              aria-current={order.id === selectedId}
              onClick={() => setSelectedId(order.id)}
            >
              <div>
                <span className="workflow-status" data-tone={statusTone(order.status)}>
                  {order.status}
                </span>
                <small>{order.priority ?? 'Normal'} priority</small>
              </div>
              <strong>{order.productName ?? 'Product not set'}</strong>
              <p>
                {order.orderNumber} · {order.customerName ?? 'Customer not set'}
              </p>
              <footer>
                <span>{formatDate(order.requestedDeliveryDate)}</span>
                <span>{order.openClarifications ? `${order.openClarifications} clarification` : 'Needs review'}</span>
              </footer>
            </Button>
          ))}
          {!loading && !visible.length ? (
            <div className="workflow-queue-empty">
              <CircleAlert size={22} />
              <strong>No technical reviews pending</strong>
              <p>Assigned CSR submissions will appear here.</p>
            </div>
          ) : null}
        </div>
      </aside>
      {detail ? (
        <OrderDetail
          order={detail}
          planners={planners}
          onUpdated={() => {
            void refreshQueue()
          }}
        />
      ) : (
        <article className="rd-loading">
          <RefreshCw className={loading ? 'spin' : undefined} />
          <span>{loading ? 'Loading technical queue...' : 'Select an order to review.'}</span>
        </article>
      )}
    </section>
  )
}
