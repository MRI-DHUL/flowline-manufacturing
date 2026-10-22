import { CheckCircle2, CircleAlert, Factory, Pause, Play, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, Card, FormField, Select, TextArea, TextInput } from '../../components/ui'
import { ReportIssueButton } from '../issues/ReportIssueButton'
import { HoldControls } from '../holds/HoldControls'
import {
  acceptPressOrder,
  completePressOrder,
  getPressOrder,
  listPressOrders,
  listShippingUsers,
  pausePressOrder,
  PressRequestError,
  reportProductionIssue,
  startPressOrder,
} from './press-service'
import type { PressOrderDetail, PressOrderSummary, ShippingUser } from './press-service'
import './press-workspace.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : dateFormatter.format(date)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not started'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : dateTimeFormatter.format(date)
}

function PressDetail({ order, shippingUsers, onUpdated, onCompleted }: {
  order: PressOrderDetail
  shippingUsers: ShippingUser[]
  onUpdated: (order: PressOrderDetail) => void
  onCompleted: (orderId: string) => void
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [issue, setIssue] = useState({ category: '', notes: '', correctiveAction: '' })
  const [completion, setCompletion] = useState({ goodQuantity: '', wasteQuantity: '', notes: '', shippingUserAuthUserId: '' })
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  async function runAction(action: 'accept' | 'start' | 'pause') {
    setBusy(true)
    try {
      const updated = action === 'accept'
        ? await acceptPressOrder(order.id)
        : action === 'start'
          ? await startPressOrder(order.id)
          : await pausePressOrder(order.id, pauseReason)
      onUpdated(updated)
      if (action === 'pause') setPauseReason('')
      showToast({ title: action === 'accept' ? 'Job accepted' : action === 'start' ? 'Production started' : 'Production paused', tone: 'success' })
    } catch (error) {
      if (error instanceof PressRequestError) setFieldErrors(error.fields)
      showToast({ title: 'Production action failed', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally { setBusy(false) }
  }

  async function submitIssue() {
    setBusy(true)
    try {
      const updated = await reportProductionIssue(order.id, issue)
      onUpdated(updated)
      setIssue({ category: '', notes: '', correctiveAction: '' })
      showToast({ title: 'Production issue recorded', message: 'The job requires rework before completion.', tone: 'success' })
    } catch (error) {
      if (error instanceof PressRequestError) setFieldErrors(error.fields)
      showToast({ title: 'Issue not recorded', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally { setBusy(false) }
  }

  async function complete() {
    setBusy(true)
    setFieldErrors([])
    try {
      await completePressOrder(order.id, {
        goodQuantity: Number(completion.goodQuantity),
        wasteQuantity: Number(completion.wasteQuantity),
        notes: completion.notes,
        shippingUserAuthUserId: completion.shippingUserAuthUserId,
      })
      showToast({ title: 'Production completed', message: 'The order was assigned and sent to the selected Shipping user.', tone: 'success' })
      onCompleted(order.id)
    } catch (error) {
      if (error instanceof PressRequestError) setFieldErrors(error.fields)
      showToast({ title: 'Completion blocked', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally { setBusy(false) }
  }

  const canAccept = order.runStatus === 'SCHEDULED'
  const canStart = ['ACCEPTED', 'PAUSED', 'ISSUE'].includes(order.runStatus)
  const canPause = order.runStatus === 'IN_PRODUCTION'
  const canComplete = order.runStatus === 'IN_PRODUCTION'
  const shippingReady = shippingUsers.length > 0

  return (
    <Card className="press-detail">
      <header className="press-detail-header">
        <div><span className="workflow-status">{order.status}</span><h2>{order.productName ?? 'Product not set'}</h2><p>{order.orderNumber} · {order.customerName ?? 'Customer not set'}</p></div>
        <div className="press-detail-actions"><ReportIssueButton orderId={order.id} orderNumber={order.orderNumber} /><HoldControls orderId={order.id} orderNumber={order.orderNumber} status={order.status} stage="Press" defaultTeam="PRESS" />{canAccept ? <Button variant="primary" type="button" disabled={busy} onClick={() => void runAction('accept')}><CheckCircle2 size={16} />Accept job</Button> : null}{canStart ? <Button variant="primary" type="button" disabled={busy} onClick={() => void runAction('start')}><Play size={16} />{order.runStatus === 'ACCEPTED' ? 'Start production' : 'Resume production'}</Button> : null}</div>
      </header>
      <div className="press-detail-content">
        <dl className="press-spec-grid">
          <div><dt>Production line</dt><dd>{order.productionLineName ?? 'Not assigned'}</dd></div>
          <div><dt>Run status</dt><dd>{order.runStatus.replaceAll('_', ' ')}</dd></div>
          <div><dt>Planned quantity</dt><dd>{order.plannedQuantity.toLocaleString()}</dd></div>
          <div><dt>Requested delivery</dt><dd>{formatDate(order.requestedDeliveryDate)}</dd></div>
          <div><dt>Started</dt><dd>{formatDateTime(order.startedAt)}</dd></div>
          <div><dt>Destination</dt><dd>{order.destination ?? 'Not set'}</dd></div>
          <div><dt>Material</dt><dd>{order.material ?? 'Not set'}</dd></div>
          <div><dt>Dimensions</dt><dd>{order.dimensions ?? 'Not set'}</dd></div>
          <div><dt>Print colors</dt><dd>{order.printColors ?? 'Not set'}</dd></div>
        </dl>

        {order.technicalNotes ? <section className="press-notes"><h3>Production notes</h3><p>{order.technicalNotes}</p></section> : null}

        {canPause ? <section className="press-action-panel"><header><Pause size={18} /><div><strong>Pause production</strong><small>Record why this run cannot continue.</small></div></header><div className="press-inline-action"><TextInput value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} placeholder="Pause reason" aria-invalid={fieldErrors.includes('reason')} /><Button type="button" disabled={busy || pauseReason.trim().length < 5} onClick={() => void runAction('pause')}><Pause size={16} />Pause</Button></div></section> : null}

        {['IN_PRODUCTION', 'PAUSED'].includes(order.runStatus) ? <section className="press-action-panel press-issue-panel"><header><ShieldAlert size={18} /><div><strong>Production issue / rework</strong><small>Record the issue before resuming production.</small></div></header><div className="press-form-grid"><FormField label="Issue category" required><TextInput value={issue.category} onChange={(event) => setIssue((current) => ({ ...current, category: event.target.value }))} aria-invalid={fieldErrors.includes('category')} /></FormField><FormField label="Corrective action"><TextInput value={issue.correctiveAction} onChange={(event) => setIssue((current) => ({ ...current, correctiveAction: event.target.value }))} /></FormField><FormField label="Issue notes" required className="wide"><TextArea value={issue.notes} onChange={(event) => setIssue((current) => ({ ...current, notes: event.target.value }))} aria-invalid={fieldErrors.includes('notes')} /></FormField></div><footer><Button variant="danger" type="button" disabled={busy} onClick={() => void submitIssue()}><ShieldAlert size={16} />Record issue & request rework</Button></footer></section> : null}

        {order.issues.length ? <section className="press-history"><h3>Production issue history</h3><ol>{order.issues.map((item) => <li key={item.id}><strong>{item.category}</strong><time>{formatDateTime(item.reportedAt)}</time><p>{item.notes}</p>{item.correctiveAction ? <small>Corrective action: {item.correctiveAction}</small> : null}</li>)}</ol></section> : null}

        {canComplete ? <section className="press-completion" aria-label="Production completion"><header><Factory size={20} /><div><strong>Complete production & send to Shipping</strong><small>Completion is blocked until quantities and a Shipping assignee are recorded.</small></div></header>{!shippingReady ? <div className="press-resource-warning"><CircleAlert size={17} /><span>No active Shipping users are available.</span></div> : null}<div className="press-form-grid"><FormField label="Assign to Shipping user on completion" required className="wide" hint="The completed order is sent only to this active Shipping user."><Select value={completion.shippingUserAuthUserId} onChange={(event) => setCompletion((current) => ({ ...current, shippingUserAuthUserId: event.target.value }))} aria-invalid={fieldErrors.includes('shippingUserAuthUserId')}><option value="">Select active Shipping user</option>{shippingUsers.map((user) => <option key={user.authUserId} value={user.authUserId}>{user.displayName} ({user.email})</option>)}</Select></FormField><FormField label="Good quantity" required><TextInput type="number" min="0" step="0.001" value={completion.goodQuantity} onChange={(event) => setCompletion((current) => ({ ...current, goodQuantity: event.target.value }))} aria-invalid={fieldErrors.includes('goodQuantity')} /></FormField><FormField label="Waste quantity" required><TextInput type="number" min="0" step="0.001" value={completion.wasteQuantity} onChange={(event) => setCompletion((current) => ({ ...current, wasteQuantity: event.target.value }))} aria-invalid={fieldErrors.includes('wasteQuantity')} /></FormField><FormField label="Completion notes" className="wide"><TextArea value={completion.notes} onChange={(event) => setCompletion((current) => ({ ...current, notes: event.target.value }))} /></FormField></div><footer><Button variant="primary" type="button" disabled={busy || !shippingReady} onClick={() => void complete()}><Send size={16} />Complete production & send to Shipping</Button></footer></section> : null}
      </div>
    </Card>
  )
}

export function PressWorkspace() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<PressOrderSummary[]>([])
  const [shippingUsers, setShippingUsers] = useState<ShippingUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PressOrderDetail | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([listPressOrders(), listShippingUsers()]).then(([nextOrders, users]) => {
      if (cancelled) return
      setOrders(nextOrders)
      setShippingUsers(users)
      setSelectedId(nextOrders[0]?.id ?? null)
      if (!nextOrders.length) setDetailLoading(false)
    }).catch((error) => { if (!cancelled) showToast({ title: 'Press queue unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' }) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [showToast])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    getPressOrder(selectedId).then((item) => { if (!cancelled) setDetail(item) }).catch((error) => { if (!cancelled) showToast({ title: 'Press job unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' }) }).finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, showToast])

  const visible = orders.filter((order) => `${order.orderNumber} ${order.customerName ?? ''} ${order.productName ?? ''}`.toLowerCase().includes(deferredSearch))

  function updateDetail(updated: PressOrderDetail) {
    setDetail(updated)
    setOrders((current) => current.map((order) => order.id === updated.id ? updated : order))
  }

  function removeCompleted(orderId: string) {
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

  return <section className="workflow-workbench press-workspace" aria-label="Press production workspace"><aside className="workflow-queue"><div className="workflow-queue-title"><div><p>Production workspace</p><h2>Scheduled jobs</h2></div><strong>{visible.length}</strong></div><div className="workflow-filters press-search"><label><span>Search assigned jobs</span><TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, product" /></label></div><div className="workflow-order-list">{loading ? <div className="workflow-queue-empty"><RefreshCw className="spin" /><strong>Loading production queue</strong></div> : visible.length ? visible.map((order) => <button key={order.id} type="button" aria-current={selectedId === order.id} onClick={() => selectOrder(order.id)}><div><span className="workflow-status">{order.status}</span><small>{order.priority ?? 'Normal'} priority</small></div><strong>{order.productName ?? 'Product not set'}</strong><p>{order.orderNumber} · {order.customerName ?? 'Customer not set'}</p><footer><span>{order.productionLineName ?? 'No line'}</span><span>{order.plannedQuantity.toLocaleString()}</span></footer></button>) : <div className="workflow-queue-empty"><Factory size={24} /><strong>No assigned production jobs</strong><p>Jobs assigned by Planning will appear here.</p></div>}</div></aside>{detailLoading ? <Card className="press-detail press-detail-empty"><RefreshCw className="spin" /><strong>Loading production job</strong></Card> : detail ? <PressDetail key={`${detail.id}-${detail.runStatus}`} order={detail} shippingUsers={shippingUsers} onUpdated={updateDetail} onCompleted={removeCompleted} /> : <Card className="press-detail press-detail-empty"><Factory size={28} /><h2>No job selected</h2><p>Select an assigned production job.</p></Card>}</section>
}
