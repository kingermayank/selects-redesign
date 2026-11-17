import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion, AnimatePresence, LayoutGroup, useMotionValue, animate } from 'framer-motion'
import { Mark, Clap, BarProgress, Poster, Counter, Img, useRoute } from '../components/ui.jsx'
import Assembly from '../components/Assembly.jsx'
import { films, film, wall, search, poster, backdrop, colour, ids as byTitles } from '../lib/films.js'
import { scoreAll, archetype, yourColour, insights } from '../lib/taste.js'
import { useStore, setState, getState, tick } from '../lib/store.js'
import { createDevelop } from '../gl/develop.js'
import { webglOK } from '../gl/reel.js'
import './onboarding.css'

const STEPS = ['splash', 'name', 'positive', 'negative', 'neutral', 'hour', 'import', 'reading', 'reveal', 'insights']
const COUNTED = ['name', 'positive', 'negative', 'neutral', 'hour', 'import', 'reveal', 'insights']
const MARK_FOR = { name: 'mark', positive: 'wide', negative: 'strike', neutral: 'fan', hour: 'rise', import: 'tight', reveal: 'mark', insights: 'mark' }

export default function Onboarding() {
  const s = useStore()
  const [step, setStep] = useState('splash')
  const [dir, setDir] = useState(1)
  const { go } = useRoute()
  const idx = STEPS.indexOf(step)
  const next = useCallback(() => { setDir(1); tick(); setStep(STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)]) }, [step])
  const back = () => { setDir(-1); const i = STEPS.indexOf(step); setStep(STEPS[i - 1 === 7 ? 6 : Math.max(1, i - 1)]) }
  useEffect(() => { window.scrollTo(0, 0) }, [step])

  const finish = () => {
    setState({ onboarded: true, colour: yourColour(getState().positive) })
    go('home', { wipe: true })
  }

  const chrome = !['splash', 'reading'].includes(step)
  const ci = COUNTED.indexOf(step)

  return (
    <div className={`ob ob-${step}`}>
      {chrome && (
        <header className="ob-top">
          <button className="ob-back link-spec" onClick={idx <= 1 ? () => go('', { wipe: true }) : back} aria-label="Back">
            <span className="ob-chev"><Arrow dir="left" /></span> {idx <= 1 ? 'Selects' : 'Back'}
          </button>
          <BarProgress total={COUNTED.length} at={ci} />
          <span className="spec ob-count">{String(ci + 1).padStart(2, '0')} / {String(COUNTED.length).padStart(2, '0')}</span>
        </header>
      )}
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.main
          key={step}
          className="ob-stage"
          custom={dir}
          initial={{ opacity: 0, y: dir * 28 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, y: dir * -18, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
        >
          {step === 'splash' && <Splash onDone={next} />}
          {step === 'name' && <Name s={s} next={next} />}
          {step === 'positive' && <Positive s={s} next={next} />}
          {step === 'negative' && <Negative s={s} next={next} />}
          {step === 'neutral' && <Neutral s={s} next={next} />}
          {step === 'hour' && <Hour s={s} next={next} />}
          {step === 'import' && <Import s={s} next={next} />}
          {step === 'reading' && <Reading s={s} next={next} />}
          {step === 'reveal' && <Reveal s={s} next={next} />}
          {step === 'insights' && <Insights s={s} next={finish} />}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

/* shared: the question block + the bars above it */
function Q({ layout, kicker, title, sub, children, lit = true }) {
  return (
    <div className="q">
      <div className="q-mark"><Mark size={64} layout={layout} lit={2} /></div>
      {kicker && <p className={`spec ${lit ? 'lit' : ''}`}>{kicker}</p>}
      <h1 className="q-h">{title}</h1>
      {sub && <p className="spec q-sub">{sub}</p>}
      {children}
    </div>
  )
}
function CTA({ label, onClick, disabled, secondary, onSecondary, lit }) {
  return (
    <div className="ob-cta">
      {secondary && <button className="link-spec" onClick={onSecondary}>{secondary}</button>}
      <button className={`btn block ${lit ? 'lit' : ''}`} onClick={onClick} disabled={disabled}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={label} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            {label}
          </motion.span>
        </AnimatePresence>
        <span className="arr"><Arrow /></span>
      </button>
    </div>
  )
}

/* ── 0 · SPLASH: the clapstick claps shut ──────────────────── */
function Splash({ onDone }) {
  const [shut, setShut] = useState(false)
  useEffect(() => { const t = setTimeout(onDone, 2900); return () => clearTimeout(t) }, [])
  return (
    <div className="splash" onClick={onDone}>
      <Clap size={148} delay={0.35} onDone={() => setShut(true)} />
      <motion.div className="splash-word" initial={{ opacity: 0, letterSpacing: '0.5em' }} animate={shut ? { opacity: 1, letterSpacing: '0.01em' } : {}} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}>
        SELECTS
      </motion.div>
      <motion.p className="spec" initial={{ opacity: 0 }} animate={shut ? { opacity: 1 } : {}} transition={{ delay: 0.3, duration: 0.8 }}>The take worth keeping</motion.p>
    </div>
  )
}

/* ── 1 · NAME: the ticket prints as you type ───────────────── */
function Name({ s, next }) {
  const [v, setV] = useState(s.name || '')
  const save = () => { setState({ name: v.trim() }); next() }
  const shown = (v.trim() || 'YOUR NAME').toUpperCase()
  return (
    <div className="ob-split">
      <Q layout="mark" title="What should the ticket say?" />
      <div className="ob-right center">
        <motion.div className="name-ticket" initial={{ rotate: -4, y: 30, opacity: 0 }} animate={{ rotate: -2.5, y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 16 }}>
          <div className="nt-l">
            <span className="spec">Selects · admit one</span>
            <div className="nt-name">
              {shown.split('').map((ch, i) => (
                <motion.span key={i + ch} initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.35 }}>{ch === ' ' ? ' ' : ch}</motion.span>
              ))}
            </div>
            <div className="nt-row"><span className="spec">Screen 01</span><span className="spec">Row F · 07</span><span className="spec">Tonight</span></div>
          </div>
          <div className="nt-r"><Mark size={30} ink="#0a0a0b" /><span className="numeral">No. 0001</span></div>
        </motion.div>
        <form className="name-form" onSubmit={(e) => { e.preventDefault(); if (v.trim()) save() }}>
          <label className="field">
            <input autoFocus value={v} maxLength={18} onChange={(e) => { setV(e.target.value); tick(4) }} placeholder="your first name" aria-label="Your first name" autoComplete="given-name" />
          </label>
        </form>
      </div>
      <CTA label={v.trim() ? `Print it, ${v.trim().split(' ')[0]}` : 'Type a name'} onClick={save} disabled={!v.trim()} />
    </div>
  )
}

