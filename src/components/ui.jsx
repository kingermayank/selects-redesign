import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react'
import { motion, animate, useInView, AnimatePresence } from 'framer-motion'
import { poster, syncSrc, resolveSrc } from '../lib/films.js'
import { play, soundOn, setSound } from '../lib/sound.js'
import { useStore } from '../lib/store.js'

/* ─────────────────────────────────────────────────────────────
   THE MARK — five bars, one lit. Everything after the splash is
   these same five bars rearranging.
   ───────────────────────────────────────────────────────────── */
/* Geometry, from the Figma master (06 Brand kit): a bar is 14 units on a 100-unit
   height, bars sit on a 24-unit pitch, everything leans 13.5°. Bars are whole: the
   viewBox is the exact bounding box of the sheared shape, so the mark is centred
   by construction and nothing is ever cropped. */
const LEAN = 100 * Math.tan((13.5 * Math.PI) / 180) // 24.0 units over the full height
const FIVE = { n: 5, w: 14, pitch: 24, lit: 2 } // the mark
const THREE = { n: 3, w: 23, pitch: 34, lit: 1 } // the icon: below 48px, three bars, never five
const vbWidth = (g) => (g.n - 1) * g.pitch + g.w + LEAN
// Layouts move bars away from rest. dx/dy in units; rotation and scaleY pivot on the bar's foot.
const LAYOUTS = {
  mark: () => ({ dx: 0, dy: 0, rotate: 0, scaleY: 1 }),
  open: (i) => ({ dx: 6, dy: -22 - i * 3, rotate: -26 - i * 3.5, scaleY: 1 }),
  wide: (i) => ({ dx: (i - 2) * 8, dy: 0, rotate: 0, scaleY: 1 }),
  tight: (i) => ({ dx: -(i - 2) * 9, dy: 0, rotate: 0, scaleY: 1 }),
  fan: (i) => ({ dx: 0, dy: Math.abs(i - 2) * 4, rotate: (i - 2) * 10, scaleY: 1 }),
  strike: (i) => (i === 2 ? { dx: -6, dy: 4, rotate: 52, scaleY: 1.12 } : { dx: 0, dy: 0, rotate: 0, scaleY: 1 }),
  rise: (i) => ({ dx: 0, dy: 0, rotate: 0, scaleY: [0.62, 0.8, 1, 0.8, 0.62][i] }),
  // two bars lean in to each other; the rest hold back
  pair: (i) => (i === 1 ? { dx: 10, dy: 0, rotate: 9, scaleY: 1 } : i === 2 ? { dx: -2, dy: 0, rotate: -9, scaleY: 1 } : { dx: 0, dy: 0, rotate: 0, scaleY: 0.42 }),
  // film cans on a shelf: every bar lies down
  stack: (i) => ({ dx: 30 - i * 24, dy: -i * 19 + 4, rotate: -76.5, scaleY: 0.66 }),
  // a staircase climbing into the dark
  climb: (i) => ({ dx: 0, dy: 0, rotate: 0, scaleY: 0.32 + i * 0.17 }),
}
function barCoords(g, i, { dx, dy, rotate, scaleY }) {
  const x0 = i * g.pitch
  const corners = [[0, 100], [g.w, 100], [g.w + LEAN, 0], [LEAN, 0]]
  const a = (rotate * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return corners.flatMap(([px, py]) => {
    const ly = (py - 100) * scaleY
    const lx = px + (py - 100) * (scaleY - 1) * -(LEAN / 100) // keep the lean when a bar is shortened
    return [lx * c - ly * s + x0 + dx, lx * s + ly * c + 100 + dy]
  })
}
const toPts = (a) => `${a[0].toFixed(2)},${a[1].toFixed(2)} ${a[2].toFixed(2)},${a[3].toFixed(2)} ${a[4].toFixed(2)},${a[5].toFixed(2)} ${a[6].toFixed(2)},${a[7].toFixed(2)}`

/* The mark. `size` is its height in px; width follows the geometry. */
export function Mark({ size = 40, layout = 'mark', lit, litColour = 'var(--select)', ink = 'var(--fg)', className = '', style, spring, five = false, hop = false }) {
  const g = size < 48 && layout === 'mark' && !five ? THREE : FIVE
  const litAt = lit === undefined ? g.lit : g === THREE && lit === 2 && !hop ? 1 : lit
  const L = LAYOUTS[layout] || LAYOUTS.mark
  const polys = useRef([])
  const cur = useRef(null)
  const targets = Array.from({ length: g.n }, (_, i) => barCoords(g, i, L(i)))
  if (!cur.current || cur.current.length !== g.n) cur.current = targets.map((t) => t.slice())
  useEffect(() => {
    const from = cur.current.map((a) => a.slice())
    const ctl = animate(0, 1, {
      ...(spring || { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 }),
      onUpdate: (k) => {
        cur.current = from.map((a, i) => a.map((v, j) => v + (targets[i][j] - v) * k))
        cur.current.forEach((a, i) => polys.current[i] && polys.current[i].setAttribute('points', toPts(a)))
      },
    })
    return () => ctl.stop()
  }, [layout, g.n])
  const vw = vbWidth(g)
  return (
    <svg className={className} style={{ display: 'block', flex: 'none', ...style }} width={(size * vw) / 100} height={size} viewBox={`0 0 ${vw.toFixed(2)} 100`} aria-hidden="true" overflow="visible">
      {cur.current.map((pts, i) => (
        <polygon key={`${g.n}-${i}`} ref={(el) => (polys.current[i] = el)} points={toPts(pts)} style={{ fill: i === litAt ? litColour : ink, transform: hop && i === litAt ? 'translateY(-9px)' : 'none', transition: hop ? 'fill .16s linear, transform .22s cubic-bezier(.34,1.56,.64,1)' : 'fill .45s cubic-bezier(.22,1,.36,1), transform .4s cubic-bezier(.22,1,.36,1)' }} />
      ))}
    </svg>
  )
}

/* Lockup, in the Figma proportions: wordmark cap height 0.55 of the mark, gap 0.375.
   Hover: the lit bar runs the length of the mark like a frame through a gate, then settles home. */
const CHASE = { 3: [2, 1, 0, 1], 5: [3, 4, 3, 2, 1, 0, 1, 2] }
export function useChase(n = 3) {
  const [lit, setLit] = useState(undefined)
  const timer = useRef(0)
  const run = () => {
    clearInterval(timer.current)
    const seq = CHASE[n]
    let k = 0
    timer.current = setInterval(() => {
      setLit(seq[k % seq.length]); k++
      if (k > seq.length * 2) { clearInterval(timer.current); setLit(undefined) }
    }, 70)
  }
  const stop = () => { clearInterval(timer.current); setLit(undefined) }
  useEffect(() => () => clearInterval(timer.current), [])
  return { lit, run, stop, hop: lit !== undefined }
}
export function Lockup({ size = 22, className = '', onClick }) {
  const n = size < 48 ? 3 : 5
  const c = useChase(n)
  return (
    <button className={`lockup ${className}`} onClick={onClick} onPointerEnter={(e) => e.pointerType === 'mouse' && c.run()} onPointerLeave={c.stop} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.375, minHeight: 44 }} aria-label="Selects home">
      <Mark size={size} lit={c.lit} hop={c.hop} />
      <span className="lockup-word" style={{ fontSize: size * 0.78 }}>SELECTS</span>
    </button>
  )
}

