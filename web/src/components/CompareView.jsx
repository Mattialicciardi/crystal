import { useEffect, useMemo, useState } from 'react'
import { growthColor, fmtMoneyKeur, fmtCount, fmtPct, fmtRatio } from '../lib.js'

const BASE = import.meta.env.BASE_URL

const METRICS = [
  { key: 'fatturato_keur', label: 'Fatturato',      kind: 'money' },
  { key: 'va_keur',        label: 'Valore aggiunto', kind: 'money' },
  { key: 'produttivita',   label: 'VA / addetto',    kind: 'money' },
  { key: 'redditivita',    label: 'MOL / VA',        kind: 'pct' },
  { key: 'struttura',      label: 'Add. / impresa',  kind: 'ratio' },
  { key: 'crescita',       label: 'CAGR',            kind: 'pct' },
  { key: 'occupati',       label: 'Occupati',        kind: 'count' },
  { key: 'imprese',        label: 'Imprese',         kind: 'count' },
]
const LEVELN = { section: 'sezione', div: 'divisione', group: 'gruppo' }

function fmt(kind, v) {
  if (v == null) return '—'
  if (kind === 'money') return fmtMoneyKeur(v)
  if (kind === 'pct') return fmtPct(v)
  if (kind === 'ratio') return fmtRatio(v)
  if (kind === 'count') return fmtCount(v)
  return v
}

export default function CompareView() {
  const [doc, setDoc] = useState(null)
  const [err, setErr] = useState(null)
  const [code, setCode] = useState('62')
  const [metric, setMetric] = useState('fatturato_keur')
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch(`${BASE}compare.json`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(setDoc).catch((e) => setErr(String(e)))
  }, [])

  const byCode = useMemo(() => {
    const m = new Map()
    if (doc) for (const s of doc.sectors) m.set(s.code, s)
    return m
  }, [doc])

  if (err) return <div className="screen err">Errore nel caricamento del confronto: {err}</div>
  if (!doc) return <div className="screen">Carico il confronto…</div>

  const sector = byCode.get(code) || doc.sectors.find((s) => s.code === '62') || doc.sectors[0]
  const met = METRICS.find((mm) => mm.key === metric)
  const rows = Object.entries(sector.by)
    .filter(([g, v]) => g !== 'EU27_2020' && v[metric] != null)
    .map(([g, v]) => ({ g, name: doc.countries[g] || g, val: v[metric], cagr: v.crescita }))
    .sort((a, b) => b.val - a.val)
  const max = Math.max(...rows.map((r) => r.val), 0) || 1
  const eu = sector.by['EU27_2020']

  const onPick = (e) => {
    const val = e.target.value
    setQ(val)
    const c = val.split(' · ')[0].trim()
    if (byCode.has(c)) { setCode(c); setQ('') }
  }

  return (
    <div className="compare">
      <p className="tag">Confronto cross-country al livello comune (fino a 3 cifre NACE). <b>«Dove è più grande il mercato di…?»</b></p>

      <div className="cmp-controls">
        <input className="sector-search" list="seclist" value={q} onChange={onPick}
               placeholder="Cerca un settore: software, farmaceutici, autoveicoli, ristorazione…" />
        <datalist id="seclist">
          {doc.sectors.map((s) => <option key={s.level + s.code} value={`${s.code} · ${s.name}`} />)}
        </datalist>
        <span className="cmp-hint">{doc.sectors.length} settori · {Object.keys(doc.countries).length} paesi</span>
      </div>

      <div className="cmp-sel">
        <span className="cmp-code">{sector.code}</span> <b>{sector.name}</b>
        <span className="cmp-lvl">{LEVELN[sector.level] || sector.level}</span>
      </div>

      <div className="controls">
        <div className="ctl">
          <span className="ctl-lbl">Classifica per</span>
          {METRICS.map((mm) => (
            <button key={mm.key} className={'chip sm' + (metric === mm.key ? ' on' : '')} onClick={() => setMetric(mm.key)}>{mm.label}</button>
          ))}
        </div>
      </div>

      {eu && eu[metric] != null && (
        <div className="cmp-ref">UE-27 (riferimento): <b>{fmt(met.kind, eu[metric])}</b></div>
      )}

      <div className="bars">
        {rows.map((r, i) => (
          <div className="bar-row" key={r.g}>
            <div className="bar-name"><span className="bar-rank">{i + 1}</span> {r.name}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: Math.max(0.5, 100 * r.val / max) + '%', background: growthColor(r.cagr) }} />
            </div>
            <div className="bar-val">{fmt(met.kind, r.val)}{metric !== 'crescita' && r.cagr != null && <span className="bar-cagr"> · {fmtPct(r.cagr)}</span>}</div>
          </div>
        ))}
        {!rows.length && <div className="screen">Nessun dato per questo settore con la metrica scelta.</div>}
      </div>

      <p className="legend"><span className="gradient">
        <i style={{ background: growthColor(-0.08) }} /><i style={{ background: growthColor(0) }} /><i style={{ background: growthColor(0.08) }} />
        Lunghezza barra = {met.label} · colore = crescita CAGR del settore in quel paese
      </span></p>
    </div>
  )
}
