import { useMemo, useState } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Poster, useRoute } from '../components/ui.jsx'
import { film, colour, poster, backdrop } from '../lib/films.js'
import { scoreAll } from '../lib/taste.js'
import { useStore } from '../lib/store.js'
import { Bars, EmptyReel } from './parts.jsx'

const EMPTY = [
  { title: 'No stubs torn yet.', sub: 'Tear one off tonight’s ticket and it lands here.', action: 'Open tonight’s ticket', to: 'home' },
  { title: 'Nothing waiting.', sub: 'Films you save for the right night collect here.', action: 'Hunt a film', to: 'hunt' },
  { title: 'Nothing logged.', sub: 'Rate a film with the five bars and it joins your strip.', action: 'Hunt a film', to: 'hunt' },
  { title: 'Nothing struck.', sub: 'Generous. Strike what never landed and the ticket learns.', action: 'Retake the read', to: 'start' },
]

export default function Library() {
  const s = useStore()
  const { go } = useRoute()
  const tabs = [
    ['Kept', 'films you picked or tore a stub for', [...new Set([...s.positive, ...(s.kept || [])])]],
    ['Watchlist', 'waiting for the right night', s.watchlist || []],
    ['Logged', 'watched and rated', (s.logged || []).map((l) => l.id)],
    ['Struck', 'everyone loved them; you did not', s.negative],
  ]
  const [tab, setTab] = useState(0)
  const list = tabs[tab][2].map(film).filter(Boolean)
  const wallet = useMemo(() => scoreAll(s).slice(0, 10).map((e) => e.f), [s.positive.join(','), s.negative.join(',')])
  const strip = [...new Set([...s.positive, ...(s.kept || []), ...(s.logged || []).map((l) => l.id), ...(s.watchlist || [])])].map(film).filter(Boolean)
  const [hov, setHov] = useState(-1)

  return (
    <div className="library">
      <header className="page-head">
        <h1 className="verdict page-h">Your shelf.</h1>
      </header>

      <section className="lib-strip" onPointerLeave={() => setHov(-1)}>
        <div className="row-head"><h3 className="row-title">The Strip</h3><span className="spec">{hov >= 0 && strip[hov] ? strip[hov].t : ''}</span></div>
        <div className="ls-row">
          {strip.map((f, i) => (
            <motion.button key={f.id} className="ls-bar" onPointerEnter={() => setHov(i)} onClick={() => go(`film-${f.id}`)} style={{ '--c': colour(f) }} animate={{ flexGrow: hov === i ? 6 : hov >= 0 && Math.abs(hov - i) === 1 ? 2.2 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} aria-label={f.t}>
              <img src={poster(f.id)} alt="" style={{ opacity: hov === i ? 1 : 0 }} />
            </motion.button>
          ))}
          {!strip.length && <span className="spec">Your strip starts with the first film you keep</span>}
        </div>
      </section>

      <section className="wallet">
        <div className="row-head"><h3 className="row-title">The Wallet</h3></div>
        <div className="wallet-fan">
          {wallet.map((f, i) => (
            <button key={f.id} className="wf-card" style={{ '--i': i, '--n': wallet.length, '--film': colour(f) }} onClick={() => go(`film-${f.id}`)} data-cursor="OPEN">
              <img src={poster(f.id)} alt={f.t} />
            </button>
          ))}
        </div>
      </section>

      <div className="seg" role="tablist">
        <LayoutGroup>
          {tabs.map(([t, , l], i) => (
            <button key={t} role="tab" aria-selected={tab === i} className={`seg-b ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>
              <span>{t}</span> <span className="numeral">{l.length}</span>
              {tab === i && <motion.i layoutId="seg" className="seg-lit" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            </button>
          ))}
        </LayoutGroup>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} className="lib-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {list.map((f) => {
            const log = (s.logged || []).find((l) => l.id === f.id)
            return (
              <button key={f.id} className="hr-item" onClick={() => go(`film-${f.id}`)}>
                <Poster id={f.id} alt={f.t} struck={tab === 3} cursor="OPEN">{tab === 3 && <span className="strike-bar on" />}</Poster>
                <span className="ri-t">{f.t}</span>
                {log ? <Bars value={log.r} size={11} /> : <span className="ri-n spec">{f.y} · {f.dir[0] || ''}</span>}
              </button>
            )
          })}
          {!list.length && <div className="lib-empty"><EmptyReel {...EMPTY[tab]} onAction={() => go(EMPTY[tab].to, { wipe: EMPTY[tab].to === 'start' })} /></div>}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
