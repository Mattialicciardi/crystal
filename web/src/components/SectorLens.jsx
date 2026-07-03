import { useState } from 'react'
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
  const signals = [
    {
      key: 'struttura',
      label: 'Struttura',
      value: structureBand || 'n.d.',
      tone: workersPerFirm == null ? 'neutral' : workersPerFirm <= 10 ? 'teal' : 'blue',
      detail: workersPerFirm == null ? 'addetti per impresa non disponibile' : `${fmtRatio(workersPerFirm)} addetti/impresa`,
    },
    {
      key: 'capitale',
      label: 'Capitale',
      value: capitalBand || 'n.d.',
      tone: capexIntensity == null ? 'neutral' : capexIntensity >= 0.08 ? 'amber' : 'teal',
      detail: capexIntensity == null ? 'intensità investimenti non disponibile' : `${fmtPct(capexIntensity)} investimenti/fatturato`,
    },
    {
      key: 'mercato',
      label: 'Mercato',
      value: marketBand || 'n.d.',
      tone: largeShare == null ? 'neutral' : largeShare >= 0.5 ? 'blue' : 'teal',
      detail: largeShare == null ? 'concentrazione non disponibile' : `${fmtPct(largeShare)} quota grandi`,
    },
    {
      key: 'margine',
      label: 'Margine',
      value: marginBand || 'n.d.',
      tone: margin == null ? 'neutral' : margin >= 0.2 ? 'teal' : 'amber',
      detail: margin == null ? 'margine non disponibile' : `${fmtPct(margin)} MOL/fatturato`,
    },
    {
      key: 'produttivita',
      label: 'Produttività',
      value: productivityBand || 'n.d.',
      tone: productivity == null ? 'neutral' : productivity >= 150 ? 'teal' : 'amber',
      detail: productivity == null ? 'produttività non disponibile' : `${fmtMoneyKeur(productivity)} VA/addetto`,
    },
  ]
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
  const summary = [
    workersPerFirm != null ? `${fmtRatio(workersPerFirm)} addetti per impresa` : null,
    revenuePerFirm != null ? `${fmtMoneyKeur(revenuePerFirm)} di ricavo medio` : null,
    vaMargin != null ? `${fmtPct(vaMargin)} di VA su fatturato` : null,
    payrollOnVa != null ? `${fmtPct(payrollOnVa)} di costo del personale sul VA` : null,
  ].filter(Boolean).join(' · ')
  const companyFrame = [
    {
      key: 'scale',
      label: 'Scala',
      value: workersPerFirm == null ? 'n.d.' : `${fmtRatio(workersPerFirm)} addetti/impresa`,
      detail: revenuePerFirm == null ? 'ricavo medio non disponibile' : `${fmtMoneyKeur(revenuePerFirm)} di ricavo medio`,
      tone: workersPerFirm == null ? 'neutral' : workersPerFirm >= 30 ? 'blue' : workersPerFirm >= 10 ? 'teal' : 'amber',
    },
    {
      key: 'costi',
      label: 'Costi',
      value: payrollOnVa == null ? 'n.d.' : `${fmtPct(payrollOnVa)} del VA`,
      detail: capexIntensity == null ? 'capex non disponibile' : `${fmtPct(capexIntensity)} investimenti/fatturato`,
      tone: payrollOnVa == null ? 'neutral' : payrollOnVa >= 0.7 ? 'amber' : 'teal',
    },
    {
      key: 'potere',
      label: 'Potere mercato',
      value: marketBand || 'n.d.',
      detail: largeShare == null ? 'concentrazione non disponibile' : `${fmtPct(largeShare)} quota grandi`,
      tone: largeShare == null ? 'neutral' : largeShare >= 0.5 ? 'blue' : 'teal',
    },
    {
      key: 'moat',
      label: 'Barriera',
      value: barrier == null ? 'n.d.' : fmtMoneyKeur(barrier),
      detail: barrier == null ? 'barriera non disponibile' : 'investimenti per addetto',
      tone: barrier == null ? 'neutral' : barrier >= 100 ? 'blue' : barrier >= 50 ? 'teal' : 'amber',
    },
  ]
  const diagnostics = []
  if (companyType !== 'profilo misto') diagnostics.push(`profilo: ${companyType}`)
  if (margin != null && margin <= 0.08) diagnostics.push('margine stretto: il pricing è sotto pressione')
  if (capitalBand === 'capex-heavy') diagnostics.push('capitale pesante: la scala conta più della frammentazione')
  if (intensityBand === 'labor-heavy') diagnostics.push('modello lavoro-intensivo: il costo del personale pesa sul VA')
  if (largeShare != null && largeShare >= 0.5) diagnostics.push('mercato concentrato: pochi player dominano il fatturato')
  if (microShare != null && microShare >= 0.25) diagnostics.push('coda lunga: molti piccoli attori restano rilevanti')
  if (barrier != null && barrier >= 100) diagnostics.push('barriera d’ingresso alta: serve capitale per stare sul mercato')
  if (!diagnostics.length) diagnostics.push('profilo ancora ibrido: leggere il nodo con le sotto-nicchie immediate')

  const revenueEngine = (() => {
    if (productivity != null && productivity >= 150) return 'leva valore/produttività'
    if (largeShare != null && largeShare >= 0.5) return 'leva scala e posizione di mercato'
    if (margin != null && margin >= 0.2) return 'leva pricing e mix'
    return 'leva volume e controllo costi'
  })()

  const costEngine = (() => {
    if (payrollOnVa == null) return 'costo del personale non leggibile'
    if (payrollOnVa >= 0.7) return 'costo lavoro dominante sul VA'
    if (payrollOnVa >= 0.45) return 'costi lavoro bilanciati con margine'
    return 'costo lavoro contenuto rispetto al VA'
  })()

  const capitalEngine = (() => {
    if (capexIntensity == null) return 'intensità capitale non leggibile'
    if (capexIntensity >= 0.08) return 'modello capital intensive'
    if (capexIntensity >= 0.03) return 'modello a capitale moderato'
    return 'modello capital light'
  })()

  const marketEngine = (() => {
    if (largeShare == null) return 'mercato non classificabile'
    if (largeShare >= 0.5) return 'mercato concentrato'
    if (largeShare <= 0.2) return 'mercato frammentato'
    return 'mercato intermedio'
  })()

  const operatingRisk = []
  if (margin != null && margin <= 0.08) operatingRisk.push('rischio pricing')
  if (capitalBand === 'capex-heavy') operatingRisk.push('rischio capitale')
  if (intensityBand === 'labor-heavy') operatingRisk.push('rischio costo lavoro')
  if (microShare != null && microShare >= 0.25) operatingRisk.push('coda lunga difficile da consolidare')
  if (largeShare != null && largeShare >= 0.5) operatingRisk.push('dipendenza dai grandi player')
  if (barrier != null && barrier >= 100) operatingRisk.push('barriera alta per nuovi entranti')
  if (!operatingRisk.length) operatingRisk.push('profilo rischi bilanciato o poco leggibile')

  const companyModel = [
    { key: 'revenue', label: 'Motore ricavi', value: revenueEngine, detail: revenuePerFirm == null ? 'ricavo medio non disponibile' : `${fmtMoneyKeur(revenuePerFirm)} per impresa`, tone: 'blue' },
    { key: 'cost', label: 'Motore costi', value: costEngine, detail: payrollOnVa == null ? 'costo lavoro non disponibile' : `${fmtPct(payrollOnVa)} del VA in personale`, tone: 'amber' },
    { key: 'capital', label: 'Motore capitale', value: capitalEngine, detail: capexIntensity == null ? 'capex non disponibile' : `${fmtPct(capexIntensity)} investimenti/fatturato`, tone: 'teal' },
    { key: 'market', label: 'Motore mercato', value: marketEngine, detail: largeShare == null ? 'concentrazione non disponibile' : `${fmtPct(largeShare)} quota grandi`, tone: 'blue' },
    { key: 'risk', label: 'Rischio operativo', value: operatingRisk[0], detail: operatingRisk.slice(1).join(' · ') || 'nessun rischio dominante emergente', tone: 'amber' },
  ]

  const valueChain = [
    {
      key: 'input',
      label: 'Input',
      value: capexIntensity == null ? 'n.d.' : capexIntensity >= 0.08 ? 'capital input-heavy' : 'capital input-light',
      detail: capexIntensity == null ? 'non leggibile dai dati' : `${fmtPct(capexIntensity)} investimenti/fatturato`,
      tone: capexIntensity == null ? 'neutral' : capexIntensity >= 0.08 ? 'amber' : 'teal',
    },
    {
      key: 'processing',
      label: 'Processo',
      value: intensityBand || 'n.d.',
      detail: payrollOnVa == null ? 'non leggibile dai dati' : `${fmtPct(payrollOnVa)} del VA in personale`,
      tone: intensityBand == null ? 'neutral' : intensityBand === 'labor-heavy' ? 'amber' : 'teal',
    },
    {
      key: 'scale',
      label: 'Scala operativa',
      value: structureBand || 'n.d.',
      detail: companyWorkers == null ? 'non leggibile dai dati' : `${fmtRatio(companyWorkers)} addetti/impresa`,
      tone: structureBand == null ? 'neutral' : companyWorkers >= 30 ? 'blue' : 'teal',
    },
    {
      key: 'pricing',
      label: 'Pricing power',
      value: marginBand || 'n.d.',
      detail: margin == null ? 'non leggibile dai dati' : `${fmtPct(margin)} MOL/fatturato`,
      tone: margin == null ? 'neutral' : margin >= 0.2 ? 'teal' : 'amber',
    },
    {
      key: 'distribution',
      label: 'Distribuzione',
      value: marketBand || 'n.d.',
      detail: largeShare == null ? 'non leggibile dai dati' : `${fmtPct(largeShare)} quota grandi`,
      tone: largeShare == null ? 'neutral' : largeShare >= 0.5 ? 'blue' : 'teal',
    },
    {
      key: 'resilience',
      label: 'Resilienza',
      value: operatingRisk.length > 1 ? 'mix di pressioni' : 'profilo lineare',
      detail: operatingRisk.join(' · '),
      tone: operatingRisk.length > 1 ? 'amber' : 'teal',
    },
  ]

  const companyNarrative = [
    `Se fosse un'azienda, il suo motore sarebbe: ${revenueEngine}.`,
    `La struttura dei costi è: ${costEngine}.`,
    `Il modello di capitale è: ${capitalEngine}.`,
    `Il campo competitivo è: ${marketEngine}.`,
  ].join(' ')

  const valueChainNarrative = [
    `Input e capitale: ${capitalEngine}.`,
    `Processo interno: ${intensityBand || 'non leggibile'} con ${companyWorkers == null ? 'scala non disponibile' : `${fmtRatio(companyWorkers)} addetti per impresa`}.`,
    `Uscita economica: ${marginBand || 'margini non leggibili'} e ${productivityBand || 'produttività non leggibile'}.`,
    `Pressione esterna: ${marketBand || 'mercato non leggibile'} con ${largeShare == null ? 'quota grandi non disponibile' : `${fmtPct(largeShare)} grandi`}.`,
  ].join(' ')

  const customerPressure = (() => {
    if (margin == null && largeShare == null) return 'domanda non leggibile'
    if (margin != null && margin >= 0.2 && largeShare != null && largeShare >= 0.5) return 'clienti forti / pricing difendibile'
    if (margin != null && margin <= 0.08) return 'clienti forti / pricing debole'
    if (largeShare != null && largeShare <= 0.2) return 'clienti più frammentati'
    return 'clienti intermedi'
  })()

  const supplierPressure = (() => {
    if (capexIntensity == null && payrollOnVa == null) return 'fornitori non leggibili'
    if (capexIntensity != null && capexIntensity >= 0.08) return 'fornitori/capitale pesano'
    if (payrollOnVa != null && payrollOnVa >= 0.7) return 'fornitori lavoro pesano'
    if (capexIntensity != null && capexIntensity <= 0.03 && payrollOnVa != null && payrollOnVa <= 0.45) return 'fornitori leggeri'
    return 'fornitori bilanciati'
  })()

  const dependencyModel = [
    {
      key: 'clients',
      label: 'Clienti',
      value: customerPressure,
      detail: margin == null ? 'margine non disponibile' : `${fmtPct(margin)} MOL/fatturato`,
      tone: margin != null && margin <= 0.08 ? 'amber' : 'blue',
    },
    {
      key: 'suppliers',
      label: 'Fornitori',
      value: supplierPressure,
      detail: capexIntensity == null ? 'capex non disponibile' : `${fmtPct(capexIntensity)} investimenti/fatturato`,
      tone: capexIntensity != null && capexIntensity >= 0.08 ? 'teal' : 'amber',
    },
    {
      key: 'switching',
      label: 'Switching',
      value: barrier == null ? 'n.d.' : barrier >= 100 ? 'alto' : barrier >= 50 ? 'medio' : 'basso',
      detail: barrier == null ? 'barriera non disponibile' : `${fmtMoneyKeur(barrier)} per addetto`,
      tone: barrier == null ? 'neutral' : barrier >= 100 ? 'blue' : barrier >= 50 ? 'teal' : 'amber',
    },
    {
      key: 'pressure',
      label: 'Pressione prezzo',
      value: marginBand || 'n.d.',
      detail: largeShare == null ? 'concentrazione non disponibile' : `${fmtPct(largeShare)} quota grandi`,
      tone: margin == null ? 'neutral' : margin <= 0.08 ? 'amber' : 'teal',
    },
  ]

  const dominantDriver = (() => {
    if (productivity != null && productivity >= 150) return 'produttività alta'
    if (largeShare != null && largeShare >= 0.5) return 'posizione di mercato forte'
    if (margin != null && margin >= 0.2) return 'pricing e mix solidi'
    if (capitalBand === 'capex-heavy') return 'intensità capitale'
    if (intensityBand === 'labor-heavy') return 'intensità lavoro'
    return 'driver misto'
  })()

  const mainConstraint = (() => {
    if (margin != null && margin <= 0.08) return 'margine compresso'
    if (microShare != null && microShare >= 0.25) return 'frammentazione elevata'
    if (barrier != null && barrier >= 100) return 'barriera di ingresso alta'
    if (payrollOnVa != null && payrollOnVa >= 0.7) return 'costo del personale pesante'
    return 'vincolo non dominante'
  })()

  const nextCheck = (() => {
    if (directRows.length > 0) return 'scendere nelle sotto-nicchie immediate'
    if (leafRows.length > 0) return 'leggere le classi finali più pesanti'
    if (siblingRows.length > 0) return 'confrontare le sorelle della nicchia'
    return 'spostarsi sul parent per contesto'
  })()

  return {
    companyType,
    narrative: narrativeParts.join(' · ') || 'profilo ancora frammentario',
    signals,
    summary,
    companyFrame,
    diagnostics,
    companyModel,
    companyNarrative,
    valueChain,
    valueChainNarrative,
    dependencyModel,
    dominantDriver,
    mainConstraint,
    nextCheck,
  }
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

