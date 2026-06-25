import { useEffect, useMemo, useState } from 'react'
import { METRICS } from '../metrics.js'
import InfoDot from './InfoDot.jsx'
import Legend from './Legend.jsx'

const BASE = import.meta.env.BASE_URL
const MAX_ROWS = 250

// Campi filtrabili dello screener. factor = converte il valore memorizzato nell'unità di filtro.
const F = (id, unit, factor, ph, extra = {}) => ({
  id, unit, factor, ph, label: METRICS[id].label, info: METRICS[id].info, fmt: METRICS[id].fmt, ...extra,
})
const FIELDS = [
  F('fatturato', 'Mln €', 1 / 1000, 'es. 100'),
  F('crescita', '%', 100, 'es. 3'),
  F('trend', 'anni', 1, 'es. 3'),
  F('margine', '%', 100, 'es. 15'),
  F('produttivita', 'k€/add.', 1, 'es. 60'),
  F('struttura', 'add./impr.', 1, 'es. 5'),
  F('conc_grandi', '%', 100, 'es. 40'),
  F('barriera', 'k€/add.', 1, 'es. 30', { itOnly: true }),
]
const IDS = FIELDS.map((f) => f.id)

// Preset = scorciatoie che impostano i filtri (in unità di filtro). Non sono punteggi.
const PRESETS = {
  bootstrapper: { struttura: { max: 5 }, margine: { min: 15 }, barriera: { max: 50 } },
  venture: { trend: { min: 3 }, struttura: { max: 8 }, crescita: { min: 5 } },
  value: { margine: { min: 20 }, conc_grandi: { min: 40 }, fatturato: { min: 100 } },
}

// estrae i valori-screener (memorizzati) da un settore (modalità paese)
function rowFromSector(s, countryName) {
  return {
    code: s.code, name: s.name, country: countryName,
    fatturato: s.raw.fatturato_keur,
    crescita: s.fields.crescita.value,
    trend: s.trend?.anni_crescita,
    margine: s.fields.margine?.value,
    produttivita: s.fields.produttivita.value,
    struttura: s.fields.struttura.value,
    conc_grandi: s.concentrazione?.quota_grandi,
    barriera: s.barriera?.value,
  }
}
// estrae da una riga compare (modalità europa)
function rowFromCompare(sec, geo, v, countryName) {
  return {
    code: sec.code, name: sec.name, country: countryName,
    fatturato: v.fatturato_keur, crescita: v.crescita, trend: v.trend, margine: v.margine,
    produttivita: v.produttivita, struttura: v.struttura, conc_grandi: v.quota_grandi, barriera: v.barriera,
  }
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
                <input type="number" placeholder={'min ' + f.ph} disabled={disabled}
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

      <table className="grid">
        <thead>
          <tr>
            <th className="l">Settore</th>
            {scope === 'europa' && <th className="l">Paese</th>}
            {FIELDS.map((f) => (
              <th key={f.id} className={'r' + (sort.key === f.id ? ' sorted' : '')} onClick={() => clickHeader(f.id)}>
                {f.label}{sort.key === f.id ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}
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

      <Legend ids={IDS} />
    </div>
  )
}
