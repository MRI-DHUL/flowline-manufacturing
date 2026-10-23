import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../backend/src/auth/auth-service.js'
import { IssueError, PostgresIssueService } from '../../backend/src/issues/issue-service.js'

const pressUser: AuthUser = {
  id: 'press-user-1',
  email: 'press@example.com',
  displayName: 'Press Operator',
  status: 'ACTIVE',
  roles: ['PRESS'],
}

function createService() {
  const pool = { connect: vi.fn() } as unknown as pg.Pool
  return { pool, service: new PostgresIssueService(pool) }
}

describe('Issue escalation service', () => {
  it('rejects inactive reporters before database access', async () => {
    const { pool, service } = createService()

    await expect(service.report({ ...pressUser, status: 'DISABLED' }, 'order-1', 'Material is unavailable.')).rejects.toEqual(expect.objectContaining<Partial<IssueError>>({ code: 'FORBIDDEN', statusCode: 403 }))
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('rejects invalid messages before database access', async () => {
    const { pool, service } = createService()

    await expect(service.report(pressUser, 'order-1', 'Too short')).rejects.toEqual(expect.objectContaining<Partial<IssueError>>({ code: 'ISSUE_MESSAGE_INVALID', statusCode: 422 }))
    expect(pool.connect).not.toHaveBeenCalled()
  })
})
