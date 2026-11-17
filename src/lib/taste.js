import { films, film, colour } from './films.js'

/* ─────────────────────────────────────────────────────────────
   The read. Small, honest, explainable: every recommendation can
   say exactly which person or thread put it on your ticket.
   ───────────────────────────────────────────────────────────── */

const overlap = (a = [], b = []) => a.filter((x) => b.includes(x))

function affinity(f, p) {
  const why = []
  let s = 0
  const dir = overlap(f.dir, p.dir)
  if (dir.length) { s += 3.4; why.push({ w: 3.4, kind: 'dir', who: dir[0], via: p }) }
  const dp = overlap(f.dp, p.dp)
  if (dp.length) { s += 2.4; why.push({ w: 2.4, kind: 'dp', who: dp[0], via: p }) }
  const mus = overlap(f.mus, p.mus)
  if (mus.length) { s += 1.6; why.push({ w: 1.6, kind: 'mus', who: mus[0], via: p }) }
  const cast = overlap(f.cast.slice(0, 4), p.cast.slice(0, 4))
  if (cast.length) { s += 1.2 * Math.min(2, cast.length); why.push({ w: 1.2 * cast.length, kind: 'cast', who: cast[0], via: p }) }
  const g = overlap(f.g, p.g).length / Math.max(1, new Set([...f.g, ...p.g]).size)
  s += g * 2.2
  const kw = overlap(f.k, p.k)
  if (kw.length) { s += Math.min(2.2, kw.length * 0.45); if (kw.length >= 2) why.push({ w: kw.length * 0.45, kind: 'kw', who: kw.slice(0, 2), via: p }) }
  if (p.recs.includes(f.id) || f.recs.includes(p.id)) { s += 2.6; why.push({ w: 2.0, kind: 'rec', via: p }) }
  s += Math.exp(-Math.abs((f.y || 2000) - (p.y || 2000)) / 14)
  const d = Math.hypot(f.mx - p.mx, f.my - p.my)
  s += 1.4 * (1 - d / 2.8)
  return { s, why }
}

export function scoreAll(profile) {
  const pos = (profile.positive || []).map(film).filter(Boolean)
  const neg = (profile.negative || []).map(film).filter(Boolean)
  const axes = profile.axes || []
  const exclude = new Set([...(profile.positive || []), ...(profile.negative || []), ...(profile.dismissed || [])])
  const out = []
  for (const f of films()) {
    if (exclude.has(f.id)) continue
    let s = 0
    let why = []
    for (const p of pos) {
      const a = affinity(f, p)
      s += a.s
      why = why.concat(a.why)
    }
    s /= Math.max(1, Math.sqrt(pos.length))
    for (const n of neg) s -= affinity(f, n).s * 0.55
    if (axes.includes('writing')) s += ((f.sc || 60) - 70) / 9 + (f.g.includes('Drama') || f.g.includes('Mystery') ? 0.5 : 0)
    if (axes.includes('room')) s += (f.rt > 135 ? 0.8 : 0) + (f.my > 0.2 ? 0.7 : 0)
    s += ((f.sc || 60) - 70) / 18
    why.sort((a, b) => b.w - a.w)
    out.push({ f, s, why })
  }
  return out.sort((a, b) => b.s - a.s)
}