/* ── 2 · POSITIVE: the theatre question ────────────────────── */
function Positive({ s, next }) {
  const [q, setQ] = useState('')
  const picks = s.positive
  const base = useMemo(() => wall('positive'), [])
  const list = useMemo(() => {
    if (q.trim()) return search(q, 36)
    if (!picks.length) return base.slice(0, 36)
    const near = scoreAll({ positive: picks }).slice(0, 30).map((e) => e.f)
    const seen = new Set([...picks, ...near.map((f) => f.id)])
    return [...picks.map(film), ...near, ...base.filter((f) => !seen.has(f.id))].slice(0, 39)
  }, [q, picks.join(',')])
  const toggle = (id) => {
    tick(picks.includes(id) ? 4 : 10)
    setState((st) => ({ positive: st.positive.includes(id) ? st.positive.filter((x) => x !== id) : [...st.positive, id].slice(-5) }))
  }
  return (
    <div className="ob-split wall-split">
      <Q layout="wide" title="If you could rent a theatre and watch one film in it forever, what is it?">
        <Tray ids={picks} onRemove={toggle} />
      </Q>
      <div className="ob-right">
        <Search value={q} onChange={setQ} placeholder="search any film, director, actor" />
        <Wall list={list} picked={picks} onPick={toggle} kind="positive" label={q ? `Results for “${q}”` : picks.length ? 'Re-sorted around your pick' : 'Trending this week and always'} />
      </div>
      <CTA label={picks.length ? `Next · ${picks.length} kept` : 'Pick at least one'} onClick={next} disabled={!picks.length} />
    </div>
  )
}

