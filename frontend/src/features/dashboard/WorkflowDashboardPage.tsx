import { CircleAlert, ClipboardList, Clock3, FileSearch, LayoutDashboard, LogOut, Plus, RefreshCw, Search } from 'lucide-react'
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
import { AdminOrderMonitor } from '../admin/AdminOrderMonitor'
import { Button, Select, TextInput } from '../../components/ui'
import { CsrOrdersWorkspace } from '../csr/CsrOrdersWorkspace'
import { CsrOrderStatusPage } from '../csr/CsrOrderStatusPage'
import { NotificationsPage } from './NotificationsPage'
import { DashboardAnalytics } from './DashboardAnalytics'
import { DashboardNotificationPanel } from './DashboardNotificationPanel'
import { roleWorkspaces } from './dashboard-config'
import { DashboardRequestError, getDashboard, logout } from './dashboard-service'
import type { DashboardData } from './dashboard-service'
import { listNotifications, markNotificationRead, openNotificationStream } from './notification-service'
import type { DashboardNotification } from './notification-service'
import { OrderDetail } from './OrderDetail'
import { RoleOverview } from './RoleOverview'
import './workflow-dashboard.css'

function statusTone(status: string) {
  if (status === 'Delivered') return 'success'
  if (status === 'On Hold' || status === 'Rework Required') return 'danger'
  if (status === 'Scheduled' || status === 'In Production') return 'warning'
  return 'neutral'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
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
    document.title = '5Star | Dashboard'
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
        setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)))
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
      : data.role === 'SYSTEM_ADMIN' && location.pathname.startsWith('/dashboard/order-monitor')
        ? 'admin-orders'
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
          <img src="/5star-mark.svg" alt="" />
          <span>
            <strong>5Star</strong>
            <small>Manufacturing orders</small>
          </span>
        </div>
        <div className="workflow-header-actions">
          <DashboardNotificationPanel
            notifications={notifications}
            notificationsOpen={notificationsOpen}
            unreadCount={unreadNotifications.length}
            onToggle={() => setNotificationsOpen((open) => !open)}
            onOpen={(notification) => void openNotification(notification)}
            onMore={() => {
              setNotificationsOpen(false)
              navigate('/dashboard/notifications')
            }}
          />
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
            {data.role === 'SYSTEM_ADMIN' ? (
              <NavLink to="/dashboard/order-monitor" aria-label="Order monitor">
                <FileSearch size={19} aria-hidden="true" />
                <span>Order monitor</span>
              </NavLink>
            ) : null}
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
                      : activeView === 'admin-orders'
                        ? 'Order monitor'
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
                      : activeView === 'admin-orders'
                        ? 'Review all order details and delivery status. This view is read-only.'
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
          ) : activeView === 'admin-orders' && data.role === 'SYSTEM_ADMIN' ? (
            <AdminOrderMonitor />
          ) : activeView === 'overview' ? (
            <>
              <RoleOverview data={data} onViewOrders={() => navigate('/dashboard/orders')} onRefresh={() => void loadDashboard()} onLogout={() => void handleLogout()} />
              <DashboardAnalytics data={data} onViewOrders={() => navigate('/dashboard/orders')} onRefresh={() => void loadDashboard()} onLogout={() => void handleLogout()} />
            </>
          ) : data.role === 'CSR' ? (
            <CsrOrdersWorkspace key={`${csrMode}-${csrOrderId ?? 'none'}`} mode={csrMode} orderId={csrOrderId} onBackToOrders={() => navigate('/dashboard/orders')} />
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
                      <TextInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, product" />
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
                <OrderDetail key={selectedOrder.id} order={selectedOrder} canReportIssue={selectedOrder.status === 'Manager Review'} canManageExceptions={selectedOrder.status === 'Manager Review'} />
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
