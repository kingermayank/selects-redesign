import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Poster, useRoute } from '../components/ui.jsx'
import { films, film, search, poster, colour } from '../lib/films.js'
import { scoreAll, reasonShort } from '../lib/taste.js'
import { useStore, setState, getState } from '../lib/store.js'

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

export default function Hunt() {
  const s = useStore()
  const { go } = useRoute()
  const [q, setQ] = useState(() => { const h = getState().huntQuery || ''; if (h) setTimeout(() => setState({ huntQuery: '' })); return h })
  const [vibe, setVibe] = useState(null)
  const scored = useMemo(() => new Map(scoreAll(s).map((e) => [e.f.id, e])), [s.positive.join(','), s.negative.join(',')])
  const [box, setBox] = useState(null)

  const results = useMemo(() => {
    let list = q.trim() ? search(q, 60) : films().slice().sort((a, b) => (scored.get(b.id)?.s ?? -99) - (scored.get(a.id)?.s ?? -99))
    if (vibe != null) list = list.filter(VIBES[vibe][1])
    if (box) list = list.filter((f) => f.mx >= box.x0 && f.mx <= box.x1 && f.my >= box.y0 && f.my <= box.y1)
    return list.filter((f) => !s.negative.includes(f.id)).slice(0, 36)
  }, [q, vibe, box, scored])

  return (
    <div className="hunt">
      <header className="page-head">
        <span className="spec">Hunt</span>
        <h1 className="verdict page-h">Hunt a film.</h1>
      </header>
      <label className="field hunt-search">
        <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" stroke="currentColor" fill="none" strokeWidth="1.3" /><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="a title, a person, a year" aria-label="Search films" />
        {q && <button className="spec" onClick={() => setQ('')}>Clear</button>}
      </label>
      <div className="vibes no-scrollbar">
        {VIBES.map(([v], i) => (
          <button key={v} className={`chip vibe ${vibe === i ? 'on' : ''}`} onClick={() => setVibe(vibe === i ? null : i)} aria-pressed={vibe === i}>{v}</button>
        ))}
      </div>

      <div className="hunt-grid">
        <Viewfinder s={s} onBox={setBox} scored={scored} />
        <div className="hunt-results">
          <div className="row-head"><span className="spec">{box ? 'Inside the frame' : q ? `Results · “${q}”` : 'Sorted by how close to you'}</span><span className="spec">{results.length} films</span></div>
          <div className="hr-grid">
            <AnimatePresence initial={false}>
              {results.map((f) => (
                <motion.button layout key={f.id} className="hr-item" onClick={() => go(`film-${f.id}`)} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                  <Poster id={f.id} alt={f.t} cursor="OPEN" />
                  <span className="ri-t">{f.t}</span>
                  <span className="ri-n spec">{scored.get(f.id) ? reasonShort(scored.get(f.id)) : `${f.y}`}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          {!results.length && <p className="spec empty">Nothing in that frame. Widen it, or drop the vibe.</p>}
        </div>
      </div>
    </div>
  )
}

/* The Viewfinder: every film on two axes. Drag the frame; what is inside is what you get. */
function Viewfinder({ s, onBox, scored }) {
  const wrap = useRef(null)
  const cv = useRef(null)
  const you = useMemo(() => {
    const p = s.positive.map(film).filter(Boolean)
    return p.length ? { x: p.reduce((a, f) => a + f.mx, 0) / p.length, y: p.reduce((a, f) => a + f.my, 0) / p.length } : { x: 0, y: 0 }
  }, [s.positive.join(',')])
  const [frame, setFrame] = useState({ x: you.x, y: you.y, w: 0.62, h: 0.62 })
  const [hov, setHov] = useState(null)
  const drag = useRef(null)
  const toPx = (x, y, W, H) => [((x + 1.1) / 2.2) * W, ((1.1 - y) / 2.2) * H]
  const fromPx = (px, py, W, H) => [(px / W) * 2.2 - 1.1, 1.1 - (py / H) * 2.2]

  useEffect(() => {
    onBox({ x0: frame.x - frame.w / 2, x1: frame.x + frame.w / 2, y0: frame.y - frame.h / 2, y1: frame.y + frame.h / 2 })
  }, [frame])

  useEffect(() => {
    const c = cv.current, g = c.getContext('2d')
    let raf, t = 0
    const draw = () => {
      if (!wrap.current) return
      const W = wrap.current.clientWidth, H = wrap.current.clientHeight, d = Math.min(devicePixelRatio, 2)
      if (c.width !== W * d) { c.width = W * d; c.height = H * d }
      g.setTransform(d, 0, 0, d, 0, 0)
      g.clearRect(0, 0, W, H)
      // grid
      g.strokeStyle = 'rgba(239,237,233,.05)'; g.lineWidth = 1
      for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo((W / 8) * i, 0); g.lineTo((W / 8) * i, H); g.stroke(); g.beginPath(); g.moveTo(0, (H / 8) * i); g.lineTo(W, (H / 8) * i); g.stroke() }
      g.strokeStyle = 'rgba(239,237,233,.14)'
      g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke()
      const fx0 = frame.x - frame.w / 2, fx1 = frame.x + frame.w / 2, fy0 = frame.y - frame.h / 2, fy1 = frame.y + frame.h / 2
      for (const f of films()) {
        const [x, y] = toPx(f.mx, f.my, W, H)
        const inside = f.mx >= fx0 && f.mx <= fx1 && f.my >= fy0 && f.my <= fy1
        const struck = s.negative.includes(f.id)
        const kept = s.positive.includes(f.id)
        const sc = scored.get(f.id)
        const r = kept ? 5 : 2 + Math.max(0, Math.min(3, (sc?.s || 0) / 4))
        g.globalAlpha = struck ? 0.25 : inside ? 1 : 0.28
        g.fillStyle = struck ? '#ff3b14' : colour(f)
        if (inside && !struck) { g.shadowColor = colour(f); g.shadowBlur = 10 }
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
        g.shadowBlur = 0
        if (kept) { g.strokeStyle = '#efede9'; g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.stroke() }
      }
      g.globalAlpha = 1
      // you
      const [ux, uy] = toPx(you.x, you.y, W, H)
      t += 0.03
      g.strokeStyle = s.colour || '#3a6e85'; g.lineWidth = 1.5
      g.beginPath(); g.arc(ux, uy, 9 + Math.sin(t) * 2, 0, Math.PI * 2); g.stroke()
      g.font = '600 9px "Martian Mono", monospace'; g.fillStyle = '#efede9'; g.fillText('YOU', ux + 14, uy + 3)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [frame, you, scored, s.negative.join(',')])

  const W = () => wrap.current.clientWidth, H = () => wrap.current.clientHeight
  const down = (e, mode) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, f: { ...frame } }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) {
      const r = wrap.current.getBoundingClientRect()
      const [mx, my] = fromPx(e.clientX - r.left, e.clientY - r.top, W(), H())
      let best = null, bd = 0.05
      for (const f of films()) { const dd = Math.hypot(f.mx - mx, f.my - my); if (dd < bd) { bd = dd; best = f } }
      setHov(best ? { f: best, x: e.clientX - r.left, y: e.clientY - r.top } : null)
      return
    }
    const dx = ((e.clientX - d.sx) / W()) * 2.2, dy = -((e.clientY - d.sy) / H()) * 2.2
    if (d.mode === 'move') setFrame({ ...d.f, x: Math.max(-1, Math.min(1, d.f.x + dx)), y: Math.max(-1, Math.min(1, d.f.y + dy)) })
    else setFrame({ ...d.f, w: Math.max(0.2, Math.min(2.2, d.f.w + dx * 2)), h: Math.max(0.2, Math.min(2.2, d.f.h - dy * 2)) })
  }
  const up = () => (drag.current = null)
  const [fl, ft] = wrap.current ? toPx(frame.x - frame.w / 2, frame.y + frame.h / 2, W(), H()) : [0, 0]
  const [fr, fb] = wrap.current ? toPx(frame.x + frame.w / 2, frame.y - frame.h / 2, W(), H()) : [0, 0]

  return (
    <div className="vf">
      <div className="vf-head"><span className="spec lit">The Viewfinder</span><span className="spec">Drag the frame · pull the corner to widen</span></div>
      <div className="vf-stage" ref={wrap} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHov(null)}>
        <canvas ref={cv} />
        <span className="vf-ax l spec">Warm</span><span className="vf-ax r spec">Sharp</span><span className="vf-ax t spec">Loud</span><span className="vf-ax b spec">Quiet</span>
        {wrap.current && (
          <div className="vf-frame" style={{ left: fl, top: ft, width: fr - fl, height: fb - ft }} onPointerDown={(e) => down(e, 'move')} data-cursor="MOVE">
            <b /><b /><b /><b />
            <span className="vf-rec spec"><i /> REC</span>
            <span className="vf-size" onPointerDown={(e) => down(e, 'size')} data-cursor="WIDEN" />
          </div>
        )}
        {hov && (
          <div className="vf-tip" style={{ left: Math.min(hov.x + 14, W() - 170), top: Math.max(0, hov.y - 90) }}>
            <img src={poster(hov.f.id)} alt="" />
            <div><b>{hov.f.t}</b><span className="spec">{hov.f.y}</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
