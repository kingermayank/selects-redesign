import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Poster, useRoute } from '../components/ui.jsx'
import { Arrow } from '../components/Icons.jsx'
import { films, film, search, poster, colour } from '../lib/films.js'
import { scoreAll, reasonShort } from '../lib/taste.js'
import { useStore, setState, getState } from '../lib/store.js'
import { play } from '../lib/sound.js'
import { EmptyReel } from './parts.jsx'

const VIBES = [
  ['neo noir', (f) => f.k.some((k) => /noir|night|heist/.test(k))],
  ['two-hander', (f) => f.k.some((k) => /friendship|relationship|cat and mouse|duo/.test(k))],
  ['slow cinema', (f) => f.rt > 140 || f.k.some((k) => /slow|meditative|contemplative/.test(k))],
  ['love, badly timed', (f) => f.g.includes('Romance')],
  ['other worlds', (f) => f.g.includes('Science Fiction') || f.g.includes('Fantasy')],
  ['real people', (f) => f.g.includes('Documentary')],
  ['dread', (f) => f.g.includes('Horror')],
  ['under 100 min', (f) => f.rt && f.rt < 100],
  ['before 1970', (f) => f.y && f.y < 1970],
  ['this year', (f) => f.y >= 2025],
]

/* ─────────────────────────────────────────────────────────────
   HUNT. One instrument, two halves: the Viewfinder on the left is
   every film on a map of feel; the gate on the right is whatever
   the frame is pointing at. Hover either side and the other answers.
   ───────────────────────────────────────────────────────────── */
/* The map is fitted to where the films actually are, so the whole field is used. */
let GEO = null
const geo = () => {
  if (GEO) return GEO
  const all = films()
  const xs = all.map((f) => f.mx).sort((a, b) => a - b), ys = all.map((f) => f.my).sort((a, b) => a - b)
  const q = (a, k) => a[Math.floor((a.length - 1) * k)]
  const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99)
  GEO = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hx: (x1 - x0) / 2 || 1, hy: (y1 - y0) / 2 || 1 }
  return GEO
}
const clampU = (v) => Math.max(-1.05, Math.min(1.05, v))
export const mx = (f) => clampU((f.mx - geo().cx) / geo().hx)
export const my = (f) => clampU((f.my - geo().cy) / geo().hy)

