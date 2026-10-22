import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { AuthUser } from './auth-service.js'

export type ShippingOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  destination: string | null
  shipmentStatus: string
  updatedAt: Date
}

export type ShippingOrderDetail = ShippingOrderSummary & {
  shipmentId: string
  carrier: string | null
  trackingOrVehicleNumber: string | null
  dispatchAt: Date | null
  shippedQuantity: number | null
  expectedDeliveryAt: Date | null
  actualDeliveryAt: Date | null
  receivedBy: string | null
  goodQuantity: number | null
  proofAttachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: Date }>
  deliveryIssues: Array<{ id: string; category: string; notes: string; reportedAt: Date; resolvedAt: Date | null }>
}

export interface ShippingService {
  listQueue(user: AuthUser): Promise<ShippingOrderSummary[]>
  getOrder(user: AuthUser, orderId: string): Promise<ShippingOrderDetail>
  verifyReady(user: AuthUser, orderId: string): Promise<ShippingOrderDetail>
  dispatch(user: AuthUser, orderId: string, input: { carrier: string; trackingOrVehicleNumber: string; dispatchAt: string; shippedQuantity: number; destination: string; expectedDeliveryAt: string }): Promise<ShippingOrderDetail>
  uploadProof(user: AuthUser, orderId: string, file: { fileName: string; mediaType: string; content: Buffer }): Promise<ShippingOrderDetail>
  reportDeliveryIssue(user: AuthUser, orderId: string, input: { category: string; notes: string }): Promise<ShippingOrderDetail>
  confirmDelivery(user: AuthUser, orderId: string, input: { actualDeliveryAt: string; receivedBy: string }): Promise<ShippingOrderDetail>
}

export class ShippingError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly fields?: string[]) {
    super(message)
    this.name = 'ShippingError'
  }
}

function ensureShipping(user: AuthUser) {
  if (!user.roles.includes('SHIPPING')) throw new ShippingError(403, 'FORBIDDEN', 'Shipping access is required.')
}

