import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '../../components/ui'
import type { DashboardNotification } from './notification-service'

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

type DashboardNotificationPanelProps = {
  notifications: DashboardNotification[]
  notificationsOpen: boolean
  unreadCount: number
  onToggle: () => void
  onOpen: (notification: DashboardNotification) => void
  onMore: () => void
}

export function DashboardNotificationPanel({ notifications, notificationsOpen, unreadCount, onToggle, onOpen, onMore }: DashboardNotificationPanelProps) {
  return (
    <div className="workflow-notification-wrap">
      <button
        className="workflow-notification"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={notificationsOpen}
        onClick={onToggle}
      >
        <Bell size={19} />
        {unreadCount ? <span className="workflow-notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      {notificationsOpen ? (
        <section className="workflow-notification-panel" aria-label="Notifications">
          <header>
            <div>
              <strong>Notifications</strong>
              <small>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</small>
            </div>
            <CheckCheck size={18} aria-hidden="true" />
          </header>
          {notifications.length ? (
            <ul>
              {notifications.slice(0, 5).map((notification) => (
                <li key={notification.id} data-unread={!notification.readAt}>
                  <button type="button" onClick={() => onOpen(notification)}>
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
            <Button className="workflow-notification-more" variant="quiet" size="sm" type="button" onClick={onMore}>
              More notifications
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}