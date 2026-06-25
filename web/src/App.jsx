import { useEffect, useMemo, useState } from 'react'
import Treemap from './components/Treemap.jsx'
import CompareView from './components/CompareView.jsx'
import ScreenerView from './components/ScreenerView.jsx'
import MarketView from './components/MarketView.jsx'
import InfoDot from './components/InfoDot.jsx'
import Legend from './components/Legend.jsx'
import { METRICS } from './metrics.js'
import {
  VIEWS, LEVEL_LABEL, LEVEL_PLURAL, growthColor,
  fmtMoneyKeur, fmtCount, fmtPct, fmtRatio,
} from './lib.js'

const BASE = import.meta.env.BASE_URL

const COLS = [
  { key: 'name',         label: 'Settore',        kind: 'name' },
  { key: 'fatturato',    label: 'Fatturato',      kind: 'money', get: (s) => s.raw.fatturato_keur },
  { key: 'valore_agg',   label: 'Valore aggiunto',kind: 'money', get: (s) => s.raw.valore_aggiunto_keur },
  { key: 'produttivita', label: 'VA / addetto',   kind: 'money', get: (s) => s.fields.produttivita.value },
  { key: 'redditivita',  label: 'MOL / VA',       kind: 'pct',   get: (s) => s.fields.redditivita.value },
  { key: 'struttura',    label: 'Add. / impresa', kind: 'ratio', get: (s) => s.fields.struttura.value },
  { key: 'crescita',     label: 'CAGR fatt.',     kind: 'pct',   get: (s) => s.fields.crescita.value },
  { key: 'occupati',     label: 'Occupati',       kind: 'count', get: (s) => s.raw.occupati },
  { key: 'imprese',      label: 'Imprese',        kind: 'count', get: (s) => s.raw.imprese },
]

const PRESETS = [
  { id: 'fatturato',      label: 'Dimensione',     size: 'fatturato',       sort: 'fatturato',    dir: 'desc' },
  { id: 'produttivita',   label: 'Produttività',   size: 'valore_aggiunto', sort: 'produttivita', dir: 'desc' },
  { id: 'redditivita',    label: 'Redditività',    size: 'fatturato',       sort: 'redditivita',  dir: 'desc' },
  { id: 'crescita',       label: 'Crescita',       size: 'fatturato',       sort: 'crescita',     dir: 'desc' },
  { id: 'frammentazione', label: 'Frammentazione', size: 'imprese',         sort: 'struttura',    dir: 'asc'  },
]

function fmtCell(kind, v) {
  if (v == null) return '—'
  if (kind === 'money') return fmtMoneyKeur(v)
  if (kind === 'pct') return fmtPct(v)
  if (kind === 'ratio') return fmtRatio(v)
  if (kind === 'count') return fmtCount(v)
  return v
}

