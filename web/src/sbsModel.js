// Modello della mappa SBS Italia. Nessun numero è scritto qui:
// i valori arrivano da web/public/sbs-it.json, generato dal CSV Eurostat.

export const COLUMNS = [
  { id: 'ENT_NR', label: 'Imprese', unit: 'numero', digits: 0, treemap: true },
  { id: 'EMP_NR', label: 'Addetti', unit: 'persone', digits: 0, treemap: true },
  { id: 'NETTUR_MEUR', label: 'Fatturato', unit: 'mln €', digits: 2, treemap: true },
  { id: 'PUR_MEUR', label: 'Acquisti', unit: 'mln €', digits: 2, treemap: true },
  { id: 'AV_MEUR', label: 'Valore aggiunto', unit: 'mln €', digits: 2, treemap: true },
  { id: 'WAGE_MEUR', label: 'Retribuzioni', unit: 'mln €', digits: 2, treemap: true },
  { id: 'GOS_MEUR', label: 'MOL', unit: 'mln €', digits: 2, treemap: true },
  { id: 'GRSINV_TNCA_MEUR', label: 'Investimenti', unit: 'mln €', digits: 2, treemap: true },
  { id: 'LC_EMP_TEUR', label: 'Costo lavoro / addetto', unit: 'mila €', digits: 2 },
  {
    id: 'wage_per_employee',
    label: 'Retribuzioni / addetto',
    unit: 'mila €',
    digits: 2,
    derived: true,
    computed: true,
    treemap: true,
    rate: true,
    needs: ['WAGE_MEUR', 'EMP_NR'],
  },
  { id: 'NETTUR_EMP_TEUR', label: 'Fatturato / addetto', unit: 'mila €', digits: 2 },
  { id: 'GOR_PC', label: 'GOR', unit: '%', digits: 2 },
  { id: 'fatturato_per_impresa_eur', label: 'Fatturato / impresa', unit: '€', digits: 0, derived: true, needs: ['NETTUR_MEUR', 'ENT_NR'] },
  { id: 'addetti_per_impresa', label: 'Addetti / impresa', unit: 'rapporto', digits: 2, derived: true, needs: ['EMP_NR', 'ENT_NR'] },
  { id: 'va_per_addetto_teur', label: 'VA / addetto', unit: 'mila €', digits: 2, derived: true, needs: ['AV_MEUR', 'EMP_NR'] },
]

export const SIZE_METRICS = COLUMNS.filter((column) => column.treemap)
export const DEFAULT_SIZE = 'AV_MEUR'
export const KPI_IDS = COLUMNS.filter((column) => !column.derived).map((column) => column.id)

export const LEVEL_SEQUENCE = ['section', 'division', 'group', 'class']

export function levelsBelow(parentLevel) {
  const start = parentLevel ? LEVEL_SEQUENCE.indexOf(parentLevel) + 1 : 0
  if (start < 0 || start >= LEVEL_SEQUENCE.length) return []
  return LEVEL_SEQUENCE.slice(start)
}

export function collectDescendants(childrenOf, rootCode) {
  const out = []
  const stack = [...(childrenOf.get(rootCode || '__root__') || [])]
  while (stack.length) {
    const node = stack.pop()
    out.push(node)
    for (const kid of childrenOf.get(node.code) || []) stack.push(kid)
  }
  out.sort((left, right) => left.code.localeCompare(right.code, 'it'))
  return out
}

export function collectLevel(childrenOf, rootCode, level) {
  const out = []
  const stack = [...(childrenOf.get(rootCode || '__root__') || [])]
  while (stack.length) {
    const node = stack.pop()
    if (node.level === level) out.push(node)
    else {
      const kids = childrenOf.get(node.code) || []
      for (const kid of kids) stack.push(kid)
    }
  }
  out.sort((left, right) => left.code.localeCompare(right.code, 'it'))
  return out
}

