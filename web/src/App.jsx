import { useEffect, useMemo, useState } from 'react'
import Treemap from './components/Treemap.jsx'
import {
  VIEWS, STATE_COLOR, LEVEL_LABEL, LEVEL_PLURAL, confidenceColor,
  fmtMoneyKeur, fmtCount, fmtPct, fmtRatio,
} from './lib.js'

// Colonne tabella. get = accessor valore; field = chiave in s.fields per lo stato.
const COLS = [
  { key: 'name',           label: 'Settore',        kind: 'name' },
  { key: 'fatturato',      label: 'Fatturato',      kind: 'money', get: (s) => s.raw.fatturato_keur,      field: 'dimensione' },
  { key: 'produttivita',   label: 'VA / addetto',   kind: 'money', get: (s) => s.fields.produttivita.value, field: 'produttivita' },
  { key: 'redditivita',    label: 'MOL / VA',       kind: 'pct',   get: (s) => s.fields.redditivita.value,  field: 'redditivita' },
  { key: 'struttura',      label: 'Add. / impresa', kind: 'ratio', get: (s) => s.fields.struttura.value,    field: 'struttura' },
  { key: 'crescita',       label: 'CAGR fatt.',     kind: 'pct',   get: (s) => s.fields.crescita.value,     field: 'crescita' },
  { key: 'concentrazione', label: 'Dispersione',    kind: 'ratio', get: (s) => s.fields.concentrazione.value, field: 'concentrazione' },
  { key: 'coverage',       label: 'Coverage',       kind: 'meter', get: (s) => s.coverage },
  { key: 'confidence',     label: 'Confidence',     kind: 'meter', get: (s) => s.confidence },
]

// Viste-lente (L3): preset di metrica-area + ordinamento. Nessun punteggio composito.
const PRESETS = [
  { id: 'fatturato',     label: 'Dimensione',     size: 'fatturato',       sort: 'fatturato',    dir: 'desc' },
  { id: 'produttivita',  label: 'Produttività',   size: 'valore_aggiunto', sort: 'produttivita', dir: 'desc' },
  { id: 'redditivita',   label: 'Redditività',    size: 'fatturato',       sort: 'redditivita',  dir: 'desc' },
  { id: 'crescita',      label: 'Crescita',       size: 'fatturato',       sort: 'crescita',     dir: 'desc' },
  { id: 'frammentazione',label: 'Frammentazione', size: 'imprese',         sort: 'struttura',    dir: 'asc'  },
]

function fmtCell(kind, v) {
  if (v == null) return '—'
  if (kind === 'money') return fmtMoneyKeur(v)
  if (kind === 'pct') return fmtPct(v)
  if (kind === 'ratio') return fmtRatio(v)
  return v
}