export default function Hunt() {
  const s = useStore()
  const { go } = useRoute()
  const [q, setQ] = useState(() => { const h = getState().huntQuery || ''; if (h) setTimeout(() => setState({ huntQuery: '' })); return h })
  const [vibe, setVibe] = useState(null)
  const scored = useMemo(() => new Map(scoreAll(s).map((e) => [e.f.id, e])), [s.positive.join(','), s.negative.join(',')])
  const you = useMemo(() => {
    const p = s.positive.map(film).filter(Boolean)
    return p.length ? { x: p.reduce((a, f) => a + mx(f), 0) / p.length, y: p.reduce((a, f) => a + my(f), 0) / p.length } : { x: 0, y: 0 }
  }, [s.positive.join(',')])
  const home = { x: Math.max(-0.7, Math.min(0.7, you.x)), y: Math.max(-0.7, Math.min(0.7, you.y)), w: 0.7, h: 0.7 }
  const [frame, setFrame] = useState(home)
  const [focus, setFocus] = useState(null) // hovered on either side
  const [pin, setPin] = useState(null) // clicked on the map
  const list = useRef(null)

  // the pool: search and vibe narrow what is on the map at all
  const pool = useMemo(() => {
    let l = q.trim() ? search(q, 80) : films()
    if (vibe != null) l = l.filter(VIBES[vibe][1])
    return l.filter((f) => !s.negative.includes(f.id))
  }, [q, vibe, s.negative.join(',')])
  const poolIds = useMemo(() => new Set(pool.map((f) => f.id)), [pool])
  const inFrame = (f) => Math.abs(mx(f) - frame.x) <= frame.w / 2 && Math.abs(my(f) - frame.y) <= frame.h / 2
  const results = useMemo(() => pool.filter(inFrame).sort((a, b) => (scored.get(b.id)?.s ?? -99) - (scored.get(a.id)?.s ?? -99)).slice(0, 48), [pool, frame, scored])
  const reset = () => { play('detent'); setFrame(home); setVibe(null); setQ('') }

  useEffect(() => {
    if (pin == null || !list.current) return
    const el = list.current.querySelector(`[data-id="${pin}"]`)
    el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [pin])

  return (
    <div className="hunt">
      <header className="page-head">
        <h1 className="verdict page-h">Hunt by feel.</h1>
      </header>
      <div className="hunt-bar">
        <label className="field hunt-search">
          <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" stroke="currentColor" fill="none" strokeWidth="1.3" /><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A title, a person, a year" aria-label="Search films" />
          {q && <button className="spec" onClick={() => setQ('')}>Clear</button>}
        </label>
        <div className="vibes no-scrollbar">
          {VIBES.map(([v], i) => (
            <button key={v} className={`chip vibe ${vibe === i ? 'on' : ''}`} onClick={() => setVibe(vibe === i ? null : i)} aria-pressed={vibe === i}>{v}</button>
          ))}
        </div>
      </div>

      <section className="deck">
        <div className="deck-top">
          <span className="spec deck-rec"><i /> Viewfinder</span>
          <span className="spec">{pool.length} on the map</span>
          <span className="spec deck-count"><b className="numeral">{results.length}</b> in frame</span>
          <button className="link-spec deck-reset" onClick={reset}>Reset frame</button>
        </div>
        <div className="deck-body">
          <Viewfinder s={s} you={you} frame={frame} setFrame={setFrame} poolIds={poolIds} scored={scored} focus={focus} setFocus={setFocus} pin={pin} setPin={setPin} go={go} />
          <div className="deck-list" ref={list}>
            <div className="deck-list-head"><span className="spec">{q ? `“${q}”` : vibe != null ? VIBES[vibe][0] : 'Closest to you first'}</span></div>
            {results.length ? (
              <div className="hr-grid">
                <AnimatePresence initial={false}>
                  {results.map((f) => (
                    <motion.button
                      layout
                      key={f.id}
                      data-id={f.id}
                      className={`hr-item ${focus === f.id || pin === f.id ? 'hl' : ''}`}
                      onClick={() => go(`film-${f.id}`)}
                      onPointerEnter={() => setFocus(f.id)}
                      onPointerLeave={() => setFocus((x) => (x === f.id ? null : x))}
                      style={{ '--film': colour(f) }}
                      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Poster id={f.id} alt={f.t} cursor="OPEN" />
                      <span className="ri-t">{f.t}</span>
                      <span className="ri-n spec">{scored.get(f.id) ? reasonShort(scored.get(f.id)) : `${f.y}`}</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              q.trim() && !pool.length
              ? <EmptyReel title="No film by that name." sub="Check the spelling, or try a director, an actor or a year." action="Clear search" onAction={() => { setQ(''); play('detent') }} />
              : <EmptyReel title="Nothing in frame." sub="Widen the frame, or drag it toward the brighter stars." action="Reset frame" onAction={reset} />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/* The Viewfinder: every film on two axes. Stars grow with how close they are to you,
   and swell under the pointer like a loupe. Drag the frame; resize from its corner. */
function Viewfinder({ s, you, frame, setFrame, poolIds, scored, focus, setFocus, pin, setPin, go }) {
  const wrap = useRef(null)
  const cv = useRef(null)
  const live = useRef({})
  live.current = { frame, poolIds, scored, focus, pin, you, neg: s.negative, pos: s.positive, colour: s.colour }
  const ptr = useRef({ x: -999, y: -999, k: 0 })
  const drag = useRef(null)
  const shown = useRef([]) // screen positions from the last frame, for hit testing
  const [size, setSize] = useState({ W: 0, H: 0 })
  const toPx = (x, y, W, H) => [((x + 1.1) / 2.2) * W, ((1.1 - y) / 2.2) * H]

  useEffect(() => {
    const ro = new ResizeObserver(() => wrap.current && setSize({ W: wrap.current.clientWidth, H: wrap.current.clientHeight }))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = cv.current, g = c.getContext('2d')
    let raf, t = 0
    const all = films()
    const draw = () => {
      if (!wrap.current) return
      const L = live.current
      const W = wrap.current.clientWidth, H = wrap.current.clientHeight, d = Math.min(devicePixelRatio, 2)
      if (c.width !== Math.round(W * d) || c.height !== Math.round(H * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d) }
      g.setTransform(d, 0, 0, d, 0, 0)
      g.clearRect(0, 0, W, H)
      t += 0.016
      const P = ptr.current
      P.k += ((P.x > -900 ? 1 : 0) - P.k) * 0.12
      // grid
      g.strokeStyle = 'rgba(239,237,233,.045)'; g.lineWidth = 1
      for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo((W / 10) * i, 0); g.lineTo((W / 10) * i, H); g.stroke(); g.beginPath(); g.moveTo(0, (H / 10) * i); g.lineTo(W, (H / 10) * i); g.stroke() }
      g.strokeStyle = 'rgba(239,237,233,.12)'
      g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke()
      const F = L.frame
      const fx0 = F.x - F.w / 2, fx1 = F.x + F.w / 2, fy0 = F.y - F.h / 2, fy1 = F.y + F.h / 2
      let lo = Infinity, hi = -Infinity
      L.scored.forEach((e) => { lo = Math.min(lo, e.s); hi = Math.max(hi, e.s) })
      const R = Math.min(W, H) * 0.16 // the loupe
      const out = []
      for (const f of all) {
        const fmx = mx(f), fmy = my(f)
        let [x, y] = toPx(fmx, fmy, W, H)
        const onMap = L.poolIds.has(f.id)
        const inside = fmx >= fx0 && fmx <= fx1 && fmy >= fy0 && fmy <= fy1
        const struck = L.neg.includes(f.id)
        const kept = L.pos.includes(f.id)
        const sc = L.scored.get(f.id)
        const n = sc ? (sc.s - lo) / Math.max(1e-6, hi - lo) : kept ? 1 : 0.3
        let r = kept ? 6 : inside ? 2 + n * n * 6.5 : 1.6 + n * 2.6
        // loupe: stars near the pointer swell and push apart
        const dd = Math.hypot(x - P.x, y - P.y)
        const k = Math.max(0, 1 - dd / R) * P.k
        if (k > 0) { x = P.x + (x - P.x) * (1 + 0.55 * k); y = P.y + (y - P.y) * (1 + 0.55 * k); r *= 1 + 1.8 * k * k }
        const hl = f.id === L.focus || f.id === L.pin
        g.globalAlpha = !onMap ? 0.08 : struck ? 0.25 : inside ? 1 : 0.42 + k * 0.5
        g.fillStyle = struck ? '#ff3b14' : colour(f)
        if (inside && onMap && !struck) { g.shadowColor = colour(f); g.shadowBlur = 6 + n * 10 }
        g.beginPath(); g.arc(x, y, hl ? r + 2 : r, 0, Math.PI * 2); g.fill()
        g.shadowBlur = 0
        if (kept) { g.globalAlpha = 1; g.strokeStyle = '#efede9'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.stroke() }
        if (onMap) out.push({ f, x, y, r, k })
      }
      g.globalAlpha = 1
      shown.current = out
      // names inside the loupe
      g.font = '500 9px "Martian Mono", monospace'
      const used = []
      out.filter((o) => o.k > 0.35).sort((a, b) => b.k - a.k).slice(0, 8).forEach((o) => {
        const txt = o.f.t.toUpperCase().slice(0, 24)
        const tw = g.measureText(txt).width
        const lx = o.x + o.r + 6 + tw > W - 6 ? o.x - o.r - 6 - tw : o.x + o.r + 6
        if (used.some((u) => Math.abs(u.y - o.y) < 12 && lx < u.x + u.w + 8 && lx + tw + 8 > u.x) || used.length >= 4) return
        used.push({ x: lx, y: o.y, w: tw })
        g.fillStyle = `rgba(239,237,233,${Math.min(1, (o.k - 0.35) * 2.5)})`
        g.fillText(txt, lx, o.y + 3)
      })
      // the focused film: crosshair and name, whichever side it came from
      const fo = out.find((o) => o.f.id === (L.pin ?? L.focus))
      if (fo) {
        g.strokeStyle = 'rgba(255,59,20,.55)'; g.lineWidth = 1; g.setLineDash([3, 4])
        g.beginPath(); g.moveTo(fo.x, 0); g.lineTo(fo.x, H); g.moveTo(0, fo.y); g.lineTo(W, fo.y); g.stroke(); g.setLineDash([])
        g.strokeStyle = '#ff3b14'; g.lineWidth = 1.5
        const rr = fo.r + 7 + Math.sin(t * 4) * 1.5
        g.beginPath(); g.arc(fo.x, fo.y, rr, 0, Math.PI * 2); g.stroke()
        if (L.pin == null) { g.fillStyle = '#efede9'; g.font = '600 9px "Martian Mono", monospace'; g.fillText(fo.f.t.toUpperCase().slice(0, 28), fo.x + rr + 6, fo.y - rr) }
      }
      // you
      const [ux, uy] = toPx(L.you.x, L.you.y, W, H)
      g.strokeStyle = L.colour || '#3a6e85'; g.lineWidth = 1.5
      g.beginPath(); g.arc(ux, uy, 9 + Math.sin(t * 2) * 2, 0, Math.PI * 2); g.stroke()
      g.font = '600 9px "Martian Mono", monospace'; g.fillStyle = '#efede9'; g.fillText('YOU', ux + 14, uy + 3)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  const W = () => wrap.current.clientWidth, H = () => wrap.current.clientHeight
  const nearest = (px, py) => {
    let best = null, bd = 16
    for (const o of shown.current) { const dd = Math.hypot(o.x - px, o.y - py) - o.r; if (dd < bd) { bd = dd; best = o } }
    return best
  }
  const local = (e) => { const r = wrap.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = (e, mode) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, f: { ...frame }, moved: false }
  }
  const move = (e) => {
    const [px, py] = local(e)
    if (e.pointerType !== 'touch') ptr.current.x = px, ptr.current.y = py
    const d = drag.current
    if (!d) {
      const o = nearest(px, py)
      const id = o ? o.f.id : null
      if (id !== focus) { setFocus(id); id && play('hover', { gap: 0.05 }) }
      return
    }
    d.moved = true
    const dx = ((e.clientX - d.sx) / W()) * 2.2, dy = -((e.clientY - d.sy) / H()) * 2.2
    if (d.mode === 'move') setFrame({ ...d.f, x: Math.max(-1, Math.min(1, d.f.x + dx)), y: Math.max(-1, Math.min(1, d.f.y + dy)) })
    else setFrame({ ...d.f, w: Math.max(0.2, Math.min(2.2, d.f.w + dx * 2)), h: Math.max(0.2, Math.min(2.2, d.f.h - dy * 2)) })
  }
  const up = (e) => {
    const d = drag.current
    drag.current = null
    if (d && d.moved) { play('detent'); return }
    // a tap on a star pins it; a tap on empty map moves the frame there
    const [px, py] = local(e)
    const o = nearest(px, py)
    if (o) { setPin(o.f.id === pin ? null : o.f.id); play('pick') }
    else if (!d) { setPin(null) }
  }
  const tapEmpty = (e) => {
    const [px, py] = local(e)
    if (nearest(px, py)) return
    const x = (px / W()) * 2.2 - 1.1, y = 1.1 - (py / H()) * 2.2
    setFrame((f) => ({ ...f, x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) })); setPin(null); play('detent')
  }
  const { W: w, H: h } = size
  const [fl, ft] = w ? toPx(frame.x - frame.w / 2, frame.y + frame.h / 2, w, h) : [0, 0]
  const [fr, fb] = w ? toPx(frame.x + frame.w / 2, frame.y - frame.h / 2, w, h) : [0, 0]
  const pf = pin != null ? film(pin) : null
  const po = pf ? shown.current.find((o) => o.f.id === pin) : null

  return (
    <div className="vf-stage" ref={wrap} onPointerMove={move} onPointerUp={up} onDoubleClick={tapEmpty} onPointerLeave={() => { ptr.current.x = -999; ptr.current.y = -999; setFocus(null) }}>
      <canvas ref={cv} />
      <span className="vf-ax l spec">Warm</span><span className="vf-ax r spec">Sharp</span><span className="vf-ax t spec">Loud</span><span className="vf-ax b spec">Quiet</span>
      {w > 0 && (
        <div className="vf-frame" style={{ left: fl, top: ft, width: fr - fl, height: fb - ft }} onPointerDown={(e) => down(e, 'move')} data-cursor="MOVE">
          <b /><b /><b /><b />
          <span className="vf-rec spec"><i /> REC</span>
          <span className="vf-size" onPointerDown={(e) => down(e, 'size')} data-cursor="WIDEN" />
        </div>
      )}
      <AnimatePresence>
        {pf && po && (
          <motion.div key={pf.id} className="vf-pin" style={{ left: Math.min(po.x + 18, w - 248), top: Math.max(8, Math.min(po.y - 40, h - 132)) }} initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <img src={poster(pf.id)} alt="" />
            <div className="vf-pin-b">
              <b>{pf.t}</b>
              <span className="spec">{pf.y}{scored.get(pf.id) ? ` · ${reasonShort(scored.get(pf.id))}` : ''}</span>
              <div className="vf-pin-act">
                <button className="btn" onClick={() => go(`film-${pf.id}`)}>Open <span className="arr"><Arrow /></span></button>
                <button className="link-spec" onClick={() => setPin(null)}>Close</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
