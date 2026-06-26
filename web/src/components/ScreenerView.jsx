import { useEffect, useMemo, useState } from 'react'
import { METRICS, ALL_METRIC_IDS } from '../metrics.js'
import InfoDot from './InfoDot.jsx'
import Legend from './Legend.jsx'

const BASE = import.meta.env.BASE_URL
const MAX_ROWS = 250

// TUTTE le metriche (stesso set di Esplora/Mercato); unit/factor dal registro per i filtri.
const FIELDS = ALL_METRIC_IDS.map((id) => ({
  id, label: METRICS[id].label, info: METRICS[id].info, fmt: METRICS[id].fmt,
  unit: METRICS[id].unit, factor: METRICS[id].factor, itOnly: METRICS[id].itOnly,
}))
const IDS = ALL_METRIC_IDS
// id metrica -> chiave in compare.json (modalità Europa)
const CMP_KEY = {
  fatturato: 'fatturato_keur', valore_agg: 'va_keur', produttivita: 'produttivita', margine: 'margine',
  redditivita: 'redditivita', struttura: 'struttura', crescita: 'crescita', trend: 'trend',
  conc_grandi: 'quota_grandi', conc_micro: 'quota_micro', barriera: 'barriera', occupati: 'occupati', imprese: 'imprese',
}

// Preset = scorciatoie che impostano i filtri (in unità di filtro). Non sono punteggi.
const PRESETS = {
  bootstrapper: { struttura: { max: 5 }, margine: { min: 15 }, barriera: { max: 50 } },
  venture: { trend: { min: 3 }, struttura: { max: 8 }, crescita: { min: 5 } },
  value: { margine: { min: 20 }, conc_grandi: { min: 40 }, fatturato: { min: 100 } },
}

// riga piatta con TUTTE le metriche, da un settore (modalità paese)
function rowFromSector(s, countryName) {
  const row = { code: s.code, name: s.name, country: countryName }
  for (const id of ALL_METRIC_IDS) row[id] = METRICS[id].get(s)
  return row
}
// riga piatta con TUTTE le metriche, da una riga compare (modalità europa)
function rowFromCompare(sec, geo, v, countryName) {
  const row = { code: sec.code, name: sec.name, country: countryName }
  for (const id of ALL_METRIC_IDS) row[id] = v[CMP_KEY[id]] ?? null
  return row
}

