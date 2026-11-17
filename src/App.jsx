import { useEffect, useState, lazy, Suspense } from 'react'
import { loadFilms } from './lib/films.js'
import { Router, useRoute, Cursor, Mark } from './components/ui.jsx'
import Landing from './landing/Landing.jsx'
const Onboarding = lazy(() => import('./onboarding/Onboarding.jsx'))
const Shell = lazy(() => import('./app/Shell.jsx'))

function Routes() {
  const { route } = useRoute()
  if (route === 'start') return <Onboarding />
  if (/^(home|hunt|library|you|film-\d+)$/.test(route)) return <Shell />
  return <Landing />
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => { loadFilms().then(() => setReady(true)) }, [])
  return (
    <Router>
      {ready ? (
        <Suspense fallback={<Boot />}>
          <Routes />
        </Suspense>
      ) : (
        <Boot />
      )}
      <Cursor />
      <div className="grain" aria-hidden="true" />
    </Router>
  )
}

function Boot() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--base)' }}>
      <Mark size={44} layout="tight" />
    </div>
  )
}
