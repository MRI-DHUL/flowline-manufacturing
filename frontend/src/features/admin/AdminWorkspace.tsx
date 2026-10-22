import { useEffect, useState } from 'react'
import { Button, Card, Select } from '../../components/ui'
import './admin-workspace.css'
type AdminUser = {
  authUserId: string
  displayName: string
  email: string
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
  roles: string[]
}
const roles = ['CSR', 'R&D', 'PLANNING', 'PRESS', 'SHIPPING', 'MANAGER', 'SYSTEM_ADMIN']
async function request<T>(path: string, init?: RequestInit) {
  const base = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '')
  const r = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const b = await r.json()
  if (!r.ok) throw new Error(b.error?.message ?? 'Request failed')
  return b as T
}
export function AdminWorkspace() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    void request<{ users: AdminUser[] }>('/api/v1/admin/users')
      .then((b) => setUsers(b.users))
      .catch((e) => setError(e.message))
  }, [])
  async function save(user: AdminUser, status: string, role: string) {
    const b = await request<{ user: AdminUser }>(`/api/v1/admin/users/${user.authUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, role }),
    })
    setUsers((items) => items.map((item) => (item.authUserId === user.authUserId ? b.user : item)))
  }
  return (
    <section className="admin-workspace" aria-label="System administrator workspace">
      <Card>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <div className="admin-table">
            {users.map((user) => (
              <div className="admin-row" key={user.authUserId}>
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                </div>
                <Select value={user.status} onChange={(e) => void save(user, e.target.value, user.roles[0] ?? 'CSR')}>
                  <option>PENDING</option>
                  <option>ACTIVE</option>
                  <option>DISABLED</option>
                </Select>
                <Select value={user.roles[0] ?? 'CSR'} onChange={(e) => void save(user, user.status, e.target.value)}>
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </Select>
                <Button size="sm" type="button" onClick={() => void save(user, 'ACTIVE', user.roles[0] ?? 'CSR')}>
                  Activate
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  )
}
