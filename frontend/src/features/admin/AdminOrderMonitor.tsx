import { Eye, Search } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { Card, Select, TextInput } from '../../components/ui'
import { requestJson } from '../../shared/api/client'
import './admin-workspace.css'

type AdminOrder = {
  id: string
  orderNumber: string
  customerName: string
  productName: string
  status: string
  stage: string
  priority: string | null
  owner: string
  requestedDeliveryDate: string
  createdAt: string
  updatedAt: string
  shipmentStatus: string | null
  carrier: string | null
  trackingOrVehicleNumber: string | null
  expectedDeliveryAt: string | null
  actualDeliveryAt: string | null
  receivedBy: string | null
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(new Date(value))
}

export function AdminOrderMonitor() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [error, setError] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())

  useEffect(() => {
    void requestJson<{ orders: AdminOrder[] }>('/api/v1/admin/orders')
      .then(({ orders: nextOrders }) => {
        setOrders(nextOrders)
        setSelectedId(nextOrders[0]?.id ?? null)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load the order monitor.'))
  }, [])

  const statuses = ['All', ...new Set(orders.map((order) => order.status))]
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = !deferredSearch || `${order.orderNumber} ${order.customerName} ${order.productName} ${order.owner}`.toLowerCase().includes(deferredSearch)
    return matchesSearch && (status === 'All' || order.status === status)
  })
  const selected = filteredOrders.find((order) => order.id === selectedId) ?? filteredOrders[0] ?? null

  return (
    <section className="admin-order-monitor" aria-label="Read-only order monitor">
      <Card className="admin-order-monitor-toolbar">
        <div>
          <p>Read-only oversight</p>
          <h2>All orders</h2>
          <span>Order records and delivery status are visible here. Changes must be made by the assigned workflow role.</span>
        </div>
        <strong>{filteredOrders.length} orders</strong>
      </Card>
      {error ? <p className="admin-order-monitor-error" role="alert">{error}</p> : null}
      <div className="admin-order-monitor-layout">
        <Card className="admin-order-monitor-list">
          <div className="admin-order-monitor-filters">
            <label>
              <span>Search orders</span>
              <div><Search size={16} /><TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, product, owner" /></div>
            </label>
            <label>
              <span>Status</span>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</Select>
            </label>
          </div>
          <div className="admin-order-monitor-rows">
            {filteredOrders.map((order) => (
              <button key={order.id} type="button" aria-current={selected?.id === order.id} onClick={() => setSelectedId(order.id)}>
                <span className="admin-order-status">{order.status}</span>
                <strong>{order.productName}</strong>
                <small>{order.orderNumber} · {order.customerName}</small>
                <em>{order.stage} · {order.owner}</em>
              </button>
            ))}
            {!filteredOrders.length ? <p className="admin-order-monitor-empty">No orders match these filters.</p> : null}
          </div>
        </Card>
        <Card className="admin-order-monitor-detail">
          {selected ? (
            <>
              <header>
                <div><p>Order record</p><h2>{selected.productName}</h2><span>{selected.orderNumber} · {selected.customerName}</span></div>
                <span className="admin-order-read-only"><Eye size={15} /> Read-only</span>
              </header>
              <dl>
                <div><dt>Status</dt><dd>{selected.status}</dd></div>
                <div><dt>Current stage</dt><dd>{selected.stage}</dd></div>
                <div><dt>Owner</dt><dd>{selected.owner}</dd></div>
                <div><dt>Priority</dt><dd>{selected.priority ?? 'Normal'}</dd></div>
                <div><dt>Requested delivery</dt><dd>{formatDate(selected.requestedDeliveryDate)}</dd></div>
                <div><dt>Last updated</dt><dd>{formatDate(selected.updatedAt)}</dd></div>
                <div><dt>Shipment status</dt><dd>{selected.shipmentStatus ?? 'Not created'}</dd></div>
                <div><dt>Carrier</dt><dd>{selected.carrier ?? 'Not assigned'}</dd></div>
                <div><dt>Tracking / vehicle</dt><dd>{selected.trackingOrVehicleNumber ?? 'Not assigned'}</dd></div>
                <div><dt>Expected delivery</dt><dd>{formatDate(selected.expectedDeliveryAt)}</dd></div>
                <div><dt>Actual delivery</dt><dd>{formatDate(selected.actualDeliveryAt)}</dd></div>
                <div><dt>Received by</dt><dd>{selected.receivedBy ?? 'Not recorded'}</dd></div>
              </dl>
            </>
          ) : <p className="admin-order-monitor-empty">Select an order to inspect its read-only record.</p>}
        </Card>
      </div>
    </section>
  )
}