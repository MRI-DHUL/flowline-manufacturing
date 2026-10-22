/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../frontend/src/components/toast/ToastProvider'
import { useToast } from '../../frontend/src/components/toast/useToast'

function ToastHarness({ duration = 4200 }: { duration?: number }) {
  const { showToast } = useToast()
  return (
    <button
      type="button"
      onClick={() =>
        showToast({
          title: 'Action completed',
          message: 'The update was saved.',
          tone: 'success',
          duration,
        })
      }
    >
      Show toast
    </button>
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ToastProvider', () => {
  it('renders an accessible toast and supports manual dismissal', () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }))
    expect(screen.getByRole('status').textContent).toContain('Action completed')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('automatically dismisses after the configured duration', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <ToastHarness duration={1000} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }))
    expect(screen.getByRole('status')).not.toBeNull()

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('status')).toBeNull()
  })
})