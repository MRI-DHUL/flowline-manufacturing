import { PauseCircle, PlayCircle, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/toast/useToast'
import { Button, FormField, Select, TextArea, TextInput } from '../../components/ui'
import { listHoldOwners, listOrderHolds, placeOrderHold, resolveOrderHold } from './hold-service'
import type { HoldOwner, HoldRecord } from './hold-service'
import './holds.css'

const teams = ['CSR', 'R&D', 'PLANNING', 'PRESS', 'SHIPPING', 'MANAGER']
const stages = ['R&D', 'Planning', 'Press', 'Shipping']

type HoldControlsProps = { orderId: string; orderNumber: string; status: string; stage: string; defaultTeam: string }

export function HoldControls({ orderId, orderNumber, status, stage, defaultTeam }: HoldControlsProps) {
  const { showToast } = useToast()
  const [holds, setHolds] = useState<HoldRecord[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [owners, setOwners] = useState<HoldOwner[]>([])
  const [resolutionOwners, setResolutionOwners] = useState<HoldOwner[]>([])
  const [values, setValues] = useState({ category: '', reason: '', responsibleTeam: defaultTeam, ownerAuthUserId: '', correctiveAction: '', targetResolutionDate: '' })
  const [resolution, setResolution] = useState({ action: 'RESUME' as 'RESUME' | 'REVIEW' | 'CANCEL', text: '', stage, ownerAuthUserId: '' })
  const activeHold = holds.find((hold) => hold.status === 'OPEN')

  useEffect(() => {
    if (status === 'On Hold') void listOrderHolds(orderId).then(setHolds).catch(() => undefined)
  }, [orderId, status])

  useEffect(() => {
    if (!open) return
    void listHoldOwners(values.responsibleTeam).then((users) => {
      setOwners(users)
      setValues((current) => ({ ...current, ownerAuthUserId: users[0]?.authUserId ?? '' }))
    }).catch(() => setOwners([]))
  }, [open, values.responsibleTeam])

  useEffect(() => {
    if (!activeHold || resolution.action !== 'REVIEW') return
    const team = resolution.stage === 'R&D' ? 'R&D' : resolution.stage.toUpperCase()
    void listHoldOwners(team).then((users) => { setResolutionOwners(users); setResolution((current) => ({ ...current, ownerAuthUserId: users[0]?.authUserId ?? '' })) }).catch(() => setResolutionOwners([]))
  }, [activeHold, resolution.action, resolution.stage])

  async function place() {
    setBusy(true)
    try {
      await placeOrderHold(orderId, values)
      setOpen(false)
      showToast({ title: 'Order placed on hold', message: `${orderNumber} is routed to the selected owner and active Managers.`, tone: 'success' })
      window.location.reload()
    } catch (error) {
      showToast({ title: 'Hold could not be placed', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally { setBusy(false) }
  }

  async function resolve(hold: HoldRecord) {
    setBusy(true)
    try {
      await resolveOrderHold(hold.id, { action: resolution.action, resolution: resolution.text, stage: resolution.action === 'REVIEW' ? resolution.stage : undefined, ownerAuthUserId: resolution.action === 'REVIEW' ? resolution.ownerAuthUserId : undefined })
      showToast({ title: resolution.action === 'CANCEL' ? 'Order cancelled' : 'Hold resolved', tone: 'success' })
      window.location.reload()
    } catch (error) {
      showToast({ title: 'Hold resolution failed', message: error instanceof Error ? error.message : undefined, tone: 'error' })
    } finally { setBusy(false) }
  }

  if (activeHold) {
    return (
      <section className="hold-control-panel">
        <header><PauseCircle size={18} /><div><strong>Active hold</strong><small>{activeHold.category} · target {activeHold.targetResolutionDate}</small></div></header>
        <p>{activeHold.reason}</p>
        <div className="hold-form-grid">
          <FormField label="Resolution" required className="wide"><TextArea value={resolution.text} onChange={(event) => setResolution((current) => ({ ...current, text: event.target.value }))} placeholder="Record the corrective action and evidence." /></FormField>
          <FormField label="Outcome" required><Select value={resolution.action} onChange={(event) => setResolution((current) => ({ ...current, action: event.target.value as typeof current.action }))}><option value="RESUME">Resume previous stage</option><option value="REVIEW">Send for re-review</option><option value="CANCEL">Cancel order</option></Select></FormField>
          {resolution.action === 'REVIEW' ? <FormField label="Review stage" required><Select value={resolution.stage} onChange={(event) => setResolution((current) => ({ ...current, stage: event.target.value }))}>{stages.map((item) => <option key={item}>{item}</option>)}</Select></FormField> : null}
          {resolution.action === 'REVIEW' ? <FormField label="Review owner" required><Select value={resolution.ownerAuthUserId} onChange={(event) => setResolution((current) => ({ ...current, ownerAuthUserId: event.target.value }))}><option value="">Select active owner</option>{resolutionOwners.map((owner) => <option key={owner.authUserId} value={owner.authUserId}>{owner.displayName} ({owner.email})</option>)}</Select></FormField> : null}
        </div>
        <footer><Button variant={resolution.action === 'CANCEL' ? 'danger' : 'primary'} type="button" disabled={busy || resolution.text.trim().length < 10 || (resolution.action === 'REVIEW' && !resolution.ownerAuthUserId)} onClick={() => void resolve(activeHold)}>{resolution.action === 'CANCEL' ? <X size={16} /> : resolution.action === 'REVIEW' ? <Send size={16} /> : <PlayCircle size={16} />}{busy ? 'Saving...' : 'Record hold outcome'}</Button></footer>
      </section>
    )
  }

  if (['Delivered', 'Cancelled', 'On Hold'].includes(status)) return null
  return (
    <>
      <Button variant="danger" size="sm" type="button" onClick={() => setOpen(true)}><PauseCircle size={16} />Place on hold</Button>
      {open ? (
        <div className="hold-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section className="hold-dialog" role="dialog" aria-modal="true" aria-label="Place order on hold">
            <header><div><PauseCircle size={20} /><span><strong>Place order on hold</strong><small>{orderNumber}</small></span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close hold dialog"><X size={18} /></button></header>
            <div className="hold-body">
              <div className="hold-form-grid">
                <FormField label="Category" required><TextInput value={values.category} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))} /></FormField>
                <FormField label="Target resolution date" required><TextInput type="date" value={values.targetResolutionDate} onChange={(event) => setValues((current) => ({ ...current, targetResolutionDate: event.target.value }))} /></FormField>
                <FormField label="Responsible team" required><Select value={values.responsibleTeam} onChange={(event) => setValues((current) => ({ ...current, responsibleTeam: event.target.value, ownerAuthUserId: '' }))}>{teams.map((team) => <option key={team}>{team}</option>)}</Select></FormField>
                <FormField label="Responsible owner" required><Select value={values.ownerAuthUserId} onChange={(event) => setValues((current) => ({ ...current, ownerAuthUserId: event.target.value }))}><option value="">Select active owner</option>{owners.map((owner) => <option key={owner.authUserId} value={owner.authUserId}>{owner.displayName} ({owner.email})</option>)}</Select></FormField>
                <FormField label="Reason" required className="wide"><TextArea value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain the blocker and its impact." /></FormField>
                <FormField label="Corrective action" className="wide"><TextArea value={values.correctiveAction} onChange={(event) => setValues((current) => ({ ...current, correctiveAction: event.target.value }))} /></FormField>
              </div>
            </div>
            <footer><Button variant="quiet" type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant="danger" type="button" disabled={busy || !values.ownerAuthUserId || values.reason.trim().length < 10 || !values.category.trim() || !values.targetResolutionDate} onClick={() => void place()}><PauseCircle size={16} />{busy ? 'Placing...' : 'Place order on hold'}</Button></footer>
          </section>
        </div>
      ) : null}
    </>
  )
}