/* ── 3 · NEGATIVE: strike what never landed ────────────────── */
function Negative({ s, next }) {
  const [q, setQ] = useState('')
  const base = useMemo(() => wall('negative').filter((f) => !s.positive.includes(f.id)), [])
  const list = q.trim() ? search(q, 36).filter((f) => !s.positive.includes(f.id)) : base.slice(0, 36)
  const toggle = (id) => {
    tick(s.negative.includes(id) ? 4 : [10, 40, 10])
    setState((st) => ({ negative: st.negative.includes(id) ? st.negative.filter((x) => x !== id) : [...st.negative, id] }))
  }
  return (
    <div className="ob-split wall-split">
      <Q layout="strike" title="What did everyone love that never landed for you?">
        <div className="struck-list">
          {s.negative.map((id) => film(id)).filter(Boolean).map((f) => (
            <motion.button key={f.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="struck-chip" onClick={() => toggle(f.id)}>{f.t}<span>×</span></motion.button>
          ))}
        </div>
      </Q>
      <div className="ob-right">
        <Search value={q} onChange={setQ} placeholder="search the ones you resisted" />
        <Wall list={list} picked={s.negative} onPick={toggle} kind="negative" label={q ? `Results for “${q}”` : 'Everyone loved these'} />
      </div>
      <CTA label={s.negative.length ? `Next · ${s.negative.length} struck` : 'Next · or skip'} onClick={next} />
    </div>
  )
}

function Search({ value, onChange, placeholder }) {
  return (
    <label className="field ob-search">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.5" stroke="currentColor" fill="none" strokeWidth="1.3" /><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button className="spec" onClick={() => onChange('')} type="button">Clear</button>}
    </label>
  )
}

function Wall({ list, picked, onPick, kind, label }) {
  return (
    <div className="wall-wrap">
      <LayoutGroup>
        <div className="wall">
          {list.map((f, i) => {
            const on = picked.includes(f.id)
            return (
              <motion.button
                layout
                key={f.id}
                className={`w-item ${on ? 'on' : ''} ${kind}`}
                onClick={() => onPick(f.id)}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ layout: { type: 'spring', stiffness: 260, damping: 30 }, opacity: { duration: 0.4, delay: Math.min(i, 18) * 0.02 } }}
                whileTap={{ scale: 0.95 }}
                aria-pressed={on}
                aria-label={`${f.t} (${f.y})`}
              >
                <Poster id={f.id} alt="" struck={kind === 'negative' && on} cursor={kind === 'negative' ? (on ? 'UNSTRIKE' : 'STRIKE') : on ? 'REMOVE' : 'KEEP'}>
                  {kind === 'negative' && <span className="strike-bar" />}
                </Poster>
                {kind === 'positive' && on && (
                  <motion.span className="kept-tag" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 24 }}>
                    <i className="bar-atom" />{String(picked.indexOf(f.id) + 1).padStart(2, '0')}
                  </motion.span>
                )}
                <span className="w-cap">{f.t}<em>{f.y}</em></span>
              </motion.button>
            )
          })}
        </div>
      </LayoutGroup>
      {!list.length && <p className="spec" style={{ padding: '40px 0' }}>No match.</p>}
    </div>
  )
}