/* Sound on/off: five bars that play like a meter while sound is on, and lie flat when it is off. */
export function SoundToggle({ className = '' }) {
  const on = useStore((s) => s.sound !== false)
  return (
    <button className={`sound-t ${on ? 'on' : ''} ${className}`} onClick={() => setSound(!on)} aria-pressed={on} aria-label={on ? 'Sound on' : 'Sound off'} data-sfx="none" data-cursor={on ? 'MUTE' : 'SOUND'}>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--d': `${[0.12, 0.42, 0, 0.3, 0.2][i]}s` }} />)}
    </button>
  )
}

/* the clap: bars open like a clapstick and slam shut */
export function Clap({ size = 120, onDone, delay = 0.25 }) {
  const [state, setState] = useState('open')
  const [lit, setLit] = useState(-1)
  useEffect(() => {
    const t1 = setTimeout(() => setState('mark'), delay * 1000 + 420)
    const t2 = setTimeout(() => { setLit(2); tickFlash() }, delay * 1000 + 640)
    const t0 = setTimeout(() => play('clap'), delay * 1000 + 440)
    const t3 = setTimeout(() => onDone && onDone(), delay * 1000 + 1500)
    return () => [t0, t1, t2, t3].forEach(clearTimeout)
  }, [])
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={state === 'mark' ? { scale: [1.06, 1], opacity: 1, x: [0, -3, 2, 0] } : { scale: 0.96, opacity: 1 }}
      transition={{ duration: state === 'mark' ? 0.32 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Mark size={size} five layout={state} lit={lit} spring={state === 'mark' ? { type: 'spring', stiffness: 1400, damping: 38 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
    </motion.div>
  )
}
function tickFlash() { try { navigator.vibrate && navigator.vibrate([6, 30, 10]) } catch {} }

/* the progress strip at the top of onboarding */
export function BarProgress({ total = 7, at = 0 }) {
  return (
    <div style={{ display: 'flex', gap: 4 }} aria-label={`Step ${at + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.span
          key={i}
          className="bar-atom"
          initial={false}
          animate={{ backgroundColor: i < at ? '#efede9' : i === at ? '#ff3b14' : '#2a2a2e', height: i === at ? 16 : 12 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 5 }}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   POSTER — tilts toward the pointer, catches light, can be struck.
   ───────────────────────────────────────────────────────────── */
export function Poster({ id, alt = '', className = '', tilt = true, struck = false, picked = false, onClick, style, children, eager = false, cursor = 'VIEW' }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const raf = useRef(0)
  const onMove = useCallback((e) => {
    if (!tilt || e.pointerType === 'touch') return
    const el = ref.current
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(700px) rotateX(${(0.5 - py) * 9}deg) rotateY(${(px - 0.5) * 11}deg) translateZ(0)`
      el.style.setProperty('--gx', px * 100 + '%')
      el.style.setProperty('--gy', py * 100 + '%')
    })
  }, [tilt])
  const onLeave = () => { cancelAnimationFrame(raf.current); if (ref.current) ref.current.style.transform = '' }
  return (
    <div
      ref={ref}
      className={`poster ${struck ? 'is-struck' : ''} ${picked ? 'is-picked' : ''} ${className}`}
      style={{ transition: 'transform .6s cubic-bezier(.22,1,.36,1), box-shadow .4s', ...style }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      data-cursor={cursor}
    >
      <img src={poster(id)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className={loaded ? '' : 'loading'} onLoad={() => setLoaded(true)} draggable={false} />
      <span className="glare" />
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   NUMBERS — mono, tabular, they count like a reel counter.
   ───────────────────────────────────────────────────────────── */
export function Counter({ to, from = 0, duration = 1.4, format = (n) => Math.round(n).toLocaleString('en-US'), className = '', style, start = true }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  useEffect(() => {
    if (!inView || !start) return
    const c = animate(from, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => ref.current && (ref.current.textContent = format(v)) })
    return () => c.stop()
  }, [inView, to, start])
  return <span ref={ref} className={className} style={style}>{format(from)}</span>
}

/* Words that rise out of a skewed slot, one by one. */
export function Rise({ text, as: Tag = 'span', className = '', delay = 0, stagger = 0.05, once = true, style }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once, margin: '-8% 0px' })
  const lines = String(text).split('\n')
  let k = 0
  return (
    <Tag ref={ref} className={className} style={style} aria-label={String(text).replace(/\n/g, ' ')}>
      {lines.map((line, li) => (
        <span key={li} style={{ display: 'block' }} aria-hidden="true">
          {line.split(' ').map((w, wi) => {
            const d = delay + k++ * stagger
            return (
              <span key={wi} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.08em', marginBottom: '-0.08em', paddingRight: '0.04em' }}>
                <motion.span
                  style={{ display: 'inline-block', transformOrigin: '0% 100%' }}
                  initial={{ y: '108%', skewY: 7 }}
                  animate={inView ? { y: '0%', skewY: 0 } : {}}
                  transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: d }}
                >
                  {w}
                  {wi < line.split(' ').length - 1 ? ' ' : ''}
                </motion.span>
              </span>
            )
          })}
        </span>
      ))}
    </Tag>
  )
}

