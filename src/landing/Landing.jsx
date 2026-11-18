import { useEffect, useRef, useState, useMemo } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion, useScroll, useTransform, useInView, useSpring, useMotionValueEvent } from 'framer-motion'
import Lenis from 'lenis'
import { Mark, Lockup, Rise, Counter, Poster, Img, useRoute, useMagnetic, Clap, SoundToggle } from '../components/ui.jsx'
import Ticket from '../components/Ticket.jsx'
import { TabIcon, LbDots } from '../components/Icons.jsx'
import Wheel from '../components/Wheel.jsx'
import { film, films, backdrop, poster, colour, logo, fmtRuntime, ids as byTitles } from '../lib/films.js'
import { yourColour, ARCHETYPES } from '../lib/taste.js'
import { setState, getState } from '../lib/store.js'
import { play } from '../lib/sound.js'
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

const TODAY = (() => { const d = new Date(); return `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]} ${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}` })()

/* Each section is a reel: a numbered can label, sprocket and all. */
function Reel({ n, name }) {
  return <p className="spec reel-k"><span className="reel-holes" aria-hidden="true"><i /><i /><i /></span>Reel {String(n).padStart(2, '0')} · {name}</p>
}

/* ── NAV ───────────────────────────────────────────────────── */
function Nav({ to, start, returning }) {
  const [solid, setSolid] = useState(false)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    // One update per frame; ignore iOS rubber-band overscroll; only flip after a
    // deliberate 48px run in one direction, so momentum jitter never toggles it.
    let last = Math.max(0, scrollY), run = 0, raf = 0, isSolid = false, isHidden = false
    const set = (solidNext, hiddenNext) => {
      if (solidNext !== isSolid) { isSolid = solidNext; setSolid(solidNext) }
      if (hiddenNext !== isHidden) { isHidden = hiddenNext; setHidden(hiddenNext) }
    }
    const update = () => {
      raf = 0
      const max = Math.max(0, document.documentElement.scrollHeight - innerHeight)
      const y = Math.min(Math.max(scrollY, 0), max)
      const d = y - last
      last = y
      if (d !== 0) run = Math.sign(d) === Math.sign(run) ? run + d : d
      let hiddenNext = isHidden
      if (y < 600) { hiddenNext = false; run = 0 }
      else if (run > 48) hiddenNext = true
      else if (run < -48) hiddenNext = false
      set(y > 40, hiddenNext)
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(update) }
    addEventListener('scroll', on, { passive: true })
    update()
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf) }
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
      <span className="nav-end"><SoundToggle /><button ref={mag} className="btn nav-cta" onClick={start}>{returning ? 'Open Selects' : 'Try now'}<span className="arr"><Arrow /></span></button></span>
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
        <motion.p className="spec hero-kick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.8 }}><i className="live-dot" />Now showing · {TODAY}</motion.p>
        <h1 className="verdict hero-h">
          <Rise text={'Tonight’s reel,\ncut from your diary.'} delay={0.35} stagger={0.09} />
        </h1>
        <motion.div className="hero-cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
          <p className="lead hero-lead">Selects reads your Letterboxd and programmes three films for tonight. Two close to home, one reach.</p>
          <form className="hero-form" onSubmit={(e) => { e.preventDefault(); start(lb) }}>
            <label className="field hero-field">
              <span className="pre"><LbDots />letterboxd.com/</span>
              <input id="hero-lb" value={lb} onChange={(e) => setLb(e.target.value)} placeholder="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Letterboxd username" />
            </label>
            <button className="btn lit hero-go" type="submit">Read me <span className="arr"><Arrow /></span></button>
          </form>
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
    'Every', 'film', 'you', 'log', 'is', 'a', 'frame.', { p: 949 }, { p: 843 },
    'Selects', 'reads', 'the', 'whole', 'roll', { p: 1398 }, 'and', 'prints', 'three', 'for', 'tonight.', { p: 655 },
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
          [3, '', 'films a night'],
          [1, '', 'reach on every ticket'],
          [8, '', 'negatives to find yourself in'],
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
        <Reel n={1} name="The Ticket" />
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