/* the tray: a short strip of film that fills as you pick */
function Tray({ ids, onRemove }) {
  const slots = [0, 1, 2, 3, 4]
  return (
    <div className="tray" aria-label="Your picks">
      <div className="tray-strip">
        {slots.map((i) => {
          const id = ids[i]
          return (
            <div key={i} className={`tray-frame ${id ? 'full' : ''}`}>
              <AnimatePresence>
                {id && (
                  <motion.button key={id} className="tray-img" onClick={() => onRemove(id)} initial={{ y: -40, opacity: 0, rotate: -8 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }} data-cursor="REMOVE">
                    <img src={poster(id)} alt={film(id)?.t || ''} />
                  </motion.button>
                )}
              </AnimatePresence>
              {!id && <span className="spec">{String(i + 1).padStart(2, '0')}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── 4 · NEUTRAL ───────────────────────────────────────────── */
const AXES = [
  { v: 'writing', l: 'A flawless screenplay', sub: 'Structure · dialogue · the writing', layout: 'tight' },
  { v: 'room', l: 'The room and the projection', sub: '70mm · the crowd · the dark', layout: 'wide' },
  { v: 'both', l: 'Both, depending on the night', sub: 'And I will tell you which', layout: 'fan' },
]
function Neutral({ s, next }) {
  const toggle = (v) => { tick(8); setState((st) => ({ axes: st.axes.includes(v) ? st.axes.filter((x) => x !== v) : [...st.axes.filter((x) => (v === 'both' ? false : x !== 'both')), v] })) }
  return (
    <div className="ob-split">
      <Q layout="fan" title="What are you actually there for?" sub="Pick any." />
      <div className="ob-right center">
        <div className="axes">
          {AXES.map((a, i) => {
            const on = s.axes.includes(a.v)
            return (
              <motion.button key={a.v} className={`axis ${on ? 'on' : ''}`} onClick={() => toggle(a.v)} aria-pressed={on} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} whileTap={{ scale: 0.985 }}>
                <span className="axis-mark"><Mark size={30} five layout={on ? a.layout : 'mark'} lit={on ? 2 : -1} ink={on ? 'var(--fg)' : 'var(--fg-4)'} /></span>
                <span className="axis-txt"><b>{a.l}</b><span className="spec">{a.sub}</span></span>
                <span className={`axis-check ${on ? 'on' : ''}`} />
              </motion.button>
            )
          })}
        </div>
      </div>
      <CTA label="Continue" onClick={next} disabled={!s.axes.length} />
    </div>
  )
}

/* ── 5 · HOUR: a dial from dusk to the small hours ─────────── */
function Hour({ s, next }) {
  // range: 12:00 (0) → 03:00 (+15h). value in hours after noon.
  const [h, setH] = useState(() => Math.min(15, ((s.hour ?? 22) - 12 + 24) % 24))
  const ref = useRef(null)
  const MIN = 0, MAX = 15
  const clamp = (x) => Math.max(MIN, Math.min(MAX, x))
  const ang = -120 + (h / MAX) * 240
  const setFromPointer = (e) => {
    const r = ref.current.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    let a = (Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI
    a = Math.max(-120, Math.min(120, a))
    const nh = Math.round(clamp(((a + 120) / 240) * MAX) * 4) / 4
    if (Math.floor(nh) !== Math.floor(h)) tick(5)
    setH(nh)
  }
  const real = (12 + h) % 24
  const hh = Math.floor(real), mm = Math.round((real - hh) * 60)
  const label = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const line = real >= 22 || real < 4 ? (real >= 0 && real < 4 ? 'The small hours. You and the projectionist.' : 'Late. Good. Tickets will lean darker.') : real >= 18 ? 'Prime time. Long ones on Fridays.' : 'A matinee person. Rare, and noted.'
  const sky = h / MAX
  const save = () => { setState({ hour: Math.floor(real) }); next() }
  return (
    <div className="ob-split" style={{ '--sky': sky }}>
      <div className="hour-sky" style={{ background: `radial-gradient(80% 60% at 50% 100%, hsl(${22 - sky * 230} ${70 - sky * 30}% ${32 - sky * 22}% / ${0.55 - sky * 0.2}), transparent 70%)` }} />
      <Q layout="rise" title="When do the lights usually go down?" />
      <div className="ob-right center">
        <div className="dial" ref={ref} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFromPointer(e) }} onPointerMove={(e) => e.buttons && setFromPointer(e)} data-cursor="DRAG" role="slider" aria-valuemin={12} aria-valuemax={27} aria-valuenow={12 + h} aria-valuetext={`${label} ${ampm}`} tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setH((x) => clamp(x + 0.25)); if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setH((x) => clamp(x - 0.25)) }}>
          <svg viewBox="0 0 300 300" className="dial-svg" aria-hidden="true">
            {Array.from({ length: 61 }).map((_, i) => {
              const a = (-120 + i * 4) * (Math.PI / 180)
              const major = i % 4 === 0
              const r1 = major ? 118 : 124, r2 = 132
              const on = -120 + i * 4 <= ang
              return <line key={i} x1={150 + Math.sin(a) * r1} y1={150 - Math.cos(a) * r1} x2={150 + Math.sin(a) * r2} y2={150 - Math.cos(a) * r2} stroke={on ? (i * 4 > 160 ? '#ff3b14' : '#efede9') : '#2c2c31'} strokeWidth={major ? 2 : 1.2} />
            })}
            {[['12', -120], ['6P', -24], ['10P', 40], ['3A', 120]].map(([t, a]) => (
              <text key={t} x={150 + Math.sin((a * Math.PI) / 180) * 100} y={154 - Math.cos((a * Math.PI) / 180) * 100} textAnchor="middle" className="dial-lbl">{t}</text>
            ))}
            <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: '150px 150px', transition: 'transform .12s' }}>
              <polygon points="146,8 158,8 164,40 152,40" fill="#ff3b14" />
            </g>
          </svg>
          <div className="dial-read">
            <span className="numeral dial-time">{label}</span>
            <span className="spec">{ampm}</span>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={line} className="dial-line" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{line}</motion.p>
        </AnimatePresence>
      </div>
      <CTA label={`Lights down at ${label} ${ampm}`} onClick={save} />
    </div>
  )
}

/* ── 6 · IMPORT ────────────────────────────────────────────── */
function Import({ s, next }) {
  const [u, setU] = useState(s.letterboxd || '')
  const [linked, setLinked] = useState(!!s.letterboxd)
  const link = () => { if (!u.trim()) return; tick(12); setState({ letterboxd: u.trim().replace(/^@/, '') }); setLinked(true) }
  return (
    <div className="ob-split">
      <Q layout="tight" kicker="Optional" title="I can read your last fifty in four seconds." lit={false} />
      <div className="ob-right center">
        <div className="imp">
          <div className="imp-tile main">
            <div className="imp-row"><b>Letterboxd</b>{linked && <motion.span className="spec lit" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}><i className="live-dot" /> Linked</motion.span>}</div>
            <form className="imp-form" onSubmit={(e) => { e.preventDefault(); link() }}>
              <label className="field">
                <span className="pre">letterboxd.com/</span>
                <input value={u} onChange={(e) => { setU(e.target.value); setLinked(false) }} placeholder="username" autoCapitalize="none" spellCheck={false} aria-label="Letterboxd username" />
              </label>
              <button className="btn ghost" type="submit" disabled={!u.trim() || linked}>{linked ? 'Linked' : 'Link'}</button>
            </form>
          </div>
        </div>
      </div>
      <CTA label={linked ? 'Read me' : 'Read my picks'} onClick={next} secondary={linked ? null : 'Skip for now'} onSecondary={next} lit />
    </div>
  )
}

