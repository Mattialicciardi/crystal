import { useEffect, useMemo, useState } from 'react'
import { computeMarket, somSuggestion, weighted } from '../market.js'
import { buildIndex, suggestSectors } from '../match.js'
import { METRICS } from '../metrics.js'
import InfoDot from './InfoDot.jsx'
import { fmtMoneyKeur, fmtPct, fmtCount, fmtRatio } from '../lib.js'

const BASE = import.meta.env.BASE_URL
const DETAIL_IDS = ['margine', 'crescita', 'trend', 'produttivita', 'struttura', 'conc_grandi', 'barriera']
const STORE = 'sfera-mercato'
const DEFAULTS = {
  prd: '', mode: 'compete', picked: [],
  spend: { low: 0.5, base: 1, high: 2 },   // % della spesa del settore-cliente
  addr: { low: 20, base: 35, high: 50 },   // % quota indirizzabile
  capt: { low: 2, base: 5, high: 8 },      // % quota catturabile (manuale)
  anchor: false,
}
const toFrac = (r) => ({ low: r.low / 100, base: r.base / 100, high: r.high / 100 })
const pct1 = (f) => +(f * 100).toFixed(1)

function loadState() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || '{}') } }
  catch { return { ...DEFAULTS } }
}

function RangeInput({ label, info, unit, value, onChange, disabled }) {
  return (
    <div className={'assume' + (disabled ? ' disabled' : '')}>
      <span className="assume-lbl">{label} <span className="assume-unit">({unit})</span>{info && <InfoDot text={info} />}</span>
      <div className="assume-inputs">
        {['low', 'base', 'high'].map((k) => (
          <label key={k}>
            <span>{k === 'low' ? 'pess.' : k === 'base' ? 'base' : 'ott.'}</span>
            <input type="number" disabled={disabled} value={value[k]}
              onChange={(e) => onChange(k, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}

export default function MarketView({ data }) {
  const [st, setSt] = useState(loadState)
  const [q, setQ] = useState('')
  const [compareDoc, setCompareDoc] = useState(null)
  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(st)) }, [st])
  useEffect(() => { fetch(`${BASE}compare.json`).then((r) => r.json()).then(setCompareDoc).catch(() => {}) }, [])
  const set = (patch) => setSt((s) => ({ ...s, ...patch }))
  const setRange = (key, side, val) => setSt((s) => ({
    ...s, [key]: { ...s[key], [side]: val === '' ? 0 : parseFloat(val) },
    ...(key === 'capt' ? { anchor: false } : {}),
  }))

  const leaf = data.meta.max_level
  const byCode = useMemo(() => new Map(data.sectors.map((s) => [s.code, s])), [data])
  const leafSectors = useMemo(() => data.sectors.filter((s) => s.level === leaf), [data, leaf])
  const matchIndex = useMemo(() => buildIndex(leafSectors), [leafSectors])
  const suggestions = useMemo(() => suggestSectors(st.prd, matchIndex, 6), [st.prd, matchIndex])
  const selected = st.picked.map((c) => byCode.get(c)).filter(Boolean)

  const sumFatt = selected.reduce((a, s) => a + (s.raw.fatturato_keur || 0), 0)
  const qg = weighted(selected, (s) => s.concentrazione?.quota_grandi, (s) => s.raw.fatturato_keur)

  // quota catturabile effettiva: se anchor ON usa il suggerimento, altrimenti i valori manuali
  const captEff = (st.anchor && qg != null)
    ? { low: pct1(somSuggestion(qg).low), base: pct1(somSuggestion(qg).base), high: pct1(somSuggestion(qg).high) }
    : st.capt

  const market = computeMarket({
    sumFatt, mode: st.mode,
    spendRatio: st.mode === 'sellinto' ? toFrac(st.spend) : null,
    addressable: toFrac(st.addr), capturable: toFrac(captEff),
  })

  // arena competitiva (aggregati ponderati per fatturato)
  const qm = weighted(selected, (s) => s.concentrazione?.quota_micro, (s) => s.raw.fatturato_keur)
  const sumOcc = selected.reduce((a, s) => a + (s.raw.occupati || 0), 0)
  const nImprese = selected.reduce((a, s) => a + (s.raw.imprese || 0), 0)
  const addPerFirm = nImprese ? sumOcc / nImprese : null
  const playerTipo = nImprese ? sumFatt / nImprese : null

  const crossData = useMemo(() => {
    if (!compareDoc || !selected.length) return []
    const groups = new Set(selected.map((s) => (s.level === 'class' ? s.code.slice(0, 3) : s.code)))
    const byCountry = {}
    for (const sec of compareDoc.sectors) {
      if (!groups.has(sec.code)) continue
      for (const [geo, v] of Object.entries(sec.by)) {
        if (geo === 'EU27_2020' || v.fatturato_keur == null) continue
        byCountry[geo] = (byCountry[geo] || 0) + v.fatturato_keur
      }
    }
    return Object.entries(byCountry)
      .map(([geo, val]) => ({ geo, name: compareDoc.countries[geo] || geo, val }))
      .sort((a, b) => b.val - a.val)
  }, [compareDoc, st.picked]) // eslint-disable-line react-hooks/exhaustive-deps

  const addPicked = (e) => {
    const code = e.target.value.split(' · ')[0].trim()
    if (byCode.has(code) && !st.picked.includes(code)) set({ picked: [...st.picked, code] })
    setQ('')
  }
  const removePicked = (c) => set({ picked: st.picked.filter((x) => x !== c) })

  const FUNNEL = [
    { key: 'tam', label: 'TAM', badge: st.mode === 'sellinto' ? '🟡' : '🟢',
      sub: st.mode === 'sellinto' ? 'spesa stimata del settore-cliente (dimensione × quota di spesa)' : 'fatturato totale del settore — dato, top-down',
      info: 'Total Addressable Market: il mercato totale. In "competi nel settore" = fatturato del settore (dato). In "vendi al settore" = la spesa del settore-cliente per il tuo tipo di prodotto (stima).' },
    { key: 'sam', label: 'SAM', badge: '🟡',
      sub: 'quota indirizzabile del TAM — tua assunzione',
      info: 'Serviceable Available Market: la parte del TAM che il tuo prodotto può davvero servire. È una tua assunzione (sotto le 4 cifre i dati non vedono): mostrata come range.' },
    { key: 'som', label: 'SOM', badge: '🟡',
      sub: 'quota catturabile del SAM' + (st.anchor ? ' — ancorata alla parte contendibile' : ' — tua assunzione'),
      info: 'Serviceable Obtainable Market: quanto puoi realisticamente catturare nel breve. Assunzione; col checkbox la base è suggerita dalla parte non dominata dai grandi (1−quota grandi).' },
  ]

  return (
    <div className="market">
      <p className="tag">Dimensiona il <b>mercato vero</b> del tuo prodotto in <b>{data.meta.country_name}</b>. TAM = dato; SAM e SOM = tue assunzioni, mostrate come range. Tutto salvato nel browser.</p>

      <textarea className="market-prd" placeholder="Descrivi il prodotto che vuoi costruire (PRD)…"
        value={st.prd} onChange={(e) => set({ prd: e.target.value })} />

      {suggestions.length > 0 && (
        <div className="suggested">
          <span className="cmp-hint">Settori suggeriti dal PRD — clic per aggiungere<InfoDot text="Proposti da un matcher deterministico (parole chiave + sinonimi sui nomi ATECO). Niente LLM né chiavi: conferma, togli o aggiungi a mano." /></span>
          <div className="picked">
            {suggestions.filter((x) => !st.picked.includes(x.code)).map((x) => {
              const nm = byCode.get(x.code)?.name || x.name
              return (
                <span key={x.code} className="pchip sug" onClick={() => set({ picked: [...st.picked, x.code] })}>
                  + {x.code} {nm.slice(0, 30)}{nm.length > 30 ? '…' : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="market-grid">
        <div className="market-col">
          <div className="ctl">
            <span className="ctl-lbl">Modo<InfoDot text="«Competi nel settore»: il tuo prodotto È nel settore → TAM = fatturato del settore. «Vendi al settore»: il settore è il tuo cliente → TAM = la sua spesa per il tuo tipo di prodotto." /></span>
            <button className={'chip sm' + (st.mode === 'compete' ? ' on' : '')} onClick={() => set({ mode: 'compete' })}>Competi nel settore</button>
            <button className={'chip sm' + (st.mode === 'sellinto' ? ' on' : '')} onClick={() => set({ mode: 'sellinto' })}>Vendi al settore</button>
          </div>

          <div className="market-pick">
            <input className="sector-search" list="msec" value={q}
              placeholder="Aggiungi un settore (cerca per nome)…" onChange={addPicked} />
            <datalist id="msec">
              {leafSectors.map((s) => <option key={s.code} value={`${s.code} · ${s.name}`} />)}
            </datalist>
            <div className="picked">
              {selected.length === 0 && <span className="cmp-hint">nessun settore selezionato</span>}
              {selected.map((s) => (
                <span key={s.code} className="pchip" onClick={() => removePicked(s.code)}>
                  {s.code} {s.name.slice(0, 28)}{s.name.length > 28 ? '…' : ''} ✕
                </span>
              ))}
            </div>
          </div>

          <div className="assumptions">
            {st.mode === 'sellinto' && (
              <RangeInput label="Quota di spesa" unit="%" value={st.spend}
                info="Frazione del fatturato del settore-cliente spesa per il tuo tipo di prodotto. Tua assunzione."
                onChange={(side, v) => setRange('spend', side, v)} />
            )}
            <RangeInput label="Quota indirizzabile" unit="%" value={st.addr}
              info="Quanta parte del TAM il tuo prodotto davvero indirizza (gestisce il «più fine delle 4 cifre»). Tua assunzione."
              onChange={(side, v) => setRange('addr', side, v)} />
            <RangeInput label="Quota catturabile" unit="%" value={captEff} disabled={st.anchor}
              info="Quanto del SAM puoi catturare. Col checkbox sotto la base è suggerita dai dati."
              onChange={(side, v) => setRange('capt', side, v)} />
            <label className="anchor-check">
              <input type="checkbox" checked={st.anchor} onChange={(e) => set({ anchor: e.target.checked })} />
              ancora la quota catturabile alla parte contendibile {qg != null && <span className="cmp-hint">(quota grandi {fmtPct(qg)})</span>}
            </label>
          </div>
        </div>

        <div className="market-col funnel">
          {FUNNEL.map((f, i) => (
            <div key={f.key} className="funnel-row" style={{ width: `${100 - i * 22}%` }}>
              <div className="funnel-head">{f.badge} {f.label}<InfoDot text={f.info} /></div>
              <div className="funnel-val">{sumFatt ? fmtMoneyKeur(market[f.key].base) : '—'}</div>
              <div className="funnel-range">{sumFatt ? `${fmtMoneyKeur(market[f.key].low)} – ${fmtMoneyKeur(market[f.key].high)}` : 'seleziona un settore'}</div>
              <div className="funnel-sub">{f.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="arena">
          <h3 className="sec-title">Arena competitiva<InfoDot text="La struttura competitiva del settore dai nostri dati aggregati (niente aziende reali nominate)." /></h3>
          <div className="arena-grid">
            <div className="arena-card"><div className="arena-k">Quota grandi (≥250 add.)</div><div className="arena-v">{qg == null ? '—' : fmtPct(qg)}</div></div>
            <div className="arena-card"><div className="arena-k">Quota micro (&lt;10 add.)</div><div className="arena-v">{qm == null ? '—' : fmtPct(qm)}</div></div>
            <div className="arena-card"><div className="arena-k">Addetti / impresa</div><div className="arena-v">{addPerFirm == null ? '—' : fmtRatio(addPerFirm)}</div></div>
            <div className="arena-card"><div className="arena-k">N° imprese</div><div className="arena-v">{fmtCount(nImprese)}</div></div>
            <div className="arena-card"><div className="arena-k">Player tipo<InfoDot text="Fatturato medio per impresa = fatturato del settore / numero imprese. Media sintetica, NON un'azienda reale." /></div><div className="arena-v">{playerTipo == null ? '—' : fmtMoneyKeur(playerTipo)}</div></div>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="market-details">
          <h3 className="sec-title">Dettagli del settore</h3>
          <table className="grid">
            <thead>
              <tr><th className="l">Settore</th>{DETAIL_IDS.map((id) => <th key={id} className="r">{METRICS[id].label}<InfoDot text={METRICS[id].info} /></th>)}</tr>
            </thead>
            <tbody>
              {selected.map((s) => (
                <tr key={s.code}>
                  <td className="l"><span className="code">{s.code}</span> {s.name}</td>
                  {DETAIL_IDS.map((id) => { const v = METRICS[id].get(s); return <td key={id} className="r">{v == null ? '—' : METRICS[id].fmt(v)}</td> })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.length > 0 && crossData.length > 0 && (
        <div className="market-cross">
          <h3 className="sec-title">Lo stesso mercato in Europa<InfoDot text="Settori selezionati mappati a 3 cifre e sommati per paese: dove il mercato è più grande. Approssimato al livello comune europeo." /></h3>
          <div className="bars">
            {crossData.slice(0, 12).map((r, i) => (
              <div className="bar-row" key={r.geo}>
                <div className="bar-name"><span className="bar-rank">{i + 1}</span> {r.name}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: Math.max(0.5, 100 * r.val / (crossData[0].val || 1)) + '%', background: '#2dd4bf' }} /></div>
                <div className="bar-val">{fmtMoneyKeur(r.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
