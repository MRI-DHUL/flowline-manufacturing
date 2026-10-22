import { Bell, CheckCheck, CircleAlert, ClipboardList, Clock3, LayoutDashboard, LogOut, Plus, RefreshCw, Search } from 'lucide-react'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/toast/useToast'
import { LoadingScreen } from '../../components/loading/LoadingScreen'
import { RdWorkspace } from '../rd/RdWorkspace'
import { PlanningWorkspace } from '../planning/PlanningWorkspace'
import { PressWorkspace } from '../press/PressWorkspace'
import { ShippingWorkspace } from '../shipping/ShippingWorkspace'
import { ManagerWorkspace } from '../manager/ManagerWorkspace'
import { AdminWorkspace } from '../admin/AdminWorkspace'
import { Button, SegmentedTabs, Select, TextInput } from '../../components/ui'
import { CsrOrdersWorkspace } from '../csr/CsrOrdersWorkspace'
import { CsrOrderStatusPage } from '../csr/CsrOrderStatusPage'
import { NotificationsPage } from './NotificationsPage'
import { listOrderActivity } from './activity-service'
import type { OrderActivity } from './activity-service'
import { roleWorkspaces } from './dashboard-config'
import { DashboardRequestError, getDashboard, logout } from './dashboard-service'
import type { DashboardData, DashboardOrder } from './dashboard-service'
import { listNotifications, markNotificationRead, openNotificationStream } from './notification-service'
import { ReportIssueButton } from '../issues/ReportIssueButton'
import { HoldControls } from '../holds/HoldControls'
import type { DashboardNotification } from './notification-service'
import './workflow-dashboard.css'

