import { useEffect, useRef, useState } from 'react'
import { assembly } from '../lib/taste.js'
import { poster } from '../lib/films.js'

/* ─────────────────────────────────────────────────────────────
   THE ASSEMBLY — your films, pulled together by the people who
   made them. Drag a star; the whole constellation answers.
   ───────────────────────────────────────────────────────────── */
export default function Assembly({ ids, you = '#3A6E85', height = 520, onOpen, labels = true, youLabel = 'YOU', className = '', intro = true }) {
  const wrap = useRef(null)
  const cv = useRef(null)
  const [hover, setHover] = useState(null)
  const state = useRef({})

  useEffect(() => {
    const canvas = cv.current
    const g = canvas.getContext('2d')
    const { nodes, edges } = assembly(ids)
    const W = () => wrap.current.clientWidth
    const H = () => wrap.current.clientHeight
    let dpr = Math.min(devicePixelRatio || 1, 2)
    const resize = () => { if (!wrap.current) return; dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = W() * dpr; canvas.height = H() * dpr }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(wrap.current)

    // degree for sizing
    const deg = nodes.map(() => 0)
    edges.forEach((e) => { deg[e.a] += e.w; deg[e.b] += e.w })
    const imgs = {}
    const sim = nodes.map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 + Math.random() * 0.3
      const r = 0.15 + Math.random() * 0.25
      return { ...n, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, r: 3.2 + Math.min(6, deg[i] * 0.9), deg: deg[i] }
    })
    const center = { x: 0, y: 0, r: 9 }
    state.current = { sim, edges }
    let drag = null, hov = -1, born = intro ? 0 : 1, raf, t = 0, visible = true
    const scale = () => Math.min(W(), H()) * 0.42

    // keep every star (and most of its label) inside the panel
    const sx = () => Math.min(W() / 2 - (W() > 520 ? 110 : 28), scale() * (W() > H() ? 1.35 : 1))
    const toScreen = (p) => [W() / 2 + p.x * sx(), H() / 2 + p.y * scale()]
    const fromScreen = (x, y) => ({ x: (x - W() / 2) / sx(), y: (y - H() / 2) / scale() })

    const step = () => {
      const k = 0.00042
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i]
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j]
          let dx = a.x - b.x, dy = a.y - b.y
          const d2 = dx * dx + dy * dy + 0.0004
          const f = k / d2
          dx *= f; dy *= f
          a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy
        }
        // gravity toward centre, stronger for loners
        a.vx -= a.x * (a.deg ? 0.006 : 0.011)
        a.vy -= a.y * (a.deg ? 0.006 : 0.011)
        // keep off the YOU node
        const dc = Math.hypot(a.x, a.y)
        if (dc < 0.16) { a.vx += (a.x / (dc + 1e-4)) * 0.004; a.vy += (a.y / (dc + 1e-4)) * 0.004 }
      }
      for (const e of edges) {
        const a = sim[e.a], b = sim[e.b]
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) + 1e-4
        const L = 0.2 / Math.sqrt(e.w)
        const f = (d - L) * 0.012 * Math.min(2, e.w)
        a.vx += (dx / d) * f; a.vy += (dy / d) * f
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f
      }
      for (const a of sim) {
        if (a === drag) continue
        a.vx += Math.sin(t * 0.5 + a.id) * 0.00006
        a.vy += Math.cos(t * 0.4 + a.id * 0.7) * 0.00006
        a.vx *= 0.86; a.vy *= 0.86
        a.x += a.vx; a.y += a.vy
        a.x = Math.max(-1, Math.min(1, a.x)); a.y = Math.max(-1, Math.min(1, a.y))
      }
    }
    for (let i = 0; i < 400; i++) step()

    const draw = () => {
      if (!wrap.current) return
      t += 0.016
      born = Math.min(1, born + 0.012)
      step()
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W(), H())
      const ease = 1 - Math.pow(1 - born, 3)
      const lit = hov >= 0 ? new Set([hov, ...edges.filter((e) => e.a === hov || e.b === hov).flatMap((e) => [e.a, e.b])]) : null
      // spokes from YOU
      const [cx, cy] = toScreen(center)
      sim.forEach((n, i) => {
        if (!n.picked && i > 5) return
        const [x, y] = toScreen(n)
        g.strokeStyle = 'rgba(239,237,233,0.07)'
        g.setLineDash([2, 4]); g.lineWidth = 1
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (x - cx) * ease, cy + (y - cy) * ease); g.stroke()
        g.setLineDash([])
      })
      // edges
      for (const e of edges) {
        const a = sim[e.a], b = sim[e.b]
        const [x1, y1] = toScreen(a), [x2, y2] = toScreen(b)
        const on = lit && (e.a === hov || e.b === hov)
        const alpha = (lit ? (on ? 0.9 : 0.05) : Math.min(0.72, 0.24 + e.w * 0.2)) * ease
        const gr = g.createLinearGradient(x1, y1, x2, y2)
        gr.addColorStop(0, hexA(a.c, alpha)); gr.addColorStop(1, hexA(b.c, alpha))
        g.strokeStyle = on ? `rgba(255,59,20,${alpha})` : gr
        g.lineWidth = on ? 1.4 : Math.min(2.2, 0.6 + e.w * 0.35)
        g.beginPath(); g.moveTo(x1, y1)
        const mx = (x1 + x2) / 2 + (y1 - y2) * 0.12, my = (y1 + y2) / 2 + (x2 - x1) * 0.12
        g.quadraticCurveTo(mx, my, x1 + (x2 - x1) * ease, y1 + (y2 - y1) * ease)
        g.stroke()
      }
      // nodes
      const placed = []
      const pts = sim.map((n) => toScreen(n))
      // a label goes down only where it covers no other label and no other star
      const free = (x, y, w, self) => !placed.some((r) => x < r.x + r.w + 6 && x + w + 6 > r.x && Math.abs(y - r.y) < 13) && !pts.some(([px, py], j) => j !== self && px > x - 5 && px < x + w + 5 && Math.abs(py - y) < 9)
      sim.forEach((n, i) => {
        const [x, y] = toScreen(n)
        const dim = lit && !lit.has(i)
        const r = n.r * (i === hov ? 1.7 : 1) * ease
        g.globalAlpha = dim ? 0.18 : 1
        g.shadowColor = n.c; g.shadowBlur = dim ? 0 : 16
        g.fillStyle = n.c
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
        g.shadowBlur = 0
        if (i === hov) {
          g.strokeStyle = '#efede9'; g.lineWidth = 1
          g.beginPath(); g.arc(x, y, r + 5, 0, Math.PI * 2); g.stroke()
        }
        if (labels && i !== hov && (n.deg > 2 || (lit && lit.has(i))) && W() > 420 && !dim) {
          g.font = '500 9px "Martian Mono", monospace'
          const txt = n.f.t.toUpperCase().slice(0, 26)
          const tw = g.measureText(txt).width
          const lx = x + r + 7 + tw > W() - 6 ? x - r - 7 - tw : x + r + 7
          if (lx > 4 && free(lx, y, tw, i)) {
            placed.push({ x: lx, y, w: tw })
            g.fillStyle = i === hov ? '#efede9' : 'rgba(168,166,161,0.8)'
            g.fillText(txt, lx, y + 3)
          }
        }
        g.globalAlpha = 1
      })
      // YOU
      g.shadowColor = you; g.shadowBlur = 40
      g.fillStyle = you
      g.beginPath(); g.arc(cx, cy, 10 * ease, 0, Math.PI * 2); g.fill()
      g.shadowBlur = 0
      g.strokeStyle = 'rgba(239,237,233,.55)'; g.lineWidth = 1
      g.beginPath(); g.arc(cx, cy, 17 + Math.sin(t * 2) * 1.5, 0, Math.PI * 2); g.stroke()
      g.font = '600 9px "Martian Mono", monospace'; g.fillStyle = '#efede9'
      g.fillText(youLabel, cx + 24, cy + 3)
      raf = visible ? requestAnimationFrame(draw) : 0
    }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(draw) })
    io.observe(canvas)
    raf = requestAnimationFrame(draw)

    const pick = (e) => {
      if (!wrap.current) return { best: -1, sx: 0, sy: 0 }
      const r = canvas.getBoundingClientRect()
      const sx = e.clientX - r.left, sy = e.clientY - r.top
      let best = -1, bd = 22
      sim.forEach((n, i) => { const [x, y] = toScreen(n); const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = i } })
      return { best, sx, sy }
    }
    const move = (e) => {
      const { best, sx, sy } = pick(e)
      if (drag) { const p = fromScreen(sx, sy); drag.x = p.x; drag.y = p.y; drag.vx = drag.vy = 0; return }
      if (best !== hov) {
        hov = best
        if (best >= 0) {
          const n = sim[best]
          const links = edges.filter((x) => x.a === best || x.b === best)
          const who = [...new Set(links.flatMap((l) => l.who))].slice(0, 3)
          setHover({ f: n.f, x: sx, y: sy, who, links: links.length })
        } else setHover(null)
      } else if (best >= 0) setHover((h) => h && { ...h, x: sx, y: sy })
    }
    let downAt = null
    const down = (e) => { const { best } = pick(e); downAt = { x: e.clientX, y: e.clientY, best }; if (best >= 0) { drag = sim[best]; canvas.setPointerCapture(e.pointerId) } }
    const up = (e) => {
      if (downAt && downAt.best >= 0 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && onOpen) onOpen(sim[downAt.best].f)
      drag = null; downAt = null
    }
    const leave = () => { hov = -1; setHover(null) }
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointerleave', leave)
    }
  }, [ids.join(','), you])

  return (
    <div ref={wrap} className={`assembly ${className}`} style={{ position: 'relative', height, touchAction: 'pan-y' }}>
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block', cursor: hover ? 'pointer' : 'default' }} data-cursor={hover ? 'DRAG · OPEN' : undefined} />
      {hover && (
        <AssemblyTip hover={hover} W={wrap.current?.clientWidth || 400} H={wrap.current?.clientHeight || 400} />
      )}
    </div>
  )
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/* The card for a hovered star. Sits below and right of the cursor label; flips to stay inside the panel. */
function AssemblyTip({ hover, W, H }) {
  const w = Math.min(320, W - 24), h = 132
  const right = hover.x + 26 + w > W - 12
  const below = hover.y + 46 + h < H - 12
  const left = right ? Math.max(12, hover.x - 26 - w) : hover.x + 26
  const top = below ? hover.y + 46 : Math.max(12, hover.y - 26 - h)
  return (
    <div className="assembly-tip" style={{ left, top, width: w }}>
      <img src={poster(hover.f.id)} alt="" />
      <div className="at-body">
        <b className="at-title">{hover.f.t}</b>
        <span className="spec">{hover.f.y}{hover.f.dir[0] ? ` · ${hover.f.dir[0]}` : ''}</span>
        {hover.who.length > 0 && (
          <div className="at-who">
            <span className="spec">Shared</span>
            {hover.who.map((p) => <span key={p} className="at-person">{p}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}