export function reason(entry) {
  const w = entry && entry.why[0]
  if (!w) return 'Sits close to everything you kept.'
  const via = w.via.t
  switch (w.kind) {
    case 'dir': return `${w.who}, again. You kept ${via}.`
    case 'dp': return `${w.who} lit this and ${via}. Same light.`
    case 'mus': return `Scored by ${w.who}, like ${via}.`
    case 'cast': return `${w.who} again, after ${via}.`
    case 'kw': return `${cap(w.who[0])} and ${w.who[1]}: the same night as ${via}.`
    case 'rec': return `People who keep ${via} keep this.`
    default: return 'Sits close to everything you kept.'
  }
}
export const reasonShort = (entry) => {
  const w = entry && entry.why[0]
  if (!w) return 'close to your map'
  switch (w.kind) {
    case 'dir': return `same director as ${w.via.t}`
    case 'dp': return `shot by ${w.who}`
    case 'mus': return `scored by ${w.who}`
    case 'cast': return `${w.who}`
    case 'kw': return `${w.who[0]} · ${w.who[1]}`
    case 'rec': return `near ${w.via.t}`
    default: return 'close to your map'
  }
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// The Ticket: three films. Two close, one a reach.
export function ticket(profile, day = dayIndex()) {
  const all = scoreAll(profile)
  if (!all.length) return []
  const top = all.slice(0, 30)
  const rot = day % 5
  const a = top[rot % top.length]
  const b = top.find((e, i) => i > rot && e.f.id !== a.f.id && overlap(e.f.dir, a.f.dir).length === 0) || top[1]
  const center = centroid(profile)
  const reach = all
    .slice(8, 80)
    .filter((e) => e.f.id !== a.f.id && e.f.id !== b.f.id)
    .map((e) => ({ e, d: Math.hypot(e.f.mx - center.x, e.f.my - center.y) + Math.abs((e.f.y || 2000) - center.y0) / 40 }))
    .sort((p, q) => q.d * q.e.s - p.d * p.e.s)[day % 3]
  return [
    { ...a, slot: 'close' },
    { ...b, slot: 'close' },
    { ...(reach ? reach.e : top[2]), slot: 'reach' },
  ]
}

export const dayIndex = () => Math.floor(Date.now() / 86400000)

function centroid(profile) {
  const pos = (profile.positive || []).map(film).filter(Boolean)
  if (!pos.length) return { x: 0, y: 0, y0: 2000 }
  return {
    x: pos.reduce((s, f) => s + f.mx, 0) / pos.length,
    y: pos.reduce((s, f) => s + f.my, 0) / pos.length,
    y0: pos.reduce((s, f) => s + (f.y || 2000), 0) / pos.length,
  }
}

/* ── colour: the OKLab centroid of every poster you kept ───── */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
function toOk([r, g, b]) {
  ;[r, g, b] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
function fromOk([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, delin(c))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}
export function yourColour(ids) {
  const fs = ids.map(film).filter(Boolean)
  if (!fs.length) return '#3A6E85'
  let L = 0, A = 0, B = 0
  fs.forEach((f) => f.pal.slice(0, 2).forEach((h, i) => {
    const [l, a, b] = toOk(hex2rgb(h)); const w = i ? 0.5 : 1
    L += l * w; A += a * w; B += b * w
  }))
  const n = fs.length * 1.5
  L /= n; A /= n; B /= n
  const C = Math.hypot(A, B) || 0.0001
  const targetC = Math.max(0.07, Math.min(0.13, C * 1.6))
  return fromOk([Math.max(0.48, Math.min(0.62, L)), (A / C) * targetC, (B / C) * targetC])
}

/* ── the archetype: the negative every print comes from ────── */
export const ARCHETYPES = {
  NOCTURNALIST: { hue: '#3A6E85', line: 'You watch at night, and you go back to the same six people.', tell: 'Sodium light, wet streets, men who are good at their jobs.' },
  PROCEDURALIST: { hue: '#6B7A4F', line: 'You like watching people be good at their jobs.', tell: 'Process over plot. Show me the method.' },
  FORMALIST: { hue: '#8C8270', line: 'You came for the frame. Story is a courtesy.', tell: 'Long takes, held breath, a shot you can hang on a wall.' },
  ROMANTIC: { hue: '#A23A2E', line: 'You want to be wrecked, gently, by eleven.', tell: 'Two people, one city, the wrong timing.' },
  MAXIMALIST: { hue: '#C7772A', line: 'Bigger screen, louder room, no notes.', tell: '70mm or nothing. The seat should shake.' },
  ARCHIVIST: { hue: '#6F8796', line: 'You trust what happened over what was written.', tell: 'Real people, real rooms, no score telling you how to feel.' },
  DREAMER: { hue: '#3F7F6E', line: 'You go to the movies to leave the planet.', tell: 'Other worlds, drawn or built, and the people who live there.' },
  NERVE: { hue: '#6A2438', line: 'You like being frightened by people who know exactly what they are doing.', tell: 'Dread as craft. The cut that lands a second late.' },
}

export function archetype(profile) {
  const pos = (profile.positive || []).map(film).filter(Boolean)
  const near = scoreAll(profile).slice(0, 14).map((e) => e.f)
  const pool = [...pos, ...pos, ...near]
  const g = {}
  pool.forEach((f) => f.g.forEach((x) => (g[x] = (g[x] || 0) + 1)))
  const n = pool.length || 1
  const r = (k) => (g[k] || 0) / n
  const late = (profile.hour ?? 21) >= 22 || (profile.hour ?? 21) < 4
  const axes = profile.axes || []
  const avgYear = pos.reduce((s, f) => s + (f.y || 2000), 0) / (pos.length || 1)
  const kw = pool.flatMap((f) => f.k).join(' ')
  const scores = {
    NOCTURNALIST: r('Crime') * 2 + r('Thriller') * 1.5 + (late ? 0.9 : 0) + (/neo noir|night|los angeles|heist/.test(kw) ? 0.6 : 0),
    PROCEDURALIST: r('Crime') * 1.2 + r('Mystery') * 1.6 + r('History') * 0.6 + (axes.includes('writing') ? 0.6 : 0) + (/investigation|journalism|detective|police/.test(kw) ? 0.5 : 0),
    FORMALIST: r('Drama') * 1.0 + (avgYear < 1985 ? 1.0 : 0) + (axes.includes('room') ? 0.3 : 0) + r('Foreign') + (/art house|long take|black and white/.test(kw) ? 0.6 : 0),
    ROMANTIC: r('Romance') * 2.6 + r('Music') + (axes.includes('writing') ? 0.2 : 0),
    MAXIMALIST: r('Action') * 1.5 + r('Adventure') * 1.4 + r('Science Fiction') * 0.8 + (axes.includes('room') ? 0.9 : 0),
    ARCHIVIST: r('Documentary') * 4,
    DREAMER: r('Animation') * 2.2 + r('Fantasy') * 1.6 + r('Science Fiction') * 0.9,
    NERVE: r('Horror') * 2.8 + r('Thriller') * 0.5,
  }
  const name = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
  return { name, ...ARCHETYPES[name] }
}

/* ── the thread: the person who keeps showing up ───────────── */
export function thread(ids) {
  const near = ids.map(film).filter(Boolean)
  const count = {}
  const add = (who, role, f) => {
    if (!who) return
    const k = who + '|' + role
    ;(count[k] = count[k] || { who, role, films: new Set() }).films.add(f.id)
  }
  for (const f of near) {
    f.dir.forEach((w) => add(w, 'director', f))
    f.dp.forEach((w) => add(w, 'cinematographer', f))
    f.mus.forEach((w) => add(w, 'composer', f))
    f.cast.slice(0, 3).forEach((w) => add(w, 'actor', f))
  }
  const best = Object.values(count).sort((a, b) => b.films.size - a.films.size || (a.role === 'cinematographer' ? -1 : 1))[0]
  return best ? { ...best, films: [...best.films] } : null
}

/* ── insights: eight warm, two sharp ───────────────────────── */
export function insights(profile) {
  const pos = (profile.positive || []).map(film).filter(Boolean)
  const neg = (profile.negative || []).map(film).filter(Boolean)
  const read = scoreAll(profile).slice(0, 24)
  const out = []
  const hour = profile.hour ?? 21
  const hh = ((hour + 11) % 12) + 1
  const ampm = hour >= 12 ? 'PM' : 'AM'
  if (pos[0]) out.push({ k: 'THE FLOOR', big: pos[0].t, line: 'Every ticket is measured against it.' })
  out.push({
    k: 'THE HOUR',
    big: `${hh}:00 ${ampm}`,
    line: hour >= 22 || hour < 4 ? 'You watch late. Tickets lean darker.' : hour >= 18 ? 'Prime time. Long ones on Fridays.' : 'Matinees get the reach.',
  })
  const th = thread([...pos.map((f) => f.id), ...read.map((e) => e.f.id)])
  if (th && th.films.length > 1) out.push({ k: 'THE THREAD', big: th.who, line: `${th.films.length} films on your map.` })
  const warm = pos.filter((f) => f.warm > 0.02).length
  if (pos.length >= 2) out.push({ k: 'THE TEMPERATURE', big: `${warm} warm · ${pos.length - warm} sharp`, line: warm >= pos.length - warm ? 'You keep the warm ones.' : 'Warmth has to earn it.' })
  if (neg[0]) out.push({ k: 'STRUCK', big: neg[0].t, sharp: true, line: 'Anything built like it starts a step behind.' })
  if ((profile.axes || []).length) {
    const a = profile.axes
    out.push({ k: 'WHAT YOU ARE THERE FOR', big: a.includes('both') || (a.includes('writing') && a.includes('room')) ? 'Both' : a.includes('writing') ? 'The writing' : 'The room', line: a.includes('room') && !a.includes('writing') ? '70mm and IMAX runs get flagged.' : 'Films that hold up on a rewatch.' })
  }
  return out
}

/* ── the assembly: a graph of the people between your films ── */
export function assembly(ids, max = 36) {
  const fs = ids.map(film).filter(Boolean).slice(0, max)
  const nodes = fs.map((f) => ({ id: f.id, f, c: colour(f) }))
  const edges = []
  for (let i = 0; i < fs.length; i++)
    for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j]
      const who = [...overlap(a.dir, b.dir), ...overlap(a.dp, b.dp), ...overlap(a.mus, b.mus), ...overlap(a.cast.slice(0, 4), b.cast.slice(0, 4))]
      const w = who.length + (a.recs.includes(b.id) || b.recs.includes(a.id) ? 0.6 : 0) + (overlap(a.g, b.g).length >= 2 ? 0.3 : 0) + Math.min(0.6, overlap(a.k, b.k).length * 0.2)
      if (w >= 0.6) edges.push({ a: i, b: j, w, who })
    }
  return { nodes, edges }
}