const stages = ['R&D', 'Planning', 'Press', 'Shipping', 'Delivered']
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`))
}

const notificationDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function formatNotificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : notificationDateFormatter.format(date)
}

function statusTone(status: string) {
  if (status === 'Delivered') return 'success'
  if (status === 'On Hold' || status === 'Rework Required') return 'danger'
  if (status === 'Scheduled' || status === 'In Production') return 'warning'
  return 'neutral'
}

function nextAction(status: string) {
  return (
    {
      Draft: 'Complete required information and submit for review',
      Submitted: 'Begin technical feasibility review',
      'R&D Review': 'Complete feasibility review',
      'Planning Review': 'Confirm materials and production capacity',
      Scheduled: 'Accept and start the scheduled job',
      'In Production': 'Record completed and waste quantities',
      'Ready to Ship': 'Confirm dispatch readiness',
      Dispatched: 'Confirm customer delivery',
      Delivered: 'No action required',
      'On Hold': 'Resolve the active hold',
      'Rework Required': 'Complete required rework',
      'Manager Review': 'Complete delivery manager review',
    }[status] ?? 'Review current stage requirements'
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function StageStepper({ order }: { order: DashboardOrder }) {
  const activeIndex = Math.max(0, stages.indexOf(order.stage))

  return (
    <div className="workflow-stage-track" aria-label="Order progress">
      {stages.map((stage, index) => (
        <div
          className={index < activeIndex ? 'complete' : index === activeIndex ? 'current' : ''}
          key={stage}
          aria-current={index === activeIndex ? 'step' : undefined}
        >
          <span aria-hidden="true" />
          <small>{stage}</small>
        </div>
      ))}
    </div>
  )
}

function OrderDetail({
  order,
  canReportIssue,
  canManageExceptions,
}: {
  order: DashboardOrder
  canReportIssue: boolean
  canManageExceptions: boolean
}) {
  const [tab, setTab] = useState<'overview' | 'activity'>('overview')
  const [activity, setActivity] = useState<OrderActivity[]>([])
  const [activityError, setActivityError] = useState('')

  useEffect(() => {
    if (tab !== 'activity') return
    void listOrderActivity(order.id)
      .then(setActivity)
      .catch((error) => setActivityError(error instanceof Error ? error.message : 'Order activity could not be loaded.'))
  }, [order.id, tab])

  return (
    <article className="workflow-detail">
      <SegmentedTabs
        className="workflow-tabs"
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'activity', label: 'Activity' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
      />

      {tab === 'overview' ? (
        <div className="workflow-detail-content" role="tabpanel">
          <header className="workflow-order-heading">
            <div>
              <h2>{order.product}</h2>
              <p>
                {order.orderNumber} · {order.customer}
              </p>
            </div>
            <div className="workflow-order-heading-actions">
              {canReportIssue ? <ReportIssueButton orderId={order.id} orderNumber={order.orderNumber} /> : null}
              {canManageExceptions ? (
                <HoldControls
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  status={order.status}
                  stage={order.stage}
                  defaultTeam={order.stage === 'R&D' ? 'R&D' : order.stage.toUpperCase()}
                />
              ) : null}
            </div>
          </header>

          <StageStepper order={order} />

          <section className="workflow-next-action" aria-label="Next required action">
            <div>
              <strong>Next required action</strong>
              <p>{nextAction(order.status)}</p>
            </div>
            <button type="button" disabled>
              Open order
            </button>
          </section>

          <dl className="workflow-summary">
            <div>
              <dt>Requested delivery</dt>
              <dd>{formatDate(order.requestedDate)}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{order.priority ?? 'Normal'}</dd>
            </div>
            <div>
              <dt>Order age</dt>
              <dd>
                {order.ageDays} days{order.slaRisk ? <small className="workflow-sla-risk">SLA risk</small> : null}
              </dd>
            </div>
            <div>
              <dt>Current stage</dt>
              <dd>{order.stage}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="workflow-activity" role="tabpanel">
          <div className="workflow-timeline-heading">
            <Clock3 size={24} aria-hidden="true" />
            <div>
              <small>Order activity</small>
              <h2>Lifecycle snapshot</h2>
            </div>
          </div>
          {activityError ? (
            <p role="alert">{activityError}</p>
          ) : (
            <ol className="workflow-timeline">
              {activity.map((item, index) => (
                <li className={index === 0 ? 'complete' : ''} key={item.id}>
                  <span />
                  <div>
                    <strong>{item.newStatus ?? item.action.replaceAll('_', ' ')}</strong>
                    <small>
                      {item.actorName} ·{' '}
                      {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.occurredAt))}
                    </small>
                    <p>
                      {item.reason ??
                        (item.previousStatus && item.newStatus ? `${item.previousStatus} → ${item.newStatus}` : 'Workflow event recorded.')}
                    </p>
                    {Object.keys(item.details ?? {}).length ? (
                      <small className="workflow-event-details">
                        {Object.entries(item.details)
                          .map(([key, value]) => `${key}: ${String(value)}`)
                          .join(' · ')}
                      </small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  )
}

function RoleOverview({
  data,
  onViewOrders,
  onRefresh,
  onLogout,
}: {
  data: DashboardData
  onViewOrders: () => void
  onRefresh: () => void
  onLogout: () => void
}) {
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
    <section
      className={`role-overview role-overview-${data.role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      aria-label={`${role.title} overview`}
    >
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
                  <span
                    className="role-order-dot"
                    data-tone={order.status === 'On Hold' || order.status === 'Rework Required' ? 'danger' : 'normal'}
                  />
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
          <p>
            {data.metrics.attention
              ? `${data.metrics.attention} order${data.metrics.attention === 1 ? '' : 's'} need intervention.`
              : 'No active exceptions are currently assigned to this workspace.'}
          </p>
          <button type="button" onClick={onLogout}>
            Sign out safely
          </button>
        </article>
      </div>
    </section>
  )
}

