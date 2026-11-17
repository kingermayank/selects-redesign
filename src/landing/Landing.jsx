import { useEffect, useRef, useState, useMemo } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion, useScroll, useTransform, useInView, useSpring, useMotionValueEvent } from 'framer-motion'
import Lenis from 'lenis'
import { Mark, Lockup, Rise, Counter, Poster, Img, useRoute, useMagnetic, Clap } from '../components/ui.jsx'
import Ticket from '../components/Ticket.jsx'
import { TabIcon } from '../components/Icons.jsx'
import Assembly from '../components/Assembly.jsx'
import { film, films, backdrop, poster, colour, logo, fmtRuntime, ids as byTitles } from '../lib/films.js'
import { yourColour, ARCHETYPES } from '../lib/taste.js'
import { setState, getState } from '../lib/store.js'
import { createReel, webglOK } from '../gl/reel.js'
import './landing.css'

const HERO_STILLS = [949, 335984, 843, 64690, 693134, 655, 11104, 62, 76341, 376867, 947, 152601, 1538, 11220, 1398, 9693] // Heat, 2049, Mood for Love, Drive, Dune 2, Paris Texas, Chungking, 2001, Fury Road, Moonlight, Lawrence, Her, Collateral, Fallen Angels, Stalker, Children of Men

export default function Landing() {
  const { go } = useRoute()
  const lenis = useRef(null)
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const l = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 })
    lenis.current = l
    let raf
    const loop = (t) => { l.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); l.destroy() }
  }, [])
  const to = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    lenis.current ? lenis.current.scrollTo(el, { offset: -20, duration: 1.6 }) : el.scrollIntoView({ behavior: 'smooth' })
  }
  const start = (lb) => {
    setState({ letterboxd: (lb || '').trim().replace(/^@/, ''), onboarded: false })
    go('start', { wipe: true })
  }
  const returning = getState().onboarded

  return (
    <div className="landing">
      <Nav to={to} start={() => (returning ? go('home', { wipe: true }) : start(''))} returning={returning} />
      <Hero start={start} />
      <Manifesto />
      <TicketSection />
      <StripSection />
      <AssemblySection />
      <Negatives start={() => start('')} />
      <Devices />
      <Vocabulary />
      <Final start={start} />
      <Footer go={go} />
    </div>
  )
}

/* ── NAV ───────────────────────────────────────────────────── */
function Nav({ to, start, returning }) {
  const [solid, setSolid] = useState(false)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = scrollY
    const on = () => {
      setSolid(scrollY > 40)
      setHidden(scrollY > 600 && scrollY > last + 2)
      if (scrollY < last - 2) setHidden(false)
      last = scrollY
    }
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])
  const mag = useMagnetic(0.2)
  return (
    <header className={`l-nav ${solid ? 'solid' : ''} ${hidden ? 'hide' : ''}`}>
      <Lockup size={20} onClick={() => scrollTo({ top: 0, behavior: 'smooth' })} />
      <nav className="l-links">
        {[['How it reads', 'reads'], ['The Ticket', 'ticket'], ['The Assembly', 'assembly'], ['The Negative', 'negative']].map(([l, id]) => (
          <button key={id} className="link-spec" onClick={() => to(id)}>{l}</button>
        ))}
      </nav>
      <button ref={mag} className="btn nav-cta" onClick={start}>{returning ? 'Open Selects' : 'Try now'}<span className="arr"><Arrow /></span></button>
    </header>
  )
}

