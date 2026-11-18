import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Arrow } from '../components/Icons.jsx'
import { film, poster, backdrop, resolveSrc } from '../lib/films.js'
import { ticket, reason, ARCHETYPES } from '../lib/taste.js'
import { readings, stageOf } from '../components/Wheel.jsx'
import { play } from '../lib/sound.js'

/* ─────────────────────────────────────────────────────────────
   THE PRINT. Four stories, sized for Instagram (1080 × 1920), drawn
   straight onto a canvas: what you see here is the exact file you
   share. One language across all four: ink, bone, one lit bar, and
   the five-bar lean running off the bottom edge like film leader.
   ───────────────────────────────────────────────────────────── */

const W = 1080, H = 1920, PAD = 96
const INK = '#0A0A0B', BONE = '#EFEDE9', DIM = 'rgba(239,237,233,.55)', LIT = '#FF3B14'
const LEAN = Math.tan((13.5 * Math.PI) / 180)
const D = (w, s) => `${w} ${s}px Archivo, sans-serif`
const M = (w, s) => `${w} ${s}px "Martian Mono", monospace`
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const imgCache = new Map()
function load(url) {
  if (!imgCache.has(url)) imgCache.set(url, resolveSrc(url).catch(() => url).then((u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u })))
  return imgCache.get(url)
}

/* ── drawing primitives ───────────────────────────────────── */
function spaced(g, text, x, y, track = 0.18, align = 'left') {
  const size = parseFloat(g.font.match(/(\d+(?:\.\d+)?)px/)[1])
  const chars = [...text]
  const widths = chars.map((c) => g.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + track * size * (chars.length - 1)
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x
  chars.forEach((c, i) => { g.fillText(c, cx, y); cx += widths[i] + track * size })
  return total
}
function fit(g, text, maxW, size, weight = 800, min = 40) {
  let s = size
  do { g.font = D(weight, s); if (g.measureText(text).width <= maxW) break; s -= 4 } while (s > min)
  return s
}
function wrap(g, text, x, y, maxW, lh, maxLines = 4) {
  const words = text.split(' ')
  let line = '', n = 0
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) break } else line = t
  }
  if (line) { g.fillText(line, x, y); y += lh }
  return y
}
function cover(g, img, x, y, w, h, ay = 0.35) {
  if (!img) { g.fillStyle = '#18181b'; g.fillRect(x, y, w, h); return }
  const r = Math.max(w / img.width, h / img.height)
  const sw = w / r, sh = h / r
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) * ay, sw, sh, x, y, w, h)
}
function bar(g, x, y, w, h) { // one leaning bar, foot at y
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + h * LEAN, y - h); g.lineTo(x + h * LEAN, y - h); g.closePath(); g.fill()
}
function mark(g, x, y, h, lit = 2) { // the mark, foot-left at (x, y)
  const w = h * 0.14, pitch = h * 0.24
  for (let i = 0; i < 5; i++) { g.fillStyle = i === lit ? LIT : BONE; bar(g, x + i * pitch, y, w, h) }
}
function frame(g, colour) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H)
  // the film's own light, low and to one side
  const a = g.createRadialGradient(W * 0.15, H * 0.12, 0, W * 0.15, H * 0.12, W * 1.1)
  a.addColorStop(0, hexA(colour, 0.42)); a.addColorStop(0.55, hexA(colour, 0.08)); a.addColorStop(1, hexA(colour, 0))
  g.fillStyle = a; g.fillRect(0, 0, W, H)
  // grain
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(239,237,233,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2) }
  // lockup
  mark(g, PAD, 196, 72)
  g.fillStyle = BONE; g.font = D(800, 52); g.fillText('SELECTS', PAD + 124, 190)
  // the leader: bars running off the bottom edge, one lit
  const heights = [150, 108, 170, 120, 160, 104, 176, 126, 150, 112, 168]
  heights.forEach((h, i) => {
    const gr = g.createLinearGradient(0, H - h, 0, H)
    gr.addColorStop(0, i === 6 ? LIT : BONE); gr.addColorStop(1, i === 6 ? '#b8290e' : '#9a9893')
    g.fillStyle = gr; bar(g, -60 + i * 108, H + 4, 68, h + 40)
  })
}
function kicker(g, text, y, colour = DIM) { g.fillStyle = colour; g.font = M(500, 30); spaced(g, text.toUpperCase(), PAD, y, 0.22) }
function rule(g, y) { g.fillStyle = 'rgba(239,237,233,.16)'; g.fillRect(PAD, y, W - PAD * 2, 2) }
function hexA(hex, a) { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }
function tint(hex, k) { const n = parseInt(hex.replace('#', ''), 16); const m = (c) => Math.round(c + (239 - c) * k); return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})` }
const dateLine = () => { const d = new Date(); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` }