/* ─────────────────────────────────────────────────────────────
   CURSOR — a dot that becomes a viewfinder over anything you can open.
   ───────────────────────────────────────────────────────────── */
export function Cursor() {
  const ref = useRef(null)
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, raf
    const move = (e) => {
      x = e.clientX; y = e.clientY
      if (ref.current && !ref.current.classList.contains('on')) { cx = x; cy = y; ref.current.classList.add('on') }
      const t = e.target.closest && e.target.closest('[data-cursor]')
      const l = t ? t.getAttribute('data-cursor') : ''
      setLabel((p) => (p === l ? p : l))
    }
    const down = () => ref.current && ref.current.classList.add('press')
    const up = () => ref.current && ref.current.classList.remove('press')
    const loop = () => {
      cx += (x - cx) * 0.24; cy += (y - cy) * 0.24
      if (ref.current) ref.current.style.transform = `translate3d(${cx}px,${cy}px,0)`
      raf = requestAnimationFrame(loop)
    }
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerdown', down)
    addEventListener('pointerup', up)
    loop()
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); removeEventListener('pointerdown', down); removeEventListener('pointerup', up) }
  }, [])
  return (
    <div ref={ref} className={`cursor ${label ? 'view' : ''}`} aria-hidden="true">
      <span className="dot" />
      <span className="frame"><b /><b /><b /><b /></span>
      <span className="label">{label}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ROUTER + SLATE. Plain #names only (that is what survives sharing).
   Big moves get the slate: five bars sweep, the third lit.
   ───────────────────────────────────────────────────────────── */
const RouteCtx = createContext({ route: '', go: () => {} })
export const useRoute = () => useContext(RouteCtx)
const getHash = () => decodeURIComponent((location.hash || '').replace(/^#/, ''))

export function Router({ children }) {
  const [route, setRoute] = useState(getHash())
  const [slate, setSlate] = useState(null)
  useEffect(() => {
    const on = () => setRoute(getHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((to, { wipe = false } = {}) => {
    const apply = () => {
      if (to === '' || to === 'top') history.pushState(null, '', location.pathname + location.search)
      else location.hash = to
      setRoute(to === 'top' ? '' : to)
      // inside the app the outgoing page fades in place and the shell scrolls once it is gone
      if (wipe || !/^(home|hunt|library|you|film-\d+)$/.test(to)) window.scrollTo(0, 0)
    }
    if (!wipe || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
    play('whoosh'); setSlate({ phase: 'in', apply })
  }, [])
  return (
    <RouteCtx.Provider value={{ route, go }}>
      {children}
      <AnimatePresence>
        {slate && (
          <div className="slate" key="slate">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.i
                key={i}
                initial={{ y: '101%', skewX: -13.5 }}
                animate={slate.phase === 'in' ? { y: '0%', skewX: -13.5 } : { y: '-101%', skewX: -13.5 }}
                transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1], delay: (slate.phase === 'in' ? i : 4 - i) * 0.045 }}
                onAnimationComplete={() => {
                  if (i !== 4 && slate.phase === 'in') return
                  if (i !== 0 && slate.phase === 'out') return
                  if (slate.phase === 'in') { slate.apply(); setTimeout(() => setSlate({ ...slate, phase: 'out' }), 90) }
                  else setSlate(null)
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </RouteCtx.Provider>
  )
}

/* Magnetic: the element leans toward the pointer a little. */
export function useMagnetic(strength = 0.25) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !matchMedia('(hover: hover)').matches) return
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      el.style.translate = `${dx * strength}px ${dy * strength}px`
    }
    const leave = () => { el.style.translate = '0px 0px' }
    el.style.transition = 'translate .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1), background .3s, color .3s'
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [strength])
  return ref
}

export function Img({ src, alt = '', className = '', style, eager }) {
  const [ok, setOk] = useState(false)
  const [real, setReal] = useState(() => syncSrc(src))
  useEffect(() => {
    let dead = false
    const now = syncSrc(src)
    if (now) setReal(now)
    else resolveSrc(src).then((u) => !dead && setReal(u)).catch(() => {})
    return () => { dead = true }
  }, [src])
  return <img src={real || undefined} alt={alt} className={className} style={{ opacity: ok ? 1 : 0, transition: 'opacity .8s cubic-bezier(.22,1,.36,1)', ...style }} onLoad={() => setOk(true)} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
}

/* The academy leader: a countdown with the sweep, the crosshair and the rings. Used wherever we wait. */
export function Leader({ size = 88, label = 'Threading' }) {
  const [n, setN] = useState(3)
  useEffect(() => { const id = setInterval(() => setN((x) => (x <= 1 ? 3 : x - 1)), 900); return () => clearInterval(id) }, [])
  return (
    <div className="leader" style={{ '--s': `${size}px` }} role="status" aria-label={label}>
      <div className="leader-dial">
        <i className="leader-sweep" key={n} />
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="38" />
          <path d="M50 0V100M0 50H100" />
        </svg>
        <span className="numeral leader-n">{n}</span>
      </div>
      <span className="spec">{label}</span>
    </div>
  )
}
