import { useMemo, useRef, useState } from 'react'
import { Arrow } from '../components/Icons.jsx'
import { motion } from 'framer-motion'
import Assembly from '../components/Assembly.jsx'
import { Counter, Mark, useRoute } from '../components/ui.jsx'
import { film, poster } from '../lib/films.js'
import { scoreAll, insights, thread } from '../lib/taste.js'
import { useStore, reset, setState } from '../lib/store.js'
import { play } from '../lib/sound.js'
import { emit } from '../components/Motes.jsx'

export default function You({ arch }) {
  const s = useStore()
  const { go } = useRoute()
  const c = s.colour || '#3A6E85'
  const reads = useMemo(() => scoreAll(s).slice(0, 24).map((e) => e.f.id), [s.positive.join(','), s.negative.join(',')])
  const ins = useMemo(() => insights(s), [s.positive.join(','), s.negative.join(','), s.hour, s.axes.join(',')])
  const th = useMemo(() => thread([...s.positive, ...reads]), [reads])
  // copying is a splice you can see: the line is selected, the light carries it to the button, the button confirms
  const [copied, setCopied] = useState(0) // 0 idle · 1 selecting · 2 copied
  const lineRef = useRef(null), btnRef = useRef(null), printRef = useRef(null)
  const line = `${arch ? arch.name : 'My negative'} · ${c} · ${s.positive.map((id) => film(id)?.t).filter(Boolean).slice(0, 3).join(' / ')} · selects`
  const copy = () => {
    if (copied) return
    setCopied(1)
    const fallback = () => {
      // no clipboard access: leave a real selection the person can copy by hand
      const r = document.createRange(); r.selectNodeContents(lineRef.current); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r)
    }
    try { navigator.clipboard.writeText(line).catch(fallback) } catch { fallback() }
    setTimeout(() => {
      emit({ from: lineRef.current, to: btnRef.current, n: 60, colour: '#ff3b14', spread: 0.2, dur: [0.4, 0.7], size: 1.3, onDone: () => { setCopied(2); play('copy') } })
    }, 380)
    setTimeout(() => setCopied(0), 3200)
  }
  const hour = s.hour ?? 22

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
        <div className="row-head"><h3 className="row-title">The Assembly</h3>{th && <span className="spec">Thread · {th.who}</span>}</div>
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
        <div className="row-head"><h3 className="row-title">The Print</h3></div>
        <div className="print-wrap">
          <motion.div className="print" whileHover={{ rotate: -1.2, y: -6 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
            <div className="print-field">
              <Mark size={30} />
              <div className="print-posters">{s.positive.slice(0, 3).map((id) => <img key={id} src={poster(id)} alt="" />)}</div>
            </div>
            <div className="print-body">
              <span className="spec">{(s.name || 'Someone').toUpperCase()} IS A</span>
              <b>{arch ? arch.name : ''}</b>
              <span className="spec">{c} · selects</span>
            </div>
          </motion.div>
          <div className="print-side">
            <code className={`print-line ${copied ? 'sel' : ''}`} ref={lineRef}><span>{line}</span></code>
            <button ref={btnRef} className={`btn copy-btn ${copied === 2 ? 'done' : ''}`} onClick={copy} data-sfx="secondary">
              <span className="cb-a">Copy the line <span className="arr"><Arrow /></span></span>
              <span className="cb-b" aria-hidden={copied !== 2}><svg width="14" height="11" viewBox="0 0 12 10"><path d="M1 5.2L4.2 8.4L11 1.6" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg> On your clipboard</span>
            </button>
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