export function WorkflowDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [pendingAccess, setPendingAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const [status, setStatus] = useState('All')
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const knownNotificationIds = useRef(new Set<string>())
  const notificationsLoaded = useRef(false)

  async function loadDashboard() {
    setLoading(true)
    setError('')
    setPendingAccess(false)
    try {
      const dashboard = await getDashboard()
      setData(dashboard)
      setSelectedId((current) => current ?? dashboard.orders[0]?.id ?? null)
      showToast({ title: 'Dashboard refreshed', tone: 'success' })
    } catch (requestError) {
      if (requestError instanceof DashboardRequestError) {
        if (requestError.status === 401) {
          navigate('/login', { replace: true })
          return
        }
        if (requestError.code === 'ACCESS_PENDING') {
          setPendingAccess(true)
          setError(requestError.message)
          showToast({ title: 'Workspace access pending', message: requestError.message, tone: 'info' })
          return
        }
      }
      const message = requestError instanceof Error ? requestError.message : 'Unable to load the dashboard.'
      setError(message)
      showToast({ title: 'Dashboard unavailable', message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Flowline | Dashboard'
    document.documentElement.classList.add('workflow-scrollbar-hidden')
    return () => {
      document.title = previousTitle
      document.documentElement.classList.remove('workflow-scrollbar-hidden')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((dashboard) => {
        if (cancelled) return
        setData(dashboard)
        setSelectedId(dashboard.orders[0]?.id ?? null)
      })
      .catch((requestError: unknown) => {
        if (cancelled) return
        if (requestError instanceof DashboardRequestError) {
          if (requestError.status === 401) {
            navigate('/login', { replace: true })
            return
          }
          if (requestError.code === 'ACCESS_PENDING') {
            setPendingAccess(true)
            setError(requestError.message)
            return
          }
        }
        setError(requestError instanceof Error ? requestError.message : 'Unable to load the dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    let cancelled = false
    let reconnectTimer: number | undefined
    let closeSocket: (() => void) | undefined

    function receiveNotification(notification: DashboardNotification) {
      if (cancelled) return
      if (!notification.readAt && !knownNotificationIds.current.has(notification.id)) {
        showToast({ title: notification.title, message: notification.message, tone: 'info' })
      }
      knownNotificationIds.current.add(notification.id)
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)])
    }

    function connect() {
      if (cancelled) return
      closeSocket = openNotificationStream(receiveNotification, () => {
        if (!cancelled) reconnectTimer = window.setTimeout(connect, 3_000)
      })
    }

    async function loadInitialNotifications() {
      try {
        const next = await listNotifications()
        if (cancelled) return
        knownNotificationIds.current = new Set(next.map((item) => item.id))
        notificationsLoaded.current = true
        setNotifications(next)
      } catch (requestError) {
        if (!cancelled && !notificationsLoaded.current) {
          showToast({
            title: 'Notifications unavailable',
            message: requestError instanceof Error ? requestError.message : undefined,
            tone: 'error',
          })
        }
      }
    }

    void loadInitialNotifications()
    connect()
    return () => {
      cancelled = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      closeSocket?.()
    }
  }, [showToast])

  async function handleLogout() {
    try {
      await logout()
      showToast({ title: 'Signed out', message: 'Your session has been closed.', tone: 'success' })
      navigate('/login', { replace: true })
    } catch (logoutError) {
      const message = logoutError instanceof Error ? logoutError.message : 'Unable to sign out.'
      showToast({ title: 'Sign out failed', message, tone: 'error' })
    }
  }

  async function openNotification(notification: DashboardNotification) {
    if (!data) return
    setNotificationsOpen(false)
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)),
        )
      } catch (requestError) {
        showToast({
          title: 'Notification could not be marked read',
          message: requestError instanceof Error ? requestError.message : undefined,
          tone: 'error',
        })
      }
    }
    if (notification.orderId) {
      if (data.role === 'CSR') navigate(`/dashboard/orders/${notification.orderId}`)
      else {
        setSelectedId(notification.orderId)
        navigate('/dashboard/orders')
      }
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (pendingAccess || !data) {
    return (
      <main className="workflow-state">
        <CircleAlert size={30} />
        <h1>{pendingAccess ? 'Workspace access pending' : 'Dashboard unavailable'}</h1>
        <p>{error}</p>
        <Button type="button" onClick={pendingAccess ? handleLogout : loadDashboard}>
          {pendingAccess ? <LogOut size={18} /> : <RefreshCw size={18} />}
          {pendingAccess ? 'Sign out' : 'Try again'}
        </Button>
      </main>
    )
  }

  const workspace = roleWorkspaces[data.role]
  const activeView = location.pathname.startsWith('/dashboard/orders')
    ? 'orders'
    : location.pathname.startsWith('/dashboard/notifications')
      ? 'notifications'
      : data.role === 'CSR' && location.pathname.startsWith('/dashboard/order-status')
        ? 'order-status'
        : 'overview'
  const routeParts = location.pathname.split('/').filter(Boolean)
  const csrOrderId = routeParts[2] && routeParts[2] !== 'new' ? routeParts[2] : null
  const csrMode = routeParts[2] === 'new' ? 'new' : routeParts[3] === 'edit' ? 'edit' : 'list'
  const statuses = ['All', ...new Set(data.orders.map((order) => order.status))]
  const visibleOrders = data.orders.filter((order) => {
    const matchesStatus = status === 'All' || order.status === status
    const haystack = `${order.orderNumber} ${order.customer} ${order.product}`.toLowerCase()
    return matchesStatus && (!deferredSearch || haystack.includes(deferredSearch))
  })
  const selectedOrder = data.orders.find((order) => order.id === selectedId) ?? null
  const unreadNotifications = notifications.filter((notification) => !notification.readAt)

  function handlePrimaryAction() {
    if (!data) return
    if (data.role === 'CSR') {
      navigate('/dashboard/orders/new')
    } else if (data.role === 'R&D') {
      navigate('/dashboard/orders')
    } else if (data.orders[0]) {
      setSelectedId(data.orders[0].id)
    }
  }

  return (
    <div className="workflow-dashboard-page">
      <header className="workflow-header">
        <div className="workflow-brand">
          <img src="/flowline-mark.svg" alt="" />
          <span>
            <strong>Flowline</strong>
            <small>Manufacturing orders</small>
          </span>
        </div>
        <div className="workflow-header-actions">
          <div className="workflow-notification-wrap">
            <button
              className="workflow-notification"
              type="button"
              aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ''}`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={19} />
              {unreadNotifications.length ? (
                <span className="workflow-notification-count">{unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}</span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <section className="workflow-notification-panel" aria-label="Notifications">
                <header>
                  <div>
                    <strong>Notifications</strong>
                    <small>{unreadNotifications.length ? `${unreadNotifications.length} unread` : 'All caught up'}</small>
                  </div>
                  <CheckCheck size={18} aria-hidden="true" />
                </header>
                {notifications.length ? (
                  <ul>
                    {notifications.slice(0, 5).map((notification) => (
                      <li key={notification.id} data-unread={!notification.readAt}>
                        <button type="button" onClick={() => void openNotification(notification)}>
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>
                            {formatNotificationDate(notification.createdAt)}
                            {notification.orderNumber ? ` · ${notification.orderNumber}` : ''}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="workflow-notification-empty">No notifications yet.</p>
                )}
                {notifications.length > 5 ? (
                  <Button
                    className="workflow-notification-more"
                    variant="quiet"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false)
                      navigate('/dashboard/notifications')
                    }}
                  >
                    More notifications
                  </Button>
                ) : null}
              </section>
            ) : null}
          </div>
          <div className="workflow-user">
            <span>{initials(data.user.displayName)}</span>
            <div>
              <strong>{data.user.displayName}</strong>
              <small>{workspace.label}</small>
            </div>
          </div>
          <button className="workflow-logout" type="button" onClick={handleLogout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="workflow-body">
        <aside className="workflow-sidebar">
          <nav aria-label="Dashboard navigation">
            <NavLink to="/dashboard" end aria-label="Overview">
              <LayoutDashboard size={19} aria-hidden="true" />
              <span>Overview</span>
            </NavLink>
            <NavLink to="/dashboard/orders" aria-label="Orders">
              <ClipboardList size={19} aria-hidden="true" />
              <span>{data.role === 'SYSTEM_ADMIN' ? 'Users' : 'Orders'}</span>
            </NavLink>
            {data.role === 'CSR' ? (
              <NavLink to="/dashboard/order-status" aria-label="Order Status">
                <Clock3 size={19} aria-hidden="true" />
                <span>Order Status</span>
              </NavLink>
            ) : null}
          </nav>
          <div className="workflow-sidebar-role">
            <small>Workspace</small>
            <strong>{workspace.label}</strong>
          </div>
        </aside>

        <main className="workflow-main">
          <section className="workflow-page-heading">
            <div>
              <p>{workspace.eyebrow}</p>
              <h1>
                {activeView === 'overview'
                  ? workspace.heading
                  : activeView === 'notifications'
                    ? 'Notifications'
                    : activeView === 'order-status'
                      ? 'Order Status'
                      : data.role === 'SYSTEM_ADMIN'
                        ? 'Users'
                        : csrMode === 'new'
                          ? 'Create new order'
                          : csrMode === 'edit'
                            ? 'Edit order'
                            : 'Orders'}
              </h1>
              <span>
                {activeView === 'overview'
                  ? workspace.description
                  : activeView === 'notifications'
                    ? 'Review, read, and manage all workspace notifications.'
                    : activeView === 'order-status'
                      ? 'Track order handoffs, status durations, and ownership history.'
                      : data.role === 'SYSTEM_ADMIN'
                        ? 'Activate accounts and maintain workflow role assignments.'
                        : 'Search, filter, and review orders assigned to your workspace.'}
              </span>
            </div>
            {activeView === 'orders' && csrMode === 'list' && data.role === 'CSR' ? (
              <button type="button" onClick={handlePrimaryAction}>
                <Plus size={18} />
                {workspace.primaryAction}
              </button>
            ) : null}
          </section>

          {activeView === 'notifications' ? (
            <NotificationsPage />
          ) : activeView === 'order-status' ? (
            <CsrOrderStatusPage />
          ) : activeView === 'overview' ? (
            <RoleOverview
              data={data}
              onViewOrders={() => navigate('/dashboard/orders')}
              onRefresh={() => void loadDashboard()}
              onLogout={() => void handleLogout()}
            />
          ) : data.role === 'CSR' ? (
            <CsrOrdersWorkspace
              key={`${csrMode}-${csrOrderId ?? 'none'}`}
              mode={csrMode}
              orderId={csrOrderId}
              onBackToOrders={() => navigate('/dashboard/orders')}
            />
          ) : data.role === 'R&D' ? (
            <RdWorkspace />
          ) : data.role === 'PLANNING' ? (
            <PlanningWorkspace />
          ) : data.role === 'PRESS' ? (
            <PressWorkspace />
          ) : data.role === 'SHIPPING' ? (
            <ShippingWorkspace />
          ) : data.role === 'MANAGER' ? (
            <ManagerWorkspace />
          ) : data.role === 'SYSTEM_ADMIN' ? (
            <AdminWorkspace />
          ) : (
            <section className="workflow-workbench workflow-orders-view" aria-label="Order workspace">
              <aside className="workflow-queue">
                <div className="workflow-queue-title">
                  <div>
                    <p>{workspace.eyebrow}</p>
                    <h2>Orders</h2>
                  </div>
                  <strong>{visibleOrders.length}</strong>
                </div>
                <div className="workflow-filters">
                  <label>
                    <span>Search orders</span>
                    <div>
                      <Search size={16} />
                      <TextInput
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Order, customer, product"
                      />
                    </div>
                  </label>
                  <label>
                    <span>Status</span>
                    <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                      {statuses.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </Select>
                  </label>
                </div>
                <div className="workflow-order-list">
                  {visibleOrders.length ? (
                    visibleOrders.map((order) => (
                      <button key={order.id} type="button" aria-current={selectedId === order.id} onClick={() => setSelectedId(order.id)}>
                        <div>
                          <span className="workflow-status" data-tone={statusTone(order.status)}>
                            {order.status}
                          </span>
                          <small>{order.slaRisk ? 'SLA risk' : `${order.priority ?? 'Normal'} priority`}</small>
                        </div>
                        <strong>{order.product}</strong>
                        <p>
                          {order.orderNumber} · {order.customer}
                        </p>
                        <footer>
                          <span>{order.owner} owner</span>
                          <span>{order.ageDays} days</span>
                        </footer>
                      </button>
                    ))
                  ) : (
                    <div className="workflow-queue-empty">
                      <ClipboardList size={22} />
                      <strong>No matching orders</strong>
                      <p>Orders will appear when they require action.</p>
                    </div>
                  )}
                </div>
              </aside>

              {selectedOrder ? (
                <OrderDetail
                  key={selectedOrder.id}
                  order={selectedOrder}
                  canReportIssue={selectedOrder.status === 'Manager Review'}
                  canManageExceptions={selectedOrder.status === 'Manager Review'}
                />
              ) : (
                <article className="workflow-detail">
                  <div className="workflow-tabs" role="tablist" aria-label="Order views">
                    <button type="button" role="tab" aria-selected="true" disabled>
                      Overview
                    </button>
                    <button type="button" role="tab" aria-selected="false" disabled>
                      Activity
                    </button>
                  </div>
                  <div className="workflow-detail-empty">
                    <ClipboardList size={28} />
                    <h2>No order selected</h2>
                    <p>Select an order from the queue to review its details.</p>
                  </div>
                </article>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
