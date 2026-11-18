/* ─────────────────────────────────────────────────────────────
   Tab icons. One glyph per idea in the product, drawn on a 24 grid
   with hard corners and the 13.5° lean. Inactive: outline in the
   current ink. Active: one part lights in the accent and moves.
   ───────────────────────────────────────────────────────────── */
const T = 'transform .45s cubic-bezier(.34,1.56,.64,1), fill .3s, stroke .3s, opacity .3s'
const LIT = 'var(--select)'

function Frame({ size, children, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" strokeLinecap="square" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {children}
    </svg>
  )
}

/* Home: the Ticket. Notched ticket and stub; active, the stub is torn and lit. */
function TicketIcon({ on, size }) {
  return (
    <Frame size={size}>
      <path d="M2.6 6.5H14.4V17.5H2.6V13.7A1.7 1.7 0 0 0 2.6 10.3Z" />
      <path
        d="M16.4 6.5H21.4V10.3A1.7 1.7 0 0 0 21.4 13.7V17.5H16.4Z"
        style={{ fill: on ? LIT : 'none', stroke: on ? LIT : 'currentColor', transformBox: 'fill-box', transformOrigin: '0% 0%', transform: on ? 'translate(0.9px,0.5px) rotate(10deg)' : 'none', transition: T }}
      />
    </Frame>
  )
}

/* Hunt: the Viewfinder. Four brackets; active, they close in on a lit mark. */
function ViewfinderIcon({ on, size }) {
  const k = on ? 2.2 : 0
  const c = (x, y, dx, dy) => `M${x + dx * 5.2} ${y}H${x}V${y + dy * 5.2}`
  return (
    <Frame size={size}>
      <g style={{ transform: `translate(${k}px,${k}px)`, transition: T }}><path d={c(3, 3, 1, 1)} /></g>
      <g style={{ transform: `translate(${-k}px,${k}px)`, transition: T }}><path d={c(21, 3, -1, 1)} /></g>
      <g style={{ transform: `translate(${k}px,${-k}px)`, transition: T }}><path d={c(3, 21, 1, -1)} /></g>
      <g style={{ transform: `translate(${-k}px,${-k}px)`, transition: T }}><path d={c(21, 21, -1, -1)} /></g>
      <path d="M10.6 15.2H12.7L14.4 8.8H12.3Z" style={{ fill: on ? LIT : 'currentColor', stroke: 'none', opacity: on ? 1 : 0.7, transition: T }} />
    </Frame>
  )
}

/* Library: posters on a shelf. Two stand, one leans; active, the leaning one lights and tips further. */
function ShelfIcon({ on, size }) {
  return (
    <Frame size={size}>
      <path d="M2 20.6H22" />
      <path d="M3.6 20.6V6.2H8.2V20.6" style={{ fill: on ? 'currentColor' : 'none', transition: T }} />
      <path d="M10 20.6V8.6H14.4V20.6" style={{ fill: on ? 'currentColor' : 'none', transition: T }} />
      <path
        d="M15.6 20.6V7.4H20V20.6Z"
        style={{ fill: on ? LIT : 'none', stroke: on ? LIT : 'currentColor', transformBox: 'fill-box', transformOrigin: '100% 100%', transform: on ? 'rotate(17deg)' : 'rotate(9deg)', transition: T }}
      />
    </Frame>
  )
}

/* You: the Negative. A disc split on the lean, half developed; active, it flips and lights. */
function NegativeIcon({ on, size }) {
  return (
    <Frame size={size}>
      <circle cx="12" cy="12" r="8.6" />
      <g style={{ transformBox: 'view-box', transformOrigin: '12px 12px', transform: on ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .7s cubic-bezier(.65,0,.35,1)' }}>
        <path d="M13.9 3.6A8.6 8.6 0 0 0 10.1 20.4Z" style={{ fill: on ? LIT : 'currentColor', stroke: 'none', opacity: on ? 1 : 0.55, transition: T }} />
      </g>
    </Frame>
  )
}

const MAP = { home: TicketIcon, hunt: ViewfinderIcon, library: ShelfIcon, you: NegativeIcon }
export function TabIcon({ name, on = false, size = 22 }) {
  const C = MAP[name]
  return C ? <C on={on} size={size} /> : null
}

/* Arrow: neither face ships an arrow glyph, so it is drawn. Sized in em, coloured by the text it sits in. */
export function Arrow({ dir = 'right', className = '' }) {
  return (
    <svg className={`arrow ${className}`} viewBox="0 0 16 10" width="1.1em" height="0.69em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" style={{ transform: dir === 'left' ? 'scaleX(-1)' : undefined }}>
      <path d="M1 5H14.2M10 1.2L14 5L10 8.8" />
    </svg>
  )
}

/* Letterboxd's three dots, used only to say "this field is your Letterboxd". They part when the field is focused. */
export function LbDots({ size = 14, className = '' }) {
  return (
    <svg className={`lb-dots ${className}`} width={size * 2.1} height={size} viewBox="0 0 29 14" aria-hidden="true">
      <circle className="d0" cx="7" cy="7" r="5.6" fill="#FF8000" />
      <circle className="d2" cx="22" cy="7" r="5.6" fill="#40BCF4" />
      <circle className="d1" cx="14.5" cy="7" r="5.6" fill="#00E054" />
    </svg>
  )
}
