/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../frontend/src/components/toast/ToastProvider'
import { ReportIssueButton } from '../../frontend/src/features/issues/ReportIssueButton'
import { reportOrderIssue } from '../../frontend/src/features/issues/issue-service'

vi.mock('../../frontend/src/features/issues/issue-service', () => ({
  reportOrderIssue: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReportIssueButton', () => {
  it('validates and submits an issue through the escalation modal', async () => {
    vi.mocked(reportOrderIssue).mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      orderId: '11111111-1111-4111-8111-111111111111',
      orderNumber: 'FO-2026-001004',
      message: 'The approved material is unavailable.',
      status: 'OPEN',
      reportedAt: '2026-10-22T12:00:00.000Z',
      recipientCount: 3,
    })
    render(<ToastProvider><ReportIssueButton orderId="11111111-1111-4111-8111-111111111111" orderNumber="FO-2026-001004" /></ToastProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Report issue' }))
    expect(screen.getByRole('dialog')).not.toBeNull()

    fireEvent.change(screen.getByLabelText('What issue did you find?'), { target: { value: 'Short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send issue' }))
    expect(screen.getByRole('alert').textContent).toContain('at least 10 characters')
    expect(reportOrderIssue).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('What issue did you find?'), { target: { value: 'The approved material is unavailable.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send issue' }))

    expect(await screen.findByText('Issue reported')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(reportOrderIssue).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'The approved material is unavailable.',
    )
  })
})
