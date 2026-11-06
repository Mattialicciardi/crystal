import { useEffect, useMemo, useState } from 'react'
import SbsTreemap from './components/SbsTreemap.jsx'
import {
  COLUMNS,
  DEFAULT_SIZE,
  GLOSSARY,
  KPI_IDS,
  LEVEL_LABEL,
  LEVEL_PLURAL,
  SIZE_METRICS,
  ancestorsOf,
  columnById,
  displayCell,
  indexDataset,
  kpiVariation,
  normalize,
  rootReading,
  sectionReading,
  sortSectors,
  titleIt,
} from './sbsModel.js'

const BASE = import.meta.env.BASE_URL

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [year, setYear] = useState('2023')
  const [path, setPath] = useState([])
  const [sizeKey, setSizeKey] = useState(DEFAULT_SIZE)
  const [sort, setSort] = useState({ key: 'AV_MEUR', dir: 'desc' })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`${BASE}sbs-it.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(setData)
      .catch((reason) => setError(String(reason)))
  }, [])

  const indexed = useMemo(() => (data ? indexDataset(data) : null), [data])

  if (error) return <div className="screen err">I dati non si caricano: {error}</div>
  if (!data || !indexed) return <div className="screen">Carico i conti delle imprese italiane…</div>

  const { byCode, children } = indexed
  const focusCode = path.length ? path[path.length - 1] : null
  const focus = focusCode ? byCode.get(focusCode) : data.total
  const rows = children.get(focusCode || '__root__') || []
  const normalizedQuery = normalize(query.trim())
  const filtered = normalizedQuery
    ? rows.filter((sector) => normalize(`${sector.code} ${sector.name} ${titleIt(sector.name)}`).includes(normalizedQuery))
    : rows
  const sorted = sortSectors(filtered, year, sort)
  const level = sorted[0]?.level || rows[0]?.level
  const globalHits = normalizedQuery.length < 2 ? [] : data.sectors
    .filter((sector) => normalize(`${sector.code} ${sector.name} ${titleIt(sector.name)}`).includes(normalizedQuery))
    .filter((sector) => !rows.some((row) => row.code === sector.code))
    .slice(0, 6)

  const openSector = (code) => {
    const sector = byCode.get(code)
    const kids = children.get(code) || []
    if (kids.length) {
      setPath([...ancestorsOf(byCode, code), code])
      setSelected(null)
    } else {
      setPath(ancestorsOf(byCode, code))
      setSelected(code)
    }
    setQuery('')
  }

  const clickHeader = (key) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const crumbs = [{ label: 'Italia', length: 0 }]
  path.forEach((code, index) => {
    const sector = byCode.get(code)
    crumbs.push({ label: `${code} · ${titleIt(sector?.name)}`, length: index + 1 })
  })

  const selectedSector = selected ? byCode.get(selected) : null
  const reading = focusCode ? [sectionReading(focus, year)].filter(Boolean) : rootReading(byCode, year)
  const turnoverNote = data.meta.coverage.class_turnover[year]

  return (
    <div className="page">
      <header className="mast">
        <p className="eyebrow">Crystal</p>
        <h1>Mappa dei settori italiani</h1>
        <p className="lead">
          Conti strutturali delle imprese, anno {year}. Si parte dalle sezioni NACE e si scende fino alla classe, quattro cifre.
        </p>
        <div className="year-row">
          <div className="years" role="radiogroup" aria-label="Anno">
            {data.meta.years.map((item) => (
              <button key={item} role="radio" aria-checked={item === year} className={item === year ? 'on' : ''} onClick={() => setYear(item)}>
                {item}
              </button>
            ))}
          </div>
          <p className="source-line">Eurostat {data.meta.dataset} · aggiornamento {data.meta.last_update_label}</p>
        </div>
      </header>

      <section className="callout">
        <p>{data.meta.classification_note} I titoli sono quelli italiani di ATECO 2007.</p>
        <p>
          In questo estratto mancano le sezioni A (agricoltura) e O (pubblica amministrazione).
          La sezione S non ha un totale pubblicato; alcune sue divisioni sì.
          K (finanza e assicurazioni) ha imprese e addetti, mentre i conti di bilancio sono riservati.
          Il totale in alto è l’aggregato ufficiale {data.meta.total_code}, l’economia delle imprese.
        </p>
      </section>

      <nav className="crumbs" aria-label="Percorso">
        {crumbs.map((crumb, index) => (
          <span key={crumb.length}>
            {index > 0 && <span className="sep">/</span>}
            <button className={index === crumbs.length - 1 ? 'here' : ''} onClick={() => { setPath(path.slice(0, crumb.length)); setSelected(null); setQuery('') }}>
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      <KpiBar sector={focus} year={year} isTotal={!focusCode} totalCode={data.meta.total_code} />

      {reading.length > 0 && (
        <section className="reading">
          <h2>Come leggere i conti</h2>
          {reading.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      )}

      <section className="map-block">
        <div className="map-head">
          <div>
            <h2>Panoramica</h2>
            <p>L’area segue la metrica scelta. Il colore distingue la sezione e non esprime un giudizio.</p>
          </div>
          <div className="chips" role="radiogroup" aria-label="Metrica dell’area">
            {SIZE_METRICS.map((metric) => (
              <button key={metric.id} role="radio" aria-checked={sizeKey === metric.id} className={sizeKey === metric.id ? 'on' : ''} onClick={() => setSizeKey(metric.id)}>
                {metric.label}
              </button>
            ))}
          </div>
        </div>
        <p className="trade-note">
          Il commercio (G) gonfia il fatturato, perché dentro c’è la merce rivenduta. Per confrontare il peso dei settori, il valore aggiunto è la misura più stabile.
          {sizeKey === 'NETTUR_MEUR' ? ' Ora l’area è il fatturato: G occupa più spazio di quanto dica il valore creato.' : ''}
        </p>
        <SbsTreemap items={rows} year={year} sizeKey={sizeKey} onOpen={openSector} />
      </section>

      <section className="table-block">
        <div className="table-head">
          <div>
            <h2>Tabella {level ? LEVEL_PLURAL[level] : ''}</h2>
            <p>
              {filtered.length} {level ? (filtered.length === 1 ? LEVEL_LABEL[level] : LEVEL_PLURAL[level]) : 'voci'}
              {normalizedQuery ? ` su ${rows.length}` : ''}.
              {path.length === 0 ? ` Nel ${year} il fatturato di classe è pubblicato per ${turnoverNote.published} classi, riservato per ${turnoverNote.reserved}, assente per ${turnoverNote.absent}.` : ''}
            </p>
          </div>
          <label className="search">
            <span>Cerca in questo livello</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Codice o nome, per esempio alimentari" />
          </label>
        </div>
        {globalHits.length > 0 && (
          <div className="jumps">
            <span>Altrove nella mappa</span>
            {globalHits.map((sector) => (
              <button key={sector.code} onClick={() => openSector(sector.code)}>
                {sector.code} · {titleIt(sector.name)}
              </button>
            ))}
          </div>
        )}
        {sorted.length === 0 ? (
          <p className="empty">Nessuna voce di questo livello corrisponde alla ricerca.</p>
        ) : (
          <div className="grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="sticky" aria-sort={sort.key === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button onClick={() => clickHeader('name')}>Settore {sort.key === 'name' ? mark(sort.dir) : ''}</button>
                  </th>
                  {COLUMNS.map((column) => (
                    <th key={column.id} className="num" aria-sort={sort.key === column.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button onClick={() => clickHeader(column.id)} title={glossaryHint(column.id)}>
                        <span>{column.label}</span>
                        <small>{column.unit}{column.derived ? ' · calcolato' : ''}</small>
                        {sort.key === column.id ? <small>{mark(sort.dir)}</small> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((sector) => {
                  const kids = (children.get(sector.code) || []).length > 0
                  const active = selected === sector.code
                  return (
                    <tr
                      key={sector.code}
                      className={`${kids ? 'drill' : 'leaf'}${active ? ' active' : ''}${sector.published ? '' : ' unpublished'}`}
                      onClick={() => (kids ? openSector(sector.code) : setSelected(sector.code))}
                    >
                      <th scope="row" className="sticky">
                        <span className="code">{sector.code}</span>
                        <span>{titleIt(sector.name)}</span>
                        {!sector.published && <em className="pill">totale non pubblicato</em>}
                      </th>
                      {COLUMNS.map((column) => {
                        const cell = displayCell(sector, year, column)
                        return (
                          <td key={column.id} className={`num ${cell.kind}`}>
                            {cell.text}
                            {cell.kind === 'estimated' && <em className="pill">stima</em>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="table-hint">Clic su una riga con figli per scendere. Su una classe, la riga resta ferma e apre la scheda. La tabella scorre in orizzontale: oltre il valore aggiunto ci sono retribuzioni, MOL, investimenti, costo del lavoro, GOR e i rapporti calcolati. Le celle riservate non valgono zero e restano in fondo quando si ordina.</p>
        {selectedSector && <SectorCard sector={selectedSector} year={year} />}
      </section>

      <section className="glossary">
        <h2>Cosa significa ogni voce</h2>
        <dl>
          {GLOSSARY.map((item) => (
            <div key={item.title}>
              <dt>{item.title}</dt>
              <dd>{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="colophon">
        <p>
          Fonte: Eurostat, Structural Business Statistics, dataset <a href={data.meta.source_url}>sbs_ovw_act</a> (Enterprises by detailed NACE Rev. 2 activity), geo Italia, anni {data.meta.years.join(' e ')}. Ultimo aggiornamento del dataset: {data.meta.last_update_label}.
        </p>
        <p>
          {data.meta.producer_note}{' '}
          <a href="https://www.istat.it/">ISTAT</a> è il produttore nazionale; Eurostat pubblica l’estratto usato qui.
          Titoli di settore: {data.meta.labels_source}.
        </p>
        <p>
          Aggregato {data.meta.total_code}: {data.meta.total_name}. Definizione Eurostat: {data.meta.total_name_en}.
          La somma delle righe visibili può essere più bassa del totale ufficiale, perché alcune celle sono riservate e perché il totale di S non è pubblicato.
        </p>
        <p>{data.meta.classification_note} Questa mappa descrive la struttura dei conti. Non è un consiglio di investimento.</p>
      </footer>
    </div>
  )
}

function mark(dir) {
  return dir === 'desc' ? '↓' : '↑'
}

function glossaryHint(id) {
  const found = GLOSSARY.find((item) => item.code === id)
  return found ? found.body : ''
}

function KpiBar({ sector, year, isTotal, totalCode }) {
  return (
    <section className="kpis" aria-label="Indicatori del livello corrente">
      <div className="kpi-intro">
        <h2>{isTotal ? 'Italia' : `${sector.code} · ${titleIt(sector.name)}`}</h2>
        <p>
          {isTotal
            ? `Cifre ufficiali dell’aggregato ${totalCode}. Non sono la somma delle sezioni in tabella. `
            : sector.published
              ? 'Cifre ufficiali di questo codice. Non sono la somma dei figli: se una cella sotto è riservata, i conti non tornano. '
              : 'Il totale di questa sezione non è pubblicato. Sotto ci sono solo le divisioni presenti nell’estratto.'}
          {sector.published ? 'La riga sotto ogni cifra è la variazione calcolata verso l’altro anno.' : ''}
        </p>
      </div>
      <div className="kpi-grid">
        {KPI_IDS.map((id) => {
          const column = columnById(id)
          const cell = displayCell(sector, year, column)
          const variation = kpiVariation(sector, year, column)
          return (
            <article key={id} className={cell.kind}>
              <h3>{column.label}</h3>
              <p className="kpi-value">
                {cell.text}
                {(cell.kind === 'value' || cell.kind === 'estimated') && (column.unit === '%' ? '%' : <small>{column.unit}</small>)}
              </p>
              {cell.kind === 'estimated' && <p className="kpi-note">stima Eurostat</p>}
              {variation && <p className="kpi-note">nel {year === '2023' ? '2024' : '2023'}: {variation}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function withUnit(cell, unit) {
  if (cell.kind === 'value' || cell.kind === 'estimated' || cell.kind === 'calculated') {
    return unit === '%' ? `${cell.text}%` : `${cell.text} ${unit}`
  }
  return cell.text
}

function SectorCard({ sector, year }) {
  const turnover = displayCell(sector, year, columnById('NETTUR_MEUR'))
  const valueAdded = displayCell(sector, year, columnById('AV_MEUR'))
  const gor = displayCell(sector, year, columnById('GOR_PC'))
  const firms = displayCell(sector, year, columnById('ENT_NR'))
  return (
    <article className="scheda">
      <h3>{sector.code} · {titleIt(sector.name)}</h3>
      <p>
        Classe NACE Rev. 2, equivalente alle prime quattro cifre di ATECO 2007, anno {year}.
        Imprese {firms.text}. Fatturato {withUnit(turnover, 'mln €')}. Valore aggiunto {withUnit(valueAdded, 'mln €')}. GOR {withUnit(gor, '%')}.
        Il GOR è il MOL sul fatturato: descrive la struttura del codice. Non è un utile di bilancio e non è un invito a investire.
      </p>
    </article>
  )
}
