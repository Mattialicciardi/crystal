import InfoDot from './InfoDot.jsx'
import { fmtCount, fmtMoneyKeur, fmtPct, fmtRatio } from '../lib.js'

function formatShare(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return fmtPct(value)
}

function buildTags(sector) {
  const tags = []
  const largeShare = sector.concentrazione?.quota_grandi
  const microShare = sector.concentrazione?.quota_micro
  const margin = sector.fields?.margine?.value
  const productivity = sector.fields?.produttivita?.value
  const structure = sector.fields?.struttura?.value
  const barrier = sector.barriera?.value

  if (largeShare != null) {
    if (largeShare >= 0.6) tags.push('grandi dominano')
    else if (largeShare <= 0.2) tags.push('grandi minoritari')
  }
  if (microShare != null) {
    if (microShare >= 0.25) tags.push('micro-frammentato')
    else if (microShare <= 0.08) tags.push('micro marginale')
  }
  if (structure != null) {
    if (structure <= 5) tags.push('imprese piccole')
    else if (structure >= 20) tags.push('imprese strutturate')
  }
  if (margin != null) {
    if (margin >= 0.2) tags.push('margini alti')
    else if (margin <= 0.08) tags.push('margini compressi')
  }
  if (productivity != null) {
    if (productivity >= 150) tags.push('produttivita alta')
    else if (productivity <= 70) tags.push('produttivita bassa')
  }
  if (barrier != null && barrier >= 100) tags.push('barriera forte')

  return tags
}

function sectorNarrative(sector) {
  const tags = buildTags(sector)
  if (!tags.length) return 'Il dataset qui parla ancora a frammenti: il profilo esiste, ma non basta per un giudizio netto.'
  return `Firma tipo: ${tags.join(' · ')}.`
}

function MetricCard({ label, value, note }) {
  return (
    <div className="focus-card">
      <div className="focus-k">{label}</div>
      <div className="focus-v">{value}</div>
      {note && <div className="focus-note">{note}</div>}
    </div>
  )
}

