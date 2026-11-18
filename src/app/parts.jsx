import { useRef } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion } from 'framer-motion'
import { Poster, useRoute } from '../components/ui.jsx'
import { colour } from '../lib/films.js'

/* A row of posters that scrolls sideways. Each can carry a one-line reason. */
export function Row({ title, kicker, items, wide = false, onAll }) {
  const { go } = useRoute()
  const ref = useRef(null)
  const nudge = (d) => ref.current && ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  if (!items.length) return null
  return (
    <section className="row">
      <div className="row-head">
        <div>
          {kicker && <span className="spec">{kicker}</span>}
          <h3 className="row-title">{title}</h3>
        </div>
        <div className="row-ctl">
          <button className="row-btn" onClick={() => nudge(-1)} aria-label="Scroll left"><Arrow dir="left" /></button>
          <button className="row-btn" onClick={() => nudge(1)} aria-label="Scroll right"><Arrow /></button>
        </div>
      </div>
      <div className="row-track no-scrollbar" ref={ref}>
        {items.map(({ f, note }, i) => (
          <motion.button
            key={f.id}
            className={`row-item ${wide ? 'wide' : ''}`}
            onClick={() => go(`film-${f.id}`)}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
            style={{ '--film': colour(f) }}
          >
            <Poster id={f.id} alt={f.t} cursor="OPEN" />
            <span className="ri-t">{f.t}</span>
            <span className="ri-n spec">{note || `${f.y} · ${f.dir[0] || ''}`}</span>
          </motion.button>
        ))}
      </div>
    </section>
  )
}

/* Five bars: a rating, or a match. Fills left to right. */
export function Bars({ value = 0, max = 5, size = 14, lit = true, onChange, from0 = false }) {
  return (
    <span className="bars" role={onChange ? 'radiogroup' : undefined}>
      {Array.from({ length: max }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <button
            key={i}
            className="bar"
            style={{ height: size, width: size * 0.36, cursor: onChange ? 'pointer' : 'default' }}
            onClick={onChange ? () => onChange(i + 1) : undefined}
            aria-label={onChange ? `${i + 1} of ${max}` : undefined}
            tabIndex={onChange ? 0 : -1}
          >
            <motion.i className={lit && i === Math.ceil(value) - 1 ? 'lit' : undefined} initial={from0 ? { scaleY: 0 } : false} animate={{ scaleY: fill }} transition={{ type: 'spring', stiffness: 500, damping: 30, delay: from0 ? 0.05 + i * 0.075 : i * 0.04 }} style={{ background: lit && i === Math.ceil(value) - 1 ? 'var(--select)' : 'var(--fg)' }} />
          </button>
        )
      })}
    </span>
  )
}

/* Empty: a short run of blank film. One frame waits with the lit bar in it,
   and the gate light sweeps across looking for something to expose. */
export function EmptyReel({ title, sub, action, onAction, kicker }) {
  return (
    <div className="empty-reel">
      <div className="er-strip" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`er-frame ${i === 2 ? 'lit' : ''}`}>{i === 2 && <i className="bar-atom" />}</span>)}
        <span className="er-sweep" />
      </div>
      {kicker && <span className="spec">{kicker}</span>}
      <b className="er-t">{title}</b>
      {sub && <p className="er-s">{sub}</p>}
      {action && <button className="btn ghost" onClick={onAction}>{action} <span className="arr"><Arrow /></span></button>}
    </div>
  )
}
