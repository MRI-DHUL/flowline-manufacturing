import { CheckCircle2, FileCheck2, RefreshCw, Send, Truck } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, Card, FormField, TextInput } from '../../components/ui'
import { ReportIssueButton } from '../issues/ReportIssueButton'
import { HoldControls } from '../holds/HoldControls'
import {
  confirmShippingDelivery,
  dispatchShippingOrder,
  getShippingOrder,
  handoffToManager,
  listShippingOrders,
  ShippingRequestError,
  uploadDeliveryProof,
  verifyShippingReady,
} from './shipping-service'
import type { ShippingOrderDetail, ShippingOrderSummary } from './shipping-service'
import './shipping-workspace.css'

const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
function format(value: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : fmt.format(date)
}
function ShippingDetail({ order, onUpdated, onDelivered }: { order: ShippingOrderDetail; onUpdated: (order: ShippingOrderDetail) => void; onDelivered: (id: string) => void }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [dispatch, setDispatch] = useState({
    carrier: order.carrier ?? '',
    trackingOrVehicleNumber: order.trackingOrVehicleNumber ?? '',
    dispatchAt: '',
    shippedQuantity: order.goodQuantity?.toString() ?? '',
    destination: order.destination ?? '',
    expectedDeliveryAt: '',
  })
  const [delivery, setDelivery] = useState({ actualDeliveryAt: '', receivedBy: '' })
  const [proof, setProof] = useState<File | null>(null)
  async function execute(label: string, work: () => Promise<ShippingOrderDetail>, success: string) {
    setBusy(true)
    setErrors([])
    try {
      const next = await work()
      onUpdated(next)
      showToast({ title: success, tone: 'success' })
    } catch (error) {
      if (error instanceof ShippingRequestError) setErrors(error.fields)
      showToast({ title: label, message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const ready = order.shipmentStatus === 'PENDING',
    dispatchable = order.shipmentStatus === 'READY',
    dispatched = ['DISPATCHED', 'ISSUE'].includes(order.shipmentStatus)
  return (
    <Card className="shipping-detail">
      <header className="shipping-detail-header">
        <div>
          <span className="workflow-status">{order.status}</span>
          <h2>{order.productName ?? 'Product not set'}</h2>
          <p>
            {order.orderNumber} · {order.customerName ?? 'Customer not set'}
          </p>
        </div>
        <div className="shipping-header-actions">
          <ReportIssueButton orderId={order.id} orderNumber={order.orderNumber} />
          <HoldControls orderId={order.id} orderNumber={order.orderNumber} status={order.status} stage="Shipping" defaultTeam="SHIPPING" />
          {ready ? (
            <Button variant="primary" disabled={busy} onClick={() => void execute('Readiness not verified', () => verifyShippingReady(order.id), 'Dispatch readiness verified')}>
              <CheckCircle2 size={16} />
              Verify readiness
            </Button>
          ) : null}
        </div>
      </header>
      <div className="shipping-detail-content">
        <dl className="shipping-summary">
          <div>
            <dt>Shipment status</dt>
            <dd>{order.shipmentStatus}</dd>
          </div>
          <div>
            <dt>Good quantity</dt>
            <dd>{order.goodQuantity?.toLocaleString() ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>{order.destination ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Requested delivery</dt>
            <dd>{format(order.requestedDeliveryDate)}</dd>
          </div>
          <div>
            <dt>Carrier</dt>
            <dd>{order.carrier ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Tracking / vehicle</dt>
            <dd>{order.trackingOrVehicleNumber ?? 'Not set'}</dd>
          </div>
        </dl>
        {dispatchable ? (
          <section className="shipping-panel" aria-label="Dispatch order">
            <header>
              <Truck size={19} />
              <div>
                <strong>Dispatch order</strong>
                <small>Record all transport details before dispatch.</small>
              </div>
            </header>
            <div className="shipping-grid">
              <FormField label="Carrier" required>
                <TextInput value={dispatch.carrier} onChange={(e) => setDispatch((v) => ({ ...v, carrier: e.target.value }))} aria-invalid={errors.includes('carrier')} />
              </FormField>
              <FormField label="Tracking / vehicle number" required>
                <TextInput value={dispatch.trackingOrVehicleNumber} onChange={(e) => setDispatch((v) => ({ ...v, trackingOrVehicleNumber: e.target.value }))} aria-invalid={errors.includes('trackingOrVehicleNumber')} />
              </FormField>
              <FormField label="Dispatch date and time" required>
                <TextInput type="datetime-local" value={dispatch.dispatchAt} onChange={(e) => setDispatch((v) => ({ ...v, dispatchAt: e.target.value }))} />
              </FormField>
              <FormField label="Expected delivery" required>
                <TextInput type="datetime-local" value={dispatch.expectedDeliveryAt} onChange={(e) => setDispatch((v) => ({ ...v, expectedDeliveryAt: e.target.value }))} />
              </FormField>
              <FormField label="Shipped quantity" required>
                <TextInput type="number" min="0" value={dispatch.shippedQuantity} onChange={(e) => setDispatch((v) => ({ ...v, shippedQuantity: e.target.value }))} />
              </FormField>
              <FormField label="Destination" required>
                <TextInput value={dispatch.destination} onChange={(e) => setDispatch((v) => ({ ...v, destination: e.target.value }))} />
              </FormField>
            </div>
            <footer>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void execute(
                    'Dispatch blocked',
                    () =>
                      dispatchShippingOrder(order.id, {
                        ...dispatch,
                        dispatchAt: new Date(dispatch.dispatchAt).toISOString(),
                        expectedDeliveryAt: new Date(dispatch.expectedDeliveryAt).toISOString(),
                        shippedQuantity: Number(dispatch.shippedQuantity),
                      }),
                    'Order dispatched',
                  )
                }
              >
                <Send size={16} />
                Dispatch order
              </Button>
            </footer>
          </section>
        ) : null}
        {dispatched ? (
          <>
            <section className="shipping-panel" aria-label="Delivery confirmation">
              <header>
                <FileCheck2 size={19} />
                <div>
                  <strong>Confirm delivery</strong>
                  <small>Proof, delivery time, and recipient are mandatory.</small>
                </div>
              </header>
              <div className="shipping-proof">
                <FormField label="Proof of delivery" required>
                  <TextInput type="file" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                </FormField>
                <Button
                  disabled={busy || !proof}
                  onClick={() => {
                    if (proof) void execute('Proof upload failed', () => uploadDeliveryProof(order.id, proof), 'Proof of delivery uploaded')
                  }}
                >
                  Upload proof
                </Button>
              </div>
              {order.proofAttachments.length ? (
                <ul className="shipping-files">
                  {order.proofAttachments.map((file) => (
                    <li key={file.id}>
                      <FileCheck2 size={16} />
                      <span>{file.fileName}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="shipping-no-proof">No proof uploaded.</p>
              )}
              <div className="shipping-grid">
                <FormField label="Actual delivery date and time" required>
                  <TextInput type="datetime-local" value={delivery.actualDeliveryAt} onChange={(e) => setDelivery((v) => ({ ...v, actualDeliveryAt: e.target.value }))} />
                </FormField>
                <FormField label="Received by" required>
                  <TextInput value={delivery.receivedBy} onChange={(e) => setDelivery((v) => ({ ...v, receivedBy: e.target.value }))} />
                </FormField>
              </div>
              <div className="shipping-handoff">
                <FormField label="Manager handoff" hint="All active Managers will receive this delivery handoff.">
                  <span className="shipping-role-handoff">Assign to Manager role</span>
                </FormField>
                <Button variant="primary" disabled={busy} onClick={() => void execute('Manager handoff blocked', () => handoffToManager(order.id), 'Order handed off to all Managers')}>
                  <Send size={16} />
                  Send to Manager
                </Button>
              </div>
              <footer>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true)
                      try {
                        await confirmShippingDelivery(order.id, {
                          actualDeliveryAt: new Date(delivery.actualDeliveryAt).toISOString(),
                          receivedBy: delivery.receivedBy,
                        })
                        showToast({ title: 'Delivery confirmed', tone: 'success' })
                        onDelivered(order.id)
                      } catch (error) {
                        showToast({
                          title: 'Delivery confirmation blocked',
                          message: error instanceof Error ? error.message : undefined,
                          tone: 'error',
                        })
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }
                >
                  <CheckCircle2 size={16} />
                  Confirm delivery
                </Button>
              </footer>
            </section>
          </>
        ) : null}
        {order.deliveryIssues.length ? (
          <section className="shipping-history">
            <h3>Delivery issue history</h3>
            {order.deliveryIssues.map((item) => (
              <article key={item.id}>
                <strong>{item.category}</strong>
                <time>{format(item.reportedAt)}</time>
                <p>{item.notes}</p>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </Card>
  )
}
export function ShippingWorkspace() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<ShippingOrderSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<ShippingOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(true)
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search.trim().toLowerCase())
  useEffect(() => {
    let cancelled = false
    listShippingOrders()
      .then((items) => {
        if (cancelled) return
        setOrders(items)
        setSelected(items[0]?.id ?? null)
        if (!items.length) setDetailLoading(false)
      })
      .catch((error) => {
        if (!cancelled) showToast({ title: 'Shipping queue unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    getShippingOrder(selected)
      .then((item) => {
        if (!cancelled) setDetail(item)
      })
      .catch((error) => {
        if (!cancelled) showToast({ title: 'Shipment unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, showToast])
  const visible = orders.filter((order) => `${order.orderNumber} ${order.customerName ?? ''} ${order.productName ?? ''}`.toLowerCase().includes(deferred))
  function remove(id: string) {
    const remaining = orders.filter((o) => o.id !== id)
    setOrders(remaining)
    setDetail(null)
    setDetailLoading(Boolean(remaining[0]))
    setSelected(remaining[0]?.id ?? null)
  }
  return (
    <section className="workflow-workbench shipping-workspace" aria-label="Shipping delivery workspace">
      <aside className="workflow-queue">
        <div className="workflow-queue-title">
          <div>
            <p>Shipping workspace</p>
            <h2>Delivery queue</h2>
          </div>
          <strong>{visible.length}</strong>
        </div>
        <div className="workflow-filters shipping-search">
          <label>
            <span>Search shipments</span>
            <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <div className="workflow-order-list">
          {loading ? (
            <div className="workflow-queue-empty">
              <RefreshCw className="spin" />
            </div>
          ) : visible.length ? (
            visible.map((order) => (
              <button
                key={order.id}
                onClick={() => {
                  setDetailLoading(true)
                  setSelected(order.id)
                }}
                aria-current={selected === order.id}
              >
                <div>
                  <span className="workflow-status">{order.status}</span>
                  <small>{order.shipmentStatus}</small>
                </div>
                <strong>{order.productName ?? 'Product not set'}</strong>
                <p>
                  {order.orderNumber} · {order.customerName ?? 'Customer not set'}
                </p>
                <footer>
                  <span>{order.destination ?? 'No destination'}</span>
                  <span>{format(order.requestedDeliveryDate)}</span>
                </footer>
              </button>
            ))
          ) : (
            <div className="workflow-queue-empty">
              <Truck size={24} />
              <strong>No assigned shipments</strong>
              <p>Completed production assigned to you will appear here.</p>
            </div>
          )}
        </div>
      </aside>
      {detailLoading ? (
        <Card className="shipping-detail shipping-empty">
          <RefreshCw className="spin" />
        </Card>
      ) : detail ? (
        <ShippingDetail
          key={`${detail.id}-${detail.shipmentStatus}`}
          order={detail}
          onUpdated={(updated) => {
            setDetail(updated)
            setOrders((list) => list.map((item) => (item.id === updated.id ? updated : item)))
          }}
          onDelivered={remove}
        />
      ) : (
        <Card className="shipping-detail shipping-empty">
          <Truck size={28} />
          <h2>No shipment selected</h2>
        </Card>
      )}
    </section>
  )
}
