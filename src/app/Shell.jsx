import { useEffect, useMemo, useState } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { Lockup, useRoute } from '../components/ui.jsx'
import { TabIcon } from '../components/Icons.jsx'
import { useStore, setState, getState } from '../lib/store.js'
import { yourColour, archetype } from '../lib/taste.js'
import { ids as byTitles } from '../lib/films.js'
import Home from './Home.jsx'
import Hunt from './Hunt.jsx'
import Library from './Library.jsx'
import You from './You.jsx'
import Film from './Film.jsx'
import './app.css'

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'hunt', label: 'Hunt' },
  { id: 'library', label: 'Library' },
  { id: 'you', label: 'You' },
]

export default function Shell() {
  const { route, go } = useRoute()
  const s = useStore()
  // Visiting the app without a read: seed a sample so nothing is ever empty, and say so.
  useEffect(() => {
    if (!getState().positive.length) {
      const seed = byTitles('Heat', 'In the Mood for Love', 'Blade Runner 2049')
      setState({ positive: seed, negative: byTitles('Avengers: Endgame').filter(Boolean), axes: ['both'], hour: 22, sample: true, colour: yourColour(seed) })
    }
  }, [])
  const filmId = route.startsWith('film-') ? Number(route.slice(5)) : null
  const tab = filmId ? s.lastTab || 'home' : route
  useEffect(() => { if (!filmId && route !== s.lastTab) setState({ lastTab: route }) }, [route])
  const colour = s.colour || '#3A6E85'
  const arch = useMemo(() => (s.positive.length ? archetype(s) : null), [s.positive.join(','), s.axes.join(','), s.hour])

  return (
    <div className="app" style={{ '--you': colour }}>
      <aside className="rail">
        <Lockup size={20} onClick={() => go('', { wipe: true })} />
        <nav className="rail-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`rail-item ${tab === t.id && !filmId ? 'on' : ''}`} onClick={() => go(t.id)}>
              <TabIcon name={t.id} on={tab === t.id && !filmId} size={20} />
              <span>{t.label}</span>
              {tab === t.id && !filmId && <motion.i layoutId="rail-lit" className="rail-lit" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            </button>
          ))}
        </nav>
        <div className="rail-you" onClick={() => go('you')} role="button" tabIndex={0}>
          <span className="rail-swatch" style={{ background: colour }}>{(s.name || 'Y').slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{s.name || 'You'}</b>
            <span className="spec">{arch ? arch.name : '—'}</span>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Lockup size={18} onClick={() => go('', { wipe: true })} />
        <button className="top-you" onClick={() => go('you')} style={{ background: colour }} aria-label="You">{(s.name || 'Y').slice(0, 1).toUpperCase()}</button>
      </header>

      <main className="app-main">
        {s.sample && !s.onboarded && (
          <div className="sample">
            <span className="spec">Sample read</span>
            <button className="link-spec lit-link" onClick={() => go('start', { wipe: true })}>Make it yours <Arrow /></button>
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={filmId ? `film-${filmId}` : tab}
            initial={{ opacity: 0, y: filmId ? 40 : 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
          >
            {filmId ? <Film id={filmId} /> : tab === 'hunt' ? <Hunt /> : tab === 'library' ? <Library /> : tab === 'you' ? <You arch={arch} /> : <Home arch={arch} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <TabIcon name={t.id} on={tab === t.id} size={24} />
            <span>{t.label}</span>
            {tab === t.id && <motion.i layoutId="tab-lit" className="tab-lit" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
          </button>
        ))}
      </nav>
    </div>
  )
}
