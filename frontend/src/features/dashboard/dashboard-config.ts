import type { DashboardRole } from './dashboard-service'

type RoleWorkspace = {
  label: string
  eyebrow: string
  heading: string
  description: string
  queueTitle: string
  primaryAction?: string
}

export const roleWorkspaces: Record<DashboardRole, RoleWorkspace> = {
  CSR: {
    label: 'Requestor / CSR',
    eyebrow: 'Customer service workspace',
    heading: 'Overview',
    description: 'Create requests, respond to clarifications, and track every handoff.',
    queueTitle: 'My requests',
    primaryAction: 'Create order',
  },
  'R&D': {
    label: 'R&D Expert',
    eyebrow: 'Technical workspace',
    heading: 'Technical review queue',
    description: 'Assess feasibility, document constraints, and record clear decisions.',
    queueTitle: 'Orders awaiting technical action',
    primaryAction: 'Review next order',
  },
  PLANNING: {
    label: 'Planning',
    eyebrow: 'Planning workspace',
    heading: 'Material and capacity planning',
    description: 'Confirm readiness, assign capacity, and release approved work.',
    queueTitle: 'Orders awaiting planning',
    primaryAction: 'Plan next order',
  },
  PRESS: {
    label: 'Press',
    eyebrow: 'Production workspace',
    heading: 'Production work queue',
    description: 'Run scheduled jobs and record production progress and exceptions.',
    queueTitle: 'Scheduled production jobs',
    primaryAction: 'Open next job',
  },
  SHIPPING: {
    label: 'Shipping',
    eyebrow: 'Shipping workspace',
    heading: 'Dispatch and delivery queue',
    description: 'Verify readiness, dispatch finished goods, and confirm delivery.',
    queueTitle: 'Orders awaiting shipping action',
    primaryAction: 'Open next shipment',
  },
  MANAGER: {
    label: 'Manager / Supervisor',
    eyebrow: 'Operations workspace',
    heading: 'Operations overview',
    description: 'Monitor workload, aging, exceptions, and delivery risk.',
    queueTitle: 'Orders requiring attention',
    primaryAction: 'Review exceptions',
  },
}