export function parseBound(text) {
  if (text == null || String(text).trim() === '') return null
  const value = Number(String(text).trim().replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export function matchesView(sector, { year, column, query, section, publishedOnly, min, max }) {
  if (section && section !== 'all' && sector.section !== section) return false
  if (query) {
    const haystack = normalize(`${sector.code} ${sector.name} ${titleIt(sector.name)}`)
    if (!haystack.includes(query)) return false
  }
  const value = column ? compareValue(sector, year, column) : null
  if ((publishedOnly || min != null || max != null) && value == null) return false
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

export const LEVEL_LABEL = {
  section: 'sezione',
  division: 'divisione',
  group: 'gruppo',
  class: 'classe',
  aggregate: 'aggregato',
}
export const LEVEL_PLURAL = {
  section: 'sezioni',
  division: 'divisioni',
  group: 'gruppi',
  class: 'classi',
}

export const SECTION_COLOR = {
  B: '#7a5a3a',
  C: '#1f4e79',
  D: '#8a6a12',
  E: '#1f6a5a',
  F: '#8c4630',
  G: '#215c78',
  H: '#4d5d70',
  I: '#8a4e2c',
  J: '#2c4f78',
  K: '#5c4d72',
  L: '#6e5a28',
  M: '#1e5c68',
  N: '#3d684e',
  P: '#6e4a48',
  Q: '#2f5e48',
  R: '#6e3e52',
  S: '#5c574e',
}

const pctFmt = new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })

export function columnById(id) {
  return COLUMNS.find((column) => column.id === id)
}

export function titleIt(name) {
  if (!name) return ''
  const titled = name.charAt(0).toLocaleUpperCase('it-IT') + name.slice(1)
  return titled.replace(/\bnca\b/gi, 'n.c.a.')
}

export function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function formatNumber(value, digits) {
  if (value == null || Number.isNaN(Number(value))) return 'n.d.'
  const numeric = Number(value)
  const negative = numeric < 0
  const abs = Math.abs(numeric)
  const fixed = digits === 0 ? String(Math.round(abs)) : abs.toFixed(digits)
  const [whole, frac] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const body = `${negative ? '-' : ''}${grouped}`
  return frac == null ? body : `${body},${frac}`
}

export function formatVariation(current, previous) {
  if (current == null || previous == null || previous === 0) return null
  return pctFmt.format((current - previous) / Math.abs(previous))
}

export function formatShare(value) {
  if (value == null || Number.isNaN(value)) return null
  const digits = Math.abs(value) > 0 && Math.abs(value) < 0.001 ? 2 : 1
  return new Intl.NumberFormat('it-IT', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function publishedValue(node, year, id) {
  const cell = node?.years?.[year]?.[id]
  if (!cell || cell.s === 'c' || cell.v == null) return null
  return cell.v
}

export function indexDataset(dataset) {
  const byCode = new Map()
  const children = new Map()
  for (const sector of dataset.sectors) {
    byCode.set(sector.code, sector)
    const key = sector.parent || '__root__'
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(sector)
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, 'it'))
  }
  return { byCode, children }
}

export function ancestorsOf(byCode, code) {
  const chain = []
  let cursor = byCode.get(code)
  while (cursor?.parent) {
    chain.unshift(cursor.parent)
    cursor = byCode.get(cursor.parent)
  }
  return chain
}

export function wagePerEmployee(sector, year) {
  if (!sector?.published) return { kind: 'unpublished' }
  const row = sector.years?.[year] || {}
  const wage = row.WAGE_MEUR
  const employed = row.EMP_NR
  if (wage?.s === 'c' || employed?.s === 'c') return { kind: 'reserved' }
  if (wage?.s === 'e' || employed?.s === 'e') return { kind: 'unavailable' }
  if (!wage || !employed || wage.v == null || employed.v == null) return { kind: 'missing' }
  if (!(employed.v > 0)) return { kind: 'unavailable' }
  return { kind: 'calculated', value: (Number(wage.v) * 1000) / Number(employed.v) }
}

function rawNumber(sector, year, column) {
  if (!sector?.published) return null
  if (column?.id === 'wage_per_employee') {
    const result = wagePerEmployee(sector, year)
    return result.kind === 'calculated' ? result.value : null
  }
  const row = sector.years?.[year]
  if (!row) return null
  if (column.derived) {
    const value = row.derived?.[column.id]
    return value == null ? null : value
  }
  const cell = row[column.id]
  if (!cell || cell.s === 'c' || cell.v == null) return null
  return cell.v
}

export function displayCell(sector, year, column) {
  if (!sector?.published) return { text: 'non pubblicato', kind: 'unpublished' }
  if (column.id === 'wage_per_employee') {
    const result = wagePerEmployee(sector, year)
    if (result.kind === 'calculated') return { text: formatNumber(result.value, column.digits), kind: 'calculated' }
    if (result.kind === 'reserved') return { text: 'riservato', kind: 'reserved' }
    return { text: 'n.d.', kind: 'missing' }
  }
  const row = sector.years?.[year] || {}
  if (column.derived) {
    const derived = row.derived || {}
    if (derived[column.id] != null) {
      return { text: formatNumber(derived[column.id], column.digits), kind: 'calculated' }
    }
    if ((column.needs || []).some((id) => row[id]?.s === 'c')) {
      return { text: 'riservato', kind: 'reserved' }
    }
    return { text: 'n.d.', kind: 'missing' }
  }
  const cell = row[column.id]
  if (!cell) return { text: 'n.d.', kind: 'missing' }
  if (cell.s === 'c') return { text: 'riservato', kind: 'reserved' }
  return {
    text: formatNumber(cell.v, column.digits),
    kind: cell.s === 'e' ? 'estimated' : 'value',
  }
}

export function compareValue(sector, year, column) {
  return rawNumber(sector, year, column)
}

export function sortSectors(sectors, year, sort) {
  const column = columnById(sort.key)
  const copy = sectors.slice()
  copy.sort((a, b) => {
    if (!column || sort.key === 'name') {
      const byName = titleIt(a.name).localeCompare(titleIt(b.name), 'it')
      return sort.dir === 'asc' ? byName : -byName
    }
    if (sort.key === 'code') {
      return sort.dir === 'asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code)
    }
    const va = compareValue(a, year, column)
    const vb = compareValue(b, year, column)
    if (va == null && vb == null) return a.code.localeCompare(b.code)
    if (va == null) return 1
    if (vb == null) return -1
    if (va === vb) return a.code.localeCompare(b.code)
    return sort.dir === 'asc' ? va - vb : vb - va
  })
  return copy
}

export function sizeOf(sector, year, indicatorId) {
  const column = columnById(indicatorId)
  const value = rawNumber(sector, year, column)
  if (value == null) return { state: sector?.published ? 'unavailable' : 'unpublished' }
  if (value < 0) return { state: 'negative', value }
  if (value === 0) return { state: 'zero', value }
  return { state: 'sized', value }
}

export function otherYear(year) {
  return year === '2023' ? '2024' : '2023'
}

export function kpiVariation(sector, year, column) {
  return formatVariation(rawNumber(sector, otherYear(year), column), rawNumber(sector, year, column))
}

function official(sector, year, id) {
  const cell = sector?.years?.[year]?.[id]
  if (!cell || cell.s === 'c' || cell.v == null) return null
  return cell.v
}

export function sectionReading(sector, year) {
  if (!sector) return null
  const turnover = official(sector, year, 'NETTUR_MEUR')
  const purchases = official(sector, year, 'PUR_MEUR')
  const valueAdded = official(sector, year, 'AV_MEUR')
  const gor = official(sector, year, 'GOR_PC')
  const turnoverText = turnover == null ? null : `${formatNumber(turnover, 2)} mln €`
  const purchaseText = purchases == null ? null : `${formatNumber(purchases, 2)} mln €`
  const valueAddedText = valueAdded == null ? null : `${formatNumber(valueAdded, 2)} mln €`
  const gorText = gor == null ? null : `${formatNumber(gor, 2)}%`
  if (sector.code === 'G' && turnoverText && gorText) {
    return `Nel commercio il fatturato ${year} è ${turnoverText} e il GOR è ${gorText}. Gli acquisti di beni e servizi sono ${purchaseText || 'n.d.'}: dentro il fatturato c'è la merce rivenduta, e il margine sul fatturato resta basso. Il valore aggiunto, ${valueAddedText || 'n.d.'}, descrive meglio il peso del settore. È un fatto di struttura, non un consiglio.`
  }
  if (sector.code === 'L' && turnoverText && gorText) {
    return `Nelle attività immobiliari il fatturato ${year} è ${turnoverText} e il GOR è ${gorText}. Il fatturato è più vicino al margine che nel commercio, e il valore aggiunto è ${valueAddedText || 'n.d.'}. Un GOR alto descrive i conti del settore: non dice se convenga investirci.`
  }
  return null
}

export function rootReading(byCode, year) {
  const commerce = sectionReading(byCode.get('G'), year)
  const realEstate = sectionReading(byCode.get('L'), year)
  return [commerce, realEstate].filter(Boolean)
}

export const GLOSSARY = [
  {
    title: 'Fatturato',
    code: 'NETTUR_MEUR',
    body: 'Fatturato netto, in milioni di euro. Nel commercio include il valore dei beni comprati e rivenduti, quindi può essere molto più grande del valore creato nel settore.',
  },
  {
    title: 'Acquisti di beni e servizi',
    code: 'PUR_MEUR',
    body: 'Beni, materiali e servizi comprati, in milioni di euro. Ammortamenti, oneri finanziari e imposte restano fuori. Il lavoro è una voce a parte: sta nelle retribuzioni e nel costo del lavoro per addetto.',
  },
  {
    title: 'Valore aggiunto',
    code: 'AV_MEUR',
    body: 'Valore creato dall’attività, in milioni di euro. È il confronto più stabile tra settori, perché il commercio non lo gonfia con la merce rivenduta.',
  },
  {
    title: 'Retribuzioni',
    code: 'WAGE_MEUR',
    body: 'Salari e stipendi, in milioni di euro. Non sono il costo del lavoro completo: i contributi a carico del datore, per esempio, stanno nel costo del lavoro per addetto.',
  },
  {
    title: 'Retribuzioni / addetto',
    code: 'wage_per_employee',
    body: 'Retribuzione media per addetto, in migliaia di euro. È calcolata dalle retribuzioni e dagli addetti ufficiali. Non è il costo del lavoro per addetto: quel conto include anche i contributi.',
  },
  {
    title: 'MOL',
    code: 'GOS_MEUR',
    body: 'Margine operativo lordo (gross operating surplus), in milioni di euro. È la parte di valore aggiunto che resta dopo il costo del lavoro. Ammortamenti, interessi e imposte restano fuori: non è l’utile di bilancio.',
  },
  {
    title: 'Investimenti',
    code: 'GRSINV_TNCA_MEUR',
    body: 'Investimenti lordi in attività materiali, in milioni di euro. Le attività immateriali non sono in questa voce.',
  },
  {
    title: 'Costo del lavoro per addetto',
    code: 'LC_EMP_TEUR',
    body: 'Migliaia di euro per addetto. È il costo del lavoro, più ampio delle sole retribuzioni.',
  },
  {
    title: 'Fatturato per addetto',
    code: 'NETTUR_EMP_TEUR',
    body: 'Migliaia di euro per addetto, indicatore ufficiale. Nel commercio risulta alto perché il fatturato include la merce.',
  },
  {
    title: 'GOR',
    code: 'GOR_PC',
    body: 'Gross operating rate: MOL diviso fatturato, in percentuale. Nel commercio è basso perché il denominatore contiene la merce rivenduta. Negli immobiliari è spesso alto perché il fatturato è più vicino al margine. Descrive la struttura dei conti.',
  },
  {
    title: 'Fatturato per impresa, addetti per impresa, VA per addetto',
    code: 'calcolati',
    body: 'Rapporti calcolati in questa mappa, non pubblicati da Eurostat. Fatturato per impresa = fatturato netto / imprese. Addetti per impresa = addetti / imprese. VA per addetto = valore aggiunto, in migliaia di euro, / addetti. Il rapporto compare solo se entrambi i valori ufficiali sono pubblicati e il denominatore non è zero. Se un ingrediente è riservato, anche il rapporto è riservato.',
  },
  {
    title: 'Riservato, stima, zero, n.d.',
    code: 'stati',
    body: '«Riservato» è segreto statistico (CONF_STATUS=C): la cella non è uno zero. «Stima» è un numero pubblicato con OBS_FLAG=e. Uno zero visibile è un valore ufficiale. «n.d.» significa che la cella non è in questo estratto. «Non pubblicato» vale per il totale di sezione S, assente dal dataset: le divisioni sotto, quando ci sono, restano dati ufficiali.',
  },
]
