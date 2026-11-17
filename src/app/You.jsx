import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Assembly from '../components/Assembly.jsx'
import { Counter, Mark, useRoute } from '../components/ui.jsx'
import { film, poster } from '../lib/films.js'
import { scoreAll, insights, thread } from '../lib/taste.js'
import { useStore, reset, setState } from '../lib/store.js'

export default function You({ arch }) {
  const s = useStore()
  const { go } = useRoute()
  const c = s.colour || '#3A6E85'
  const reads = useMemo(() => scoreAll(s).slice(0, 24).map((e) => e.f.id), [s.positive.join(','), s.negative.join(',')])
  const ins = useMemo(() => insights(s), [s.positive.join(','), s.negative.join(','), s.hour, s.axes.join(',')])
  const th = useMemo(() => thread([...s.positive, ...reads]), [reads])
  const [copied, setCopied] = useState(false)
  const line = `${arch ? arch.name : 'My negative'} · ${c} · ${s.positive.map((id) => film(id)?.t).filter(Boolean).slice(0, 3).join(' / ')} — selects`
  const copy = async () => { try { await navigator.clipboard.writeText(line); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { setCopied(false) } }
  const hour = s.hour ?? 22

  return (
    <div className="you" style={{ '--you': c }}>
      <header className="you-head">
        <div className="you-id">
          <span className="you-av" style={{ background: c }}>{(s.name || 'Y').slice(0, 1).toUpperCase()}</span>
          <div>
            <span className="spec">You · the negative</span>
            <h1 className="you-name">{s.name || 'You'}</h1>
          </div>
        </div>
        <div className="you-fit"><h2 className="you-arch" style={{ '--n': arch ? arch.name.length : 4 }}>{arch ? arch.name : '—'}</h2></div>
        <p className="you-line">{arch ? arch.line : ''}</p>
        <div className="you-stats">
          {[[s.positive.length + (s.kept || []).length, 'kept'], [s.negative.length, 'struck'], [(s.logged || []).length, 'logged'], [`${((hour + 11) % 12) + 1}${hour >= 12 ? 'P' : 'A'}`, 'lights down']].map(([n, l]) => (
            <div key={l} className="ys">
              <span className="numeral">{typeof n === 'number' ? <Counter to={n} duration={1.1} /> : n}</span>
              <span className="spec">{l}</span>
            </div>
          ))}
          <div className="ys colour"><span className="swatch" style={{ background: c }} /><span className="numeral">{c}</span><span className="spec">your colour</span></div>
        </div>
      </header>

      <section className="you-assembly">
        <div className="row-head"><div><span className="spec lit">The Assembly</span><h3 className="row-title">{th ? `${th.who} is the thread` : 'Your constellation'}</h3></div><span className="spec">drag a star · tap to open</span></div>
        <div className="ya-stage">
          <Assembly ids={[...s.positive, ...reads]} you={c} height={'100%'} youLabel={(s.name || 'YOU').toUpperCase()} onOpen={(f) => go(`film-${f.id}`)} />
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
        <div className="row-head"><div><span className="spec">The Print</span><h3 className="row-title">Your negative, printed</h3></div></div>
        <div className="print-wrap">
          <motion.div className="print" whileHover={{ rotate: -1.2, y: -6 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
            <div className="print-field">
              <Mark size={30} lit={2} litColour="#efede9" ink="rgba(10,10,11,.85)" />
              <div className="print-posters">{s.positive.slice(0, 3).map((id) => <img key={id} src={poster(id)} alt="" />)}</div>
            </div>
            <div className="print-body">
              <span className="spec">{(s.name || 'Someone').toUpperCase()} IS A</span>
              <b>{arch ? arch.name : ''}</b>
              <span className="spec">{c} · selects</span>
            </div>
          </motion.div>
          <div className="print-side">
            <p className="lead">One card, set in your colour. Post it, send it, let someone argue with it.</p>
            <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy the line'} <span className="arr">→</span></button>
            <code className="print-line">{line}</code>
          </div>
        </div>
      </section>

      <section className="you-settings">
        <button className="btn ghost" onClick={() => { setState({ onboarded: false }); go('start', { wipe: true }) }}>Retake the read</button>
        <button className="link-spec" onClick={() => { reset(); go('', { wipe: true }) }}>Clear everything on this device</button>
      </section>
    </div>
  )
}
