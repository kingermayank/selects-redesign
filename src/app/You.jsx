import { useMemo, useRef, useState } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion } from 'framer-motion'
import Wheel, { stageOf } from '../components/Wheel.jsx'
import Story from './Story.jsx'
import { Counter, Mark, useRoute } from '../components/ui.jsx'
import { film, poster } from '../lib/films.js'
import { scoreAll, insights, thread } from '../lib/taste.js'
import { useStore, reset, setState } from '../lib/store.js'
import { play } from '../lib/sound.js'

export default function You({ arch }) {
  const s = useStore()
  const { go } = useRoute()
  const c = s.colour || '#3A6E85'
  const reads = useMemo(() => scoreAll(s).slice(0, 24).map((e) => e.f.id), [s.positive.join(','), s.negative.join(',')])
  const ins = useMemo(() => insights(s), [s.positive.join(','), s.negative.join(','), s.hour, s.axes.join(',')])
  const th = useMemo(() => thread([...s.positive, ...reads]), [reads])
  const hour = s.hour ?? 22
  const [known, setKnown] = useState(null)

  return (
    <div className="you" style={{ '--you': c }}>
      <header className="you-head">
        <div className="you-id">
          <span className="you-av" style={{ background: c }}>{(s.name || 'Y').slice(0, 1).toUpperCase()}</span>
          <div>
            <h1 className="you-name">{s.name || 'You'}</h1>
          </div>
        </div>
        <div className="you-fit"><h2 className="you-arch" style={{ '--n': arch ? arch.name.length : 4 }}>{arch ? arch.name : '—'}</h2></div>
        <p className="you-line">{arch ? arch.line : ''}</p>
        <div className="you-stats">
          {[[s.positive.length + (s.kept || []).length, 'kept'], [s.negative.length, 'struck'], [(s.logged || []).length, 'logged'], [`${((hour + 11) % 12) + 1} ${hour >= 12 ? 'PM' : 'AM'}`, 'lights down']].map(([n, l]) => (
            <div key={l} className="ys">
              <span className="numeral">{typeof n === 'number' ? <Counter to={n} duration={1.1} /> : n}</span>
              <span className="spec">{l}</span>
            </div>
          ))}
          <div className="ys colour"><span className="swatch" style={{ background: c }} /><span className="numeral">{c}</span><span className="spec">your colour</span></div>
        </div>
      </header>

      <section className="you-assembly">
        <div className="row-head"><div><h3 className="row-title">The Assembly</h3><p className="ya-sub">How well Selects knows you, craft by craft.</p></div>{known != null && <span className="spec ya-read"><b className="numeral">{Math.round(known * 100)}%</b> exposed · {stageOf(known)[1]}</span>}</div>
        <div className="ya-stage">
          <Wheel ids={[...s.positive, ...(s.kept || []), ...reads]} kept={[...s.positive, ...(s.kept || [])]} you={c} label={s.name ? s.name.split(' ')[0] : 'You'} height="100%" onOpen={(f) => go(`film-${f.id}`)} signals={{ kept: s.positive.length + (s.kept || []).length, struck: s.negative.length, logged: (s.logged || []).length }} onKnown={setKnown} />
        </div>
      </section>

      <section className="you-ins">
        {ins.map((x, i) => (
          <motion.article key={x.k} className={`ins-card ${x.sharp ? 'sharp' : ''}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <span className={`spec ${x.sharp ? 'lit' : ''}`}>{x.k}</span>
            <b className="ins-big">{x.big}</b>
            <p>{x.line}</p>
          </motion.article>
        ))}
      </section>

      <section className="print-sec">
        <div className="row-head"><div><h3 className="row-title">The Print</h3><p className="ya-sub">Your read, as four stories. Share one, or all four.</p></div></div>
        <Story s={s} arch={arch} colour={c} reads={reads} />
      </section>

      <section className="you-settings">
        <button className="btn ghost" onClick={() => { setState({ onboarded: false }); go('start', { wipe: true }) }}>Retake the read</button>
        <button className="link-spec" onClick={() => { reset(); go('', { wipe: true }) }}>Clear everything on this device</button>
      </section>
    </div>
  )
}