/* ── THE STRIP: a century of cinema in bars; a loupe rides your hand ─ */
function StripSection() {
  const list = useMemo(() => films().slice().sort((a, b) => (a.y || 0) - (b.y || 0)), [])
  const [active, setActive] = useState(-1)
  const row = useRef(null)
  const loupe = useRef(null)
  const bars = useRef([])
  const raf = useRef(0)
  const lastI = useRef(-1)
  const N = list.length
  const onMove = (clientX) => {
    const r = row.current.getBoundingClientRect()
    const p = Math.max(0, Math.min(0.9999, (clientX - r.left) / r.width))
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
      const i = Math.floor(c)
      if (i !== lastI.current) { lastI.current = i; play('hover', { gap: 0.03 }) }
      setActive(i)
      // the loupe follows the hand, held inside the stage
      if (loupe.current) {
        const w = loupe.current.offsetWidth
        const x = Math.max(0, Math.min(r.width - w, clientX - r.left - w / 2))
        loupe.current.style.transform = `translate3d(${x}px,0,0)`
      }
    })
  }
  const leave = () => {
    bars.current.forEach((b) => b && ((b.style.flexGrow = 1), (b.style.transform = 'skewX(-13.5deg) scaleY(.62)')))
    setActive(-1); lastI.current = -1
  }
  const f = active >= 0 ? list[active] : null
  const decade = f ? `${Math.floor((f.y || 2000) / 10) * 10}s` : ''
  return (
    <section className="s-sec">
      <div className="s-head">
        <Reel n={2} name="The Strip" />
        <Rise as="h2" className="verdict sec-h" text={'A century of cinema.\nOne strip.'} />
      </div>
      <div className="s-stage">
        <div className="s-loupe-rail">
          <div ref={loupe} className={`s-loupe ${f ? 'on' : ''}`} style={{ '--film': f ? colour(f) : 'transparent' }} aria-hidden={!f}>
            <div className="s-lp-img">
              {f && <Img key={f.id} src={backdrop(f.id)} alt="" eager />}
              <span className="s-lp-decade numeral">{decade}</span>
            </div>
            <div className="s-lp-body">
              <b className="s-lp-t">{f ? f.t : ''}</b>
              <span className="spec">{f ? `${f.y} · ${f.dir[0] || ''}` : ''}</span>
              <span className="s-lp-hex"><i />{f ? colour(f) : ''}</span>
            </div>
          </div>
          {!f && <span className="spec s-idle">Run your hand along it</span>}
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
        <Reel n={3} name="The Assembly" />
        <Rise as="h2" className="verdict sec-h" text={'Your taste,\nin the end credits.'} />
      </div>
      <div className="a-stage">
        <Wheel ids={all} kept={ids.slice(0, 8)} you="#3A6E85" label="You" height="100%" className="bare" />
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
  const [hov, setHov] = useState(null)
  useEffect(() => {
    const m = () => setW(track.current ? Math.max(0, track.current.scrollWidth - innerWidth + 64) : 0)
    m(); addEventListener('resize', m)
    return () => removeEventListener('resize', m)
  }, [])
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -w])
  const xs = useSpring(x, { stiffness: 120, damping: 30, mass: 0.4 })
  const entries = Object.entries(ARCHETYPES)
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches
  return (
    <section id="negative" className="n-sec" ref={sec} style={{ '--len': entries.length }}>
      <div className="n-sticky">
        <div className="n-head">
          <div><Reel n={4} name="The Negative" />
          <Rise as="h2" className="verdict sec-h" text={'Eight ways\nto watch a film.'} /></div>
          <p className="lead">Your read develops into one of them. Which is yours?</p>
        </div>
        <motion.div className="n-track" ref={track} style={{ x: xs }}>
          {entries.map(([name, a], i) => {
            const ids = byTitles(...(ARCH_TITLES[name] || []))
            const on = hov === name
            return (
              <article key={name} className={`n-card ${on ? 'on' : ''}`} style={{ '--c': a.hue }} onClick={start} onPointerEnter={() => setHov(name)} onPointerLeave={() => setHov(null)} data-cursor="FIND YOURS">
                <div className="n-field">
                  <span className="n-no numeral">{String(i + 1).padStart(2, '0')}</span>
                  <div className="n-sigil"><Mark size={64} five layout={on || touch ? a.sigil : 'mark'} lit={2} ink="rgba(239,237,233,.92)" litColour="var(--select)" /></div>
                  <div className="n-posters">
                    {ids.map((id, k) => <img key={id} src={poster(id)} alt="" style={{ '--k': k }} />)}
                  </div>
                </div>
                <div className="n-body">
                  <h3 className="n-name">{name}</h3>
                  <p>{a.line}</p>
                  <dl className="n-spec">
                    <div><dt className="spec">Lights down</dt><dd>{a.hour}</dd></div>
                    <div><dt className="spec">Seat</dt><dd>{a.seat}</dd></div>
                    <div><dt className="spec">Ritual</dt><dd>{a.ritual}</dd></div>
                  </dl>
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
        <Reel n={5} name="Showtime" />
        <Rise as="h2" className="verdict sec-h" text={'In your pocket\nat 9:40 PM.'} />
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
        <Reel n={6} name="Glossary" />
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
      <Rise as="h2" className="verdict f-h" text={'Lights down.\nBring your diary.'} />
      <form className="f-form" onSubmit={(e) => { e.preventDefault(); start(lb) }}>
        <label className="field">
          <span className="pre"><LbDots />letterboxd.com/</span>
          <input id="final-lb" value={lb} onChange={(e) => setLb(e.target.value)} placeholder="username" autoCapitalize="none" spellCheck={false} aria-label="Letterboxd username" />
        </label>
        <button className="btn lit" type="submit">Read me <span className="arr"><Arrow /></span></button>
      </form>
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
