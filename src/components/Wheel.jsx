import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { wheel } from '../lib/taste.js'
import { film, poster, backdrop } from '../lib/films.js'
import { Img } from './ui.jsx'
import { Arrow } from './Icons.jsx'
import { play } from '../lib/sound.js'
import './wheel.css'

/* ─────────────────────────────────────────────────────────────
   THE ASSEMBLY, as a wheel. You sit in the hub. The ring is cut
   into the crafts that hold your taste together; each sector grows
   a branch per person who keeps turning up, and each branch carries
   their films. Point at a sector and its light comes up; pick it and
   the wheel turns it to the top, close enough to read.
   ───────────────────────────────────────────────────────────── */

const C = 500, R = 150, GAP = 2.6
const VB = '76 76 848 848'
const EASE = 'cubic-bezier(.65,0,.35,1)'
const T = `transform .9s ${EASE}`
const rad = (d) => (d * Math.PI) / 180
const pt = (a, r) => [C + Math.sin(rad(a)) * r, C - Math.cos(rad(a)) * r]
const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}` }
const wedge = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${C} ${C}L${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z` }
const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/* How well Selects knows you, read as exposure. A craft is exposed by evidence:
   films you kept in it, and people who recur across them. More light, sharper print. */
export const STAGES = [
  [0.2, 'Unexposed', 'Barely a frame to go on. Keep, strike or rate a few films.'],
  [0.45, 'Latent image', 'The shape is on the film. Nothing shows yet.'],
  [0.7, 'Developing', 'Your taste is coming up in the tray.'],
  [0.9, 'Fixed', 'Sharp enough to programme your nights.'],
  [1.01, 'Printed', 'Selects knows this side of you cold.'],
]
export const stageOf = (k) => STAGES.find(([t]) => k < t) || STAGES[STAGES.length - 1]
function expose(sectors, kept, signals) {
  sectors.forEach((s) => {
    const ev = s.branches.reduce((n, b) => n + b.films.filter((f) => kept.has(f.id)).length + (b.films.length >= 2 ? 0.6 : 0), 0)
    s.known = clamp(1 - Math.exp(-ev / 3.4), 0.05, 0.97)
    // the next frame worth shooting: a film on a recurring branch you have not kept yet
    const b = [...s.branches].sort((x, y) => y.films.length - x.films.length).find((x) => x.films.some((f) => !kept.has(f.id)))
    s.next = b ? { b, id: b.films.find((f) => !kept.has(f.id)).id } : null
  })
  const w = sectors.reduce((n, x) => n + Math.max(x.weight, 3), 0) || 1
  const avg = sectors.reduce((n, x) => n + x.known * Math.max(x.weight, 3), 0) / w
  const vol = 1 - Math.exp(-((signals.kept || 0) + (signals.logged || 0) * 1.5 + (signals.struck || 0) * 0.7) / 14)
  return clamp(avg * 0.62 + vol * 0.38, 0.03, 0.99)
}

function build(sectors, you) {
  const total = sectors.reduce((n, s) => n + Math.max(s.weight, 3), 0)
  const first = (360 * Math.max(sectors[0]?.weight || 3, 3)) / total
  let a = -first / 2
  return sectors.map((s, si) => {
    const span = (360 * Math.max(s.weight, 3)) / total
    const a0 = a + GAP / 2, a1 = a + span - GAP / 2
    a += span
    const colour = s.colour || you
    const people = s.people.slice(0, Math.max(1, Math.floor((a1 - a0) / 20)))
    const branches = people.map((p, j) => {
      const th = a0 + ((a1 - a0) * (j + 0.5)) / people.length
      const rp = 250 + (j % 2) * 40
      const [x, y] = pt(th, rp)
      const d = clamp(((a1 - a0) / people.length) * 0.34, 5, 13)
      const films = p.films.map((id, k) => {
        const m = p.films.length
        const fa = th + (k - (m - 1) / 2) * d
        const fr = rp + 76 + (k % 2) * 34
        const [fx, fy] = pt(fa, fr)
        return { id, a: fa, r: fr, x: fx, y: fy, key: `${s.key}:${p.who}:${id}` }
      })
      return { ...p, a: th, r: rp, x, y, films, key: `${s.key}:${p.who}` }
    })
    return { ...s, si, a0, a1, mid: (a0 + a1) / 2, colour, branches }
  })
}

