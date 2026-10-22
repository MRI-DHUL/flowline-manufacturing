import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { AuthUser } from './auth-service.js'
import type { NotificationItem, NotificationPublisher } from './notification-service.js'

export type ManagerOrder = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  destination: string | null
  shipmentStatus: string
  carrier: string | null
  trackingOrVehicleNumber: string | null
  expectedDeliveryAt: Date | null
  actualDeliveryAt: Date | null
  receivedBy: string | null
  proofAttachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: Date }>
}

export interface ManagerService {
  listQueue(user: AuthUser): Promise<ManagerOrder[]>
  getOrder(user: AuthUser, orderId: string): Promise<ManagerOrder>
  uploadProof(user: AuthUser, orderId: string, file: { fileName: string; mediaType: string; content: Buffer }): Promise<ManagerOrder>
  confirmDelivery(user: AuthUser, orderId: string, input: { actualDeliveryAt: string; receivedBy: string }): Promise<ManagerOrder>
}

export class ManagerError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message)
    this.name = 'ManagerError'
  }
}

function ensureManager(user: AuthUser) {
  if (!user.roles.includes('MANAGER')) throw new ManagerError(403, 'FORBIDDEN', 'Manager access is required.')
}

const select = `
  SELECT orders.id, orders.order_number, orders.customer_name, orders.product_name,
         orders.status, orders.destination, shipment.status AS shipment_status,
         shipment.carrier, shipment.tracking_or_vehicle_number,
         shipment.expected_delivery_at, shipment.actual_delivery_at, shipment.received_by,
         shipment.id AS shipment_id, orders.created_by_auth_user_id AS "createdByAuthUserId"
  FROM flowline.orders orders
  JOIN LATERAL (SELECT item.* FROM flowline.shipments item WHERE item.order_id = orders.id ORDER BY item.created_at DESC LIMIT 1) shipment ON true
  WHERE orders.owner_auth_user_id = $1 AND orders.status IN ('Manager Review', 'Delivered')
`

type Row = {
  id: string
  order_number: string
  customer_name: string | null
  product_name: string | null
  status: string
  destination: string | null
  shipment_status: string
  carrier: string | null
  tracking_or_vehicle_number: string | null
  expected_delivery_at: Date | null
  actual_delivery_at: Date | null
  received_by: string | null
  shipment_id: string
}

