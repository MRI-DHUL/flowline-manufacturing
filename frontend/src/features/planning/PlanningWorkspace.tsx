import { CalendarCheck, CircleAlert, Download, Factory, FileText, RefreshCw, Save, Send } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, Card, FormField, Select, TextArea, TextInput } from '../../components/ui'
import { ReportIssueButton } from '../issues/ReportIssueButton'
import { HoldControls } from '../holds/HoldControls'
import { downloadPlanningAttachment, getPlanningOrder, listPlanningOrders, listPlanningResources, PlanningRequestError, releasePlanningOrder, savePlanningAssessment } from './planning-service'
import type { PlanningAssessmentInput, PlanningOrderDetail, PlanningOrderSummary, PlanningResources } from './planning-service'
import './planning-workspace.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const emptyAssessment: PlanningAssessmentInput = {
  materialStatus: 'PENDING',
  shortageReason: '',
  expectedMaterialDate: '',
  productionLineId: '',
  plannedProductionDate: '',
  capacityStatus: 'PENDING',
  readinessStatus: 'PENDING',
  planningNotes: '',
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : dateFormatter.format(date)
}

function detailValues(order: PlanningOrderDetail): PlanningAssessmentInput {
  if (!order.assessment) return emptyAssessment
  return {
    materialStatus: order.assessment.materialStatus,
    shortageReason: order.assessment.shortageReason ?? '',
    expectedMaterialDate: order.assessment.expectedMaterialDate ?? '',
    productionLineId: order.assessment.productionLineId ?? '',
    plannedProductionDate: order.assessment.plannedProductionDate ?? '',
    capacityStatus: order.assessment.capacityStatus,
    readinessStatus: order.assessment.readinessStatus,
    planningNotes: order.assessment.planningNotes ?? '',
  }
}

