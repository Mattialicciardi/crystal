import { useEffect, useMemo, useRef, useState } from 'react'
import Treemap from './components/Treemap.jsx'
import CompareView from './components/CompareView.jsx'
import ScreenerView from './components/ScreenerView.jsx'
import MarketView from './components/MarketView.jsx'
import SectorLens from './components/SectorLens.jsx'
import InfoDot from './components/InfoDot.jsx'
import Legend from './components/Legend.jsx'
import { METRICS, ALL_METRIC_IDS } from './metrics.js'
import {
  VIEWS, LEVEL_LABEL, LEVEL_PLURAL, growthColor, fmtMoneyKeur, fmtCount,
} from './lib.js'

const BASE = import.meta.env.BASE_URL

// Colonne = Settore + TUTTE le metriche (stesso set di Screener/Mercato).
const COLS = [{ key: 'name', label: 'Settore' }, ...ALL_METRIC_IDS.map((id) => ({ key: id, label: METRICS[id].label }))]

const PRESETS = [
  { id: 'fatturato',      label: 'Dimensione',     size: 'fatturato',       sort: 'fatturato',    dir: 'desc' },
  { id: 'produttivita',   label: 'Produttività',   size: 'valore_aggiunto', sort: 'produttivita', dir: 'desc' },
  { id: 'redditivita',    label: 'Redditività',    size: 'fatturato',       sort: 'redditivita',  dir: 'desc' },
  { id: 'crescita',       label: 'Crescita',       size: 'fatturato',       sort: 'crescita',     dir: 'desc' },
  { id: 'frammentazione', label: 'Frammentazione', size: 'imprese',         sort: 'struttura',    dir: 'asc'  },
]

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
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const commandRef = useRef(null)

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

  useEffect(() => { setActiveIndex(-1) }, [query])

  useEffect(() => {
    if (!query) return
    const onDoc = (e) => { if (commandRef.current && !commandRef.current.contains(e.target)) setQuery('') }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [query])

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

  const collectLeafDescendants = (code) => {
    const leaves = []
    const stack = [...(childrenOf.get(code) || [])]
    while (stack.length) {
      const sector = stack.pop()
      const children = childrenOf.get(sector.code) || []
      if (children.length) stack.push(...children)
      else leaves.push(sector)
    }
    return leaves
  }

  if (err) return <div className="screen err">Errore nel caricamento dati: {err}</div>
  if (!countries || !data) return <div className="screen"><div className="skel skel-loading" /><p>Carico l'economia…</p></div>

  const currentCode = path.length ? path[path.length - 1] : null
  const items = (childrenOf.get(currentCode ?? '__root__') || []).slice()

  items.sort((a, b) => {
    if (sort.key === 'name') return sort.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    const g = METRICS[sort.key].get
    const va = g(a), vb = g(b)
    const na = va == null ? -Infinity : va, nb = vb == null ? -Infinity : vb
    return sort.dir === 'asc' ? na - nb : nb - na
  })

  const view = VIEWS[sizeKey]
  const m = data.meta
  const srcShort = (m.source || '').includes('ISTAT') ? 'ISTAT' : 'Eurostat'
  const granLabel = m.max_level === 'class' ? '4 cifre ATECO' : '3 cifre NACE'
  const focus = currentCode ? index.get(currentCode) : null
  const focusChildren = currentCode ? (childrenOf.get(currentCode) || []) : (childrenOf.get('__root__') || [])
  const focusLeaves = currentCode ? collectLeafDescendants(currentCode) : []
  const focusPeers = focus ? (childrenOf.get(focus.parent ?? '__root__') || []) : []

  const applyPreset = (p) => { setPreset(p.id); setSizeKey(p.size); setSort({ key: p.sort, dir: p.dir }) }
  const drill = (code) => setPath([...path, code])
  const toLevel = (i) => setPath(path.slice(0, i))
  const clickHeader = (c) => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))
  const sectorPath = (code) => {
    const chain = []
    let cursor = index.get(code)
    while (cursor) {
      chain.unshift(cursor.code)
      cursor = cursor.parent ? index.get(cursor.parent) : null
    }
    return chain
  }
  const jumpToSector = (code) => {
    setMode('explore')
    setPath(sectorPath(code))
    setQuery('')
  }
  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = normalizedQuery.length < 2 ? [] : [...index.values()]
    .filter((sector) => `${sector.code} ${sector.name}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => (right.raw?.fatturato_keur || 0) - (left.raw?.fatturato_keur || 0))
    .slice(0, 8)
  const onSearchKeyDown = (event) => {
    if (event.key === 'Escape') { setQuery(''); return }
    if (!searchResults.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      const target = searchResults[activeIndex] ?? searchResults[0]
      if (target) jumpToSector(target.code)
    }
  }

  const crumbs = [{ label: 'Economia', i: 0 }]
  path.forEach((code, i) => {
    const s = index.get(code)
    crumbs.push({ label: `${code} · ${s ? s.name : ''}`, i: i + 1 })
  })

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span>Crystal</span>
        </div>
        <div className="side-label">Workspace</div>
        <div className="modes">
          <button className={'mode' + (mode === 'explore' ? ' on' : '')} onClick={() => setMode('explore')}>Panoramica</button>
          <button className={'mode' + (mode === 'compare' ? ' on' : '')} onClick={() => setMode('compare')}>Confronta paesi</button>
          <button className={'mode' + (mode === 'screener' ? ' on' : '')} onClick={() => setMode('screener')}>Screener</button>
          <button className={'mode' + (mode === 'mercato' ? ' on' : '')} onClick={() => setMode('mercato')}>Mercato</button>
        </div>
        <div className="side-label">Percorso</div>
        <div className="side-path">
          <span>{m.country_name}</span>
          <strong>{focus ? focus.name : 'Economia completa'}</strong>
          <em>{focus ? `${focus.code} · ${focus.level}` : `${items.length} macro-settori`}</em>
        </div>
      </aside>

      <main className="workspace">
      <header className="topbar">
        <div>
          <h1>Crystal</h1>
          <p>European economy intelligence · dal paese alla nicchia aziendale</p>
        </div>
        <div className="command" ref={commandRef}>
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Cerca settore, codice o azienda media…"
            role="combobox"
            aria-expanded={normalizedQuery.length >= 2}
            aria-controls="command-listbox"
            aria-activedescendant={activeIndex >= 0 ? `command-opt-${activeIndex}` : undefined}
          />
          {normalizedQuery.length >= 2 && (
            <div className="command-menu" id="command-listbox" role="listbox">
              {searchResults.length > 0 ? searchResults.map((sector, i) => (
                <button
                  key={sector.code}
                  id={`command-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={i === activeIndex ? 'active' : ''}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => jumpToSector(sector.code)}
                >
                  <span>{sector.code}</span>
                  <strong>{sector.name}</strong>
                  <em>{sector.level}</em>
                </button>
              )) : (
                <div className="command-empty">Nessun risultato per «{query}»</div>
              )}
            </div>
          )}
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

      {mode === 'explore' && focus && (
        <SectorLens
          focus={focus}
          lineage={crumbs}
          directChildren={focusChildren}
          leafDescendants={focusLeaves}
          peerGroup={focusPeers}
          sizeKey={view.sizeKey}
          sizeLabel={view.label}
          sizeFmt={(value) => (view.kind === 'money' ? fmtMoneyKeur(value) : fmtCount(value))}
          onDrill={drill}
          onNavigate={toLevel}
          hasChildren={(code) => (childrenOf.get(code) || []).length > 0}
        />
      )}

      <Treemap items={items} sizeKey={view.sizeKey} viewKind={view.kind} onDrill={drill} hasChildren={(code) => (childrenOf.get(code) || []).length > 0} />

      <div className="legend">
        <span>Area = <b>{view.label}</b></span>
        <span className="gradient">
          <i style={{ background: growthColor(-0.08) }} /><i style={{ background: growthColor(0) }} /><i style={{ background: growthColor(0.08) }} />
          Colore = crescita CAGR (rosso −8% → verde +8%)
        </span>
        <span className="hint">clic su un riquadro o riga per scendere · clic intestazione per ordinare</span>
      </div>

      <div className="grid-wrap">
      <table className="grid">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={(c.key === 'name' ? 'l' : 'r') + (sort.key === c.key ? ' sorted' : '')}>
                <span className="th-sort" onClick={() => clickHeader(c)}>{c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}</span>
                {c.key !== 'name' && <InfoDot text={METRICS[c.key].info} />}
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
                  <td key={c.key} className="r">{METRICS[c.key].fmt(METRICS[c.key].get(s))}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      <Legend ids={ALL_METRIC_IDS} />
      </>)}

      <footer className="foot">
        <span>{m.source}</span>
        <span>Valori monetari in € · CAGR sull'orizzonte disponibile · «—» = dato non disponibile (segreto statistico o non pubblicato). Italia a 4 cifre (ISTAT); resto d'Europa a 3 cifre (Eurostat).</span>
      </footer>
      </main>
    </div>
  )
}
