/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../frontend/src/components/toast/ToastProvider'
import { CsrOrderStatusPage } from '../../frontend/src/features/csr/CsrOrderStatusPage'
import { listCsrOrderStatuses } from '../../frontend/src/features/csr/csr-order-service'

vi.mock('../../frontend/src/features/csr/csr-order-service', () => ({
  listCsrOrderStatuses: vi.fn(),
}))

const sharedRow = {
  orderName: 'Printed pouch',
  orderPlacedAt: '2026-10-20T08:00:00.000Z',
  completedBy: 'CSR User',
  transitionDurationSeconds: 3600,
  statusDurationSeconds: 3600,
  comments: null,
  action: 'STATUS_CHANGED',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CsrOrderStatusPage', () => {
  it('filters orders by current status rather than historical statuses', async () => {
    vi.mocked(listCsrOrderStatuses).mockResolvedValue([
      {
        ...sharedRow,
        eventId: 'planning-current',
        orderId: 'planning-order',
        orderNumber: 'FO-PLANNING',
        currentStatus: 'Planning Review',
        status: 'Planning Review',
        completedAt: '2026-10-22T08:00:00.000Z',
        current: true,
      },
      {
        ...sharedRow,
        eventId: 'planning-old-rd',
        orderId: 'planning-order',
        orderNumber: 'FO-PLANNING',
        currentStatus: 'Planning Review',
        status: 'R&D Review',
        completedAt: '2026-10-21T08:00:00.000Z',
        current: false,
      },
      {
        ...sharedRow,
        eventId: 'rd-current',
        orderId: 'rd-order',
        orderNumber: 'FO-RD',
        currentStatus: 'R&D Review',
        status: 'R&D Review',
        completedAt: '2026-10-22T09:00:00.000Z',
        current: true,
      },
    ])

    render(
      <ToastProvider>
        <CsrOrderStatusPage />
      </ToastProvider>,
    )

    expect(await screen.findByText('FO-PLANNING')).not.toBeNull()
    expect(screen.getByText('FO-RD')).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'R&D Review' } })

    expect(screen.queryByText('FO-PLANNING')).toBeNull()
    expect(screen.getByText('FO-RD')).not.toBeNull()
  })
})