/* ── the four stories ─────────────────────────────────────── */
const STORIES = [
  { key: 'negative', name: 'Negative' },
  { key: 'people', name: 'People' },
  { key: 'exposure', name: 'Exposure' },
  { key: 'ticket', name: 'Ticket' },
]

async function draw(kind, g, d) {
  frame(g, d.colour)
  if (kind === 'negative') {
    kicker(g, `${d.name ? d.name + ' is a' : 'My negative'}`, 420)
    g.fillStyle = tint(d.colour, 0.45)
    const s = fit(g, d.arch.name, W - PAD * 2, 190)
    g.font = D(800, s); g.fillText(d.arch.name, PAD - 6, 420 + s * 0.95)
    g.fillStyle = BONE; g.font = D(500, 52)
    const top = wrap(g, d.arch.line, PAD, 420 + s + 110, W - PAD * 2, 66)
    // the bottom block sits on fixed lines, clear of the leader
    const y0 = H - 560
    // three posters, fanned, the middle one forward, centred in the space between
    const ps = (await Promise.all(d.picks.filter((id) => film(id)).slice(0, 3).map((id) => load(poster(id))))).filter(Boolean)
    const room = y0 - 70 - top, ph = Math.min(450, room - 40), pw = ph / 1.5, cy = top + (room - ph) / 2
    const order = ps.length === 3 ? [[0, -1, -9], [2, 1, 9], [1, 0, 0]] : ps.map((_, i) => [i, i - (ps.length - 1) / 2, (i - (ps.length - 1) / 2) * 9])
    order.forEach(([i, k, rot]) => {
      g.save(); g.translate(W / 2 + k * pw * 0.82, cy + ph / 2 + Math.abs(k) * 26); g.rotate((rot * Math.PI) / 180)
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 50; g.shadowOffsetY = 24
      cover(g, ps[i], -pw / 2, -ph / 2, pw, ph, 0); g.restore()
    })
    rule(g, y0)
    g.fillStyle = d.colour; g.fillRect(PAD, y0 + 46, 60, 60)
    g.fillStyle = BONE; g.font = M(600, 40); g.fillText(d.colour.toUpperCase(), PAD + 88, y0 + 90)
    g.fillStyle = DIM; g.font = M(500, 26); spaced(g, 'MY COLOUR', W - PAD, y0 + 88, 0.2, 'right')
    rule(g, y0 + 150)
    g.fillStyle = DIM; g.font = M(500, 26); spaced(g, 'LIGHTS DOWN', PAD, y0 + 214, 0.2); spaced(g, 'SEAT', PAD, y0 + 262, 0.2)
    g.fillStyle = BONE; g.font = D(600, 36); g.fillText(d.arch.hour, PAD + 300, y0 + 216); g.fillText(d.arch.seat, PAD + 300, y0 + 264)
  }
  if (kind === 'people') {
    kicker(g, 'The people behind my taste', 420)
    const top = d.people[0]
    if (top) {
      g.fillStyle = BONE
      const s = fit(g, top.who.toUpperCase(), W - PAD * 2 - 220, 120, 800)
      g.font = D(800, s); g.fillText(top.who.toUpperCase(), PAD - 4, 560)
      g.fillStyle = top.colour; g.font = M(600, 150); spaced(g, String(top.films.length), W - PAD, 580, -0.04, 'right')
      g.fillStyle = DIM; g.font = M(500, 26); spaced(g, `${top.role.toUpperCase()} · FILMS ON MY MAP`, PAD, 630, 0.2)
      const ps = await Promise.all(top.films.slice(0, 4).map((f) => load(poster(f.id))))
      const n = Math.max(1, ps.length), gap = 22, pw = (W - PAD * 2 - gap * 3) / 4, ph = pw * 1.5
      ps.forEach((img, i) => {
        const x = PAD + i * (pw + gap)
        cover(g, img, x, 700, pw, ph, 0)
        g.fillStyle = BONE; g.font = M(600, 26); g.fillText(String(i + 1).padStart(2, '0'), x, 700 + ph + 50)
        g.fillStyle = DIM; g.font = D(500, 28); wrap(g, film(top.films[i].id)?.t || '', x, 700 + ph + 92, pw, 34, 2)
      })
      let y = 700 + ph + 210
      d.people.slice(1, 4).forEach((p) => {
        rule(g, y - 70)
        g.fillStyle = p.colour; g.font = M(500, 26); spaced(g, p.craft.toUpperCase(), PAD, y - 18, 0.2)
        g.fillStyle = BONE; const s2 = fit(g, p.who.toUpperCase(), W - PAD * 2 - 140, 62, 800, 34); g.font = D(800, s2); g.fillText(p.who.toUpperCase(), PAD, y + 50)
        g.font = M(600, 62); spaced(g, String(p.films.length), W - PAD, y + 50, -0.04, 'right')
        y += 170
      })
    }
  }
  if (kind === 'exposure') {
    kicker(g, 'How well Selects knows me', 420)
    const pct = Math.round(d.known * 100)
    g.fillStyle = BONE; g.font = M(600, 330); const w = spaced(g, String(pct), PAD - 14, 760, -0.06)
    g.font = M(600, 140); g.fillStyle = LIT; g.fillText('%', PAD + w + 6, 760)
    const [, stage, line] = stageOf(d.known)
    g.fillStyle = BONE; g.font = D(800, 84); g.fillText(stage.toUpperCase(), PAD, 900)
    g.fillStyle = DIM; g.font = D(500, 44); wrap(g, line, PAD, 980, W - PAD * 2, 58)
    // a meter row per craft: the arc, unrolled
    let y = 1120
    d.sectors.forEach((s) => {
      g.fillStyle = BONE; g.font = D(700, 44); g.fillText(s.name, PAD, y)
      g.fillStyle = DIM; g.font = M(600, 36); spaced(g, `${Math.round(s.known * 100)}%`, W - PAD, y, 0, 'right')
      const bw = W - PAD * 2, ticks = 40
      for (let t = 0; t < ticks; t++) { g.fillStyle = t / ticks < s.known ? s.colour : 'rgba(239,237,233,.14)'; bar(g, PAD + t * (bw / ticks), y + 52, bw / ticks - 9, 26) }
      y += 128
    })
  }
  if (kind === 'ticket') {
    kicker(g, `Tonight's ticket · ${dateLine()}`, 420)
    g.fillStyle = BONE; g.font = D(800, 116); g.fillText('Three films.', PAD - 4, 560); g.fillText('One reach.', PAD - 4, 680)
    const imgs = await Promise.all(d.ticket.map((e) => load(backdrop(e.f.id))))
    let y = 770
    d.ticket.forEach((e, i) => {
      const h = 300
      g.save(); g.beginPath(); g.rect(PAD, y, W - PAD * 2, h); g.clip()
      cover(g, imgs[i], PAD, y, W - PAD * 2, h, 0.4)
      const sh = g.createLinearGradient(PAD, 0, W - PAD, 0); sh.addColorStop(0, 'rgba(10,10,11,.88)'); sh.addColorStop(0.75, 'rgba(10,10,11,.15)')
      g.fillStyle = sh; g.fillRect(PAD, y, W - PAD * 2, h); g.restore()
      g.fillStyle = e.slot === 'reach' ? LIT : DIM; g.font = M(600, 24); spaced(g, e.slot === 'reach' ? 'THE REACH' : `TICKET 0${i + 1}`, PAD + 36, y + 58, 0.2)
      g.fillStyle = BONE; const s = fit(g, e.f.t, W - PAD * 2 - 72, 64, 800, 36); g.font = D(800, s); g.fillText(e.f.t, PAD + 36, y + 150)
      g.fillStyle = 'rgba(239,237,233,.8)'; g.font = D(500, 30); wrap(g, reason(e), PAD + 36, y + 206, W - PAD * 2 - 140, 38, 2)
      // the stub's notch
      g.fillStyle = INK; g.beginPath(); g.arc(W - PAD - 150, y, 16, 0, Math.PI * 2); g.arc(W - PAD - 150, y + h, 16, 0, Math.PI * 2); g.fill()
      y += h + 30
    })
  }
}