/* ── 7 · READING: the only honest loading screen ───────────── */
function Reading({ s, next }) {
  const cv = useRef(null)
  const [p, setP] = useState(0)
  const reads = useMemo(() => scoreAll(s).slice(0, 24).map((e) => e.f), [])
  const total = s.positive.length + s.negative.length + reads.length
  const [fallback] = useState(() => !webglOK())
  useEffect(() => {
    let inst, dead = false
    if (fallback) {
      const t0 = performance.now()
      const id = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 5200); setP(k); if (k >= 1) { clearInterval(id); next() } }, 50)
      return () => clearInterval(id)
    }
    createDevelop(cv.current, {
      posters: s.positive.slice(0, 5).map(poster),
      stills: [...s.positive, ...reads.map((f) => f.id)].slice(0, 12).map(backdrop),
      onProgress: (k) => !dead && setP(k),
      onDone: () => !dead && setTimeout(next, 250),
    }).then((x) => (dead ? x.dispose() : (inst = x))).catch(() => next())
    return () => { dead = true; inst && inst.dispose() }
  }, [])
  const n = Math.round(p * total)
  const phase = p < 0.2 ? 'Sampling your posters' : p < 0.55 ? 'Reading every frame' : p < 0.85 ? 'Developing the negative' : 'Fixing the print'
  return (
    <div className="reading">
      {fallback ? (
        <div className="reading-fb">{s.positive.map((id, i) => <motion.img key={id} src={poster(id)} alt="" initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: 80, filter: 'blur(12px)' }} transition={{ delay: 1 + i * 0.3, duration: 1.6 }} />)}</div>
      ) : (
        <canvas ref={cv} className="reading-cv" />
      )}
      <div className="reading-big">
        <span className="numeral">{n}</span>
        <span className="spec">films read</span>
      </div>
      <motion.div className="reading-pill" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
        <span className="spinner" /> <span>{phase}</span> <b className="numeral">{n}</b><span className="dim">/{total}</span>
      </motion.div>
    </div>
  )
}

