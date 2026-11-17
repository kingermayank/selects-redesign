import { useMemo, useState } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Img, useRoute } from '../components/ui.jsx'
import Assembly from '../components/Assembly.jsx'
import { Row, Bars } from './parts.jsx'
import { film, backdrop, logo, colour, fmtRuntime, films } from '../lib/films.js'
import { scoreAll, reason, reasonShort } from '../lib/taste.js'
import { useStore, setState, tick, toggleIn } from '../lib/store.js'

export default function Film({ id }) {
  const f = film(id)
  const s = useStore()
  const { go } = useRoute()
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 600], [0, 160])
  const sc = useTransform(scrollY, [0, 600], [1.04, 1.16])
  const all = useMemo(() => scoreAll(s), [s.positive.join(','), s.negative.join(',')])
  const entry = all.find((e) => e.f.id === id)
  const rank = entry ? all.indexOf(entry) : -1
  // match: the room (critics) and you, 60 / 40
  const you = entry ? Math.max(0, Math.min(1, 1 - rank / all.length)) : s.positive.includes(id) ? 1 : 0.3
  const match = Math.round(((f?.sc || 60) / 100) * 60 + you * 40)
  const more = useMemo(() => scoreAll({ positive: [id], negative: s.negative }).slice(0, 14).map((e) => ({ f: e.f, note: reasonShort(e) })), [id])
  const dna = useMemo(() => [id, ...scoreAll({ positive: [id] }).slice(0, 14).map((e) => e.f.id)], [id])
  const logged = (s.logged || []).find((l) => l.id === id)
  const [rated, setRated] = useState(logged ? logged.r : 0)
  if (!f) return <div className="page-head"><h1 className="page-h">Not on file.</h1></div>
  const c = colour(f)
  const inList = (s.watchlist || []).includes(id)
  const kept = (s.kept || []).includes(id) || s.positive.includes(id)
  const people = [
    ['Director', f.dir], ['Cinematography', f.dp], ['Music', f.mus], ['Editing', f.ed], ['Writing', f.wr],
  ].filter(([, v]) => v && v.length)
  const log = (r) => {
    tick(10); setRated(r)
    const today = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 86400000)
    setState((st) => ({ logged: [...(st.logged || []).filter((l) => l.id !== id), { id, r, day: today }] }))
  }

  return (
    <article className="film" style={{ '--film': c }}>
      <div className="film-hero">
        <motion.div className="film-bg" style={{ y, scale: sc }}><Img src={backdrop(id)} alt="" eager /></motion.div>
        <div className="film-shade" />
        <button className="film-back link-spec" onClick={() => history.length > 1 ? history.back() : go('home')}><Arrow dir="left" /> Back</button>
        <div className="film-title">
          <span className="spec">{f.y} · {fmtRuntime(f.rt)} · {f.cert || 'NR'} · {f.g.slice(0, 2).join(' / ')}</span>
          {f.logo ? <Img src={logo(id)} alt={f.t} className="film-logo" eager /> : <h1 className="verdict film-h">{f.t}</h1>}
          {f.tg && <p className="film-tag">{f.tg}</p>}
        </div>
      </div>

      <div className="film-body">
        <div className="film-main">
          <section className="select-score">
            <span className="spec lit">Select</span>
            <div className="ss-row">
              <Bars value={match / 20} size={34} />
              <span className="numeral ss-n">{match}</span>
            </div>
            <p className="ss-why">{entry ? reason(entry) : s.positive.includes(id) ? 'You kept this one.' : ''}</p>
          </section>

          <div className="film-actions">
            <button className={`btn ${kept ? 'ghost' : 'lit'}`} onClick={() => { tick(12); setState((st) => ({ kept: [...new Set([...(st.kept || []), id])] })) }} disabled={kept}>{kept ? 'Kept' : 'Keep for tonight'} <span className="arr"><Arrow /></span></button>
            <button className={`btn ghost ${inList ? 'on' : ''}`} onClick={() => { tick(6); toggleIn('watchlist', id) }}>{inList ? 'On the watchlist' : 'Watchlist'}</button>
            <div className="log">
              <span className="spec">{rated ? 'Logged' : 'Rate'}</span>
              <Bars value={rated} size={22} onChange={log} />
            </div>
          </div>

          <p className="film-ov">{f.ov}</p>

          <section className="people">
            {people.map(([k, v]) => (
              <div key={k} className="person-row">
                <span className="spec">{k}</span>
                <span>{v.map((p, i) => <span key={p}><button className="person" onClick={() => { setState({ huntQuery: p }); go('hunt') }}>{p}</button>{i < v.length - 1 ? ', ' : ''}</span>)}</span>
              </div>
            ))}
            <div className="person-row"><span className="spec">Cast</span><span className="cast">{f.cast.slice(0, 6).map((p, i) => <span key={p}><button className="person" onClick={() => { setState({ huntQuery: p }); go('hunt') }}><b>{p}</b></button>{f.roles[i] ? <em> as {f.roles[i]}</em> : null}</span>)}</span></div>
          </section>
        </div>

        <aside className="film-dna">
          <div className="row-head"><h3 className="row-title">DNA</h3></div>
          <div className="dna-stage"><Assembly ids={dna} you={c} height={'100%'} youLabel={f.t.toUpperCase()} onOpen={(x) => go(`film-${x.id}`)} intro={false} /></div>
          <div className="film-kw">{f.k.slice(0, 10).map((k) => <span key={k} className="chip">{k}</span>)}</div>
        </aside>
      </div>

      <Row title="More like this" items={more} />
    </article>
  )
}
