// The catalogue: every film carries its own colour, its people, and a seat on the taste map.
let FILMS = []
const BY_ID = new Map()
let loading = null

export function loadFilms() {
  if (loading) return loading
  loading = Promise.all([
    fetch('data/films.json').then((r) => r.json()),
    // Optional: hosts with a file-count limit get some media as packs (see scripts/artifact.py).
    fetch('data/media.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([list, packs]) => {
    FILMS = list
    list.forEach((f) => BY_ID.set(f.id, f))
    PACKS = packs && packs.files ? packs : null
    return list
  })
  return loading
}

/* ── media packs: an image either is a plain file, or lives inside a pack we slice on demand ── */
let PACKS = null
const packBufs = new Map()
const blobs = new Map()
export const syncSrc = (url) => blobs.get(url) || (PACKS && PACKS.files[url] ? null : url)
export function resolveSrc(url) {
  const ready = syncSrc(url)
  if (ready) return Promise.resolve(ready)
  const [pack, off, len] = PACKS.files[url]
  if (!packBufs.has(pack)) packBufs.set(pack, fetch(`media/packs/${pack}.webp`).then((r) => r.arrayBuffer()))
  return packBufs.get(pack).then((buf) => {
    if (!blobs.has(url)) blobs.set(url, URL.createObjectURL(new Blob([buf.slice(off, off + len)], { type: 'image/webp' })))
    return blobs.get(url)
  })
}

export const films = () => FILMS
export const film = (id) => BY_ID.get(Number(id))
export const poster = (id) => `media/p/${id}.webp`
export const backdrop = (id) => `media/b/${id}.webp`
export const logo = (id) => `media/l/${id}.webp`
export const colour = (f) => (f && f.pal && f.pal[0]) || '#3a6e85'

export const fmtRuntime = (m) => (!m ? '' : m >= 60 ? `${Math.floor(m / 60)}H ${String(m % 60).padStart(2, '0')}` : `${m}M`)

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function search(q, limit = 40) {
  const n = norm(q)
  if (!n) return []
  const words = n.split(' ')
  const out = []
  for (const f of FILMS) {
    const t = norm(f.t)
    let s = 0
    if (t === n) s += 100
    else if (t.startsWith(n)) s += 60
    else if (t.includes(n)) s += 40
    const people = norm([...(f.dir || []), ...(f.dp || []), ...(f.cast || []), ...(f.mus || [])].join(' '))
    const kw = norm([...(f.k || []), ...(f.g || [])].join(' '))
    for (const w of words) {
      if (w.length < 2) continue
      if (t.includes(w)) s += 8
      if (people.includes(w)) s += 6
      if (kw.includes(w)) s += 3
      if (String(f.y) === w) s += 10
    }
    if (s > 0) out.push([s + (f.sc || 50) / 100, f])
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1])
}

// A wall for onboarding: recognisable, varied, not just this week's blockbusters.
export function wall(kind = 'positive') {
  const pool = FILMS.filter((f) => f.sc >= 66)
  const seed = kind === 'positive' ? 3 : 11
  const scoreOf = (f) => {
    const r = Math.sin(f.id * 9301 + seed * 49297) * 233280
    const jitter = r - Math.floor(r)
    if (kind === 'negative') return (f.sc || 60) / 10 + (f.y > 2005 ? 3 : 0) + (f.g.includes('Action') || f.g.includes('Science Fiction') || f.g.includes('Animation') ? 2 : 0) + jitter * 3
    return (f.sc || 60) / 12 + jitter * 6
  }
  return pool.slice().sort((a, b) => scoreOf(b) - scoreOf(a))
}

export const idOf = (t) => { const f = FILMS.find((x) => x.t === t); return f ? f.id : null }
export const ids = (...titles) => titles.map(idOf).filter(Boolean)