function dateOnly(value: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

type ShippingRow = {
  id: string; order_number: string; customer_name: string | null; product_name: string | null
  status: string; priority: string | null; requested_delivery_date: string | Date | null
  destination: string | null; updated_at: Date; shipment_id: string; shipment_status: string
  carrier: string | null; tracking_or_vehicle_number: string | null; dispatch_at: Date | null
  shipped_quantity: string | null; expected_delivery_at: Date | null; actual_delivery_at: Date | null
  received_by: string | null; good_quantity: string | null
}

const shippingSelect = `
  SELECT orders.id, orders.order_number, orders.customer_name, orders.product_name,
         orders.status, orders.priority, orders.requested_delivery_date, orders.destination,
         orders.updated_at, shipment.id AS shipment_id, shipment.status AS shipment_status,
         shipment.carrier, shipment.tracking_or_vehicle_number, shipment.dispatch_at,
         shipment.shipped_quantity, shipment.expected_delivery_at, shipment.actual_delivery_at,
         shipment.received_by, run.good_quantity
  FROM flowline.orders AS orders
  JOIN LATERAL (
    SELECT item.* FROM flowline.shipments item WHERE item.order_id = orders.id
    ORDER BY item.created_at DESC LIMIT 1
  ) shipment ON true
  LEFT JOIN LATERAL (
    SELECT item.good_quantity FROM flowline.production_runs item WHERE item.order_id = orders.id
    ORDER BY item.created_at DESC LIMIT 1
  ) run ON true
`

function summary(row: ShippingRow): ShippingOrderSummary {
  return { id: row.id, orderNumber: row.order_number, customerName: row.customer_name, productName: row.product_name,
    status: row.status, priority: row.priority, requestedDeliveryDate: dateOnly(row.requested_delivery_date),
    destination: row.destination, shipmentStatus: row.shipment_status, updatedAt: row.updated_at }
}

export class PostgresShippingService implements ShippingService {
  constructor(private readonly pool: pg.Pool) {}

  async listQueue(user: AuthUser) {
    ensureShipping(user)
    const result = await this.pool.query<ShippingRow>(`${shippingSelect}
      WHERE orders.owner_auth_user_id = $1 AND orders.stage = 'Shipping'
        AND orders.status IN ('Ready to Ship', 'Dispatched', 'On Hold')
      ORDER BY CASE orders.priority WHEN 'High' THEN 0 ELSE 1 END, orders.requested_delivery_date, orders.updated_at DESC`, [user.id])
    return result.rows.map(summary)
  }

  async getOrder(user: AuthUser, orderId: string) {
    ensureShipping(user)
    const result = await this.pool.query<ShippingRow>(`${shippingSelect}
      WHERE orders.id = $1 AND orders.owner_auth_user_id = $2`, [orderId, user.id])
    const row = result.rows[0]
    if (!row) throw new ShippingError(404, 'ORDER_NOT_FOUND', 'Shipping order not found.')
    const [proof, issues] = await Promise.all([
      this.pool.query<{ id: string; file_name: string; media_type: string; size_bytes: string; created_at: Date }>(
        `SELECT id, file_name, media_type, size_bytes, created_at FROM flowline.attachments
         WHERE order_id = $1 AND related_entity_type = 'SHIPMENT' AND related_entity_id = $2 ORDER BY created_at DESC`, [orderId, row.shipment_id]),
      this.pool.query<{ id: string; category: string; notes: string; reported_at: Date; resolved_at: Date | null }>(
        `SELECT id, category, notes, reported_at, resolved_at FROM flowline.delivery_issues
         WHERE order_id = $1 AND shipment_id = $2 ORDER BY reported_at DESC`, [orderId, row.shipment_id]),
    ])
    return { ...summary(row), shipmentId: row.shipment_id, carrier: row.carrier,
      trackingOrVehicleNumber: row.tracking_or_vehicle_number, dispatchAt: row.dispatch_at,
      shippedQuantity: row.shipped_quantity === null ? null : Number(row.shipped_quantity),
      expectedDeliveryAt: row.expected_delivery_at, actualDeliveryAt: row.actual_delivery_at,
      receivedBy: row.received_by, goodQuantity: row.good_quantity === null ? null : Number(row.good_quantity),
      proofAttachments: proof.rows.map((file) => ({ id: file.id, fileName: file.file_name, mediaType: file.media_type, sizeBytes: Number(file.size_bytes), createdAt: file.created_at })),
      deliveryIssues: issues.rows.map((issue) => ({ id: issue.id, category: issue.category, notes: issue.notes, reportedAt: issue.reported_at, resolvedAt: issue.resolved_at })) }
  }

  private async locked(client: pg.PoolClient, user: AuthUser, orderId: string, shipmentStatuses: string[]) {
    const result = await client.query<ShippingRow>(`${shippingSelect}
      WHERE orders.id = $1 AND orders.owner_auth_user_id = $2 AND orders.stage = 'Shipping'
        AND shipment.status = ANY($3::text[]) FOR UPDATE OF orders, shipment`, [orderId, user.id, shipmentStatuses])
    const row = result.rows[0]
    if (!row) throw new ShippingError(404, 'ORDER_NOT_FOUND', 'Shipping order not found or action is not allowed in its current state.')
    return row
  }

  async verifyReady(user: AuthUser, orderId: string) {
    ensureShipping(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.locked(client, user, orderId, ['PENDING'])
      await client.query(`UPDATE flowline.shipments SET status = 'READY' WHERE id = $1`, [row.shipment_id])
      await client.query(`INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, reason) VALUES ($1,$2,'SHIPPING_READINESS_VERIFIED','Dispatch readiness verified')`, [orderId, user.id])
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async dispatch(user: AuthUser, orderId: string, input: { carrier: string; trackingOrVehicleNumber: string; dispatchAt: string; shippedQuantity: number; destination: string; expectedDeliveryAt: string }) {
    ensureShipping(user)
    const fields: string[] = []
    if (!input.carrier.trim()) fields.push('carrier')
    if (!input.trackingOrVehicleNumber.trim()) fields.push('trackingOrVehicleNumber')
    if (!input.dispatchAt) fields.push('dispatchAt')
    if (!Number.isFinite(input.shippedQuantity) || input.shippedQuantity <= 0) fields.push('shippedQuantity')
    if (!input.destination.trim()) fields.push('destination')
    if (!input.expectedDeliveryAt) fields.push('expectedDeliveryAt')
    if (fields.length) throw new ShippingError(422, 'DISPATCH_INCOMPLETE', 'Complete all required dispatch fields.', fields)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.locked(client, user, orderId, ['READY'])
      if (row.good_quantity !== null && input.shippedQuantity > Number(row.good_quantity)) throw new ShippingError(422, 'QUANTITY_EXCEEDS_PRODUCTION', 'Shipped quantity cannot exceed good production quantity.', ['shippedQuantity'])
      await client.query(`UPDATE flowline.shipments SET status='DISPATCHED', carrier=$2, tracking_or_vehicle_number=$3,
        dispatch_at=$4, shipped_quantity=$5, destination=$6, expected_delivery_at=$7 WHERE id=$1`,
      [row.shipment_id, input.carrier.trim(), input.trackingOrVehicleNumber.trim(), input.dispatchAt, input.shippedQuantity, input.destination.trim(), input.expectedDeliveryAt])
      await client.query(`UPDATE flowline.orders SET status='Dispatched', version=version+1 WHERE id=$1`, [orderId])
      await client.query(`INSERT INTO flowline.audit_events (order_id,actor_auth_user_id,action,previous_status,new_status,reason)
        VALUES ($1,$2,'SHIPPING_DISPATCHED',$3,'Dispatched',$4)`, [orderId, user.id, row.status, `${input.carrier.trim()} · ${input.trackingOrVehicleNumber.trim()}`])
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async uploadProof(user: AuthUser, orderId: string, file: { fileName: string; mediaType: string; content: Buffer }) {
    ensureShipping(user)
    if (!file.content.length) throw new ShippingError(400, 'FILE_EMPTY', 'The proof file is empty.')
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.locked(client, user, orderId, ['DISPATCHED', 'ISSUE'])
      await client.query(`INSERT INTO flowline.attachments (order_id,related_entity_type,related_entity_id,file_name,media_type,size_bytes,storage_key,uploaded_by_auth_user_id,content)
        VALUES ($1,'SHIPMENT',$2,$3,$4,$5,$6,$7,$8)`, [orderId, row.shipment_id, file.fileName, file.mediaType, file.content.length, randomUUID(), user.id, file.content])
      await client.query(`INSERT INTO flowline.audit_events (order_id,actor_auth_user_id,action,details) VALUES ($1,$2,'DELIVERY_PROOF_ADDED',jsonb_build_object('fileName',$3::text))`, [orderId, user.id, file.fileName])
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async reportDeliveryIssue(user: AuthUser, orderId: string, input: { category: string; notes: string }) {
    ensureShipping(user)
    if (!input.category.trim() || input.notes.trim().length < 10) throw new ShippingError(422, 'ISSUE_INCOMPLETE', 'Record a delivery issue category and detailed notes.', ['category', 'notes'])
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.locked(client, user, orderId, ['READY', 'DISPATCHED'])
      await client.query(`INSERT INTO flowline.delivery_issues (order_id,shipment_id,category,notes,reported_by_auth_user_id) VALUES ($1,$2,$3,$4,$5)`, [orderId, row.shipment_id, input.category.trim(), input.notes.trim(), user.id])
      await client.query(`UPDATE flowline.shipments SET status='ISSUE' WHERE id=$1`, [row.shipment_id])
      await client.query(`UPDATE flowline.orders SET status='On Hold', version=version+1 WHERE id=$1`, [orderId])
      await client.query(`INSERT INTO flowline.audit_events (order_id,actor_auth_user_id,action,previous_status,new_status,reason) VALUES ($1,$2,'DELIVERY_ISSUE_REPORTED',$3,'On Hold',$4)`, [orderId, user.id, row.status, `${input.category.trim()}: ${input.notes.trim()}`])
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async confirmDelivery(user: AuthUser, orderId: string, input: { actualDeliveryAt: string; receivedBy: string }) {
    ensureShipping(user)
    const fields: string[] = []
    if (!input.actualDeliveryAt) fields.push('actualDeliveryAt')
    if (!input.receivedBy.trim()) fields.push('receivedBy')
    if (fields.length) throw new ShippingError(422, 'DELIVERY_INCOMPLETE', 'Record delivery time and recipient.', fields)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.locked(client, user, orderId, ['DISPATCHED', 'ISSUE'])
      const proof = await client.query<{ count: string }>(`SELECT count(*) AS count FROM flowline.attachments WHERE order_id=$1 AND related_entity_type='SHIPMENT' AND related_entity_id=$2`, [orderId, row.shipment_id])
      if (Number(proof.rows[0]?.count ?? 0) < 1) throw new ShippingError(422, 'DELIVERY_PROOF_REQUIRED', 'Upload proof of delivery before confirming delivery.', ['proof'])
      await client.query(`UPDATE flowline.shipments SET status='DELIVERED', actual_delivery_at=$2, received_by=$3 WHERE id=$1`, [row.shipment_id, input.actualDeliveryAt, input.receivedBy.trim()])
      await client.query(`UPDATE flowline.delivery_issues SET resolved_at=COALESCE(resolved_at,clock_timestamp()) WHERE shipment_id=$1 AND resolved_at IS NULL`, [row.shipment_id])
      await client.query(`UPDATE flowline.orders SET status='Delivered', stage='Delivered', version=version+1 WHERE id=$1`, [orderId])
      await client.query(`INSERT INTO flowline.audit_events (order_id,actor_auth_user_id,action,previous_status,new_status,reason) VALUES ($1,$2,'SHIPPING_DELIVERED',$3,'Delivered',$4)`, [orderId, user.id, row.status, `Received by ${input.receivedBy.trim()}`])
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }
}
