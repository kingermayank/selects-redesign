import { useEffect, useRef } from 'react'

/* ─────────────────────────────────────────────────────────────
   MOTES. The light from the Reading never goes out: the same
   spectral particles carry your picks into the tray, your diary
   into the import, the negative into your colour, the colour into
   each insight, the line onto the clipboard. One layer, app-wide.
   ───────────────────────────────────────────────────────────── */

const live = []
let wake = () => {}

const rectOf = (x) => {
  if (!x) return { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 }
  if (x.getBoundingClientRect) { const r = x.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }
  return { w: 0, h: 0, ...x }
}
const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const spectrum = (t) => {
  const f = (k) => Math.max(0, Math.min(1, Math.abs(((t * 6 + k) % 6 + 6) % 6 - 3) - 1))
  return [f(0) * 255, f(4) * 255, f(2) * 255]
}

/* emit({ from, to, n, colour, spread, dur, onArrive, onDone, size, arc }) */
export function emit({ from, to, n = 120, colour = '#efede9', spread = 0.5, dur = [0.8, 1.5], onArrive, onDone, size = 1.6, arc = 0.35, edge = false, alpha = 1, trail = true } = {}) {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onArrive && onArrive(1); onDone && onDone(); return
  }
  const a = rectOf(from), b = rectOf(to)
  const end = hex(colour)
  const group = { left: n, arrived: 0, n, onArrive, onDone, alpha, trail }
  for (let i = 0; i < n; i++) {
    const sx = a.x + Math.random() * a.w, sy = a.y + Math.random() * a.h
    // land inside the target, or on its edge for frames and cards
    let ex, ey
    if (edge && b.w && b.h) {
      const side = Math.floor(Math.random() * 4), k = Math.random()
      ex = b.x + (side === 0 ? k * b.w : side === 1 ? b.w : side === 2 ? k * b.w : 0)
      ey = b.y + (side === 0 ? 0 : side === 1 ? k * b.h : side === 2 ? b.h : k * b.h)
    } else { ex = b.x + b.w * (0.15 + Math.random() * 0.7); ey = b.y + b.h * (0.15 + Math.random() * 0.7) }
    const mx = (sx + ex) / 2, my = (sy + ey) / 2
    const dx = ex - sx, dy = ey - sy
    const bend = (Math.random() - 0.5) * 2 * arc
    live.push({
      sx, sy, ex, ey,
      cx: mx - dy * bend + (Math.random() - 0.5) * 80, cy: my + dx * bend + (Math.random() - 0.5) * 80,
      t: -Math.random() * spread, d: dur[0] + Math.random() * (dur[1] - dur[0]),
      hue: Math.random(), end, r: size * (0.6 + Math.random() * 0.9), group, px: sx, py: sy,
    })
  }
  wake()
}

export function MotesLayer() {
  const cv = useRef(null)
  useEffect(() => {
    const c = cv.current, g = c.getContext('2d')
    let raf = 0, last = performance.now()
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * d; c.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0) }
    size()
    c.style.display = 'none'
    addEventListener('resize', size)
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      g.clearRect(0, 0, innerWidth, innerHeight)
      g.globalCompositeOperation = 'lighter'
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i]
        p.t += dt / p.d
        if (p.t < 0) continue
        if (p.t >= 1) {
          // arrival: a small flash, then gone
          const k = Math.min(1, (p.t - 1) * 6)
          if (!p.landed) { p.landed = true; p.group.arrived++; p.group.onArrive && p.group.onArrive(p.group.arrived / p.group.n) }
          g.fillStyle = `rgba(${p.end[0]},${p.end[1]},${p.end[2]},${(1 - k) * 0.9 * p.group.alpha})`
          g.beginPath(); g.arc(p.ex, p.ey, p.r * (1 + k * 2.2), 0, Math.PI * 2); g.fill()
          if (k >= 1) {
            live.splice(i, 1)
            if (--p.group.left === 0 && p.group.onDone) p.group.onDone()
          }
          continue
        }
        const t = p.t, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        const u = 1 - e
        const x = u * u * p.sx + 2 * u * e * p.cx + e * e * p.ex
        const y = u * u * p.sy + 2 * u * e * p.cy + e * e * p.ey
        const sp = spectrum(p.hue + t * 0.6 + now * 0.0002)
        const m = Math.max(0, (t - 0.55) / 0.45)
        const col = [sp[0] + (p.end[0] - sp[0]) * m, sp[1] + (p.end[1] - sp[1]) * m, sp[2] + (p.end[2] - sp[2]) * m]
        const a = Math.min(1, t * 5) * 0.95 * p.group.alpha
        g.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a * 0.45})`
        g.lineWidth = p.r * 0.9
        if (p.group.trail) { g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(x, y); g.stroke() }
        g.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`
        g.beginPath(); g.arc(x, y, p.r, 0, Math.PI * 2); g.fill()
        p.px = x; p.py = y
      }
      g.globalCompositeOperation = 'source-over'
      raf = live.length ? requestAnimationFrame(frame) : 0
      if (!live.length) { g.clearRect(0, 0, innerWidth, innerHeight); c.style.display = 'none' }
    }
    wake = () => { if (!raf) { c.style.display = 'block'; last = performance.now(); raf = requestAnimationFrame(frame) } }
    if (live.length) wake()
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); wake = () => {} }
  }, [])
  return <canvas ref={cv} className="motes" aria-hidden="true" />
}
