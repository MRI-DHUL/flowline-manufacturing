import { Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SegmentedTabs } from '../../components/ui'
import { HoldControls } from '../holds/HoldControls'
import { ReportIssueButton } from '../issues/ReportIssueButton'
import { listOrderActivity } from './activity-service'
import type { OrderActivity } from './activity-service'
import type { DashboardOrder } from './dashboard-service'

const stages = ['R&D', 'Planning', 'Press', 'Shipping', 'Delivered']
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`))
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

function StageStepper({ order }: { order: DashboardOrder }) {
  const activeIndex = Math.max(0, stages.indexOf(order.stage))

  return (
    <div className="workflow-stage-track" aria-label="Order progress">
      {stages.map((stage, index) => (
        <div className={index < activeIndex ? 'complete' : index === activeIndex ? 'current' : ''} key={stage} aria-current={index === activeIndex ? 'step' : undefined}>
          <span aria-hidden="true" />
          <small>{stage}</small>
        </div>
      ))}
    </div>
  )
}

export function OrderDetail({ order, canReportIssue, canManageExceptions }: { order: DashboardOrder; canReportIssue: boolean; canManageExceptions: boolean }) {
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
                <HoldControls orderId={order.id} orderNumber={order.orderNumber} status={order.status} stage={order.stage} defaultTeam={order.stage === 'R&D' ? 'R&D' : order.stage.toUpperCase()} />
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
                      {item.actorName} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.occurredAt))}
                    </small>
                    <p>{item.reason ?? (item.previousStatus && item.newStatus ? `${item.previousStatus} → ${item.newStatus}` : 'Workflow event recorded.')}</p>
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