/* ── the section ──────────────────────────────────────────── */
export default function Story({ s, arch, colour, reads }) {
  const [active, setActive] = useState(0)
  const [state, setState] = useState('') // '', 'sharing', 'done'
  const cvs = useRef([])
  const kept = [...s.positive, ...(s.kept || [])]
  const data = useMemo(() => {
    const r = readings([...kept, ...reads], kept, { kept: kept.length, struck: s.negative.length, logged: (s.logged || []).length }, colour)
    const people = r.sectors.filter((x) => x.key !== 'k').flatMap((x) => x.branches.map((b) => ({ who: b.who, films: b.films, colour: x.colour, craft: x.name, role: x.role }))).sort((a, b) => b.films.length - a.films.length)
    const a = arch ? { ...arch, ...(ARCHETYPES[arch.name] || {}) } : { name: 'UNEXPOSED', line: 'Nothing on the film yet.', hour: '—', seat: '—' }
    return { name: s.name ? s.name.split(' ')[0] : '', colour, arch: a, picks: s.positive, people, sectors: r.sectors, known: r.known, ticket: ticket(s) }
  }, [kept.join(','), reads.join(','), colour, arch && arch.name, s.negative.length])

  useEffect(() => {
    let dead = false
    const go = async () => {
      if (document.fonts) await Promise.all(['800 40px Archivo', '500 40px Archivo', '700 40px Archivo', '600 40px "Martian Mono"', '500 40px "Martian Mono"'].map((f) => document.fonts.load(f))).catch(() => {})
      for (let i = 0; i < STORIES.length; i++) {
        const c = cvs.current[i]
        if (!c || dead) continue
        const g = c.getContext('2d')
        await draw(STORIES[i].key, g, data)
        c.classList.add('ready')
      }
    }
    go()
    return () => { dead = true }
  }, [data])

  const blob = (i) => new Promise((res) => cvs.current[i].toBlob(res, 'image/png'))
  const share = async () => {
    setState('sharing')
    const b = await blob(active)
    const file = new File([b], `selects-${STORIES[active].key}.png`, { type: 'image/png' })
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My Selects' }); play('copy') }
      else save(file)
    } catch { /* closed the sheet */ }
    setState('done'); setTimeout(() => setState(''), 1800)
  }
  const save = (file) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); play('copy')
  }
  const saveAll = async () => { for (let i = 0; i < STORIES.length; i++) { const b = await blob(i); save(new File([b], `selects-${STORIES[i].key}.png`, { type: 'image/png' })); await new Promise((r) => setTimeout(r, 250)) } }

  return (
    <div className="story">
      <div className="story-rail no-scrollbar" onScroll={(e) => {
        // on phones the rail swipes: whichever story is centred is the one you share
        const el = e.currentTarget, c = el.children[0]
        if (!c || el.scrollWidth <= el.clientWidth) return
        const i = Math.round(el.scrollLeft / (c.offsetWidth + 16))
        if (i !== active && i >= 0 && i < STORIES.length) setActive(i)
      }}>
        {STORIES.map((st, i) => (
          <motion.button key={st.key} className={`story-card ${active === i ? 'on' : ''}`} onClick={() => { setActive(i); play('detent') }} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} aria-pressed={active === i} aria-label={`${st.name} story`} data-cursor="PICK" data-sfx="none">
            <canvas ref={(el) => (cvs.current[i] = el)} width={W} height={H} />
            <span className="spec story-n">{String(i + 1).padStart(2, '0')} · {st.name}</span>
          </motion.button>
        ))}
      </div>
      <div className="story-acts">
        <button className="btn lit" onClick={share} disabled={state === 'sharing'}>{state === 'done' ? 'Shared' : 'Share this story'} <span className="arr"><Arrow /></span></button>
        <button className="btn ghost" onClick={saveAll}>Save all four</button>
        <span className="spec story-note">1080 × 1920 · sized for stories</span>
      </div>
    </div>
  )
}