export default function App() {
  const [countries, setCountries] = useState(null)
  const [country, setCountry] = useState(null)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [path, setPath] = useState([])
  const [sizeKey, setSizeKey] = useState('fatturato')
  const [preset, setPreset] = useState('fatturato')
  const [sort, setSort] = useState({ key: 'fatturato', dir: 'desc' })
  const [mode, setMode] = useState('explore')

  // indice paesi
  useEffect(() => {
    fetch(`${BASE}index.json`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then((idx) => { setCountries(idx.countries); setCountry(idx.default || idx.countries[0]?.code) })
      .catch((e) => setErr(String(e)))
  }, [])

  // dataset del paese selezionato
  useEffect(() => {
    if (!country) return
    setData(null); setPath([])
    fetch(`${BASE}countries/${country}.json`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(setData)
      .catch((e) => setErr(String(e)))
  }, [country])

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

  if (err) return <div className="screen err">Errore nel caricamento dati: {err}</div>
  if (!countries || !data) return <div className="screen">Carico l'economia…</div>

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
  const srcShort = (m.source || '').includes('ISTAT') ? 'ISTAT' : 'Eurostat'
  const granLabel = m.max_level === 'class' ? '4 cifre ATECO' : '3 cifre NACE'

  const applyPreset = (p) => { setPreset(p.id); setSizeKey(p.size); setSort({ key: p.sort, dir: p.dir }) }
  const drill = (code) => setPath([...path, code])
  const toLevel = (i) => setPath(path.slice(0, i))
  const clickHeader = (c) => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))

  const crumbs = [{ label: 'Economia', i: 0 }]
  path.forEach((code, i) => {
    const s = index.get(code)
    crumbs.push({ label: `${code} · ${s ? s.name : ''}`, i: i + 1 })
  })

  return (
    <div className="app">
      <header className="hero">
        <h1>Sfera</h1>
        <div className="modes">
          <button className={'mode' + (mode === 'explore' ? ' on' : '')} onClick={() => setMode('explore')}>Esplora paese</button>
          <button className={'mode' + (mode === 'compare' ? ' on' : '')} onClick={() => setMode('compare')}>Confronta paesi</button>
          <button className={'mode' + (mode === 'screener' ? ' on' : '')} onClick={() => setMode('screener')}>Screener</button>
          <button className={'mode' + (mode === 'mercato' ? ' on' : '')} onClick={() => setMode('mercato')}>Mercato</button>
        </div>
      </header>

      {mode === 'compare' ? <CompareView />
       : mode === 'screener' ? <ScreenerView data={data} country={country} countries={countries} />
       : mode === 'mercato' ? <MarketView data={data} country={country} countries={countries} />
       : (<>
      <div className="subhead">
        <select className="country-sel" value={country} onChange={(e) => setCountry(e.target.value)}>
          {countries.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
        </select>
        <span className="year">dati {srcShort} · {m.latest_year} · {granLabel}</span>
      </div>
      <p className="tag">L'economia di <b>{m.country_name}</b>, settore per settore. Area = dimensione · colore = crescita (CAGR).</p>

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
      </div>

      <Treemap items={items} sizeKey={view.sizeKey} viewKind={view.kind} onDrill={drill} hasChildren={(code) => (childrenOf.get(code) || []).length > 0} />

      <div className="legend">
        <span>Area = <b>{view.label}</b></span>
        <span className="gradient">
          <i style={{ background: growthColor(-0.08) }} /><i style={{ background: growthColor(0) }} /><i style={{ background: growthColor(0.08) }} />
          Colore = crescita CAGR (rosso −8% → verde +8%)
        </span>
        <span className="hint">clic su un riquadro o riga per scendere · clic intestazione per ordinare</span>
      </div>

      <table className="grid">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={(c.kind === 'name' ? 'l' : 'r') + (sort.key === c.key ? ' sorted' : '')}>
                <span className="th-sort" onClick={() => clickHeader(c)}>{c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}</span>
                {c.kind !== 'name' && METRICS[c.key] && <InfoDot text={METRICS[c.key].info} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const drillable = s.level !== 'class' && (childrenOf.get(s.code) || []).length > 0
            return (
              <tr key={s.code} data-code={s.code} className={drillable ? 'drillable' : ''} onClick={() => drillable && drill(s.code)}>
                <td className="l"><span className="code">{s.code}</span> {s.name}</td>
                {COLS.slice(1).map((c) => (
                  <td key={c.key} className="r">{fmtCell(c.kind, c.get(s))}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <Legend ids={['fatturato', 'valore_agg', 'produttivita', 'redditivita', 'struttura', 'crescita', 'occupati', 'imprese']} />
      </>)}

      <footer className="foot">
        <span>{m.source}</span>
        <span>Valori monetari in € · CAGR sull'orizzonte disponibile · «—» = dato non disponibile (segreto statistico o non pubblicato). Italia a 4 cifre (ISTAT); resto d'Europa a 3 cifre (Eurostat).</span>
      </footer>
    </div>
  )
}