export default function ScreenerView({ data, country, countries }) {
  const [scope, setScope] = useState('paese')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState({ key: 'fatturato', dir: 'desc' })
  const [preset, setPreset] = useState(null)
  const [compareDoc, setCompareDoc] = useState(null)
  const [cmpErr, setCmpErr] = useState(null)

  useEffect(() => {
    if (scope !== 'europa' || compareDoc) return
    fetch(`${BASE}compare.json`).then((r) => r.json()).then(setCompareDoc).catch((e) => setCmpErr(String(e)))
  }, [scope, compareDoc])

  const countryName = useMemo(
    () => (countries.find((c) => c.code === country)?.name || country),
    [countries, country],
  )
  const barrieraDisabled = scope === 'europa' || country !== 'IT'

  // righe grezze secondo lo scope
  const rows = useMemo(() => {
    if (scope === 'paese') {
      const leaf = data.meta.max_level
      return data.sectors.filter((s) => s.level === leaf).map((s) => rowFromSector(s, countryName))
    }
    if (!compareDoc) return []
    const out = []
    for (const sec of compareDoc.sectors) {
      if (sec.level !== 'group') continue
      for (const [geo, v] of Object.entries(sec.by)) {
        if (geo === 'EU27_2020') continue
        out.push(rowFromCompare(sec, geo, v, compareDoc.countries[geo] || geo))
      }
    }
    return out
  }, [scope, data, countryName, compareDoc])

  const setF = (id, side, val) => {
    setPreset(null)
    setFilters((f) => {
      const cur = { ...(f[id] || {}) }
      if (val === '') delete cur[side]
      else cur[side] = parseFloat(val)
      const next = { ...f }
      if (Object.keys(cur).length) next[id] = cur
      else delete next[id]
      return next
    })
  }
  const applyPreset = (id) => { setPreset(id); setFilters(structuredClone(PRESETS[id])) }
  const clearAll = () => { setPreset(null); setFilters({}) }

  // filtro AND + ordinamento
  const matched = useMemo(() => {
    const active = FIELDS.filter((f) => filters[f.id] && (filters[f.id].min != null || filters[f.id].max != null))
    const pass = rows.filter((row) => active.every((f) => {
      const v = row[f.id]
      if (v == null) return false
      const dv = v * f.factor
      const { min, max } = filters[f.id]
      return (min == null || dv >= min) && (max == null || dv <= max)
    }))
    const col = FIELDS.find((f) => f.id === sort.key)
    pass.sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key]
      const na = va == null ? -Infinity : va, nb = vb == null ? -Infinity : vb
      return sort.dir === 'asc' ? na - nb : nb - na
    })
    return pass
  }, [rows, filters, sort])

  const clickHeader = (id) => setSort((s) => ({ key: id, dir: s.key === id && s.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <div className="screener">
      <div className="scope-toggle">
        <button className={'chip' + (scope === 'paese' ? ' on' : '')} onClick={() => setScope('paese')}>{countryName}</button>
        <button className={'chip' + (scope === 'europa' ? ' on' : '')} onClick={() => setScope('europa')}>Tutta Europa</button>
      </div>
      <p className="tag">
        {scope === 'paese'
          ? <>Filtra i settori di <b>{countryName}</b> ({data.meta.max_level === 'class' ? '4 cifre' : '3 cifre'}) per trovare quelli che convengono secondo i tuoi criteri.</>
          : <>Filtra tutte le coppie <b>settore × paese</b> d'Europa (3 cifre). Ogni riga è un settore in un paese.</>}
        {' '}Nessun punteggio: la classifica la fai tu ordinando per la colonna che ti interessa.
      </p>

      <div className="ctl" style={{ marginBottom: 4 }}>
        <span className="ctl-lbl">Preset</span>
        <button className={'chip sm' + (preset === 'bootstrapper' ? ' on' : '')} onClick={() => applyPreset('bootstrapper')}>Bootstrapper</button>
        <button className={'chip sm' + (preset === 'venture' ? ' on' : '')} onClick={() => applyPreset('venture')}>Venture</button>
        <button className={'chip sm' + (preset === 'value' ? ' on' : '')} onClick={() => applyPreset('value')}>Value</button>
        <button className="chip sm" onClick={clearAll}>Azzera</button>
      </div>

      <div className="filters">
        {FIELDS.map((f) => {
          const disabled = f.itOnly && barrieraDisabled
          return (
            <div key={f.id} className={'filter' + (disabled ? ' disabled' : '')}>
              <span className="filter-lbl">{f.label} <span style={{ color: '#5e6b80' }}>({f.unit})</span><InfoDot text={f.info + (disabled ? ' — non disponibile in questa modalità.' : '')} /></span>
              <div className="filter-inputs">
                <input type="number" placeholder="min" disabled={disabled}
                  value={filters[f.id]?.min ?? ''} onChange={(e) => setF(f.id, 'min', e.target.value)} />
                <span>–</span>
                <input type="number" placeholder="max" disabled={disabled}
                  value={filters[f.id]?.max ?? ''} onChange={(e) => setF(f.id, 'max', e.target.value)} />
              </div>
            </div>
          )
        })}
      </div>

      {cmpErr && <div className="screen err">Errore confronto: {cmpErr}</div>}
      <div className="screener-meta">
        <span className="match-count">{matched.length}</span> settori che passano i filtri
        {matched.length > MAX_ROWS && <span> · mostrati i primi {MAX_ROWS}</span>}
      </div>

      <div className="grid-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th className="l">Settore</th>
            {scope === 'europa' && <th className="l">Paese</th>}
            {FIELDS.map((f) => (
              <th key={f.id} className={'r' + (sort.key === f.id ? ' sorted' : '')}>
                <span className="th-sort" onClick={() => clickHeader(f.id)}>{f.label}{sort.key === f.id ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}</span>
                <InfoDot text={f.info} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matched.slice(0, MAX_ROWS).map((row, i) => (
            <tr key={row.code + '-' + (row.country || '') + i}>
              <td className="l"><span className="code">{row.code}</span> {row.name}</td>
              {scope === 'europa' && <td className="l">{row.country}</td>}
              {FIELDS.map((f) => (
                <td key={f.id} className="r">{row[f.id] == null ? '—' : f.fmt(row[f.id])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <Legend ids={IDS} />
    </div>
  )
}
