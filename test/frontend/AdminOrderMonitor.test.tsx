/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminOrderMonitor } from '../../frontend/src/features/admin/AdminOrderMonitor'
import { requestJson } from '../../frontend/src/shared/api/client'

vi.mock('../../frontend/src/shared/api/client', () => ({ requestJson: vi.fn() }))

const orders = [
  {
    id: 'delivered-order', orderNumber: 'FO-2026-001006', customerName: 'UI Acceptance Client', productName: 'UI Acceptance Pouch', status: 'Delivered', stage: 'Delivered', priority: 'Normal', owner: 'Devendra Rao', requestedDeliveryDate: '2026-11-15', createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-23T10:00:00.000Z', shipmentStatus: 'DELIVERED', carrier: 'Flowline Logistics', trackingOrVehicleNumber: 'TRK-UI-1006', expectedDeliveryAt: '2026-11-14T12:00:00.000Z', actualDeliveryAt: '2026-11-15T12:00:00.000Z', receivedBy: 'Client representative',
  },
  {
    id: 'planning-order', orderNumber: 'FO-2026-001007', customerName: 'GreenBite Foods', productName: 'Snack pouch', status: 'Planning Review', stage: 'Planning', priority: 'High', owner: 'Priya Kapoor', requestedDeliveryDate: '2026-11-20', createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-23T11:00:00.000Z', shipmentStatus: null, carrier: null, trackingOrVehicleNumber: null, expectedDeliveryAt: null, actualDeliveryAt: null, receivedBy: null,
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminOrderMonitor', () => {
  it('loads all records and displays delivery detail without mutation controls', async () => {
    vi.mocked(requestJson).mockResolvedValue({ orders })

    render(<AdminOrderMonitor />)

    expect(await screen.findByText('2 orders')).not.toBeNull()
    expect(screen.getAllByText('UI Acceptance Pouch').length).toBeGreaterThan(0)
    expect(screen.getByText('Flowline Logistics')).not.toBeNull()
    expect(screen.getByText('Read-only')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /edit|save|approve|assign/i })).toBeNull()
    expect(requestJson).toHaveBeenCalledWith('/api/v1/admin/orders')
  })

  it('filters by current status and product search text', async () => {
    vi.mocked(requestJson).mockResolvedValue({ orders })

    render(<AdminOrderMonitor />)
    await screen.findByText('2 orders')

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Planning Review' } })
    expect(screen.getAllByText('Snack pouch')).toHaveLength(2)
    expect(screen.queryByText('UI Acceptance Pouch')).toBeNull()

    fireEvent.change(screen.getByLabelText('Search orders'), { target: { value: 'unknown product' } })
    expect(screen.getByText('No orders match these filters.')).not.toBeNull()
  })
})