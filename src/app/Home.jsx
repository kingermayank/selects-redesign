import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Ticket from '../components/Ticket.jsx'
import { Img, Rise, useRoute, Poster } from '../components/ui.jsx'
import { Row } from './parts.jsx'
import { film, backdrop, colour, fmtRuntime, films } from '../lib/films.js'
import { ticket, reason, reasonShort, scoreAll, thread, dayIndex } from '../lib/taste.js'
import { useStore, setState } from '../lib/store.js'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Home({ arch }) {
  const s = useStore()
  const { go } = useRoute()
  const now = new Date()
  const day = dayIndex()
  const t = useMemo(() => ticket(s, day), [s.positive.join(','), s.negative.join(','), s.axes.join(','), (s.dismissed || []).length])
  const [focus, setFocus] = useState(0)
  const lead = t[focus] ? t[focus].f : null
  const torn = s.torn && s.torn[day] ? s.torn[day] : []
  const all = useMemo(() => scoreAll(s), [s.positive.join(','), s.negative.join(',')])
  const th = useMemo(() => thread([...s.positive, ...all.slice(0, 20).map((e) => e.f.id)]), [all])
  const hour = s.hour ?? 22
  const hh = now.getHours() + now.getMinutes() / 60
  const until = ((hour - hh + 24) % 24)
  const greet = hh < 12 ? 'Morning' : hh < 18 ? 'Afternoon' : 'Evening'

  const onTear = (f) => setState((st) => ({ torn: { ...(st.torn || {}), [day]: [...new Set([...((st.torn || {})[day] || []), f.id])] }, kept: [...new Set([...(st.kept || []), f.id])] }))
  const swap = (f) => setState((st) => ({ dismissed: [...(st.dismissed || []), f.id] }))

  const pick0 = film(s.positive[0])
  const because = pick0 ? scoreAll({ positive: [pick0.id], negative: s.negative }).slice(0, 14).map((e) => ({ f: e.f, note: reasonShort(e) })) : []
  const hole = th ? films().filter((f) => [...f.dir, ...f.dp, ...f.mus, ...f.cast.slice(0, 3)].includes(th.who) && !s.positive.includes(f.id)).slice(0, 14).map((f) => ({ f, note: `${f.y} · ${th.role}` })) : []
  const wallet = all.slice(0, 10).map((e) => ({ f: e.f, note: reasonShort(e) }))

  return (
    <div className="home" style={{ '--film': lead ? colour(lead) : 'var(--you)' }}>
      <div className="home-ambient" aria-hidden="true">
        <AnimatePresence>
          {lead && <motion.div key={lead.id} className="home-amb-img" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}><Img src={backdrop(lead.id)} /></motion.div>}
        </AnimatePresence>
      </div>

      <header className="home-head">
        <span className="spec">{DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} · {torn.length ? `${torn.length} kept for tonight` : `lights down in ${until < 1 ? 'under an hour' : `${Math.floor(until)}h ${String(Math.round((until % 1) * 60)).padStart(2, '0')}m`}`}</span>
        <h1 className="verdict home-h"><Rise text={`${DAYS[now.getDay()]}’s\nticket.`} stagger={0.07} /></h1>
        <p className="home-sub">{greet}{s.name ? `, ${s.name.split(' ')[0]}` : ''}.</p>
      </header>

      <section className="home-tickets" onPointerLeave={() => {}}>
        {t.map((e, i) => (
          <motion.div key={e.f.id} className="ht-item" onPointerEnter={() => setFocus(i)} onFocus={() => setFocus(i)} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            <Ticket f={e.f} why={reason(e)} slot={e.slot} index={i} torn={torn.includes(e.f.id)} onTear={onTear} onOpen={(f) => go(`film-${f.id}`)} time={`${((hour + 11) % 12) + 1}:40 ${hour >= 12 ? 'PM' : 'AM'}`} />
            {!torn.includes(e.f.id) && <button className="ht-swap link-spec" onClick={() => swap(e.f)}>Swap</button>}
          </motion.div>
        ))}
      </section>


      <YearStrip s={s} />

      <Row title={pick0 ? `Because you kept ${pick0.t}` : 'Close to you'} items={because} />
      {th && hole.length > 2 && <Row title={`${th.who}, all night`} items={hole} />}
      <Row title="The Wallet" items={wallet} />
    </div>
  )
}

/* The year as a strip: every day a bar, every logged film its colour. */
function YearStrip({ s }) {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const today = Math.floor((now - start) / 86400000)
  const days = 365
  const logged = useMemo(() => {
    const m = {}
    const ids = [...(s.logged || []).map((l) => l.id), ...s.positive, ...(s.kept || [])]
    ids.forEach((id, i) => { const d = Math.max(0, today - 3 - i * 11 - ((id * 7) % 9)); if (!m[d]) m[d] = id })
    ;(s.logged || []).forEach((l) => { if (l.day != null) m[l.day] = l.id })
    return m
  }, [s.positive.join(','), (s.kept || []).length, (s.logged || []).length])
  const [hov, setHov] = useState(null)
  const count = Object.keys(logged).length
  return (
    <section className="year">
      <div className="row-head">
        <div>
          <h3 className="row-title">{count} {count === 1 ? 'film' : 'films'} this year{hov != null && logged[hov] ? <span className="year-hov"> · {film(logged[hov])?.t}</span> : null}</h3>
        </div>
      </div>
      <div className="year-row" onPointerLeave={() => setHov(null)}>
        {Array.from({ length: days }).map((_, d) => {
          const id = logged[d]
          const f = id ? film(id) : null
          return <i key={d} onPointerEnter={() => setHov(d)} className={`${d > today ? 'future' : ''} ${d === today ? 'today' : ''} ${f ? 'has' : ''}`} style={f ? { background: colour(f) } : undefined} />
        })}
      </div>
      <div className="year-months spec">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
    </section>
  )
}
