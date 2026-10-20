import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

type AuthLayoutProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <section className="auth-context" aria-labelledby="flowline-brand">
        <div className="brand-lockup">
          <img className="brand-logo" src="/flowline-mark.svg" alt="" />
          <span>
            <strong id="flowline-brand">Flowline</strong>
            <small>Manufacturing orders</small>
          </span>
        </div>

        <div className="context-statement">
          <span className="context-index">01 / ACCESS</span>
          <h2>Production starts with a clear handoff.</h2>
          <p>Secure entry for every team in the order lifecycle.</p>
        </div>

        <div className="security-note">
          <ShieldCheck size={19} aria-hidden="true" />
          <span>Protected workspace access</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="mobile-brand" aria-label="Flowline manufacturing orders">
          <img className="brand-logo" src="/flowline-mark.svg" alt="" />
          <strong>Flowline</strong>
        </div>

        <div className="auth-form-wrap">
          <header className="auth-heading">
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>

          {children}

          <footer className="auth-footer">{footer}</footer>
        </div>
      </section>
    </main>
  )
}