/* ── HERO ──────────────────────────────────────────────────── */
function Hero({ start }) {
  const canvas = useRef(null)
  const sec = useRef(null)
  const reel = useRef(null)
  const [gl, setGl] = useState(true)
  const [ready, setReady] = useState(false)
  const [lb, setLb] = useState('')
  const { scrollYProgress } = useScroll({ target: sec, offset: ['start start', 'end start'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => reel.current && reel.current.setScroll(v))
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-28%'])
  const textO = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  useEffect(() => {
    if (!webglOK()) { setGl(false); return }
    let dead = false
    const portrait = innerHeight > innerWidth * 1.1
    createReel(canvas.current, { images: HERO_STILLS.map(backdrop), portrait, onReady: () => !dead && setReady(true) })
      .then((r) => { if (dead) r.dispose(); else reel.current = r })
      .catch(() => setGl(false))
    return () => { dead = true; reel.current && reel.current.dispose() }
  }, [])

  return (
    <section className="hero" ref={sec}>
      <div className={`hero-gl ${ready ? 'on' : ''}`}>
        {gl ? <canvas ref={canvas} /> : <FallbackStrip />}
      </div>
      <div className="hero-vignette" />
      <motion.div className="hero-copy" style={{ y: textY, opacity: textO }}>
        <h1 className="verdict hero-h">
          <Rise text={'The take\nworth keeping.'} delay={0.35} stagger={0.09} />
        </h1>
        <motion.div className="hero-cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
          <p className="lead hero-lead">Three films for tonight, read from your diary.</p>
          <form className="hero-form" onSubmit={(e) => { e.preventDefault(); start(lb) }}>
            <label className="field hero-field">
              <span className="pre">letterboxd.com/</span>
              <input id="hero-lb" value={lb} onChange={(e) => setLb(e.target.value)} placeholder="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Letterboxd username" />
            </label>
            <button className="btn lit hero-go" type="submit">Read me <span className="arr"><Arrow /></span></button>
          </form>
          <button type="button" className="text-link" onClick={() => start('')}>Start without Letterboxd <Arrow /></button>
        </motion.div>
      </motion.div>
    </section>
  )
}

function FallbackStrip() {
  return (
    <div className="fallback-strip">
      {HERO_STILLS.slice(0, 8).map((id) => <Img key={id} src={backdrop(id)} />)}
    </div>
  )
}

/* ── MANIFESTO: words light as you read them ───────────────── */
function Manifesto() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] })
  const parts = [
    'Your', 'diary', 'is', 'the', 'most', 'honest', 'review', 'you', 'have', 'written.', { p: 949 }, { p: 843 },
    'Selects', 'reads', 'it', { p: 1398 }, 'and', 'hands', 'you', 'three.', { p: 655 },
  ]
  return (
    <section id="reads" className="manifesto" ref={ref}>
      <p className="m-text">
        {parts.map((w, i) => (
          <Word key={i} i={i} n={parts.length} w={w} progress={scrollYProgress} />
        ))}
      </p>
      <div className="m-stats">
        {[
          [4, 's', 'to read your last fifty'],
          [3, '', 'films a day'],
          [1, '', 'always a reach'],
        ].map(([n, suf, l], i) => (
          <div key={i} className="m-stat">
            <span className="numeral"><Counter to={n} duration={1.6 + i * 0.2} />{suf}</span>
            <span className="spec">{l}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
function Word({ w, i, n, progress }) {
  const s = i / n
  const o = useTransform(progress, [s - 0.06, s + 0.02], [0.14, 1])
  const y = useTransform(progress, [s - 0.06, s + 0.02], [6, 0])
  if (typeof w === 'object') return <Chip id={w.p} s={s} i={i} progress={progress} />
  return <motion.span style={{ opacity: o, y, display: 'inline-block' }}>{w}&nbsp;</motion.span>
}

function Chip({ id, s, i, progress }) {
  const f = film(id)
  const o = useTransform(progress, [s - 0.06, s + 0.02], [0.14, 1])
  const r = useTransform(progress, [s - 0.08, s + 0.04], [-18, i % 2 ? 5 : -5])
  const sc = useTransform(progress, [s - 0.08, s + 0.04], [0.4, 1])
  return (
    <motion.span className="m-chip" style={{ rotate: r, scale: sc, opacity: o }}>
      <img src={poster(id)} alt={f ? f.t : ''} />
    </motion.span>
  )
}

/* ── THE TICKET ────────────────────────────────────────────── */
function TicketSection() {
  const [a, b, c] = byTitles('Thief', 'Le Samouraï', 'In the Mood for Love')
  const picks = [
    { id: a, why: 'Michael Mann, again. You kept Heat.', slot: 'close' },
    { id: b, why: 'A professional, a city at night, nobody wins.', slot: 'close' },
    { id: c, why: 'Same rain, warmer room. Your reach for Tuesday.', slot: 'reach' },
  ]
  const [torn, setTorn] = useState(0)
  return (
    <section id="ticket" className="t-sec">
      <div className="t-copy">
        <Rise as="h2" className="verdict sec-h" text={'Three films.\nOne is a reach.'} />
        <p className="spec t-hint">{torn ? 'Kept for tonight.' : <>Tear a stub to keep it <Arrow /></>}</p>
      </div>
      <div className="t-stack">
        {picks.map((p, i) => {
          const f = film(p.id)
          if (!f) return null
          return (
            <motion.div key={p.id} initial={{ opacity: 0, x: 60, rotate: 3 }} whileInView={{ opacity: 1, x: 0, rotate: 0 }} viewport={{ once: true, margin: '-15%' }} transition={{ duration: 1.1, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }} style={{ paddingLeft: `${i * 6}%` }}>
              <Ticket f={f} why={p.why} slot={p.slot} index={i} onTear={() => setTorn((n) => n + 1)} size="l" />
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

/* ── THE STRIP: a year in bars; the dock opens under your hand ─ */
function StripSection() {
  const list = useMemo(() => films().slice().sort((a, b) => (a.y || 0) - (b.y || 0)), [])
  const [active, setActive] = useState(-1)
  const row = useRef(null)
  const bars = useRef([])
  const raf = useRef(0)
  const N = list.length
  const onMove = (clientX) => {
    const r = row.current.getBoundingClientRect()
    const p = (clientX - r.left) / r.width
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const c = p * N
      bars.current.forEach((b, i) => {
        if (!b) return
        const d = Math.abs(i - c)
        const k = Math.max(0, 1 - d / 7)
        b.style.flexGrow = 1 + k * k * 10
        b.style.transform = `skewX(-13.5deg) scaleY(${0.62 + k * 0.38})`
      })
      setActive(Math.max(0, Math.min(N - 1, Math.floor(c))))
    })
  }
  const leave = () => {
    bars.current.forEach((b) => b && ((b.style.flexGrow = 1), (b.style.transform = 'skewX(-13.5deg) scaleY(.62)')))
    setActive(-1)
  }
  const f = active >= 0 ? list[active] : null
  return (
    <section className="s-sec">
      <div className="s-head">
        <div>
          <Rise as="h2" className="verdict sec-h" text={'Everything you have\nlogged, as one strip.'} />
        </div>
      </div>
      <div className="s-stage">
        <div className="s-readout">
          {f ? (
            <motion.div key={f.id} className="s-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <img src={poster(f.id)} alt="" />
              <div>
                <div className="title s-title">{f.t}</div>
                <div className="spec">{f.y} · {f.dir[0]} · <span style={{ color: colour(f) }}>{colour(f).toUpperCase()}</span></div>
              </div>
            </motion.div>
          ) : (
            <span className="spec">Each bar, a film in its own colour</span>
          )}
        </div>
        <div
          className="s-row"
          ref={row}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerDown={(e) => onMove(e.clientX)}
          onPointerLeave={leave}
          data-cursor="SCRUB"
        >
          {list.map((x, i) => (
            <i key={x.id} ref={(el) => (bars.current[i] = el)} style={{ background: `linear-gradient(180deg, ${x.pal[0]}, ${x.pal[1] || x.pal[0]})` }} />
          ))}
        </div>
        <div className="s-axis spec"><span>1927</span><span>1960</span><span>1980</span><span>2000</span><span>2026</span></div>
      </div>
    </section>
  )
}

/* ── THE ASSEMBLY ──────────────────────────────────────────── */
function AssemblySection() {
  const ids = byTitles('Heat', 'Thief', 'Collateral', 'Drive', 'Le Samouraï', 'Miami Vice', 'The Insider', 'Manhunter', 'To Live and Die in L.A.', 'Chungking Express', 'In the Mood for Love', 'Fallen Angels', '2046', 'Blade Runner 2049', 'Blade Runner', 'Sicario', 'Prisoners', 'Arrival', 'Taxi Driver', 'Goodfellas', 'Zodiac', 'Se7en', 'The Social Network', 'There Will Be Blood', 'Phantom Thread', 'The Master', 'Magnolia')
  const extra = films().filter((f) => f.dir.some((d) => ['Michael Mann', 'Wong Kar-wai', 'Denis Villeneuve', 'Martin Scorsese', 'David Fincher', 'Paul Thomas Anderson'].includes(d))).map((f) => f.id)
  const all = [...new Set([...ids, ...extra])].slice(0, 34)
  return (
    <section id="assembly" className="a-sec">
      <div className="a-copy">
        <Rise as="h2" className="verdict sec-h" text={'Your taste, as the\npeople who made it.'} />
      </div>
      <div className="a-stage">
        <Assembly ids={all} you="#3A6E85" height={'100%'} />
      </div>
    </section>
  )
}

/* ── THE NEGATIVE: archetypes ──────────────────────────────── */
const ARCH_TITLES = {
  NOCTURNALIST: ['Heat', 'Collateral', 'Drive'],
  PROCEDURALIST: ['Zodiac', "All the President's Men", 'Memories of Murder'],
  FORMALIST: ['Stalker', '2001: A Space Odyssey', 'Barry Lyndon'],
  ROMANTIC: ['In the Mood for Love', 'Past Lives', 'Portrait of a Lady on Fire'],
  MAXIMALIST: ['Mad Max: Fury Road', 'Dune: Part Two', 'Interstellar'],
  ARCHIVIST: ['Free Solo', 'Man on Wire', 'Apollo 11'],
  DREAMER: ['Spirited Away', 'Princess Mononoke', 'Akira'],
  NERVE: ['Hereditary', 'The Shining', 'The Thing'],
}
function Negatives({ start }) {
  const sec = useRef(null)
  const track = useRef(null)
  const { scrollYProgress } = useScroll({ target: sec, offset: ['start start', 'end end'] })
  const [w, setW] = useState(0)
  useEffect(() => {
    const m = () => setW(track.current ? Math.max(0, track.current.scrollWidth - innerWidth + 64) : 0)
    m(); addEventListener('resize', m)
    return () => removeEventListener('resize', m)
  }, [])
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -w])
  const xs = useSpring(x, { stiffness: 120, damping: 30, mass: 0.4 })
  const entries = Object.entries(ARCHETYPES)
  return (
    <section id="negative" className="n-sec" ref={sec} style={{ '--len': entries.length }}>
      <div className="n-sticky">
        <div className="n-head">
          <div>
            <Rise as="h2" className="verdict sec-h" text={'Every print comes\nfrom a negative.'} />
          </div>
          <p className="lead">Eight tastes. Find yours.</p>
        </div>
        <motion.div className="n-track" ref={track} style={{ x: xs }}>
          {entries.map(([name, a], i) => {
            const ids = byTitles(...(ARCH_TITLES[name] || []))
            const c = a.hue
            return (
              <article key={name} className="n-card" style={{ '--c': c }} onClick={start} data-cursor="FIND YOURS">
                <div className="n-field">
                  <div className="n-posters">
                    {ids.map((id, k) => <img key={id} src={poster(id)} alt="" style={{ '--k': k }} />)}
                  </div>
                  <Mark size={40} className="n-mark" />
                </div>
                <div className="n-body">
                  <h3 className="n-name">{name}</h3>
                  <p>{a.line}</p>
                </div>
              </article>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ── DEVICES: pocket and desk ──────────────────────────────── */
function Devices() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const py = useTransform(scrollYProgress, [0, 1], [120, -120])
  const dy = useTransform(scrollYProgress, [0, 1], [40, -40])
  const ticket = byTitles('Thief', 'Le Samouraï', 'In the Mood for Love').map(film)
  return (
    <section className="d-sec" ref={ref}>
      <div className="d-copy">
        <Rise as="h2" className="verdict sec-h" text={'In your pocket\nat 9:40 pm.'} />
      </div>
      <div className="d-stage">
        <motion.div className="d-desk" style={{ y: dy }}>
          <div className="d-chrome"><i /><i /><i /><span className="spec">selects.film/you</span></div>
          <div className="d-screen">
            <aside className="d-rail">
              <Mark size={18} />
              {['Home', 'Hunt', 'Library', 'You'].map((x, i) => <span key={x} className={`spec d-ri ${i === 3 ? 'on' : ''}`}><TabIcon name={x.toLowerCase()} on={i === 3} size={12} />{x}</span>)}
            </aside>
            <div className="d-main">
              <span className="spec">You · the negative</span>
              <div className="d-arch">NOCTURNALIST</div>
              <div className="d-grid">
                {byTitles('Heat', 'Collateral', 'Thief', 'Drive', 'Le Samouraï', 'Miami Vice', 'Manhunter', 'The Insider').map((id) => <img key={id} src={poster(id)} alt="" />)}
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div className="d-phone" style={{ y: py }}>
          <div className="d-notch" />
          <div className="d-pscreen">
            <div className="d-ptop"><Mark size={14} /><span className="spec">Tue 17 · ticket</span></div>
            <div className="d-ph">Tuesday’s<br />ticket.</div>
            {ticket.map((f, i) => (
              <div key={f.id} className="d-pticket" style={{ '--film': colour(f) }}>
                <Img src={backdrop(f.id)} alt="" />
                <span className="spec" style={{ color: i === 2 ? 'var(--select)' : undefined }}>{i === 2 ? 'The reach' : `Ticket 0${i + 1}`}</span>
                <b>{f.t}</b>
              </div>
            ))}
            <div className="d-tabs">{['Home', 'Hunt', 'Library', 'You'].map((x, i) => <span key={x} className={i === 0 ? 'on' : ''}><TabIcon name={x.toLowerCase()} on={i === 0} size={15} />{x}</span>)}</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ── VOCABULARY ────────────────────────────────────────────── */
const VOCAB = [
  ['The Ticket', 'Your daily three', 'Thief'],
  ['The Strip', 'Everything you logged', 'In the Mood for Love'],
  ['The Assembly', 'Your taste, as people', 'Collateral'],
  ['The Wallet', 'Your closest ten', 'Le Samouraï'],
  ['The Rabbit Hole', 'One person, every film', 'The Insider'],
  ['The Print', 'Your card to share', 'Drive'],
  ['The Cut', 'Your month as a trailer', 'Blade Runner 2049'],
]
function Vocabulary() {
  const [hov, setHov] = useState(-1)
  const pos = useRef({ x: 0, y: 0 })
  const img = useRef(null)
  const onMove = (e) => {
    pos.current = { x: e.clientX, y: e.clientY }
    if (img.current) img.current.style.transform = `translate3d(${e.clientX + 24}px, ${e.clientY - 110}px, 0) rotate(${(e.movementX || 0) * 0.4}deg)`
  }
  return (
    <section className="v-sec" onPointerMove={onMove}>
      <div className="v-head">
        <Rise as="h2" className="verdict sec-h" text={'Named from the\ncutting room.'} />
      </div>
      <ul className="v-list">
        {VOCAB.map(([k, d], i) => (
          <motion.li key={k} onPointerEnter={() => setHov(i)} onPointerLeave={() => setHov(-1)} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} className={hov === i ? 'on' : hov >= 0 ? 'off' : ''}>
            <span className="numeral v-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="v-k">{k}</span>
            <span className="v-d">{d}</span>
            <span className="v-bar" />
          </motion.li>
        ))}
      </ul>
      <div ref={img} className={`v-float ${hov >= 0 ? 'on' : ''}`} aria-hidden="true">
        {VOCAB.map(([, , t], i) => { const id = byTitles(t)[0]; return id ? <div key={t} className="v-fimg" style={{ opacity: hov === i ? 1 : 0 }}><Img src={backdrop(id)} alt="" /></div> : null })}
      </div>
    </section>
  )
}

/* ── FINAL ─────────────────────────────────────────────────── */
function Final({ start }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-25%' })
  const [lb, setLb] = useState('')
  return (
    <section className="f-sec" ref={ref}>
      <div className="f-mark">{inView ? <Clap size={132} delay={0.1} /> : <div style={{ height: 132 }} />}</div>
      <Rise as="h2" className="verdict f-h" text={'Bring your diary.'} />
      <form className="f-form" onSubmit={(e) => { e.preventDefault(); start(lb) }}>
        <label className="field">
          <span className="pre">letterboxd.com/</span>
          <input id="final-lb" value={lb} onChange={(e) => setLb(e.target.value)} placeholder="username" autoCapitalize="none" spellCheck={false} aria-label="Letterboxd username" />
        </label>
        <button className="btn lit" type="submit">Read me <span className="arr"><Arrow /></span></button>
      </form>
      <button className="text-link" onClick={() => start('')}>Start without Letterboxd <Arrow /></button>
    </section>
  )
}

function Footer({ go }) {
  return (
    <footer className="l-foot">
      <Lockup size={20} />
      <span className="spec">Film data from TMDB · not endorsed by TMDB</span>
      <span className="spec">© 2026 Selects</span>
    </footer>
  )
}
