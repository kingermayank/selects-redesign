import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { backdrop, logo, colour, fmtRuntime } from '../lib/films.js'
import { Img, Mark } from './ui.jsx'
import { tick } from '../lib/store.js'
import { play } from '../lib/sound.js'
import { emit } from './Motes.jsx'
import './ticket.css'

/* A ticket. Drag the stub past the perforation and it tears: that is how you keep a film for tonight. */
export default function Ticket({ f, why, slot, index = 0, torn: tornProp = false, onTear, onOpen, seat, time = '9:40 PM', size = 'l' }) {
  const [torn, setTorn] = useState(tornProp)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rot = useTransform([x, y], ([a, b]) => a * 0.06 + b * 0.12)
  const tension = useTransform(x, [0, 90], [0, 1])
  const perfGlow = useTransform(tension, (t) => `rgba(255,59,20,${t * 0.9})`)
  const stubRef = useRef(null)
  const c = colour(f)
  const s = seat || `ROW ${'FGHJK'[index % 5]} · ${String(7 + index * 3).padStart(2, '0')}`

  const tear = () => {
    if (torn) return
    tick(14); play('tear')
    // the perforation lets go in a spray of the film's own colour
    const el = stubRef.current
    if (el) { const r = el.getBoundingClientRect(); emit({ from: { x: r.left - 4, y: r.top, w: 8, h: r.height }, to: { x: r.left + 40, y: r.top + r.height + 60, w: 160, h: 60 }, n: 40, colour: c, spread: 0.1, dur: [0.5, 0.9], size: 1.2, arc: 0.5 }) }
    setTorn(true)
    animate(x, x.get() + 140, { duration: 0.9, ease: [0.3, 0, 0.7, 1] })
    animate(y, 420, { duration: 0.9, ease: [0.55, 0, 1, 0.45] })
    onTear && onTear(f)
  }

  return (
    <div className={`ticket size-${size} ${torn ? 'is-torn' : ''}`} style={{ '--film': c }}>
      <div className="ticket-main" onClick={() => onOpen && onOpen(f)} data-cursor={onOpen ? 'OPEN' : undefined} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={(e) => e.key === 'Enter' && onOpen && onOpen(f)}>
        <Img src={backdrop(f.id)} alt="" className="ticket-bg" />
        <div className="ticket-shade" />
        <div className="ticket-top">
          <span className={`spec ${slot === 'reach' ? 'lit' : ''}`}>{slot === 'reach' ? 'The reach' : `Ticket ${String(index + 1).padStart(2, '0')}`}</span>
          <span className="spec">{f.y} · {fmtRuntime(f.rt)}</span>
        </div>
        <div className="ticket-title">
          {f.logo ? <Img src={logo(f.id)} alt={f.t} className="ticket-logo" /> : <h3 className="title">{f.t}</h3>}
          {why && <p className="ticket-why">{why}</p>}
        </div>
        <AnimatePresence>
          {torn && (
            <motion.div className="ticket-stamp" initial={{ scale: 1.6, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
              <span>KEPT</span>
              <small>TONIGHT · {time}</small>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div className="ticket-perf" style={{ background: perfGlow }} />
      <motion.div
        ref={stubRef}
        className="ticket-stub"
        drag={!torn}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={{ left: 0.05, right: 0.55, top: 0.1, bottom: 0.25 }}
        style={{ x, y, rotate: rot, transformOrigin: '0% 0%' }}
        onDrag={(_, i) => { if (i.offset.x > 86 || i.offset.y > 110) tear() }}
        onDragEnd={(_, i) => { if (i.offset.x > 60 || i.velocity.x > 500) tear() }}
        data-cursor={torn ? undefined : 'TEAR'}
        whileTap={{ scale: 0.985 }}
      >
        <span className="spec">Admit one</span>
        <div className="stub-mark"><Mark size={24} ink="#0a0a0b" /></div>
        <span className="stub-seat numeral">{s}</span>
        <span className="spec">{time}</span>
        <button className="stub-tear sr-only" onClick={tear}>Keep {f.t} for tonight</button>
      </motion.div>
    </div>
  )
}
