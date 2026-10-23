import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, ClipboardList, LogOut, RefreshCw } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import type { DashboardData } from './dashboard-service'

const chartColors = ['#176b87', '#1f8a70', '#173b63', '#a15c00', '#b33535', '#718096']
const tooltipStyle = {
  border: '1px solid #cbd6e1',
  borderRadius: 7,
  boxShadow: '0 10px 24px rgba(16, 37, 63, 0.12)',
  fontSize: 11,
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="analytics-empty">
      <BarChart3 size={24} aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}

function StageBarChart({ data }: { data: DashboardData['analytics']['stages'] }) {
  if (!data.length) return <EmptyChart message="Stage analytics will appear when orders are created." />

  return (
    <div className="analytics-chart-canvas" aria-label="Orders by stage bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#e5ebf0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#52647a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#dff2f5', opacity: 0.45 }} />
          <Bar dataKey="count" name="Orders" fill="#176b87" radius={[5, 5, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatusPieChart({ data }: { data: DashboardData['analytics']['statuses'] }) {
  if (!data.length) return <EmptyChart message="Status distribution will appear when orders are created." />

  return (
    <div className="analytics-pie-layout">
      <div className="analytics-chart-canvas" aria-label="Orders by status pie chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius="52%" outerRadius="78%" paddingAngle={2} stroke="none">
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="analytics-legend">
        {data.slice(0, 6).map((entry, index) => (
          <li key={entry.label}>
            <span style={{ background: chartColors[index % chartColors.length] }} />
            <small>{entry.label}</small>
            <strong>{entry.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OrderTrendChart({ data }: { data: DashboardData['analytics']['trend'] }) {
  const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
  const chartData = data.map((point) => ({
    ...point,
    label: formatter.format(new Date(`${point.date}T12:00:00`)),
  }))

  return (
    <div className="analytics-chart-canvas" aria-label="Seven day order trend line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#e5ebf0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#52647a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#718096', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="count" name="New orders" stroke="#1f8a70" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DashboardAnalytics({ data, onViewOrders, onRefresh, onLogout }: { data: DashboardData; onViewOrders: () => void; onRefresh: () => void; onLogout: () => void }) {
  return (
    <>
      <section className="analytics-grid" aria-label="Operational charts">
        <Card className="analytics-panel">
          <header>
            <p>Workflow distribution</p>
            <h2>Orders by stage</h2>
          </header>
          <StageBarChart data={data.analytics.stages} />
        </Card>
        <Card className="analytics-panel">
          <header>
            <p>Current mix</p>
            <h2>Orders by status</h2>
          </header>
          <StatusPieChart data={data.analytics.statuses} />
        </Card>
        <Card className="analytics-panel analytics-panel-wide">
          <header>
            <p>Sunday to Saturday</p>
            <h2>New order trend</h2>
          </header>
          <OrderTrendChart data={data.analytics.trend} />
        </Card>
      </section>

      <section className="delivery-summary" aria-label="Delivery completion summary">
        <header>
          <div>
            <p>Delivery control</p>
            <h2>Completion pulse</h2>
          </div>
          <small>{data.analytics.delivery.weekStart} to {data.analytics.delivery.weekEnd}</small>
        </header>
        <div className="delivery-summary-grid">
          <article><span>Delivered</span><strong>{data.analytics.delivery.delivered}</strong></article>
          <article><span>On hold</span><strong>{data.analytics.delivery.onHold}</strong></article>
          <article><span>Open issues</span><strong>{data.analytics.delivery.openIssues}</strong></article>
        </div>
      </section>

      <section className="quick-actions" aria-labelledby="quick-actions-title">
        <div>
          <p>Common tasks</p>
          <h2 id="quick-actions-title">Quick actions</h2>
        </div>
        <div>
          <Button type="button" onClick={onViewOrders}>
            <ClipboardList size={18} />
            View orders
          </Button>
          <Button type="button" onClick={onRefresh}>
            <RefreshCw size={18} />
            Refresh analytics
          </Button>
          <Button type="button" onClick={onLogout}>
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </section>
    </>
  )
}
