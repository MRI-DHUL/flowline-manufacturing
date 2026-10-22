import { describe, expect, it } from 'vitest'
import { roleWorkspaces } from '../../frontend/src/features/dashboard/dashboard-config'

describe('roleWorkspaces', () => {
  it('defines every BRD workspace role', () => {
    expect(Object.keys(roleWorkspaces).sort()).toEqual(
      ['CSR', 'MANAGER', 'PLANNING', 'PRESS', 'R&D', 'SHIPPING'].sort(),
    )
  })

  it('defines a role-appropriate primary command for every workspace', () => {
    expect(roleWorkspaces.CSR.primaryAction).toBe('Create order')
    expect(
      Object.values(roleWorkspaces).every(
        (workspace) => Boolean(workspace.primaryAction),
      ),
    ).toBe(true)
    expect(
      Object.entries(roleWorkspaces)
        .filter(([role]) => role !== 'CSR')
        .every(([, workspace]) => workspace.primaryAction !== 'Create order'),
    ).toBe(true)
  })
})