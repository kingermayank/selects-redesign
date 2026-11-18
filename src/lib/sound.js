/* ─────────────────────────────────────────────────────────────
   SOUND. Everything is synthesised: no files, nothing to load.
   The palette is a projection booth: a shutter, a sprocket, a
   splice, a reel settling. Quiet by default, never musical except
   when something is finished.
   ───────────────────────────────────────────────────────────── */
import { getState, setState } from './store.js'

let ctx = null, out = null, noiseBuf = null
const rm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function boot() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC({ latencyHint: 'interactive' })
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.12
  out = ctx.createGain()
  out.gain.value = 0.55
  out.connect(comp).connect(ctx.destination)
  // one second of white noise, reused by every grain
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

export const soundOn = () => getState().sound !== false
export function setSound(on) {
  setState({ sound: on })
  if (on) { boot(); ctx && ctx.resume(); play('on') }
}

// Browsers only allow audio after a gesture: wake the context on the first one.
if (typeof window !== 'undefined') {
  const wake = () => { if (soundOn()) { boot(); ctx && ctx.state === 'suspended' && ctx.resume() } }
  addEventListener('pointerdown', wake, { capture: true, passive: true })
  addEventListener('keydown', wake, { capture: true })
}

/* ── primitives ─────────────────────────────────────────────── */
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}
function tone(t, { f = 440, f2, type = 'sine', a = 0.004, d = 0.12, v = 0.2, pan = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d)
  env(g, t, a, v, d)
  let node = o.connect(g)
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p) }
  node.connect(out)
  o.start(t); o.stop(t + a + d + 0.05)
}
function grain(t, { f = 2000, f2, q = 1, type = 'bandpass', a = 0.002, d = 0.05, v = 0.2, rate = 1 }) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain()
  s.buffer = noiseBuf
  s.playbackRate.value = rate
  fl.type = type; fl.Q.value = q
  fl.frequency.setValueAtTime(f, t)
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d)
  env(g, t, a, v, d)
  s.connect(fl).connect(g).connect(out)
  s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05)
}

/* ── the palette ────────────────────────────────────────────── */
const LIB = {
  // primary: a shutter. Two blades, a body thump.
  primary(t) {
    grain(t, { f: 3200, q: 2.2, d: 0.018, v: 0.5 })
    grain(t + 0.034, { f: 2400, q: 2.2, d: 0.024, v: 0.36 })
    tone(t, { f: 140, f2: 70, type: 'sine', d: 0.08, v: 0.32 })
  },
  // secondary: a lighter latch
  secondary(t) {
    grain(t, { f: 4200, q: 3, d: 0.014, v: 0.26 })
    tone(t, { f: 900, f2: 700, type: 'triangle', d: 0.03, v: 0.05 })
  },
  // hover: barely there. A sprocket tooth passing.
  hover(t) { grain(t, { f: 6000, q: 6, d: 0.01, v: 0.07 }) },
  // a key: a counter wheel. Pitch drifts so typing never machine-guns.
  key(t) { grain(t, { f: 2600 + Math.random() * 1800, q: 5, d: 0.012, v: 0.12 }) },
  delete(t) { grain(t, { f: 1500, q: 4, d: 0.016, v: 0.12 }) },
  // pick: the sprocket advances a frame, upward
  pick(t) {
    grain(t, { f: 3600, q: 3, d: 0.012, v: 0.28 })
    tone(t + 0.008, { f: 660, f2: 990, type: 'triangle', d: 0.07, v: 0.09 })
  },
  unpick(t) {
    grain(t, { f: 2600, q: 3, d: 0.012, v: 0.22 })
    tone(t + 0.008, { f: 760, f2: 480, type: 'triangle', d: 0.07, v: 0.07 })
  },
  // strike: a grease pencil across the frame
  strike(t) {
    grain(t, { f: 5200, f2: 900, q: 1.6, a: 0.01, d: 0.16, v: 0.34, type: 'bandpass' })
    tone(t + 0.02, { f: 180, f2: 90, d: 0.12, v: 0.12 })
  },
  // tear: paper giving way, fibres first
  tear(t) {
    for (let i = 0; i < 7; i++) grain(t + i * 0.018 + Math.random() * 0.01, { f: 1800 + Math.random() * 2600, q: 1.2, d: 0.03, v: 0.18 + Math.random() * 0.1 })
    grain(t + 0.13, { f: 900, f2: 400, q: 0.8, d: 0.12, v: 0.12, type: 'lowpass' })
  },
  // splice: copy. Two cuts and a press.
  copy(t) {
    grain(t, { f: 5200, q: 4, d: 0.012, v: 0.3 })
    grain(t + 0.07, { f: 5600, q: 4, d: 0.012, v: 0.3 })
    tone(t + 0.12, { f: 1320, type: 'sine', d: 0.22, v: 0.06 })
    tone(t + 0.12, { f: 1980, type: 'sine', d: 0.28, v: 0.035 })
  },
  // a frame landing in a gate: used by the dial, the tray, the import
  detent(t) { grain(t, { f: 2200, q: 8, d: 0.008, v: 0.16 }); tone(t, { f: 1200, d: 0.02, v: 0.03 }) },
  // the slate: air moving past
  whoosh(t) { grain(t, { f: 400, f2: 3400, q: 0.7, a: 0.06, d: 0.32, v: 0.16, type: 'bandpass' }) },
  // link: a sync blip, then a lock
  link(t) {
    tone(t, { f: 880, type: 'sine', d: 0.06, v: 0.08 })
    tone(t + 0.07, { f: 1320, type: 'sine', d: 0.09, v: 0.08 })
    grain(t + 0.07, { f: 4800, q: 4, d: 0.01, v: 0.2 })
  },
  // roll: the reel catches; sprocket teeth speed up into a run
  roll(t) {
    let at = t
    for (let i = 0; i < 14; i++) { grain(at, { f: 2400 + i * 90, q: 6, d: 0.01, v: 0.1 + i * 0.008 }); at += Math.max(0.028, 0.11 - i * 0.008) }
    tone(at, { f: 660, d: 0.08, v: 0.06 }); tone(at + 0.07, { f: 990, d: 0.14, v: 0.06 })
  },
  // reveal / done: the house lights. A slow open fifth in the colour of tungsten.
  develop(t) {
    ;[220, 330, 440, 554.4].forEach((f, i) => tone(t + i * 0.06, { f, type: 'sine', a: 0.25, d: 1.8, v: 0.05, pan: (i - 1.5) * 0.3 }))
    tone(t, { f: 55, type: 'sine', a: 0.1, d: 1.4, v: 0.12 })
    for (let i = 0; i < 10; i++) grain(t + 0.2 + i * 0.09, { f: 6000 + Math.random() * 3000, q: 9, d: 0.02, v: 0.05 })
  },
  // the clap: the slate shutting
  clap(t) { grain(t, { f: 1800, q: 0.9, d: 0.05, v: 0.6 }); tone(t, { f: 110, f2: 55, d: 0.12, v: 0.3 }) },
  on(t) { tone(t, { f: 660, d: 0.06, v: 0.07 }); tone(t + 0.06, { f: 990, d: 0.09, v: 0.07 }) },
  error(t) { tone(t, { f: 220, f2: 180, type: 'triangle', d: 0.12, v: 0.08 }); tone(t + 0.1, { f: 196, f2: 160, type: 'triangle', d: 0.14, v: 0.07 }) },
}

