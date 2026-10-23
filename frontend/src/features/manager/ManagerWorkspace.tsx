import { CheckCircle2, FileCheck2, RefreshCw, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, Card, FormField, TextInput } from '../../components/ui'
import { confirmManagerDelivery, listManagerOrders, ManagerRequestError, uploadManagerProof } from './manager-service'
import type { ManagerOrder } from './manager-service'
import './manager-workspace.css'

export function ManagerWorkspace() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<ManagerOrder[]>([])
  const [selected, setSelected] = useState<ManagerOrder | null>(null)
  const [proof, setProof] = useState<File | null>(null)
  const [receivedBy, setReceivedBy] = useState('')
  const [actualDeliveryAt, setActualDeliveryAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  useEffect(() => {
    void listManagerOrders()
      .then((items) => {
        setOrders(items)
        setSelected(items[0] ?? null)
      })
      .catch((error) => showToast({ title: 'Manager queue unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' }))
  }, [showToast])
  async function upload() {
    if (!selected || !proof) return
    setBusy(true)
    try {
      const next = await uploadManagerProof(selected.id, proof)
      setSelected(next)
      setOrders((items) => items.map((item) => (item.id === next.id ? next : item)))
      setProof(null)
      showToast({ title: 'Delivery proof uploaded', tone: 'success' })
    } catch (error) {
      showToast({ title: 'Proof upload failed', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  async function confirm() {
    if (!selected) return
    setBusy(true)
    try {
      await confirmManagerDelivery(selected.id, { actualDeliveryAt: new Date(actualDeliveryAt).toISOString(), receivedBy })
      showToast({ title: 'Delivery confirmed', message: 'The order is now Delivered.', tone: 'success' })
      const remaining = orders.filter((item) => item.id !== selected.id)
      setOrders(remaining)
      setSelected(remaining[0] ?? null)
    } catch (error) {
      if (error instanceof ManagerRequestError) showToast({ title: 'Delivery confirmation blocked', message: error.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const visibleOrders = orders.filter((order) => `${order.orderNumber} ${order.productName ?? ''} ${order.customerName ?? ''} ${order.destination ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <section className="manager-workspace" aria-label="Manager delivery workspace">
      <aside className="manager-queue">
        <header>
          <div>
            <p>Manager workspace</p>
            <h2>Delivery handoffs</h2>
          </div>
          <strong>{visibleOrders.length}</strong>
        </header>
        <div className="manager-search">
          <TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search handoffs" />
        </div>
        {visibleOrders.length ? (
          visibleOrders.map((order) => (
            <button key={order.id} type="button" className={selected?.id === order.id ? 'selected' : ''} onClick={() => setSelected(order)}>
              <span>{order.status}</span>
              <strong>{order.productName ?? 'Product not set'}</strong>
              <small>
                {order.orderNumber} · {order.destination ?? 'Destination not set'}
              </small>
            </button>
          ))
        ) : (
          <div className="manager-empty">
            <Truck size={26} />
            <strong>No Manager handoffs</strong>
            <p>Shipping escalations assigned to you will appear here.</p>
          </div>
        )}
      </aside>
      {selected ? (
        <Card className="manager-detail">
          <header>
            <div>
              <span className="manager-status">{selected.status}</span>
              <h2>{selected.productName ?? 'Product not set'}</h2>
              <p>
                {selected.orderNumber} · {selected.customerName ?? 'Customer not set'}
              </p>
            </div>
            <Truck size={28} />
          </header>
          <dl>
            <div>
              <dt>Destination</dt>
              <dd>{selected.destination ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Carrier</dt>
              <dd>{selected.carrier ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Tracking / vehicle</dt>
              <dd>{selected.trackingOrVehicleNumber ?? 'Not set'}</dd>
            </div>
            <div>
              <dt>Shipment status</dt>
              <dd>{selected.shipmentStatus}</dd>
            </div>
          </dl>
          {selected.status === 'Delivered' ? <section className="manager-delivery-panel manager-delivery-complete"><header><CheckCircle2 size={19} /><div><strong>Delivered to client</strong><small>Delivery confirmation has been recorded.</small></div></header></section> : <section className="manager-delivery-panel">
            <header>
              <FileCheck2 size={19} />
              <div>
                <strong>Deliver to client</strong>
                <small>Proof, delivery time, and recipient are mandatory.</small>
              </div>
            </header>
            <div className="manager-proof">
              <FormField label="Proof of delivery" required>
                <TextInput type="file" onChange={(event) => setProof(event.target.files?.[0] ?? null)} />
              </FormField>
              <Button type="button" disabled={busy || !proof} onClick={() => void upload()}>
                <FileCheck2 size={16} />
                Upload proof
              </Button>
            </div>
            {selected.proofAttachments.length ? (
              <ul>
                {selected.proofAttachments.map((file) => (
                  <li key={file.id}>{file.fileName}</li>
                ))}
              </ul>
            ) : (
              <p>No proof uploaded.</p>
            )}
            <div className="manager-delivery-fields">
              <FormField label="Actual delivery time" required>
                <TextInput type="datetime-local" value={actualDeliveryAt} onChange={(event) => setActualDeliveryAt(event.target.value)} />
              </FormField>
              <FormField label="Received by" required>
                <TextInput value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} />
              </FormField>
            </div>
            <footer>
              <Button variant="primary" type="button" disabled={busy || !selected.proofAttachments.length || !receivedBy.trim() || !actualDeliveryAt} onClick={() => void confirm()}>
                <CheckCircle2 size={16} />
                Confirm delivered
              </Button>
            </footer>
          </section>}
        </Card>
      ) : (
        <Card className="manager-detail manager-detail-empty">
          <RefreshCw size={28} />
          <h2>No Manager handoff selected</h2>
        </Card>
      )}
    </section>
  )
}
