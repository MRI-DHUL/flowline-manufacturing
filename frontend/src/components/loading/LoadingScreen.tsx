import './loading-screen.css'

export function LoadingScreen() {
  return (
    <main className="flowline-loading-screen" aria-busy="true" aria-label="Loading 5Star workspace">
      <div className="flowline-loading-brand">
        <div className="flowline-loading-mark">
          <img src="/5star-mark.svg" alt="" />
        </div>
        <div>
          <strong>5Star</strong>
          <span>Manufacturing orders</span>
        </div>
      </div>
      <div className="flowline-loading-progress" aria-hidden="true">
        <span />
      </div>
      <p>Preparing your workspace</p>
    </main>
  )
}