function comparePercentile(value, peers, getter) {
  if (value == null || !peers?.length) return null
  const values = peers.map((peer) => getter(peer)).filter((peerValue) => peerValue != null && !Number.isNaN(peerValue))
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const below = sorted.filter((peerValue) => peerValue <= value).length
  const percentile = below / sorted.length
  return {
    percentile,
    rank: below,
    total: sorted.length,
    median: sorted[Math.floor((sorted.length - 1) / 2)],
  }
}

function sumRevenue(rows) {
  return rows.reduce((total, row) => total + (row.raw?.fatturato_keur || 0), 0)
}

function concentrationStats(rows, parentRevenue) {
  const positive = rows
    .map((row) => ({ row, revenue: row.raw?.fatturato_keur || 0 }))
    .filter(({ revenue }) => revenue > 0)
    .sort((left, right) => right.revenue - left.revenue)
  if (!positive.length || !parentRevenue) return null
  const shares = positive.map(({ revenue }) => revenue / parentRevenue)
  const top1 = shares[0] ?? null
  const top3 = shares.slice(0, 3).reduce((total, value) => total + value, 0)
  const hhi = shares.reduce((total, value) => total + (value * value), 0)
  const effectiveCount = hhi > 0 ? 1 / hhi : null
  return { top1, top3, hhi, effectiveCount, count: positive.length }
}

