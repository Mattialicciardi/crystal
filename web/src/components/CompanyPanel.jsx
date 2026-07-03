import { useEffect, useMemo, useState } from 'react'
import InfoDot from './InfoDot.jsx'
import { loadCompanyIndex, loadCompanyShard } from '../companies.js'
import { fmtMoneyKeur, fmtCount, fmtPct } from '../lib.js'

const INITIAL_ROWS = 12

// Valore di un campo azienda (schema { value, state }), null-safe.
const fv = (company, key) => company.fields?.[key]?.value ?? null

export default function CompanyPanel({ country, focus, leafDescendants, onDrill, hasChildren }) {
  const [index, setIndex] = useState(undefined) // undefined = in caricamento, null = assente
  const [shard, setShard] = useState(null)
  const [shardLoading, setShardLoading] = useState(false)
  const [sort, setSort] = useState({ key: 'fatturato', dir: 'desc' })
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(false)

  const isLeaf = focus.level === 'class'
  const targetCodes = isLeaf ? [focus.code] : leafDescendants.map((s) => s.code)

  // Indice paese (leggero) — una volta per paese.
  useEffect(() => {
    let alive = true
    setIndex(undefined)
    loadCompanyIndex(country).then((idx) => { if (alive) setIndex(idx) })
    return () => { alive = false }
  }, [country])

  // Shard della classe corrente — solo se è una foglia con aziende note.
  useEffect(() => {
    setShard(null); setFilter(''); setExpanded(false)
    setSort({ key: 'fatturato', dir: 'desc' })
    if (!isLeaf || !index) return
    const known = index.counts?.[focus.code]?.companies
    if (!known) return
    let alive = true
    setShardLoading(true)
    loadCompanyShard(country, focus.code).then((doc) => {
      if (!alive) return
      setShard(doc); setShardLoading(false)
    })
    return () => { alive = false }
  }, [country, focus.code, isLeaf, index])

  // Roll-up dei conteggi sulle classi sotto il nodo (per i livelli non-foglia).
  const rollup = useMemo(() => {
    if (!index?.counts) return { companies: 0, classes: 0, top: [] }
    let companies = 0, classes = 0
    const top = []
    for (const s of (isLeaf ? [] : leafDescendants)) {
      const c = index.counts[s.code]
      if (c?.companies) {
        companies += c.companies; classes += 1
        top.push({ code: s.code, name: s.name, count: c.companies, immediate: s.parent === focus.code })
      }
    }
    top.sort((a, b) => b.count - a.count)
    return { companies, classes, top: top.slice(0, 8) }
  }, [index, leafDescendants, isLeaf, focus.code])

  const companies = shard?.companies ?? []
  const showFin = companies.some((c) => fv(c, 'fatturato') != null)

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const filtered = q
      ? companies.filter((c) => `${c.name} ${c.comune || ''} ${c.provincia || ''} ${c.regione || ''}`.toLowerCase().includes(q))
      : companies
    const getters = {
      name: (c) => c.name?.toLowerCase() ?? '',
      comune: (c) => (c.comune || '').toLowerCase(),
      fatturato: (c) => fv(c, 'fatturato'),
      addetti: (c) => fv(c, 'addetti'),
      produttivita: (c) => fv(c, 'produttivita'),
      margine: (c) => fv(c, 'margine'),
    }
    const get = getters[sort.key] || getters.name
    const sorted = [...filtered].sort((a, b) => {
      const va = get(a), vb = get(b)
      if (typeof va === 'string' || typeof vb === 'string') {
        return sort.dir === 'asc' ? String(va).localeCompare(vb) : String(vb).localeCompare(va)
      }
      const na = va == null ? -Infinity : va, nb = vb == null ? -Infinity : vb
      return sort.dir === 'asc' ? na - nb : nb - na
    })
    return sorted
  }, [companies, filter, sort])

  const maxProd = useMemo(() => Math.max(0, ...rows.map((c) => fv(c, 'produttivita') || 0)), [rows])
  const shown = expanded ? rows : rows.slice(0, INITIAL_ROWS)
  const clickHeader = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  const arrow = (key) => (sort.key === key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : '')

  const sectorProd = focus.fields?.produttivita?.value
  const sectorMargin = focus.fields?.margine?.value

  // ---- header condiviso -------------------------------------------------
  const header = (
    <div className="co-head">
      <h3 className="sec-title" style={{ margin: 0 }}>
        Aziende del settore
        <InfoDot text="Le singole imprese reali agganciate a questa classe ATECO (4 cifre). Layer statico per-classe: scaricato solo quando entri nella classe." />
      </h3>
      <div className="co-head-tags">
        {index === null && <span className="focus-chip muted">non disponibile</span>}
        {index?.meta?.demo && <span className="focus-chip">dati dimostrativi</span>}
      </div>
    </div>
  )

  const source = index?.meta?.source

  return (
    <div className="focus-block co-block">
      {header}

      {index === undefined && <p className="focus-copy">Carico il layer aziende…</p>}

      {index === null && (
        <p className="focus-copy">Il dettaglio azienda non è ancora disponibile per {country}. È attivo sul pilota italiano.</p>
      )}

      {index && !isLeaf && (
        <>
          <p className="focus-copy">
            {rollup.companies > 0
              ? <>{fmtCount(rollup.companies)} aziende in {rollup.classes} class{rollup.classes === 1 ? 'e' : 'i'} sotto questa nicchia. Scendi fino a una <b>classe (4 cifre)</b> per l'elenco impresa per impresa.</>
              : <>Nessuna azienda nel dataset per le classi sotto questo nodo.</>}
          </p>
          {rollup.top.length > 0 && (
            <div className="co-rollup">
              {rollup.top.map((t) => (
                <button
                  key={t.code}
                  className={'co-rollup-item' + (t.immediate ? ' drillable' : '')}
                  onClick={() => t.immediate && onDrill(t.code)}
                  disabled={!t.immediate}
                  title={t.immediate ? 'Scendi in questa classe' : 'Scendi passo-passo per aprire questa classe'}
                >
                  <span className="code">{t.code}</span>
                  <span className="co-rollup-name">{t.name}</span>
                  <strong>{fmtCount(t.count)}</strong>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {index && isLeaf && (
        <>
          {!index.counts?.[focus.code]?.companies && (
            <p className="focus-copy">
              Nessuna azienda nel dataset per questa classe{index.meta?.demo ? ' (il seed dimostrativo copre solo alcune classi campione)' : ''}.
            </p>
          )}

          {shardLoading && <p className="focus-copy">Carico le aziende…</p>}

          {shard && companies.length > 0 && (
            <>
              <div className="co-toolbar">
                <input
                  className="co-search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtra per nome o territorio…"
                />
                <span className="co-count">{fmtCount(rows.length)} di {fmtCount(companies.length)} aziende</span>
                {showFin && (sectorProd != null || sectorMargin != null) && (
                  <span className="co-ref">
                    Media settore: {sectorProd != null ? `${fmtMoneyKeur(sectorProd)} VA/add.` : '—'}
                    {sectorMargin != null ? ` · ${fmtPct(sectorMargin)} margine` : ''}
                  </span>
                )}
              </div>

              <div className="grid-wrap">
                <table className="grid co-table">
                  <thead>
                    <tr>
                      <th className="l"><span className="th-sort" onClick={() => clickHeader('name')}>Azienda{arrow('name')}</span></th>
                      <th className="l"><span className="th-sort" onClick={() => clickHeader('comune')}>Sede{arrow('comune')}</span></th>
                      {showFin ? (
                        <>
                          <th className="r"><span className="th-sort" onClick={() => clickHeader('fatturato')}>Fatturato{arrow('fatturato')}</span></th>
                          <th className="r"><span className="th-sort" onClick={() => clickHeader('addetti')}>Addetti{arrow('addetti')}</span></th>
                          <th className="r"><span className="th-sort" onClick={() => clickHeader('produttivita')}>VA/addetto{arrow('produttivita')}</span></th>
                          <th className="r"><span className="th-sort" onClick={() => clickHeader('margine')}>Margine{arrow('margine')}</span></th>
                        </>
                      ) : (
                        <th className="l">Forma · stato</th>
                      )}
                      <th className="l">Contatti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => {
                      const prod = fv(c, 'produttivita')
                      const margin = fv(c, 'margine')
                      const barW = maxProd > 0 && prod != null ? Math.max(4, (prod / maxProd) * 100) : 0
                      return (
                        <tr key={c.id}>
                          <td className="l"><strong>{c.name}</strong>{c.forma_giuridica ? <em className="co-form"> · {c.forma_giuridica}</em> : null}</td>
                          <td className="l co-place">{c.comune || '—'}{c.provincia ? ` (${c.provincia})` : ''}</td>
                          {showFin ? (
                            <>
                              <td className="r">{fmtMoneyKeur(fv(c, 'fatturato'))}</td>
                              <td className="r">{fmtCount(fv(c, 'addetti'))}</td>
                              <td className="r">
                                <span className="co-prod">
                                  {fmtMoneyKeur(prod)}
                                  <i className="co-bar" style={{ width: `${barW}%` }} />
                                </span>
                              </td>
                              <td className={'r' + (margin != null && sectorMargin != null ? (margin >= sectorMargin ? ' co-hi' : ' co-lo') : '')}>{fmtPct(margin)}</td>
                            </>
                          ) : (
                            <td className="l">{c.forma_giuridica || '—'}{c.stato ? ` · ${c.stato}` : ''}</td>
                          )}
                          <td className="l co-contacts">
                            {c.website ? <a href={`https://${c.website}`} target="_blank" rel="noreferrer">sito</a> : null}
                            {c.website && c.pec ? ' · ' : null}
                            {c.pec ? <span className="co-pec">PEC</span> : null}
                            {!c.website && !c.pec ? '—' : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {rows.length > INITIAL_ROWS && (
                <button className="co-more" onClick={() => setExpanded((v) => !v)}>
                  {expanded ? 'Mostra meno' : `Carica altre (${rows.length - INITIAL_ROWS})`}
                </button>
              )}
            </>
          )}
        </>
      )}

      {source && <p className="co-source">Fonte: {source}</p>}
    </div>
  )
}
