import { useSyncExternalStore } from 'react'

// One viewer's state. Lives in this browser only; the product renders fine without it.
const KEY = 'selects.v1'
const empty = { name: '', positive: [], negative: [], axes: [], hour: 22, letterboxd: '', onboarded: false, kept: [], watchlist: [], logged: [], dismissed: [], torn: {} }

let state = read()
const subs = new Set()

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty }
  } catch {
    return { ...empty }
  }
}
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

export const getState = () => state
export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  write()
  subs.forEach((f) => f())
}
export function reset() {
  state = { ...empty }
  write()
  subs.forEach((f) => f())
}
export function useStore(sel = (s) => s) {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => sel(state),
  )
}
export const toggleIn = (key, id) =>
  setState((s) => ({ [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] }))

// a tiny haptic, where the platform allows it
export const tick = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} }
