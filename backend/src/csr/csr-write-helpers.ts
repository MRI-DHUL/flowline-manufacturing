import type pg from 'pg'
import type { AuthUser } from '../auth/auth-service.js'
import { CsrError } from './csr-service-types.js'
import type { OrderPatch } from './csr-service-types.js'

export type CsrOrderRow = {
  id: string; order_number: string; customer_name: string | null; product_name: string | null; packaging_type: string | null
  material: string | null; requested_quantity: string | null; requested_delivery_date: string | Date | null; status: string
  open_clarifications: string; owner_auth_user_id: string | null
}

export const fieldsByProperty: Record<keyof OrderPatch, string> = {
  customerName: 'customer_name', destination: 'destination', productName: 'product_name', productDescription: 'product_description',
  orderType: 'order_type', packagingType: 'packaging_type', dimensions: 'dimensions', material: 'material', printColors: 'print_colors',
  requestedQuantity: 'requested_quantity', requestedDeliveryDate: 'requested_delivery_date', technicalNotes: 'technical_notes', priority: 'priority',
}

export function ensureCsr(user: AuthUser) {
  if (!user.roles.includes('CSR')) throw new CsrError(403, 'FORBIDDEN', 'CSR access is required.')
}

export function cleanValue(value: OrderPatch[keyof OrderPatch]) {
  return typeof value === 'string' ? value.trim() || null : value
}

export async function applyPatch(client: pg.PoolClient, orderId: string, patch: OrderPatch) {
  const entries = Object.entries(patch) as Array<[keyof OrderPatch, OrderPatch[keyof OrderPatch]]>
  if (!entries.length) return
  const assignments: string[] = []
  const values: unknown[] = [orderId]
  for (const [property, value] of entries) {
    values.push(cleanValue(value))
    assignments.push(`${fieldsByProperty[property]} = $${values.length}`)
  }
  await client.query(`UPDATE flowline.orders SET ${assignments.join(', ')}, version = version + 1 WHERE id = $1`, values)
}