export default function SectorLens({
  focus,
  lineage,
  directChildren,
  leafDescendants,
  sizeKey,
  sizeLabel,
  onDrill,
  sizeFmt,
  hasChildren,
}) {
  if (!focus) return null

  const fatturato = focus.raw?.fatturato_keur ?? 0
  const companyRevenue = focus.raw?.imprese ? focus.raw.fatturato_keur / focus.raw.imprese : null
  const companyWorkers = focus.raw?.imprese ? focus.raw.occupati / focus.raw.imprese : null
  const productivity = focus.fields?.produttivita?.value
  const margin = focus.fields?.margine?.value
  const structure = focus.fields?.struttura?.value
  const largeShare = focus.concentrazione?.quota_grandi
  const microShare = focus.concentrazione?.quota_micro
  const barrier = focus.barriera?.value
  const confidence = focus.confidence
  const coverage = focus.coverage
  const childCount = directChildren.length
  const leafCount = leafDescendants.length

  const directRows = [...directChildren].sort((left, right) => (right.raw?.[sizeKey] || 0) - (left.raw?.[sizeKey] || 0))
  const leafRows = [...leafDescendants].sort((left, right) => (right.raw?.fatturato_keur || 0) - (left.raw?.fatturato_keur || 0))

  return (
    <section className="focus">
      <div className="focus-head">
        <div>
          <div className="focus-kicker">Focus profondo</div>
          <h2>{focus.code} · {focus.name}</h2>
          <div className="focus-meta">
            <span>{focus.level}</span>
            <span>·</span>
            <span>{childCount} sotto-nicchie immediate</span>
            <span>·</span>
            <span>{leafCount} foglie sotto questa nicchia</span>
          </div>
        </div>
        <div className="focus-tags">
          <span className="focus-chip">{formatShare(coverage / 100)} coverage</span>
          <span className="focus-chip">{formatShare(confidence / 100)} confidence</span>
          {buildTags(focus).slice(0, 4).map((tag) => <span key={tag} className="focus-chip">{tag}</span>)}
        </div>
      </div>

      <div className="focus-lineage">
        {lineage.map((item, index) => (
          <span key={item.code}>
            {index > 0 && <span className="sep">▸</span>}
            <button className={'crumb' + (index === lineage.length - 1 ? ' here' : '')} onClick={() => onDrill(item.i)}>{item.label}</button>
          </span>
        ))}
      </div>

      <div className="focus-grid">
        <MetricCard label="Fatturato" value={fmtMoneyKeur(fatturato)} note="base economica del nodo corrente" />
        <MetricCard label="VA / addetto" value={fmtMoneyKeur(productivity)} note="firma della produttività del lavoro" />
        <MetricCard label="Margine" value={fmtPct(margin)} note="MOL su fatturato" />
        <MetricCard label="Addetti / impresa" value={fmtRatio(structure)} note="quanto è frammentata la struttura" />
        <MetricCard label="Quota grandi" value={fmtPct(largeShare)} note="peso delle imprese >=250 addetti" />
        <MetricCard label="Quota micro" value={fmtPct(microShare)} note="peso delle imprese <10 addetti" />
        <MetricCard label="Barriera" value={barrier == null ? '—' : fmtMoneyKeur(barrier)} note="investimenti per addetto" />
        <MetricCard label="Firma media" value={companyRevenue == null ? '—' : fmtMoneyKeur(companyRevenue)} note={`fatturato medio per impresa · ${fmtCount(focus.raw?.imprese) || '—'} imprese`} />
      </div>

      <div className="focus-block">
        <h3 className="sec-title">Lente aziendale <InfoDot text="Non è una singola azienda reale: è una lettura operativa del settore come se fosse un'impresa media, usando i rapporti strutturali disponibili." /></h3>
        <p className="focus-copy">{sectorNarrative(focus)}</p>
        <div className="focus-mini-grid">
          <div className="focus-mini">
            <span>Ricavo medio per impresa</span>
            <strong>{companyRevenue == null ? '—' : fmtMoneyKeur(companyRevenue)}</strong>
          </div>
          <div className="focus-mini">
            <span>Addetti medi per impresa</span>
            <strong>{companyWorkers == null ? '—' : fmtRatio(companyWorkers)}</strong>
          </div>
          <div className="focus-mini">
            <span>Produttività</span>
            <strong>{productivity == null ? '—' : fmtMoneyKeur(productivity)}</strong>
          </div>
          <div className="focus-mini">
            <span>Barriera di entrata</span>
            <strong>{barrier == null ? '—' : fmtMoneyKeur(barrier)}</strong>
          </div>
        </div>
      </div>

      <div className="focus-block">
        <h3 className="sec-title">Sotto-nicchie immediate</h3>
        <div className="grid-wrap">
          <table className="grid focus-table">
            <thead>
              <tr>
                <th className="l">Settore</th>
                <th className="r">Peso</th>
                <th className="r">{sizeLabel}</th>
                <th className="r">Crescita</th>
                <th className="r">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {directRows.map((row) => {
                const share = fatturato ? ((row.raw?.fatturato_keur || 0) / fatturato) : null
                const drillable = hasChildren ? hasChildren(row.code) : false
                return (
                  <tr key={row.code} className={drillable ? 'drillable' : ''} onClick={() => drillable && onDrill(row.code)}>
                    <td className="l"><span className="code">{row.code}</span> {row.name}</td>
                    <td className="r">{share == null ? '—' : fmtPct(share)}</td>
                    <td className="r">{sizeFmt(row.raw?.[sizeKey])}</td>
                    <td className="r">{fmtPct(row.fields?.crescita?.value)}</td>
                    <td className="r">{fmtPct((row.confidence ?? 0) / 100)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {leafRows.length > 0 && (
        <div className="focus-block">
          <h3 className="sec-title">Foglie più pesanti sotto questa nicchia <InfoDot text="Le classi finali che spiegano il massimo del fatturato sotto il nodo selezionato." /></h3>
          <div className="focus-leaves">
            {leafRows.slice(0, 8).map((row) => {
              const share = fatturato ? ((row.raw?.fatturato_keur || 0) / fatturato) : null
              return (
                <button key={row.code} className="leaf-chip" onClick={() => onDrill(row.code)}>
                  <span className="leaf-code">{row.code}</span>
                  <span className="leaf-name">{row.name}</span>
                  <span className="leaf-share">{share == null ? '—' : fmtPct(share)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