export default function Wheel({ ids, kept = [], you = '#3A6E85', label = 'YOU', onOpen, height = 640, className = '', signals, onKnown }) {
  const uid = useId().replace(/:/g, '')
  const svg = useRef(null)
  const wrap = useRef(null)
  const sectors = useMemo(() => build(wheel(ids), you), [ids.join(','), you])
  const keptSet = useMemo(() => new Set(kept), [kept.join(',')])
  const known = useMemo(() => expose(sectors, keptSet, signals || { kept: kept.length }), [sectors, keptSet, signals && JSON.stringify(signals)])
  // the meter needs a moment to read: arcs and ticks develop up from zero
  const [dev, setDev] = useState(0)
  useEffect(() => { const t = setTimeout(() => setDev(1), 250); return () => clearTimeout(t) }, [])
  useEffect(() => { onKnown && onKnown(known) }, [known])
  const [hov, setHov] = useState(-1) // sector under the pointer (overview)
  const [focus, setFocus] = useState(-1) // sector turned to the top
  const [sel, setSel] = useState(null) // selected node key in focus
  const [hint, setHint] = useState(null) // node under the pointer
  const rot = useRef(0)

  const F = focus >= 0 ? sectors[focus] : null
  // shortest way round, so the wheel never spins the long way
  if (F) { const want = -F.mid; let d = ((want - rot.current) % 360 + 540) % 360 - 180; rot.current += d } else rot.current = Math.round(rot.current / 360) * 360
  const groupT = F ? `translate(0px, 300px) scale(1.45) rotate(${rot.current}deg)` : `translate(0px, 0px) scale(1) rotate(${rot.current}deg)`
  const counter = `rotate(${-rot.current}deg)`

  const nodes = useMemo(() => (F ? [{ kind: 'craft', key: `${F.key}:craft` }, ...F.branches.flatMap((b) => [{ kind: 'person', b, key: b.key }, ...b.films.map((f) => ({ kind: 'film', b, f, key: f.key }))])] : []), [F])
  const selected = nodes.find((n) => n.key === sel) || nodes[0] || null

  const open = (i) => {
    if (i < 0 || i >= sectors.length) return
    setFocus(i); setHov(-1); setHint(null); play('whoosh')
    const s = sectors[i]
    setSel(`${s.key}:craft`)
  }
  const back = () => { setFocus(-1); setSel(null); play('secondary') }
  const step = (d) => open((focus + d + sectors.length) % sectors.length)

  // the angle under the pointer picks the sector
  const angleAt = (e) => {
    const m = svg.current.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const dx = p.x - C, dy = p.y - C
    if (Math.hypot(dx, dy) < R * 0.55) return null
    return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
  }
  const sectorAt = (a) => {
    if (a == null) return -1
    return sectors.findIndex((s) => { const lo = ((s.a0 % 360) + 360) % 360, span = s.a1 - s.a0 + GAP; const d = (((a - lo) % 360) + 360) % 360; return d <= span })
  }
  const onMove = (e) => {
    if (F) return
    const i = sectorAt(angleAt(e))
    if (i !== hov) { setHov(i); if (i >= 0) play('hover', { gap: 0.04 }) }
  }
  const onClickStage = (e) => {
    if (F) return
    const i = sectorAt(angleAt(e))
    if (i >= 0) open(i)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); F ? step(1) : open(Math.max(0, hov)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); F ? step(-1) : open(Math.max(0, hov)) }
    else if (F && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const i = nodes.findIndex((n) => n.key === (selected && selected.key))
      const n = nodes[(i + (e.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]
      if (n) { setSel(n.key); play('detent') }
    } else if (e.key === 'Enter' && F && selected && selected.kind === 'film' && onOpen) onOpen(film(selected.f.id))
    else if (e.key === 'Escape' && F) back()
  }

  const lit = F ? focus : hov
  const L = lit >= 0 ? sectors[lit] : null
  const reading = L ? L.known : known
  const centre = L ? L.name : label
  const centreSub = `${stageOf(reading)[1]}`

  return (
    <div ref={wrap} className={`wheel ${F ? 'is-focus' : ''} ${className}`} style={{ height }} tabIndex={0} onKeyDown={onKey} aria-label="The Assembly. Use the arrow keys to move between sectors.">
      <DotField focus={!!F} />
      <div className="wh-head">
        {F ? (
          <>
            <button className="wh-side l" onClick={() => step(-1)} aria-label={`Previous: ${sectors[(focus - 1 + sectors.length) % sectors.length].name}`}><Arrow dir="left" /> {sectors[(focus - 1 + sectors.length) % sectors.length].name}</button>
            <div className="wh-now">
              <span className="wh-dots">{sectors.map((s, i) => <i key={s.key} className={i === focus ? 'on' : ''} style={{ '--c': s.colour }} />)}</span>
              <b>{F.name}</b>
              <button className="link-spec wh-back" onClick={back}>All crafts</button>
            </div>
            <button className="wh-side r" onClick={() => step(1)} aria-label={`Next: ${sectors[(focus + 1) % sectors.length].name}`}>{sectors[(focus + 1) % sectors.length].name} <Arrow /></button>
          </>
        ) : null}
      </div>

      <svg ref={svg} className="wh-svg" viewBox={VB} preserveAspectRatio="xMidYMid meet" onPointerMove={onMove} onPointerLeave={() => !F && setHov(-1)} onClick={onClickStage} data-cursor={F ? undefined : hov >= 0 ? 'OPEN' : undefined}>
        <defs>
          {sectors.map((s, i) => (
            <radialGradient key={s.key} id={`${uid}g${i}`} cx={C} cy={C} r="470" gradientUnits="userSpaceOnUse">
              <stop offset="0.3" stopColor={s.colour} stopOpacity="0" />
              <stop offset="0.34" stopColor={s.colour} stopOpacity="0.5" />
              <stop offset="0.62" stopColor={s.colour} stopOpacity="0.16" />
              <stop offset="1" stopColor={s.colour} stopOpacity="0" />
            </radialGradient>
          ))}
          <clipPath id={`${uid}c`} clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" /></clipPath>
        </defs>
        <g className="wh-g" style={{ transform: groupT, transformOrigin: `${C}px ${C}px`, transition: T }}>
          {/* the light: a cone from the hub across the lit sector */}
          {sectors.map((s, i) => (
            <path key={s.key} d={wedge(s.a0 - GAP / 2, s.a1 + GAP / 2, 470)} fill={`url(#${uid}g${i})`} className={`wh-glow ${lit === i ? 'on' : ''}`} />
          ))}
          {/* the ring, cut into crafts */}
          {sectors.map((s, i) => (
            <g key={s.key} className={`wh-arc-g ${lit >= 0 && lit !== i ? 'dim' : ''} ${lit === i ? 'on' : ''}`}>
              <path d={arc(s.a0, s.a1, R)} stroke={s.colour} className="wh-arc track" />
              <path d={arc(s.a0, s.a1, R)} stroke={s.colour} className="wh-arc" pathLength="1" style={{ strokeDasharray: `${(s.known * dev).toFixed(3)} 1`, transitionDelay: `${0.15 + i * 0.12}s` }} />
            </g>
          ))}
          {/* branches */}
          {sectors.map((s, i) => {
            const dim = lit >= 0 && lit !== i
            return (
              <g key={s.key} className={`wh-sector ${dim ? 'dim' : ''}`}>
                {s.branches.map((b) => {
                  const [sx, sy] = pt(b.a, R + 14), [ex, ey] = pt(b.a, b.r - 22)
                  const strong = b.films.length >= 2
                  return (
                    <g key={b.key}>
                      <line x1={sx} y1={sy} x2={ex} y2={ey} className="wh-stem" stroke={strong ? s.colour : undefined} />
                      {b.films.map((f) => <line key={f.key} x1={b.x} y1={b.y} x2={f.x} y2={f.y} className={`wh-twig ${keptSet.has(f.id) ? 'kept' : ''}`} stroke={keptSet.has(f.id) ? s.colour : undefined} />)}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {/* nodes */}
          {sectors.map((s, i) => {
            const dim = lit >= 0 && lit !== i
            return s.branches.map((b) => (
              <g key={b.key} className={`wh-sector ${dim ? 'dim' : ''}`}>
                <Node x={b.x} y={b.y} r={21} counter={counter} colour={s.colour} person text={s.key === 'k' ? '#' : initials(b.who)} strong={b.films.length >= 2}
                  active={F && selected && selected.key === b.key} label={b.who}
                  onEnter={() => setHint(b.key)} onLeave={() => setHint(null)} hint={hint === b.key}
                  onPick={F && focus === i ? () => { setSel(b.key); play('detent') } : undefined} />
                {b.films.map((f) => (
                  <Node key={f.key} x={f.x} y={f.y} r={keptSet.has(f.id) ? 19 : 16} counter={counter} colour={s.colour} img={poster(f.id)} clip={`${uid}c`} kept={keptSet.has(f.id)}
                    active={F && selected && selected.key === f.key} label={film(f.id)?.t || ''}
                    onEnter={() => setHint(f.key)} onLeave={() => setHint(null)} hint={hint === f.key}
                    onPick={F && focus === i ? () => { setSel(f.key); play('detent') } : undefined}
                    onDouble={F && onOpen ? () => onOpen(film(f.id)) : undefined} />
                ))}
              </g>
            ))
          })}
          {/* the hub */}
          <g style={{ transform: counter, transformOrigin: `${C}px ${C}px`, transition: T }}>
            {Array.from({ length: 60 }).map((_, t) => {
              const a = t * 6, [x0, y0] = pt(a, R - 34), [x1, y1] = pt(a, R - (t % 5 ? 28 : 24))
              const on = t / 60 < reading * dev
              return <line key={t} x1={x0} y1={y0} x2={x1} y2={y1} className={`wh-tick ${on ? 'on' : ''}`} style={{ stroke: on && L ? L.colour : undefined, transitionDelay: `${(t / 60) * 0.9}s` }} />
            })}
            <text x={C} y={C - 30} className="wh-hub-sub" textAnchor="middle">{(centre.length > 18 ? centre.slice(0, 17) + '…' : centre).toUpperCase()}</text>
            <text x={C} y={C + 12} className="wh-hub" textAnchor="middle">{Math.round(reading * 100 * dev)}%</text>
            <text x={C} y={C + 34} className="wh-hub-sub" textAnchor="middle" style={{ fill: L ? L.colour : 'var(--fg-2)' }}>{centreSub.toUpperCase()}</text>
          </g>
        </g>
      </svg>

      {!F && <p className="spec wh-hint">{hov >= 0 ? `Open ${sectors[hov].name}` : 'Point at a craft'}</p>}

      <AnimatePresence mode="wait">
        {F && selected && (
          <motion.div key={selected.key} className="wh-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            {selected.kind === 'craft' ? <CraftCard s={F} onOpen={onOpen} onPick={(k) => setSel(k)} /> : selected.kind === 'film' ? <FilmCard f={film(selected.f.id)} via={selected.b} sector={F} kept={keptSet.has(selected.f.id)} onOpen={onOpen} /> : <PersonCard b={selected.b} sector={F} onPick={(k) => setSel(k)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Node({ x, y, r, counter, colour, img, clip, kept, person, text, strong, active, hint, label, onEnter, onLeave, onPick, onDouble }) {
  const on = active || hint
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className={`wh-node ${person ? 'person' : 'film'} ${kept ? 'kept' : ''} ${active ? 'active' : ''} ${onPick ? 'pickable' : ''}`}
      onPointerEnter={onEnter} onPointerLeave={onLeave}
      onClick={onPick ? (e) => { e.stopPropagation(); onPick() } : undefined}
      onDoubleClick={onDouble ? (e) => { e.stopPropagation(); onDouble() } : undefined}>
      <g style={{ transform: counter, transition: T }}>
        {active && <circle r={r + 9} className="wh-halo" stroke={colour} />}
        <circle r={r + 3} className="wh-ring" stroke={person ? (strong ? colour : undefined) : kept ? colour : undefined} />
        {person ? (
          <>
            <circle r={r} className="wh-disc" style={strong ? { fill: colour } : undefined} />
            <text className="wh-init" textAnchor="middle" dy="0.36em" style={strong ? { fill: '#0a0a0b' } : undefined}>{text}</text>
          </>
        ) : (
          <>
            <image href={img} x={-r} y={-r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMin slice" clipPath={`url(#${clip})`} className="wh-img" />
            {!kept && <circle r={r} className="wh-veil" />}
          </>
        )}
        {on && label && <text className="wh-label" y={r + 18} textAnchor="middle">{label.toUpperCase().slice(0, 26)}</text>}
      </g>
    </g>
  )
}

function CraftCard({ s, onOpen, onPick }) {
  const [, name, line] = stageOf(s.known)
  const nf = s.next ? film(s.next.id) : null
  return (
    <div className="wh-card craft">
      <div className="wh-meter" style={{ '--c': s.colour }}>
        <b className="numeral">{Math.round(s.known * 100)}%</b>
        <span className="wh-bars">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={s.known > i / 5 + 0.04 ? 'on' : ''} />)}</span>
      </div>
      <div className="wh-body">
        <span className="spec" style={{ color: s.colour }}>{s.name} · {name}</span>
        <b className="wh-title">{line}</b>
        {nf ? (
          <>
            <p className="wh-why">To develop it further: {nf.t}, with {s.next.b.who}. Keep it or rate it.</p>
            <div className="wh-acts">
              {onOpen && <button className="btn" onClick={() => onOpen(nf)}>Open {nf.t.length > 22 ? 'the film' : nf.t} <span className="arr"><Arrow /></span></button>}
              <button className="link-spec" onClick={() => onPick(`${s.key}:${s.next.b.who}:${nf.id}`)}>Show on the wheel</button>
            </div>
          </>
        ) : <p className="wh-why">Every film on these branches is already in your reel.</p>}
      </div>
    </div>
  )
}

function FilmCard({ f, via, sector, kept, onOpen }) {
  if (!f) return null
  return (
    <div className="wh-card">
      <div className="wh-still"><Img src={backdrop(f.id)} alt="" /></div>
      <div className="wh-body">
        <span className="spec" style={{ color: sector.colour }}>{sector.name} · {via.who}</span>
        <b className="wh-title">{f.t}</b>
        <span className="spec">{f.y} · {f.dir[0] || ''}{kept ? ' · In your reel' : ''}</span>
        <p className="wh-why">{via.films.length > 1 ? `${via.who} ties this to ${via.films.length - 1} more of your films.` : `${via.who} is the thread here.`}</p>
        {onOpen && <button className="btn" onClick={() => onOpen(f)}>Open film <span className="arr"><Arrow /></span></button>}
      </div>
    </div>
  )
}

function PersonCard({ b, sector, onPick }) {
  return (
    <div className="wh-card person">
      <div className="wh-mono" style={{ background: sector.colour }}>{sector.key === 'k' ? '#' : initials(b.who)}</div>
      <div className="wh-body">
        <span className="spec" style={{ color: sector.colour }}>{sector.role}</span>
        <b className="wh-title">{sector.key === 'k' ? b.who.charAt(0).toUpperCase() + b.who.slice(1) : b.who}</b>
        <p className="wh-why">{b.films.length > 1 ? `On ${b.films.length} films you keep coming back to.` : 'One film so far. Worth following.'}</p>
        <div className="wh-chips">{b.films.map((f) => <button key={f.id} className="chip" onClick={() => onPick(f.key)}>{film(f.id)?.t}</button>)}</div>
      </div>
    </div>
  )
}

/* A city at night under the wheel: clusters of dots, as if seen from above. */
function DotField({ focus }) {
  const cv = useRef(null)
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d')
    const draw = () => {
      const W = c.clientWidth, H = c.clientHeight, d = Math.min(devicePixelRatio || 1, 2)
      c.width = W * d; c.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H)
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let k = 0; k < 16; k++) {
        const cx = rnd() * W, cy = rnd() * H, sx = 30 + rnd() * 120, sy = 10 + rnd() * 50, rot = rnd() * Math.PI
        const n = 30 + Math.floor(rnd() * 70)
        for (let i = 0; i < n; i++) {
          const u = (rnd() + rnd() + rnd() - 1.5) * sx, v = (rnd() + rnd() + rnd() - 1.5) * sy
          const x = cx + u * Math.cos(rot) - v * Math.sin(rot), y = cy + u * Math.sin(rot) + v * Math.cos(rot)
          g.fillStyle = `rgba(239,237,233,${0.08 + rnd() * 0.22})`
          g.fillRect(x, y, 1.2, 1.2)
        }
      }
    }
    draw()
    const ro = new ResizeObserver(draw); ro.observe(c)
    return () => ro.disconnect()
  }, [])
  return <canvas ref={cv} className={`wh-dots-bg ${focus ? 'zoom' : ''}`} aria-hidden="true" />
}
