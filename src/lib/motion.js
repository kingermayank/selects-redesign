/* One motion language, borrowed from the booth.
   out: a frame settling in the gate. inOut: a shutter. gate: the projector catching. */
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.4, 0, 1, 1],
}
export const SPRING = { snap: { type: 'spring', stiffness: 520, damping: 38 }, soft: { type: 'spring', stiffness: 200, damping: 24 } }
// a page arriving: the lamp strikes, dips, and holds, like a projector coming up to speed
export const GATE_IN = { opacity: [0, 1, 0.62, 1], y: [10, 0, 0, 0], transition: { duration: 0.6, times: [0, 0.28, 0.4, 1], ease: 'linear' } }
export const GATE_OUT = { opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.18, ease: EASE.in } }
