import './loading-screen.css'

export function LoadingScreen() {
  return (
    <main className="flowline-loading-screen" aria-busy="true" aria-label="Loading Flowline workspace">
      <div className="flowline-loading-brand">
        <div className="flowline-loading-mark"><img src="/flowline-mark.svg" alt="" /></div>
        <div><strong>Flowline</strong><span>Manufacturing orders</span></div>
      </div>
      <div className="flowline-loading-progress" aria-hidden="true"><span /></div>
      <p>Preparing your workspace</p>
    </main>
  )
}
