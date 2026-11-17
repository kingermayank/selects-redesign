import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react'
import { motion, animate, useInView, AnimatePresence } from 'framer-motion'
import { poster, syncSrc, resolveSrc } from '../lib/films.js'

/* ─────────────────────────────────────────────────────────────
   THE MARK — five bars, one lit. Everything after the splash is
   these same five bars rearranging.
   ───────────────────────────────────────────────────────────── */
const BAR = '0,100 14,100 38,0 24,0'
const LAYOUTS = {
  mark: (i) => ({ x: -10 + i * 20, y: 0, rotate: 0, scaleY: 1 }),
  open: (i) => ({ x: -10 + i * 20 + 6, y: -22 - i * 3, rotate: -26 - i * 3.5, scaleY: 1 }),
  wide: (i) => ({ x: -26 + i * 28, y: 0, rotate: 0, scaleY: 1 }),
  tight: (i) => ({ x: 8 + i * 12, y: 0, rotate: 0, scaleY: 1 }),
  fan: (i) => ({ x: -10 + i * 20, y: Math.abs(i - 2) * 4, rotate: (i - 2) * 10, scaleY: 1 }),
  strike: (i) => (i === 2 ? { x: 22, y: 6, rotate: 52, scaleY: 1.18 } : { x: -10 + i * 20, y: 0, rotate: 0, scaleY: 1 }),
  rise: (i) => ({ x: -10 + i * 20, y: [14, 6, 0, 6, 14][i], rotate: 0, scaleY: [0.72, 0.86, 1, 0.86, 0.72][i] }),
}
const BASE_PTS = [[0, 100], [14, 100], [38, 0], [24, 0]]
// a layout applied to the bar's four corners; pivot is the bar's bottom-left
function barCoords({ x, y, rotate, scaleY }) {
  const a = (rotate * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return BASE_PTS.flatMap(([px, py]) => {
    const ly = (py - 100) * scaleY
    return [px * c - ly * s + x, px * s + ly * c + 100 + y]
  })
}
const toPts = (a) => `${a[0].toFixed(2)},${a[1].toFixed(2)} ${a[2].toFixed(2)},${a[3].toFixed(2)} ${a[4].toFixed(2)},${a[5].toFixed(2)} ${a[6].toFixed(2)},${a[7].toFixed(2)}`

export function Mark({ size = 40, layout = 'mark', lit = 2, litColour = 'var(--select)', ink = 'var(--fg)', clip = true, className = '', style, spring }) {
  const id = useRef('m' + Math.random().toString(36).slice(2, 8)).current
  const L = LAYOUTS[layout] || LAYOUTS.mark
  const polys = useRef([])
  const cur = useRef(null)
  const targets = [0, 1, 2, 3, 4].map((i) => barCoords(L(i)))
  if (!cur.current) cur.current = targets.map((t) => t.slice())
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
  }, [layout])
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" overflow="visible">
      <defs>
        <clipPath id={id}>
          {clip ? <rect x="0" y="0" width="100" height="100" /> : <rect x="-140" y="-180" width="380" height="320" />}
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <polygon key={i} ref={(el) => (polys.current[i] = el)} points={toPts(cur.current[i])} style={{ fill: i === lit ? litColour : ink, transition: 'fill .45s cubic-bezier(.22,1,.36,1)' }} />
        ))}
      </g>
    </svg>
  )
}

export function Lockup({ size = 22, gap = 12, className = '', onClick }) {
  return (
    <button className={`lockup ${className}`} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap, minHeight: 44 }} aria-label="Selects home">
      <Mark size={size} />
      <span style={{ fontVariationSettings: "'wdth' 125", fontWeight: 800, fontSize: size * 0.72, letterSpacing: '0.04em' }}>SELECTS</span>
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
    const t3 = setTimeout(() => onDone && onDone(), delay * 1000 + 1500)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [])
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={state === 'mark' ? { scale: [1.06, 1], opacity: 1, x: [0, -3, 2, 0] } : { scale: 0.96, opacity: 1 }}
      transition={{ duration: state === 'mark' ? 0.32 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Mark size={size} layout={state} clip={state === 'mark'} lit={lit} spring={state === 'mark' ? { type: 'spring', stiffness: 1400, damping: 38 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
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
      window.scrollTo(0, 0)
    }
    if (!wipe || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
    setSlate({ phase: 'in', apply })
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