function PlanningDetail({ order, resources, onSaved, onReleased }: { order: PlanningOrderDetail; resources: PlanningResources; onSaved: (order: PlanningOrderDetail) => void; onReleased: (orderId: string) => void }) {
  const { showToast } = useToast()
  const [values, setValues] = useState(() => detailValues(order))
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState<'save' | 'release' | null>(null)

  function update<K extends keyof PlanningAssessmentInput>(key: K, value: PlanningAssessmentInput[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => current.filter((field) => field !== key))
  }

  async function submit(action: 'save' | 'release') {
    setSubmitting(action)
    setFieldErrors([])
    try {
      if (action === 'save') {
        const updated = await savePlanningAssessment(order.id, values)
        onSaved(updated)
        showToast({ title: 'Planning assessment saved', tone: 'success' })
      } else {
        await releasePlanningOrder(order.id, values)
        showToast({ title: 'Planning completed', message: 'The order was assigned and sent to the selected Press user.', tone: 'success' })
        onReleased(order.id)
      }
    } catch (error) {
      if (error instanceof PlanningRequestError) setFieldErrors(error.fields)
      showToast({
        title: action === 'save' ? 'Assessment not saved' : 'Release blocked',
        message: error instanceof Error ? error.message : undefined,
        tone: 'error',
      })
    } finally {
      setSubmitting(null)
    }
  }

  const latestReview = order.technicalReviews[0]
  const resourcesReady = resources.productionLines.length > 0 && resources.pressUsers.length > 0

  return (
    <Card className="planning-detail">
      <header className="planning-detail-header">
        <div>
          <span className="workflow-status">Planning Review</span>
          <h2>{order.productName ?? 'Product not set'}</h2>
          <p>
            {order.orderNumber} · {order.customerName ?? 'Customer not set'}
          </p>
        </div>
        <div className="planning-detail-header-actions">
          <ReportIssueButton orderId={order.id} orderNumber={order.orderNumber} />
          <HoldControls orderId={order.id} orderNumber={order.orderNumber} status={order.status} stage="Planning" defaultTeam="PLANNING" />
          <span>
            <small>Requested delivery</small>
            <strong>{formatDate(order.requestedDeliveryDate)}</strong>
          </span>
        </div>
      </header>
      <div className="planning-detail-content">
        <dl className="planning-spec-grid">
          <div>
            <dt>Quantity</dt>
            <dd>{order.requestedQuantity?.toLocaleString() ?? 'Not set'}</dd>
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
            <dt>Packaging</dt>
            <dd>{order.packagingType ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Print colors</dt>
            <dd>{order.printColors ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>{order.destination ?? 'Not set'}</dd>
          </div>
        </dl>

        {order.productDescription || order.technicalNotes ? (
          <section className="planning-order-notes">
            <h3>Order requirements</h3>
            {order.productDescription ? <p>{order.productDescription}</p> : null}
            {order.technicalNotes ? (
              <p>
                <strong>Technical notes:</strong> {order.technicalNotes}
              </p>
            ) : null}
          </section>
        ) : null}

        {latestReview ? (
          <section className="planning-review-summary">
            <header>
              <FileText size={18} />
              <div>
                <strong>Approved technical review</strong>
                <small>
                  {latestReview.reviewerName} · {formatDate(latestReview.decidedAt)}
                </small>
              </div>
            </header>
            <p>{latestReview.technicalComments}</p>
            <dl>
              <div>
                <dt>Material recommendation</dt>
                <dd>{latestReview.materialRecommendation ?? 'None'}</dd>
              </div>
              <div>
                <dt>Tooling</dt>
                <dd>{latestReview.toolingRequirements ?? 'None'}</dd>
              </div>
              <div>
                <dt>Constraints and risks</dt>
                <dd>{latestReview.constraintsAndRisks ?? 'None'}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {order.attachments.length ? (
          <section className="planning-files">
            <h3>Supporting files</h3>
            {order.attachments.map((attachment) => (
              <button type="button" key={attachment.id} onClick={() => void downloadPlanningAttachment(order.id, attachment.id, attachment.fileName)}>
                <FileText size={17} />
                <span>
                  <strong>{attachment.fileName}</strong>
                  <small>{Math.ceil(attachment.sizeBytes / 1024)} KB</small>
                </span>
                <Download size={16} />
              </button>
            ))}
          </section>
        ) : null}

        <section className="planning-assessment" aria-label="Material and capacity planning">
          <header>
            <div>
              <Factory size={20} />
              <span>
                <strong>Material & capacity plan</strong>
                <small>All readiness checks must pass before release.</small>
              </span>
            </div>
            {order.assessment ? <small>Last saved {formatDate(order.assessment.updatedAt)}</small> : null}
          </header>
          {!resourcesReady ? (
            <div className="planning-resource-warning" role="alert">
              <CircleAlert size={18} />
              <span>
                <strong>Release resources unavailable</strong>
                <small>
                  {!resources.productionLines.length ? 'Configure an active production line. ' : ''}
                  {!resources.pressUsers.length ? 'Activate and assign a Press user.' : ''}
                </small>
              </span>
            </div>
          ) : null}
          <div className="planning-form-grid">
            <FormField label="Material status" required>
              <Select value={values.materialStatus} onChange={(event) => update('materialStatus', event.target.value as PlanningAssessmentInput['materialStatus'])} aria-invalid={fieldErrors.includes('materialStatus')}>
                <option value="PENDING">Pending confirmation</option>
                <option value="AVAILABLE">Available</option>
                <option value="SHORTAGE">Shortage</option>
              </Select>
            </FormField>
            <FormField label="Capacity status" required>
              <Select value={values.capacityStatus} onChange={(event) => update('capacityStatus', event.target.value as PlanningAssessmentInput['capacityStatus'])} aria-invalid={fieldErrors.includes('capacityStatus')}>
                <option value="PENDING">Pending confirmation</option>
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </Select>
            </FormField>
            {values.materialStatus === 'SHORTAGE' ? (
              <>
                <FormField label="Shortage reason" required className="wide">
                  <TextArea value={values.shortageReason} onChange={(event) => update('shortageReason', event.target.value)} aria-invalid={fieldErrors.includes('shortageReason')} />
                </FormField>
                <FormField label="Expected material date" required>
                  <TextInput type="date" value={values.expectedMaterialDate} onChange={(event) => update('expectedMaterialDate', event.target.value)} aria-invalid={fieldErrors.includes('expectedMaterialDate')} />
                </FormField>
              </>
            ) : null}
            <FormField label="Production line" required>
              <Select value={values.productionLineId} onChange={(event) => update('productionLineId', event.target.value)} aria-invalid={fieldErrors.includes('productionLineId')}>
                <option value="">Select active line</option>
                {resources.productionLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name} ({line.code})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Planned production date" required>
              <TextInput type="date" value={values.plannedProductionDate} onChange={(event) => update('plannedProductionDate', event.target.value)} aria-invalid={fieldErrors.includes('plannedProductionDate')} />
            </FormField>
            <FormField label="Readiness" required>
              <Select
                value={values.readinessStatus}
                onChange={(event) => update('readinessStatus', event.target.value as PlanningAssessmentInput['readinessStatus'])}
                aria-invalid={fieldErrors.includes('readinessStatus')}
              >
                <option value="PENDING">Pending</option>
                <option value="READY">Ready</option>
                <option value="BLOCKED">Blocked</option>
              </Select>
            </FormField>
            <FormField label="Planning notes" className="wide">
              <TextArea value={values.planningNotes} onChange={(event) => update('planningNotes', event.target.value)} placeholder="Schedule, capacity, or handoff notes" />
            </FormField>
          </div>
          <footer>
            <Button type="button" variant="secondary" disabled={submitting !== null} onClick={() => void submit('save')}>
              {submitting === 'save' ? <RefreshCw className="spin" /> : <Save size={17} />}Save assessment
            </Button>
            <Button type="button" disabled={submitting !== null || !resourcesReady} onClick={() => void submit('release')}>
              {submitting === 'release' ? <RefreshCw className="spin" /> : <Send size={17} />}Complete planning & send to Press
            </Button>
          </footer>
        </section>
      </div>
    </Card>
  )
}

export function PlanningWorkspace() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<PlanningOrderSummary[]>([])
  const [resources, setResources] = useState<PlanningResources>({ productionLines: [], pressUsers: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PlanningOrderDetail | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([listPlanningOrders(), listPlanningResources()])
      .then(([nextOrders, nextResources]) => {
        if (cancelled) return
        setOrders(nextOrders)
        setResources(nextResources)
        setSelectedId(nextOrders[0]?.id ?? null)
        if (!nextOrders.length) setDetailLoading(false)
      })
      .catch((error) => {
        if (!cancelled) showToast({ title: 'Planning queue unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
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
    getPlanningOrder(selectedId)
      .then((order) => {
        if (!cancelled) setDetail(order)
      })
      .catch((error) => {
        if (!cancelled) showToast({ title: 'Planning order unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, showToast])

  const visibleOrders = orders.filter((order) => `${order.orderNumber} ${order.customerName ?? ''} ${order.productName ?? ''}`.toLowerCase().includes(deferredSearch))

  function removeReleased(orderId: string) {
    const remaining = orders.filter((order) => order.id !== orderId)
    setOrders(remaining)
    setDetail(null)
    setDetailLoading(Boolean(remaining[0]))
    setSelectedId(remaining[0]?.id ?? null)
  }

  function selectOrder(orderId: string) {
    setDetailLoading(true)
    setSelectedId(orderId)
  }

  return (
    <section className="planning-workspace workflow-workbench" aria-label="Planning work queue">
      <aside className="planning-queue workflow-queue">
        <div className="workflow-queue-title">
          <div>
            <p>Planning workspace</p>
            <h2>Approved orders</h2>
          </div>
          <strong>{visibleOrders.length}</strong>
        </div>
        <div className="workflow-filters">
          <label>
            <span>Search assigned orders</span>
            <TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, product" />
          </label>
        </div>
        <div className="workflow-order-list">
          {loading ? (
            <div className="workflow-queue-empty">
              <RefreshCw className="spin" />
              <strong>Loading assigned work</strong>
            </div>
          ) : visibleOrders.length ? (
            visibleOrders.map((order) => (
              <button key={order.id} type="button" aria-current={selectedId === order.id} onClick={() => selectOrder(order.id)}>
                <div>
                  <span className="workflow-status">{order.status}</span>
                  <small>{order.priority ?? 'Normal'} priority</small>
                </div>
                <strong>{order.productName ?? 'Product not set'}</strong>
                <p>
                  {order.orderNumber} · {order.customerName ?? 'Customer not set'}
                </p>
                <footer>
                  <span>{order.requestedQuantity?.toLocaleString() ?? 'No quantity'}</span>
                  <span>{formatDate(order.requestedDeliveryDate)}</span>
                </footer>
              </button>
            ))
          ) : (
            <div className="workflow-queue-empty">
              <CalendarCheck size={24} />
              <strong>No assigned planning orders</strong>
              <p>Technically approved orders assigned to you will appear here.</p>
            </div>
          )}
        </div>
      </aside>
      {detailLoading ? (
        <Card className="planning-detail planning-detail-empty">
          <RefreshCw className="spin" />
          <strong>Loading planning details</strong>
        </Card>
      ) : detail ? (
        <PlanningDetail key={detail.id} order={detail} resources={resources} onSaved={setDetail} onReleased={removeReleased} />
      ) : (
        <Card className="planning-detail planning-detail-empty">
          <CalendarCheck size={28} />
          <h2>No order selected</h2>
          <p>Select an assigned order to plan materials and production.</p>
        </Card>
      )}
    </section>
  )
}