/* ── 8 · REVEAL: the negative ──────────────────────────────── */
function Reveal({ s, next }) {
  const a = useMemo(() => archetype(s), [])
  const c = useMemo(() => yourColour(s.positive), [])
  const reads = useMemo(() => scoreAll(s).slice(0, 22).map((e) => e.f.id), [])
  const [stage, setStage] = useState(0)
  useEffect(() => { const t = [setTimeout(() => setStage(1), 300), setTimeout(() => setStage(2), 1300)]; return () => t.forEach(clearTimeout) }, [])
  useEffect(() => { setState({ colour: c, archetype: a.name }) }, [])
  return (
    <div className="reveal" style={{ '--you': c }}>
      <div className="reveal-wash" />
      <div className="reveal-graph">
        <Assembly ids={[...s.positive, ...reads]} you={c} height={'100%'} youLabel={(s.name || 'YOU').toUpperCase()} />
      </div>
      <div className="reveal-copy">
        <p className="spec">Your negative</p>
        <h1 className="reveal-name fit" aria-label={a.name} style={{ '--n': a.name.length }}>
          {a.name.split('').map((ch, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: '0.4em', filter: 'blur(10px)' }} animate={stage >= 1 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}} transition={{ delay: i * 0.045, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>{ch}</motion.span>
          ))}
        </h1>
        <motion.p className="reveal-line" initial={{ opacity: 0 }} animate={stage >= 2 ? { opacity: 1 } : {}} transition={{ duration: 0.9 }}>{a.line}</motion.p>
        <motion.div className="reveal-meta" initial={{ opacity: 0, y: 10 }} animate={stage >= 2 ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.25, duration: 0.8 }}>
          <span className="swatch" style={{ background: c }} />
          <div><span className="spec">Your colour</span><b className="numeral">{c}</b></div>
        </motion.div>
      </div>
      <CTA label="Insights" onClick={next} />
    </div>
  )
}

/* ── 9 · INSIGHTS ──────────────────────────────────────────── */
function Insights({ s, next }) {
  const list = useMemo(() => insights(s), [])
  const c = s.colour || yourColour(s.positive)
  return (
    <div className="ins" style={{ '--you': c }}>
      <div className="ins-head">
        <h1 className="q-h">{s.name ? `${s.name.split(' ')[0]}, here is what I read.` : 'Here is what I read.'}</h1>
        <div className="ins-bars">{list.map((x, i) => <i key={i} className="bar-atom" style={{ color: x.sharp ? 'var(--select)' : 'var(--fg-3)' }} />)}</div>
      </div>
      <div className="ins-grid">
        {list.map((x, i) => (
          <motion.article key={x.k} className={`ins-card ${x.sharp ? 'sharp' : ''}`} initial={{ opacity: 0, y: 40, rotate: i % 2 ? 1.5 : -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.12 + i * 0.09, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
            <span className={`spec ${x.sharp ? 'lit' : ''}`}>{x.k}</span>
            <b className="ins-big">{x.big}</b>
            <p>{x.line}</p>
          </motion.article>
        ))}
      </div>
      <CTA label="Open the Assembly" onClick={next} lit />
    </div>
  )
}