function HierarchyCard({ label, value, note, tone = 'neutral' }) {
  return (
    <div className={`hier-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{note}</em>
    </div>
  )
}

function FocusSection({ id, title, subtitle, open, onToggle, children }) {
  return (
    <div className="focus-section">
      <button className="focus-section-toggle" onClick={() => onToggle(id)}>
        <span>
          <strong>{title}</strong>
          {subtitle && <em>{subtitle}</em>}
        </span>
        <i>{open ? '−' : '+'}</i>
      </button>
      {open && <div className="focus-section-body">{children}</div>}
    </div>
  )
}

function PeerCard({ label, value, peer, note, tone = 'neutral' }) {
  const percentile = peer?.percentile
  const width = percentile == null ? 0 : Math.max(4, percentile * 100)
  const descriptor =
    percentile == null ? 'non confrontabile'
      : percentile >= 0.8 ? 'top quartile'
      : percentile >= 0.5 ? 'sopra mediana'
      : percentile >= 0.2 ? 'sotto mediana'
      : 'bottom quartile'
  return (
    <div className={`peer-card ${tone}`}>
      <div className="peer-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="peer-bar">
        <i style={{ width: `${width}%` }} />
      </div>
      <div className="peer-foot">
        <span>{descriptor}</span>
        <em>{peer == null ? 'nessun confronto disponibile' : `${peer.rank}/${peer.total} pari`}</em>
      </div>
      <div className="peer-note">{note}</div>
    </div>
  )
}

export default function SectorLens({
  focus,
  lineage,
  directChildren,
  leafDescendants,
  peerGroup,
  sizeKey,
  sizeLabel,
  onDrill,
  sizeFmt,
  hasChildren,
}) {
  if (!focus) return null
  const [openSections, setOpenSections] = useState({
    hierarchy: true,
    archetype: true,
    chain: true,
    dependency: true,
    peers: true,
    operating: true,
    leaves: false,
  })
  const toggleSection = (id) => setOpenSections((state) => ({ ...state, [id]: !state[id] }))

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
  const peerCards = [
    {
      key: 'scale',
      label: 'Scala',
      value: companyWorkers == null ? '—' : fmtRatio(companyWorkers),
      peer: comparePercentile(companyWorkers, peerGroup, (s) => (s.raw?.imprese ? s.raw.occupati / s.raw.imprese : null)),
      note: 'addetti per impresa rispetto alle nicchie sorelle',
      tone: 'blue',
    },
    {
      key: 'productivity',
      label: 'Produttività',
      value: productivity == null ? '—' : fmtMoneyKeur(productivity),
      peer: comparePercentile(productivity, peerGroup, (s) => s.fields?.produttivita?.value),
      note: 'VA/addetto rispetto ai pari',
      tone: 'teal',
    },
    {
      key: 'margin',
      label: 'Margine',
      value: margin == null ? '—' : fmtPct(margin),
      peer: comparePercentile(margin, peerGroup, (s) => s.fields?.margine?.value),
      note: 'MOL/fatturato nella nicchia madre',
      tone: 'amber',
    },
    {
      key: 'market',
      label: 'Mercato',
      value: largeShare == null ? '—' : fmtPct(largeShare),
      peer: comparePercentile(largeShare, peerGroup, (s) => s.concentrazione?.quota_grandi),
      note: 'quota grandi = concentrazione del campo',
      tone: 'blue',
    },
    {
      key: 'fragmentation',
      label: 'Frammentazione',
      value: microShare == null ? '—' : fmtPct(microShare),
      peer: comparePercentile(microShare, peerGroup, (s) => s.concentrazione?.quota_micro),
      note: 'quota micro = coda lunga',
      tone: 'amber',
    },
    {
      key: 'moat',
      label: 'Barriera',
      value: barrier == null ? '—' : fmtMoneyKeur(barrier),
      peer: comparePercentile(barrier, peerGroup, (s) => s.barriera?.value),
      note: 'investimenti per addetto come proxy del moat',
      tone: 'teal',
    },
  ]
  const operatingRows = [
    { label: 'Fatturato', total: focus.raw?.fatturato_keur, share: null, perFirm: perFirmRevenue, perWorker: perWorkerRevenue },
    { label: 'Valore aggiunto', total: valueAdded, share: vaShareOnRevenue, perFirm: perFirmVa, perWorker: perWorkerVa },
    { label: 'Costo del personale', total: payroll, share: payrollShareOnVa, perFirm: perFirmPayroll, perWorker: perWorkerPayroll },
    { label: 'MOL', total: mol, share: molShareOnVa, perFirm: perFirmMol, perWorker: perWorkerMol },
    { label: 'Investimenti', total: invest, share: investShareOnRevenue, perFirm: perFirmInvest, perWorker: perWorkerInvest },
  ]

  const directRows = [...directChildren].sort((left, right) => (right.raw?.[sizeKey] || 0) - (left.raw?.[sizeKey] || 0))
  const leafRows = [...leafDescendants].sort((left, right) => (right.raw?.fatturato_keur || 0) - (left.raw?.fatturato_keur || 0))
  const parentCrumb = lineage.length > 1 ? lineage[lineage.length - 2] : null
  const directRevenue = sumRevenue(directRows)
  const leafRevenue = sumRevenue(leafRows)
  const directConcentration = concentrationStats(directRows, focus.raw?.fatturato_keur)
  const leafConcentration = concentrationStats(leafRows, focus.raw?.fatturato_keur)
  const siblingRows = peerGroup.filter((row) => row.code !== focus.code)
  const siblingRevenue = sumRevenue(siblingRows)
  const siblingContext = siblingRows.length ? concentrationStats(siblingRows, parentCrumb ? (parentCrumb.raw?.fatturato_keur || siblingRevenue + (focus.raw?.fatturato_keur || 0)) : siblingRevenue + (focus.raw?.fatturato_keur || 0)) : null
  const executiveMemo = [
    companyWorkers == null ? 'scala non leggibile' : `${fmtRatio(companyWorkers)} addetti/impresa`,
    productivity == null ? 'produttività non leggibile' : `${fmtMoneyKeur(productivity)} VA/addetto`,
    margin == null ? 'margine non leggibile' : `${fmtPct(margin)} MOL/fatturato`,
    largeShare == null ? 'concentrazione non leggibile' : `${fmtPct(largeShare)} quota grandi`,
  ]
  const executiveVerdict = (() => {
    if (margin != null && margin <= 0.08 && largeShare != null && largeShare >= 0.5) return 'mercato duro: pricing stretto e potere concentrato'
    if (productivity != null && productivity >= 150 && barrier != null && barrier >= 100) return 'nicchia di qualità: produttività e barriera sostengono il moat'
    if (microShare != null && microShare >= 0.25) return 'coda lunga forte: frammentazione alta e consolidamento difficile'
    if (capitalBand === 'capex-heavy') return 'capitale pesante: la scala conta più della quantità di operatori'
    return 'profilo intermedio: leggere i dettagli per capire il vero driver'
  })()
  const avgDefined = (values) => {
    const filtered = values.filter((value) => value != null && !Number.isNaN(value))
    if (!filtered.length) return null
    return filtered.reduce((total, value) => total + value, 0) / filtered.length
  }
  const scoreLabel = (score) => (score == null ? 'n.d.' : `${Math.round(score * 100)}/100`)
  const depthScore = avgDefined([
    companyWorkers == null ? null : clamp01(companyWorkers / 30),
    productivity == null ? null : clamp01(productivity / 150),
    leafCount === 0 ? null : clamp01(leafCount / 12),
  ])
  const pressureScore = avgDefined([
    margin == null ? null : clamp01(1 - (margin / 0.2)),
    microShare == null ? null : clamp01(microShare / 0.25),
    largeShare == null ? null : clamp01(largeShare / 0.5),
    capitalBand == null ? null : (capitalBand === 'capex-heavy' ? 1 : capitalBand === 'capex moderato' ? 0.55 : 0.2),
  ])
  const defensibilityScore = avgDefined([
    barrier == null ? null : clamp01(barrier / 100),
    margin == null ? null : clamp01(margin / 0.2),
    largeShare == null ? null : clamp01(largeShare / 0.5),
  ])

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
          <span className="focus-chip">{focus.level}</span>
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

      <div className="focus-memo">
        <div className="focus-memo-head">
          <div>
            <div className="focus-kicker">Executive memo</div>
            <h3>{executiveVerdict}</h3>
          </div>
          <div className="focus-memo-stats">
            {executiveMemo.map((item) => <span key={item} className="focus-chip">{item}</span>)}
          </div>
        </div>
        <div className="focus-memo-grid">
          <div className="focus-memo-card">
            <span>Che tipo di azienda è</span>
            <strong>{business.companyType}</strong>
            <em>{business.companyNarrative}</em>
          </div>
          <div className="focus-memo-card">
            <span>Dove si difende</span>
            <strong>{business.companyModel[0]?.value || '—'}</strong>
            <em>{business.companyModel[0]?.detail || '—'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Dove soffre</span>
            <strong>{business.dependencyModel[0]?.value || '—'}</strong>
            <em>{business.dependencyModel[0]?.detail || '—'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Come leggerlo</span>
            <strong>{focus.level} · {childCount} figli · {leafCount} foglie</strong>
            <em>{parentCrumb ? `sotto ${parentCrumb.label}` : 'radice del settore'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Driver dominante</span>
            <strong>{business.dominantDriver}</strong>
            <em>{business.companyModel.find((item) => item.key === 'revenue')?.detail || '—'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Vincolo principale</span>
            <strong>{business.mainConstraint}</strong>
            <em>{business.dependencyModel.find((item) => item.key === 'pressure')?.detail || '—'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Prossimo check</span>
            <strong>{business.nextCheck}</strong>
            <em>{leafRows.length > 0 ? 'le foglie aiutano a validare il quadro' : 'serve più dettaglio a valle'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Profondità operativa</span>
            <strong>{scoreLabel(depthScore)}</strong>
            <em>{leafCount > 0 ? 'misura scala, produttività e ramificazioni della nicchia' : 'assenza di foglie limita la lettura'}</em>
          </div>
          <div className="focus-memo-card">
            <span>Pressione competitiva</span>
            <strong>{scoreLabel(pressureScore)}</strong>
            <em>{business.mainConstraint}</em>
          </div>
          <div className="focus-memo-card">
            <span>Difendibilità</span>
            <strong>{scoreLabel(defensibilityScore)}</strong>
            <em>{business.dominantDriver}</em>
          </div>
        </div>
      </div>

      <div className="focus-block">
        <h3 className="sec-title">Posizione gerarchica <InfoDot text="Legge il nodo rispetto ai livelli sopra e sotto: parent, sibling, figli immediati e foglie finali." /></h3>
        <FocusSection
          id="hierarchy"
          title="Gerarchia"
          subtitle="sopra, dentro, foglie e sorelle"
          open={openSections.hierarchy}
          onToggle={toggleSection}
        >
        <div className="hier-grid">
          <HierarchyCard
            label="Sopra"
            value={parentCrumb ? parentCrumb.label : 'radice'}
            note={parentCrumb ? `${parentCrumb.code} · livello superiore` : 'nessun parent: stai al livello più alto'}
            tone="blue"
          />
          <HierarchyCard
            label="Dentro"
            value={`${childCount} sotto-nicchie`}
            note={directRevenue ? `${fmtPct(directRevenue / (focus.raw?.fatturato_keur || 1))} del fatturato nei figli immediati` : 'nessun figlio disponibile'}
            tone="teal"
          />
          <HierarchyCard
            label="Foglie"
            value={`${leafCount} classi finali`}
            note={leafRevenue ? `${fmtPct(leafRevenue / (focus.raw?.fatturato_keur || 1))} del fatturato sotto la nicchia` : 'nessuna foglia disponibile'}
            tone="amber"
          />
          <HierarchyCard
            label="Sorelle"
            value={`${siblingRows.length} pari`}
            note={siblingContext ? `top1 pari ${fmtPct(siblingContext.top1)} · top3 ${fmtPct(siblingContext.top3)}` : 'niente confronto sorelle'}
            tone="blue"
          />
        </div>
        <div className="hier-grid">
          <HierarchyCard
            label="Concentrazione figli"
            value={directConcentration ? `${fmtPct(directConcentration.top1)} top1` : 'n.d.'}
            note={directConcentration ? `top3 ${fmtPct(directConcentration.top3)} · HHI proxy ${directConcentration.hhi.toFixed(3)}` : 'figli non abbastanza leggibili'}
            tone={directConcentration && directConcentration.top1 >= 0.5 ? 'amber' : 'teal'}
          />
          <HierarchyCard
            label="Concentrazione foglie"
            value={leafConcentration ? `${fmtPct(leafConcentration.top1)} top1` : 'n.d.'}
            note={leafConcentration ? `top3 ${fmtPct(leafConcentration.top3)} · foglie effettive ~ ${fmtRatio(leafConcentration.effectiveCount)}` : 'foglie non abbastanza leggibili'}
            tone={leafConcentration && leafConcentration.top1 >= 0.5 ? 'amber' : 'teal'}
          />
        </div>
        </FocusSection>
      </div>

      <div className="focus-block">
        <h3 className="sec-title">Lente aziendale <InfoDot text="Non è una singola azienda reale: è una lettura operativa del settore come se fosse un'impresa media, usando i rapporti strutturali disponibili." /></h3>
        <FocusSection
          id="archetype"
          title="Scomposizione aziendale"
          subtitle="motore ricavi, costi, capitale, mercato"
          open={openSections.archetype}
          onToggle={toggleSection}
        >
          <div className="business-badge-row">
            <span className="focus-chip business-chip">{business.companyType}</span>
          </div>
          <div className="business-grid">
            {business.signals.map((signal) => (
              <div key={signal.key} className={`business-signal ${signal.tone}`}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <em>{signal.detail}</em>
              </div>
            ))}
          </div>
          <div className="business-frame">
            {business.companyFrame.map((item) => (
              <div key={item.key} className={`business-frame-card ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </div>
            ))}
          </div>
          <p className="focus-copy">{business.narrative}</p>
          <p className="focus-copy focus-summary">{business.summary}</p>
        </FocusSection>
        <FocusSection
          id="chain"
          title="Catena del valore proxy"
          subtitle="input, processo, uscita, pressione esterna"
          open={openSections.chain}
          onToggle={toggleSection}
        >
          <div className="company-model">
            <p className="company-model-copy">{business.companyNarrative}</p>
            <div className="company-model-grid">
              {business.companyModel.map((item) => (
                <div key={item.key} className={`company-model-card ${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.detail}</em>
                </div>
              ))}
            </div>
          </div>
          <div className="value-chain">
            <p className="company-model-copy">{business.valueChainNarrative}</p>
            <div className="company-model-grid">
              {business.valueChain.map((item) => (
                <div key={item.key} className={`company-model-card ${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.detail}</em>
                </div>
              ))}
            </div>
          </div>
        </FocusSection>
        <FocusSection
          id="dependency"
          title="Clienti e fornitori proxy"
          subtitle="dipendenza esterna e switching"
          open={openSections.dependency}
          onToggle={toggleSection}
        >
          <p className="company-model-copy">Leggo la dipendenza esterna usando margine, concentrazione, barriera e intensità capitale: è una mappa di pressione, non un bilancio clienti/fornitori reale.</p>
          <div className="company-model-grid">
            {business.dependencyModel.map((item) => (
              <div key={item.key} className={`company-model-card ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </div>
            ))}
          </div>
        </FocusSection>
        <FocusSection
          id="peers"
          title="Posizione rispetto ai pari"
          subtitle="rank relativo nella nicchia sorella"
          open={openSections.peers}
          onToggle={toggleSection}
        >
          <div className="peer-grid">
            {peerCards.map((card) => (
              <PeerCard
                key={card.key}
                label={card.label}
                value={card.value}
                peer={card.peer}
                note={card.note}
                tone={card.tone}
              />
            ))}
          </div>
          <ul className="business-diagnostics">
            {business.diagnostics.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </FocusSection>
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
          <FocusSection
            id="leaves"
            title="Foglie pesanti"
            subtitle="classi finali che spiegano il nodo"
            open={openSections.leaves}
            onToggle={toggleSection}
          >
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
          </FocusSection>
        </div>
      )}
    </section>
  )
}
