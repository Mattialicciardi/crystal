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

function deriveBand(value, bands) {
  if (value == null || Number.isNaN(value)) return null
  for (const band of bands) {
    if (band.max != null && value <= band.max) return band.label
    if (band.min != null && value >= band.min && band.max == null) return band.label
    if (band.min == null && band.max == null) return band.label
  }
  return null
}

function buildArchetype(sector) {
  const revenuePerFirm = sector.raw?.imprese ? sector.raw.fatturato_keur / sector.raw.imprese : null
  const workersPerFirm = sector.raw?.imprese ? sector.raw.occupati / sector.raw.imprese : null
  const vaMargin = sector.raw?.fatturato_keur ? sector.raw.valore_aggiunto_keur / sector.raw.fatturato_keur : null
  const payrollOnVa = sector.raw?.valore_aggiunto_keur ? sector.raw.costi_personale_keur / sector.raw.valore_aggiunto_keur : null
  const capexIntensity = sector.raw?.fatturato_keur ? sector.raw.investimenti_keur / sector.raw.fatturato_keur : null
  const largeShare = sector.concentrazione?.quota_grandi
  const microShare = sector.concentrazione?.quota_micro
  const margin = sector.fields?.margine?.value
  const productivity = sector.fields?.produttivita?.value
  const structure = sector.fields?.struttura?.value
  const barrier = sector.barriera?.value

  const structureBand = deriveBand(workersPerFirm, [
    { max: 3, label: 'micro-organizzazione' },
    { max: 10, label: 'PMI snella' },
    { max: 30, label: 'PMI strutturata' },
    { min: 30, label: 'azienda industriale' },
  ])
  const intensityBand = deriveBand(payrollOnVa, [
    { max: 0.35, label: 'labor-light' },
    { max: 0.7, label: 'labor-balanced' },
    { min: 0.7, label: 'labor-heavy' },
  ])
  const capitalBand = deriveBand(capexIntensity, [
    { max: 0.03, label: 'asset-light' },
    { max: 0.08, label: 'capex moderato' },
    { min: 0.08, label: 'capex-heavy' },
  ])
  const marketBand = deriveBand(largeShare, [
    { max: 0.2, label: 'frammentato' },
    { max: 0.5, label: 'intermedio' },
    { min: 0.5, label: 'concentrato' },
  ])
  const marginBand = deriveBand(margin, [
    { max: 0.08, label: 'margini stretti' },
    { max: 0.2, label: 'margini sani' },
    { min: 0.2, label: 'margini forti' },
  ])
  const productivityBand = deriveBand(productivity, [
    { max: 70, label: 'produttività bassa' },
    { max: 150, label: 'produttività media' },
    { min: 150, label: 'produttività alta' },
  ])
  const labels = [structureBand, intensityBand, capitalBand, marketBand, marginBand, productivityBand].filter(Boolean)
  const companyType = labels.length ? labels.join(' · ') : 'profilo misto'
  const narrativeParts = []
  if (workersPerFirm != null) narrativeParts.push(`${fmtRatio(workersPerFirm)} addetti per impresa`)
  if (revenuePerFirm != null) narrativeParts.push(`${fmtMoneyKeur(revenuePerFirm)} di ricavo medio per impresa`)
  if (vaMargin != null) narrativeParts.push(`${fmtPct(vaMargin)} di VA su fatturato`)
  if (payrollOnVa != null) narrativeParts.push(`${fmtPct(payrollOnVa)} di costo del personale sul VA`)
  if (capitalBand) narrativeParts.push(capitalBand)
  if (barrier != null) narrativeParts.push(`barriera ~ ${fmtMoneyKeur(barrier)}`)
  if (largeShare != null || microShare != null) {
    narrativeParts.push(`struttura mercato ${largeShare != null ? fmtPct(largeShare) : '—'} grandi / ${microShare != null ? fmtPct(microShare) : '—'} micro`)
  }
  return { companyType, narrative: narrativeParts.join(' · ') || 'profilo ancora frammentario' }
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

function clamp01(value) {
  if (value == null || Number.isNaN(value)) return null
  return Math.max(0, Math.min(1, value))
}

function ShareBar({ label, value, tone = 'teal' }) {
  const shown = clamp01(value)
  return (
    <div className="share-row">
      <div className="share-top">
        <span>{label}</span>
        <strong>{shown == null ? '—' : fmtPct(shown)}</strong>
      </div>
      <div className="share-track">
        <div className={`share-fill ${tone}`} style={{ width: shown == null ? '0%' : `${Math.max(4, shown * 100)}%` }} />
      </div>
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
  const valueAdded = focus.raw?.valore_aggiunto_keur ?? null
  const payroll = focus.raw?.costi_personale_keur ?? null
  const mol = focus.raw?.mol_keur ?? null
  const invest = focus.raw?.investimenti_keur ?? null
  const perFirmRevenue = focus.raw?.imprese ? focus.raw.fatturato_keur / focus.raw.imprese : null
  const perFirmVa = focus.raw?.imprese ? focus.raw.valore_aggiunto_keur / focus.raw.imprese : null
  const perFirmMol = focus.raw?.imprese ? focus.raw.mol_keur / focus.raw.imprese : null
  const perFirmPayroll = focus.raw?.imprese ? focus.raw.costi_personale_keur / focus.raw.imprese : null
  const perFirmInvest = focus.raw?.imprese ? focus.raw.investimenti_keur / focus.raw.imprese : null
  const perWorkerRevenue = focus.raw?.occupati ? focus.raw.fatturato_keur / focus.raw.occupati : null
  const perWorkerVa = focus.raw?.occupati ? focus.raw.valore_aggiunto_keur / focus.raw.occupati : null
  const perWorkerPayroll = focus.raw?.occupati ? focus.raw.costi_personale_keur / focus.raw.occupati : null
  const perWorkerMol = focus.raw?.occupati ? focus.raw.mol_keur / focus.raw.occupati : null
  const perWorkerInvest = focus.raw?.occupati ? focus.raw.investimenti_keur / focus.raw.occupati : null
  const vaShareOnRevenue = focus.raw?.fatturato_keur ? valueAdded / focus.raw.fatturato_keur : null
  const payrollShareOnVa = valueAdded ? payroll / valueAdded : null
  const molShareOnVa = valueAdded ? mol / valueAdded : null
  const investShareOnRevenue = focus.raw?.fatturato_keur ? invest / focus.raw.fatturato_keur : null
  const business = buildArchetype(focus)
  const operatingRows = [
    { label: 'Fatturato', total: focus.raw?.fatturato_keur, share: null, perFirm: perFirmRevenue, perWorker: perWorkerRevenue },
    { label: 'Valore aggiunto', total: valueAdded, share: vaShareOnRevenue, perFirm: perFirmVa, perWorker: perWorkerVa },
    { label: 'Costo del personale', total: payroll, share: payrollShareOnVa, perFirm: perFirmPayroll, perWorker: perWorkerPayroll },
    { label: 'MOL', total: mol, share: molShareOnVa, perFirm: perFirmMol, perWorker: perWorkerMol },
    { label: 'Investimenti', total: invest, share: investShareOnRevenue, perFirm: perFirmInvest, perWorker: perWorkerInvest },
  ]

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
        <div className="business-badge-row">
          <span className="focus-chip business-chip">{business.companyType}</span>
        </div>
        <p className="focus-copy">{business.narrative}</p>
        <div className="company-stack">
          <div className="company-stack-head">
            <span>Su 100 di fatturato</span>
            <strong>{vaShareOnRevenue == null ? '—' : `${fmtPct(vaShareOnRevenue)} di valore aggiunto`}</strong>
          </div>
          <div className="company-track">
            <div className="company-fill va" style={{ width: vaShareOnRevenue == null ? '0%' : `${Math.max(4, vaShareOnRevenue * 100)}%` }} />
          </div>
          <div className="company-split">
            <ShareBar label="Costo del personale su VA" value={payrollShareOnVa} tone="payroll" />
            <ShareBar label="MOL su VA" value={molShareOnVa} tone="mol" />
          </div>
        </div>
        <div className="grid-wrap">
          <table className="grid operating-table">
            <thead>
              <tr>
                <th className="l">Voce</th>
                <th className="r">Totale</th>
                <th className="r">Su fatturato</th>
                <th className="r">Per impresa</th>
                <th className="r">Per addetto</th>
              </tr>
            </thead>
            <tbody>
              {operatingRows.map((row) => (
                <tr key={row.label}>
                  <td className="l">{row.label}</td>
                  <td className="r">{row.total == null ? '—' : fmtMoneyKeur(row.total)}</td>
                  <td className="r">{row.share == null ? '—' : fmtPct(row.share)}</td>
                  <td className="r">{row.perFirm == null ? '—' : fmtMoneyKeur(row.perFirm)}</td>
                  <td className="r">{row.perWorker == null ? '—' : fmtMoneyKeur(row.perWorker)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="focus-mini-grid">
          <div className="focus-mini">
            <span>Ricavo medio per impresa</span>
            <strong>{companyRevenue == null ? '—' : fmtMoneyKeur(companyRevenue)}</strong>
          </div>
          <div className="focus-mini">
            <span>Valore aggiunto per impresa</span>
            <strong>{perFirmVa == null ? '—' : fmtMoneyKeur(perFirmVa)}</strong>
          </div>
          <div className="focus-mini">
            <span>MOL per impresa</span>
            <strong>{perFirmMol == null ? '—' : fmtMoneyKeur(perFirmMol)}</strong>
          </div>
          <div className="focus-mini">
            <span>Addetti medi per impresa</span>
            <strong>{companyWorkers == null ? '—' : fmtRatio(companyWorkers)}</strong>
          </div>
          <div className="focus-mini">
            <span>Ricavo per addetto</span>
            <strong>{perWorkerRevenue == null ? '—' : fmtMoneyKeur(perWorkerRevenue)}</strong>
          </div>
          <div className="focus-mini">
            <span>VA per addetto</span>
            <strong>{perWorkerVa == null ? '—' : fmtMoneyKeur(perWorkerVa)}</strong>
          </div>
          <div className="focus-mini">
            <span>Investimenti per addetto</span>
            <strong>{perWorkerInvest == null ? '—' : fmtMoneyKeur(perWorkerInvest)}</strong>
          </div>
          <div className="focus-mini">
            <span>Investimenti totali</span>
            <strong>{invest == null ? '—' : fmtMoneyKeur(invest)}</strong>
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
