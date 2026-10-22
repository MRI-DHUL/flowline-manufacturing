import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/toast/useToast'
import { Button, Card } from '../../components/ui'
import {
  deleteNotification,
  listNotifications,
  markNotificationRead,
} from './notification-service'
import type { DashboardNotification } from './notification-service'
import './notifications-page.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : dateFormatter.format(date)
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listNotifications()
      .then((items) => { if (!cancelled) setNotifications(items) })
      .catch((error) => {
        if (!cancelled) showToast({ title: 'Notifications unavailable', message: error instanceof Error ? error.message : undefined, tone: 'error' })
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [showToast])

  async function markRead(notification: DashboardNotification) {
    if (notification.readAt) return
    try {
      await markNotificationRead(notification.id)
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
    } catch (error) {
      showToast({ title: 'Notification could not be marked read', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    }
  }

  async function remove(notification: DashboardNotification) {
    try {
      await deleteNotification(notification.id)
      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      showToast({ title: 'Notification deleted', tone: 'success' })
    } catch (error) {
      showToast({ title: 'Notification could not be deleted', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    }
  }

  function openOrder(notification: DashboardNotification) {
    void markRead(notification)
    if (notification.orderId) navigate(`/dashboard/orders/${notification.orderId}`)
  }

  return (
    <section className="notifications-page" aria-labelledby="notifications-page-title">
      <header className="notifications-page-header">
        <div><p>Workspace updates</p><h2 id="notifications-page-title">All notifications</h2><span>Review, read, and remove your notification history.</span></div>
        <Bell size={26} aria-hidden="true" />
      </header>
      {loading ? <div className="notifications-page-empty">Loading notifications...</div> : notifications.length ? (
        <div className="notifications-page-list">
          {notifications.map((notification) => (
            <Card key={notification.id} className="notification-history-item" data-unread={!notification.readAt}>
              <div className="notification-history-icon"><Bell size={18} /></div>
              <div className="notification-history-body"><strong>{notification.title}</strong><p>{notification.message}</p><small>{formatDate(notification.createdAt)}{notification.orderNumber ? ` · ${notification.orderNumber}` : ''}</small></div>
              <div className="notification-history-actions">
                {notification.orderId ? <Button variant="quiet" size="sm" type="button" onClick={() => openOrder(notification)}>Open order</Button> : null}
                {!notification.readAt ? <Button variant="quiet" size="sm" type="button" onClick={() => void markRead(notification)} aria-label={`Mark ${notification.title} as read`}><CheckCheck size={17} /></Button> : null}
                <Button variant="quiet" size="sm" type="button" onClick={() => void remove(notification)} aria-label={`Delete ${notification.title}`}><Trash2 size={17} /></Button>
              </div>
            </Card>
          ))}
        </div>
      ) : <div className="notifications-page-empty"><Bell size={26} /><strong>No notifications</strong><p>You are all caught up.</p></div>}
    </section>
  )
}