export default function App() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [path, setPath] = useState([])               // codici dal vertice
  const [sizeKey, setSizeKey] = useState('fatturato') // metrica-area treemap
  const [colorMetric, setColorMetric] = useState('confidence')
  const [preset, setPreset] = useState('fatturato')
  const [sort, setSort] = useState({ key: 'fatturato', dir: 'desc' })

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}sectors.json`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(setData)
      .catch((e) => setErr(String(e)))
  }, [])

  const { index, childrenOf } = useMemo(() => {
    const index = new Map(), childrenOf = new Map()
    if (data) {
      for (const s of data.sectors) index.set(s.code, s)
      for (const s of data.sectors) {
        const k = s.parent ?? '__root__'
        if (!childrenOf.has(k)) childrenOf.set(k, [])
        childrenOf.get(k).push(s)
      }
    }
    return { index, childrenOf }
  }, [data])

  if (err) return <div className="screen err">Errore nel caricamento di sectors.json: {err}</div>
  if (!data) return <div className="screen">Carico l'economia…</div>

  const currentCode = path.length ? path[path.length - 1] : null
  const items = (childrenOf.get(currentCode ?? '__root__') || []).slice()

  const col = COLS.find((c) => c.key === sort.key) || COLS[1]
  items.sort((a, b) => {
    if (col.kind === 'name') return sort.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    const va = col.get(a), vb = col.get(b)
    const na = va == null ? -Infinity : va, nb = vb == null ? -Infinity : vb
    return sort.dir === 'asc' ? na - nb : nb - na
  })

  const view = VIEWS[sizeKey]
  const m = data.meta
  const ns = m.north_star_pct_economy_high_conf

  const applyPreset = (p) => { setPreset(p.id); setSizeKey(p.size); setSort({ key: p.sort, dir: p.dir }) }
  const drill = (code) => setPath([...path, code])
  const toLevel = (i) => setPath(path.slice(0, i))
  const clickHeader = (c) => {
    if (c.kind === 'meter' || c.kind === 'name' || c.get) {
      setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))
    }
  }

  // breadcrumb
  const crumbs = [{ label: 'Economia', i: 0 }]
  path.forEach((code, i) => {
    const s = index.get(code)
    crumbs.push({ label: `${code} · ${s ? s.name : ''}`, i: i + 1 })
  })

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>Sfera</h1>
          <p className="tag">L'economia italiana a 4 cifre ATECO, con l'onestà di dichiarare di quali parti fidarsi.</p>
        </div>
        <div className="northstar">
          <div className="ns-val">{ns}%</div>
          <div className="ns-lbl">dell'economia (pesata sul fatturato)<br />con Confidence ≥ {m.confidence_threshold}</div>
          <div className="ns-sub">{m.n_classes_4d} classi · dati ISTAT SBS {m.latest_year}</div>
        </div>
      </header>

      <nav className="crumbs">
        {crumbs.map((c, k) => (
          <span key={k}>
            {k > 0 && <span className="sep">▸</span>}
            <button className={'crumb' + (k === crumbs.length - 1 ? ' here' : '')} onClick={() => toLevel(c.i)}>{c.label}</button>
          </span>
        ))}
        <span className="count">{items.length} {items[0] ? (items.length > 1 ? LEVEL_PLURAL : LEVEL_LABEL)[items[0].level] : 'voci'}</span>
      </nav>

      <div className="controls">
        <div className="ctl">
          <span className="ctl-lbl">Vista</span>
          {PRESETS.map((p) => (
            <button key={p.id} data-preset={p.id} className={'chip' + (preset === p.id ? ' on' : '')} onClick={() => applyPreset(p)}>{p.label}</button>
          ))}
        </div>
        <div className="ctl">
          <span className="ctl-lbl">Area</span>
          {Object.entries(VIEWS).map(([k, v]) => (
            <button key={k} data-size={k} className={'chip sm' + (sizeKey === k ? ' on' : '')} onClick={() => setSizeKey(k)}>{v.label}</button>
          ))}
        </div>
        <div className="ctl">
          <span className="ctl-lbl">Colore</span>
          <button data-color="confidence" className={'chip sm' + (colorMetric === 'confidence' ? ' on' : '')} onClick={() => setColorMetric('confidence')}>Confidence</button>
          <button data-color="coverage" className={'chip sm' + (colorMetric === 'coverage' ? ' on' : '')} onClick={() => setColorMetric('coverage')}>Coverage</button>
        </div>
      </div>

      <Treemap items={items} sizeKey={view.sizeKey} viewKind={view.kind} colorMetric={colorMetric} onDrill={drill} />

      <div className="legend">
        <span>Area = {view.label}</span>
        <span className="gradient"><i style={{ background: confidenceColor(20) }} /><i style={{ background: confidenceColor(60) }} /><i style={{ background: confidenceColor(100) }} /> Colore = {colorMetric === 'coverage' ? 'Coverage' : 'Confidence'} (sbiadito = non fidarti)</span>
        <span className="states">
          {Object.entries(STATE_COLOR).map(([s, c]) => (
            <span key={s} className="st"><i style={{ background: c }} /> {s}</span>
          ))}
        </span>
        <span className="hint">clic su un riquadro o su una riga grande per scendere di livello</span>
      </div>

      <table className="grid">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} onClick={() => clickHeader(c)} className={(c.kind === 'name' ? 'l' : 'r') + (sort.key === c.key ? ' sorted' : '')}>
                {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const drillable = s.level !== 'class'
            return (
              <tr key={s.code} data-code={s.code} className={drillable ? 'drillable' : ''} onClick={() => drillable && drill(s.code)}>
                <td className="l">
                  <span className="code">{s.code}</span> {s.name}
                </td>
                {COLS.slice(1).map((c) => {
                  if (c.kind === 'meter') {
                    const v = c.get(s)
                    return (
                      <td key={c.key} className="r">
                        <span className="meter"><i style={{ width: v + '%', background: confidenceColor(v) }} /></span>
                        <span className="mv">{Math.round(v)}</span>
                      </td>
                    )
                  }
                  const fld = s.fields[c.field]
                  const st = fld ? fld.state : 'assente'
                  return (
                    <td key={c.key} className="r">
                      <span className="dot" style={{ background: STATE_COLOR[st] }} title={st} />
                      {fmtCell(c.kind, c.get(s))}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <footer className="foot">
        <span>{m.source}</span>
        <span>Turnover e concentrazione: dichiarati assenti a 4 cifre (fonti separate, roadmap v1.1). Sezioni K (finanza) e O (PA) fuori perimetro SBS.</span>
      </footer>
    </div>
  )
}
