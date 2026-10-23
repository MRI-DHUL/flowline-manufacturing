import { describe, expect, it, vi } from 'vitest'
import { NotificationHub } from '../../backend/src/notifications/notification-service.js'
import type { NotificationItem } from '../../backend/src/notifications/notification-service.js'
import type { WebSocket } from 'ws'

const notification: NotificationItem = {
  id: '33333333-3333-4333-8333-333333333333',
  orderId: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'FO-2026-001001',
  type: 'ORDER_SUBMITTED',
  title: 'New order ready for R&D review',
  message: 'Order FO-2026-001001 has been submitted for technical review.',
  createdAt: new Date('2026-10-22T08:00:00.000Z'),
  readAt: null,
}

describe('NotificationHub', () => {
  it('publishes events only to subscribed users', () => {
    const hub = new NotificationHub()
    const firstSocket = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    const secondSocket = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    hub.subscribe('rd-user-1', firstSocket)
    hub.subscribe('rd-user-2', secondSocket)

    hub.publish('rd-user-1', notification)

    expect(firstSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'notification', notification }))
    expect(secondSocket.send).not.toHaveBeenCalled()
  })

  it('stops publishing after unsubscribe', () => {
    const hub = new NotificationHub()
    const socket = { readyState: 1, send: vi.fn() } as unknown as WebSocket
    const unsubscribe = hub.subscribe('rd-user-1', socket)

    unsubscribe()
    hub.publish('rd-user-1', notification)

    expect(socket.send).not.toHaveBeenCalled()
  })
})