let lastAt = {}
export function play(name, { gap = 0.025 } = {}) {
  if (!soundOn() || rm()) return
  const c = boot()
  if (!c || c.state !== 'running') { c && c.resume(); if (!c || c.state !== 'running') return }
  const now = c.currentTime
  if (lastAt[name] && now - lastAt[name] < gap) return // never stack the same sound
  lastAt[name] = now
  try { LIB[name] && LIB[name](now + 0.002) } catch {}
}

/* The projector: a soft 24fps flutter under the Reading. Returns a stop(). */
export function projector() {
  if (!soundOn() || rm()) return () => {}
  const c = boot()
  if (!c) return () => {}
  const t = c.currentTime
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true
  const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 0.6
  const g = c.createGain(); g.gain.value = 0
  const lfo = c.createOscillator(); lfo.frequency.value = 24; const lg = c.createGain(); lg.gain.value = 0.018
  lfo.connect(lg).connect(g.gain)
  const hum = c.createOscillator(); hum.frequency.value = 48; const hg = c.createGain(); hg.gain.value = 0
  hum.connect(hg).connect(out)
  s.connect(fl).connect(g).connect(out)
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 1.2)
  hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(0.02, t + 1.5)
  s.start(); lfo.start(); hum.start()
  return () => {
    const n = c.currentTime
    g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + 0.6)
    hg.gain.cancelScheduledValues(n); hg.gain.setValueAtTime(hg.gain.value, n); hg.gain.linearRampToValueAtTime(0, n + 0.6)
    setTimeout(() => { try { s.stop(); lfo.stop(); hum.stop() } catch {} }, 700)
  }
}

/* Delegated: buttons and fields make their own sounds, so every screen gets them for free.
   An element can opt into a specific sound with data-sfx, or out with data-sfx="none". */
if (typeof window !== 'undefined') {
  const kind = (el) => {
    const x = el.closest('[data-sfx]')
    if (x) return x.getAttribute('data-sfx')
    if (el.closest('.btn.lit, .btn:not(.ghost)')) return 'primary'
    if (el.closest('.btn, .link-spec, .text-link, .chip, .seg-b, .rail-item, .tab, .lockup, .row-btn')) return 'secondary'
    return null
  }
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const el = e.target
    if (!el.closest || el.closest('[disabled]')) return
    const k = kind(el)
    if (k && k !== 'none') play(k)
  }, { capture: true, passive: true })
  let lastHover = null
  addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !e.target.closest) return
    const el = e.target.closest('.btn, .rail-item, .seg-b, .chip, .w-item, .hr-item, .row-item, .n-card, .axis')
    if (el && el !== lastHover && !el.closest('[disabled]')) play('hover', { gap: 0.06 })
    lastHover = el
  }, { passive: true })
  addEventListener('keydown', (e) => {
    const t = e.target
    if (!t || t.tagName !== 'INPUT' || e.metaKey || e.ctrlKey) return
    if (e.key === 'Backspace') play('delete', { gap: 0.03 })
    else if (e.key === 'Enter') play('primary')
    else if (e.key.length === 1) play('key', { gap: 0.02 })
  })
}
