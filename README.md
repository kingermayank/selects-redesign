# Selects: redesign

Landing page, onboarding and product (Home, Hunt, Library, You, film pages) for web and mobile,
built on the Selects design system from Figma: ink `#0A0A0B`, bone `#EFEDE9`, one rationed accent
`#FF3B14`, Archivo (width axis) for everything that argues, Martian Mono for everything measured,
radius zero, and the 13.5° bar atom everywhere.

## Run

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/ (deploys to Vercel as a Vite project)
npm run build:artifact # same, plus dist/page.html and media packs for the claude.ai host
```

Routes are plain hashes: `#` landing, `#start` onboarding, `#home` `#hunt` `#library` `#you`, `#film-949`.

## What is where

| Path | What it does |
| --- | --- |
| `src/gl/strip.js` | The 35mm strip shader: amber base, 4-perf sprockets, edge print, frames that develop from negative to positive under the light. Bokeh, beam, finish pass. |
| `src/gl/reel.js` | Landing hero scene. Pointer parallax, scroll dolly, portrait-specific path. |
| `src/gl/develop.js` | Onboarding "Reading": the poster deck dissolves into chromatic particles, pours through the gate, and comes back up as a developing negative. |
| `src/components/ui.jsx` | The Mark (five bars that re-arrange per screen, clap animation), Poster tilt + glare, viewfinder cursor, slate-wipe router, counters, rise text. |
| `src/components/Ticket.jsx` | The Ticket. Drag the stub past the perforation to tear it. |
| `src/components/Assembly.jsx` | Force-directed constellation of films linked by shared people. |
| `src/lib/taste.js` | The read: scoring, the daily ticket (two close, one reach), reasons, archetypes, Oklab "your colour", insights. |
| `src/onboarding/` | Splash clap, name ticket, positive/negative walls, neutral axes, the hour dial, Letterboxd, Reading, the Negative, Insights. |
| `src/app/` | Shell (rail on desktop, tab bar on mobile), Home, Hunt (with the Viewfinder taste map), Library (Strip, Wallet), You (Assembly, Print), Film. |
| `scripts/scrape.py`, `scripts/process.py` | Build the catalogue from TMDB's public pages and image CDN: posters, backdrops, logos, palettes, taste-map coordinates. |

## Wiring to the real app

State is local (`src/lib/store.js`, localStorage). To connect it to the production app, swap the store for the
Firebase user document and replace `public/data/films.json` with live TMDB calls; `taste.js` only needs film
objects with `g, k, dir, dp, mus, cast, recs, pal, mx, my`.

Film data and imagery come from TMDB. Selects is not endorsed or certified by TMDB.
