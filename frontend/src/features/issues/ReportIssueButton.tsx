import { CircleAlert, Send, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../components/toast/useToast'
import { Button, TextArea } from '../../components/ui'
import { reportOrderIssue } from './issue-service'
import './report-issue.css'

export function ReportIssueButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const { showToast } = useToast()
  const titleId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    textareaRef.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  async function submit() {
    const trimmed = message.trim()
    if (trimmed.length < 10) {
      setError('Describe the issue in at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const issue = await reportOrderIssue(orderId, trimmed)
      setOpen(false)
      setMessage('')
      showToast({
        title: 'Issue reported',
        message: `Sent to ${issue.recipientCount} escalation recipient${issue.recipientCount === 1 ? '' : 's'}, including the order chain and CSR.`,
        tone: 'success',
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The issue could not be reported.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button className="report-issue-trigger" variant="danger" size="sm" type="button" onClick={() => { setError(''); setOpen(true) }}>
        <CircleAlert size={16} />Report issue
      </Button>
      {open ? createPortal(
        <div className="report-issue-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section className="report-issue-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header>
              <div><CircleAlert size={21} /><span><strong id={titleId}>Report an order issue</strong><small>{orderNumber}</small></span></div>
              <button type="button" aria-label="Close issue dialog" onClick={() => setOpen(false)}><X size={18} /></button>
            </header>
            <div className="report-issue-body">
              <label><span>What issue did you find?</span><TextArea ref={textareaRef} value={message} onChange={(event) => { setMessage(event.target.value); setError('') }} maxLength={2000} aria-invalid={Boolean(error)} placeholder="Describe the problem, impact, and what needs attention." /></label>
              <div className="report-issue-routing"><strong>Escalation route</strong><p>The message is sent to prior workflow owners, the CSR who created the order, and active Managers.</p></div>
              <div className="report-issue-meta"><span>{message.length}/2000</span>{error ? <p role="alert">{error}</p> : null}</div>
            </div>
            <footer><Button variant="quiet" type="button" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button><Button variant="danger" type="button" onClick={() => void submit()} disabled={submitting}><Send size={16} />{submitting ? 'Sending...' : 'Send issue'}</Button></footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