export class PostgresManagerService implements ManagerService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {}

  private async detail(user: AuthUser, orderId: string, client?: pg.Pool | pg.PoolClient) {
    const executor = client ?? this.pool
    const result = await executor.query<Row>(`${select} AND orders.id = $2`, [user.id, orderId])
    const row = result.rows[0]
    if (!row) throw new ManagerError(404, 'ORDER_NOT_FOUND', 'Manager delivery order not found.')
    const proof = await executor.query<{ id: string; file_name: string; media_type: string; size_bytes: string; created_at: Date }>(
      `SELECT id, file_name, media_type, size_bytes, created_at FROM flowline.attachments WHERE order_id=$1 AND related_entity_type='SHIPMENT' AND related_entity_id=$2 ORDER BY created_at DESC`,
      [orderId, row.shipment_id],
    )
    return {
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      productName: row.product_name,
      status: row.status,
      destination: row.destination,
      shipmentStatus: row.shipment_status,
      carrier: row.carrier,
      trackingOrVehicleNumber: row.tracking_or_vehicle_number,
      expectedDeliveryAt: row.expected_delivery_at,
      actualDeliveryAt: row.actual_delivery_at,
      receivedBy: row.received_by,
      proofAttachments: proof.rows.map((item) => ({
        id: item.id,
        fileName: item.file_name,
        mediaType: item.media_type,
        sizeBytes: Number(item.size_bytes),
        createdAt: item.created_at,
      })),
    }
  }

  async listQueue(user: AuthUser) {
    ensureManager(user)
    const result = await this.pool.query<Row>(select, [user.id])
    return Promise.all(result.rows.map((row) => this.detail(user, row.id)))
  }
  async getOrder(user: AuthUser, orderId: string) {
    ensureManager(user)
    return this.detail(user, orderId)
  }

  async uploadProof(user: AuthUser, orderId: string, file: { fileName: string; mediaType: string; content: Buffer }) {
    ensureManager(user)
    if (!file.content.length) throw new ManagerError(400, 'FILE_EMPTY', 'The proof file is empty.')
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const order = await this.detail(user, orderId, client)
      const shipment = await client.query<{ shipment_id: string }>(`${select} AND orders.id=$2 FOR UPDATE`, [user.id, orderId])
      const row = shipment.rows[0]
      if (!row) throw new ManagerError(404, 'ORDER_NOT_FOUND', 'Manager delivery order not found.')
      await client.query(
        `INSERT INTO flowline.attachments (order_id,related_entity_type,related_entity_id,file_name,media_type,size_bytes,storage_key,uploaded_by_auth_user_id,content) VALUES ($1,'SHIPMENT',$2,$3,$4,$5,$6,$7,$8)`,
        [orderId, row.shipment_id, file.fileName, file.mediaType, file.content.length, randomUUID(), user.id, file.content],
      )
      await client.query(
        `INSERT INTO flowline.audit_events (order_id,actor_auth_user_id,action,details) VALUES ($1,$2,'MANAGER_DELIVERY_PROOF_ADDED',jsonb_build_object('fileName',$3::text))`,
        [orderId, user.id, file.fileName],
      )
      await client.query('COMMIT')
      return this.detail(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async confirmDelivery(user: AuthUser, orderId: string, input: { actualDeliveryAt: string; receivedBy: string }) {
    ensureManager(user)
    if (!input.actualDeliveryAt || !input.receivedBy.trim())
      throw new ManagerError(422, 'DELIVERY_INCOMPLETE', 'Record actual delivery time and recipient.', ['actualDeliveryAt', 'receivedBy'])
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const order = await this.detail(user, orderId, client)
      if (!order.proofAttachments.length)
        throw new ManagerError(422, 'DELIVERY_PROOF_REQUIRED', 'Upload proof of delivery before confirming delivery.', ['proof'])
      const shipment = await client.query<{ shipment_id: string; createdByAuthUserId: string; order_number: string }>(
        `${select} AND orders.id=$2 FOR UPDATE`,
        [user.id, orderId],
      )
      const row = shipment.rows[0]
      if (!row) throw new ManagerError(404, 'ORDER_NOT_FOUND', 'Manager delivery order not found.')
      await client.query(`UPDATE flowline.shipments SET status='DELIVERED', actual_delivery_at=$2, received_by=$3 WHERE id=$1`, [
        row.shipment_id,
        input.actualDeliveryAt,
        input.receivedBy.trim(),
      ])
      await client.query(
        `UPDATE flowline.delivery_issues SET resolved_at=COALESCE(resolved_at,clock_timestamp()) WHERE shipment_id=$1 AND resolved_at IS NULL`,
        [row.shipment_id],
      )
      await client.query(`UPDATE flowline.orders SET status='Delivered', stage='Delivered', version=version+1 WHERE id=$1`, [orderId])
      await client.query(
        `INSERT INTO flowline.audit_events (order_id,actor_auth_user_id,action,previous_status,new_status,reason) VALUES ($1,$2,'MANAGER_DELIVERED',$3,'Delivered',$4)`,
        [orderId, user.id, 'Manager Review', `Received by ${input.receivedBy.trim()}`],
      )
      const notification = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO flowline.notifications (order_id,type,title,message) VALUES ($1,'MANAGER_DELIVERED',$2,$3) RETURNING id,created_at`,
        [orderId, `Order ${row.order_number} delivered`, `Manager confirmed receipt by ${input.receivedBy.trim()}.`],
      )
      await client.query(`INSERT INTO flowline.notification_recipients (notification_id,recipient_auth_user_id) VALUES ($1,$2)`, [
        notification.rows[0]?.id,
        row.createdByAuthUserId,
      ])
      await client.query('COMMIT')
      if (notification.rows[0]) {
        const item: NotificationItem = {
          id: notification.rows[0].id,
          orderId,
          orderNumber: row.order_number,
          type: 'MANAGER_DELIVERED',
          title: `Order ${row.order_number} delivered`,
          message: `Manager confirmed receipt by ${input.receivedBy.trim()}.`,
          createdAt: notification.rows[0].created_at,
          readAt: null,
        }
        this.notificationPublisher?.publish(row.createdByAuthUserId, item)
      }
      return this.detail(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
