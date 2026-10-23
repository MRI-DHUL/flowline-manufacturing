import type { DashboardData } from './dashboard-service'

export function RoleOverview({ data, onViewOrders, onRefresh, onLogout }: { data: DashboardData; onViewOrders: () => void; onRefresh: () => void; onLogout: () => void }) {
  const copy: Record<DashboardData['role'], { eyebrow: string; title: string; detail: string }> = {
    CSR: {
      eyebrow: 'Request pipeline',
      title: 'Keep every customer promise moving.',
      detail: 'Draft, submit, and follow the handoffs that need your attention.',
    },
    'R&D': {
      eyebrow: 'Technical cockpit',
      title: 'Decide what can be built.',
      detail: 'Review feasibility, constraints, and the next technical handoff.',
    },
    PLANNING: {
      eyebrow: 'Capacity board',
      title: 'Turn approval into a schedule.',
      detail: 'Balance material readiness, production lines, and Press ownership.',
    },
    PRESS: {
      eyebrow: 'Production pulse',
      title: 'Make the next run count.',
      detail: 'Track scheduled work, production progress, and exceptions.',
    },
    SHIPPING: {
      eyebrow: 'Dispatch board',
      title: 'Move finished work to the client.',
      detail: 'Verify readiness, dispatch goods, and surface delivery risks.',
    },
    MANAGER: {
      eyebrow: 'Delivery control',
      title: 'Own the final handoff.',
      detail: 'Review escalated deliveries and close the customer-facing loop.',
    },
    SYSTEM_ADMIN: {
      eyebrow: 'Access console',
      title: 'Keep the workspace ready.',
      detail: 'Activate people and maintain the role structure behind every queue.',
    },
  }
  const role = copy[data.role]
  const spotlight = data.orders.slice(0, 3)
  return (
    <section className={`role-overview role-overview-${data.role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} aria-label={`${role.title} overview`}>
      <header className="role-overview-hero">
        <div>
          <p>{role.eyebrow}</p>
          <h2>{role.title}</h2>
          <span>{role.detail}</span>
        </div>
        <button type="button" onClick={onViewOrders}>
          Open workspace <span aria-hidden="true">↗</span>
        </button>
      </header>
      <div className="role-overview-grid">
        <article className="role-overview-primary">
          <small>Current workload</small>
          <strong>{data.metrics.active}</strong>
          <span>{data.role === 'MANAGER' ? 'delivery handoffs in your control' : 'active orders in your queue'}</span>
          <div className="role-progress">
            <i style={{ width: `${Math.min(100, data.metrics.total ? (data.metrics.completed / data.metrics.total) * 100 : 0)}%` }} />
          </div>
          <small>
            {data.metrics.completed} completed · {data.metrics.attention} need attention
          </small>
        </article>
        <article className="role-overview-list">
          <header>
            <div>
              <small>Priority view</small>
              <h3>{data.role === 'SYSTEM_ADMIN' ? 'Workspace accounts' : 'Orders to watch'}</h3>
            </div>
            <button type="button" onClick={onRefresh} aria-label="Refresh overview">
              ↻
            </button>
          </header>
          {spotlight.length ? (
            <ul>
              {spotlight.map((order) => (
                <li key={order.id}>
                  <span className="role-order-dot" data-tone={order.status === 'On Hold' || order.status === 'Rework Required' ? 'danger' : 'normal'} />
                  <div>
                    <strong>{order.product}</strong>
                    <small>
                      {order.orderNumber} · {order.status}
                    </small>
                  </div>
                  <b>{order.ageDays}d</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="role-overview-empty">No active handoffs are waiting here.</p>
          )}
        </article>
        <article className="role-overview-signal">
          <small>Signal</small>
          <strong>{data.metrics.attention ? 'Attention needed' : 'Flow is clear'}</strong>
          <p>{data.metrics.attention ? `${data.metrics.attention} order${data.metrics.attention === 1 ? '' : 's'} need intervention.` : 'No active exceptions are currently assigned to this workspace.'}</p>
          <button type="button" onClick={onLogout}>
            Sign out safely
          </button>
        </article>
      </div>

    </section>
  )
}
