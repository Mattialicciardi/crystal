// Insight calcolati solo da celle ufficiali già pubblicate. Nessuna stima sotto le 4 cifre.

import { formatNumber, formatShare, formatVariation, publishedValue } from './sbsModel.js'

export const SIZE_ORDER = ['0-9', '10-19', '20-49', '50-249', 'GE250']

export const SIZE_LABEL = {
  '0-9': '0–9 addetti',
  '10-19': '10–19',
  '20-49': '20–49',
  '50-249': '50–249',
  '250+': '250 e più',
  GE250: '250 e più',
}

export const EXTRA_ACCOUNTS = [
  { id: 'SAL_NR', label: 'Dipendenti', unit: 'numero', digits: 0 },
  { id: 'SAL_FTE_NR', label: 'Dipendenti in FTE', unit: 'numero', digits: 0 },
  { id: 'HW_NR', label: 'Ore lavorate', unit: 'ore', digits: 0 },
  { id: 'EXPN_SAL_BEN_MEUR', label: 'Costo del personale', unit: 'mln €', digits: 2 },
  { id: 'SS_COST_MEUR', label: 'Oneri sociali', unit: 'mln €', digits: 2 },
  { id: 'PUR_RS_MEUR', label: 'Acquisti per rivendita', unit: 'mln €', digits: 2 },
  { id: 'PUR_AGN_MEUR', label: 'Lavoratori interinali', unit: 'mln €', digits: 2 },
  { id: 'PUR_NRG_MEUR', label: 'Acquisti di energia', unit: 'mln €', digits: 2 },
  { id: 'VAL_OUT_MEUR', label: 'Valore della produzione', unit: 'mln €', digits: 2 },
  { id: 'GM_GD_RS_MEUR', label: 'Margine lordo sulla rivendita', unit: 'mln €', digits: 2 },
  { id: 'GRSINV_MAC_MEUR', label: 'Investimenti in macchinari', unit: 'mln €', digits: 2 },
]

export const NUTS_ACCOUNTS = [
  { id: 'LOC_NR', label: 'Unità locali', digits: 0 },
  { id: 'EMP_LOC_NR', label: 'Addetti nelle unità locali', digits: 0 },
  { id: 'WAGE_LOC_MEUR', label: 'Retribuzioni', digits: 2, unit: 'mln €' },
  { id: 'LC_EMP_LOC_TEUR', label: 'Costo lavoro / addetto', digits: 2, unit: 'mila €' },
]

export function share(part, whole) {
  if (part == null || whole == null || whole === 0) return null
  return part / whole
}

export function percentChange(start, end) {
  if (start == null || end == null || start === 0) return null
  return (end - start) / Math.abs(start)
}

export function rankAmong(value, others) {
  const present = others.filter((item) => item != null)
  if (value == null || present.length === 0) return null
  const ahead = present.filter((item) => item > value).length
  return { rank: ahead + 1, of: present.length }
}

export function locationQuotient(regionSector, regionTotal, italySector, italyTotal) {
  if ([regionSector, regionTotal, italySector, italyTotal].some((value) => value == null || value === 0)) return null
  return (regionSector / regionTotal) / (italySector / italyTotal)
}

function cellValue(bucket, id) {
  const cell = bucket?.[id]
  if (!cell || cell.s === 'c' || cell.v == null) return null
  return cell.v
}

function fact(id, label, text, detail) {
  if (text == null) return null
  return { id, label, text, detail: detail || null }
}

export function accountFacts(sector, context) {
  const { total, parent, siblings, year, years } = context
  const firms = publishedValue(sector, year, 'ENT_NR')
  const employed = publishedValue(sector, year, 'EMP_NR')
  const turnover = publishedValue(sector, year, 'NETTUR_MEUR')
  const valueAdded = publishedValue(sector, year, 'AV_MEUR')
  const purchases = publishedValue(sector, year, 'PUR_MEUR')
  const resale = publishedValue(sector, year, 'PUR_RS_MEUR')
  const wages = publishedValue(sector, year, 'WAGE_MEUR')
  const personnel = publishedValue(sector, year, 'EXPN_SAL_BEN_MEUR')
  const gos = publishedValue(sector, year, 'GOS_MEUR')
  const gor = publishedValue(sector, year, 'GOR_PC')
  const productivity = employed ? (valueAdded == null ? null : (valueAdded * 1000) / employed) : null
  const parentProductivity = parent && publishedValue(parent, year, 'EMP_NR')
    ? (publishedValue(parent, year, 'AV_MEUR') == null ? null : (publishedValue(parent, year, 'AV_MEUR') * 1000) / publishedValue(parent, year, 'EMP_NR'))
    : null
  const italyProductivity = publishedValue(total, year, 'EMP_NR')
    ? (publishedValue(total, year, 'AV_MEUR') * 1000) / publishedValue(total, year, 'EMP_NR')
    : null
  const vaRank = rankAmong(valueAdded, (siblings || []).map((item) => publishedValue(item, year, 'AV_MEUR')))
  const turnoverRank = rankAmong(turnover, (siblings || []).map((item) => publishedValue(item, year, 'NETTUR_MEUR')))
  const has = (value) => years.includes(value)
  const parentGor = parent ? publishedValue(parent, year, 'GOR_PC') : null
  const italyGor = publishedValue(total, year, 'GOR_PC')
  const euTurnover = cellValue(sector.eu?.[year], 'NETTUR_MEUR')
  const euValueAdded = cellValue(sector.eu?.[year], 'AV_MEUR')
  const euEmployed = cellValue(sector.eu?.[year], 'EMP_NR')
  const euProductivity = euEmployed && euValueAdded != null ? (euValueAdded * 1000) / euEmployed : null

  return [
    fact('quota-va', 'Quota del VA italiano', formatShare(share(valueAdded, publishedValue(total, year, 'AV_MEUR')))),
    fact('quota-fatt', 'Quota del fatturato italiano', formatShare(share(turnover, publishedValue(total, year, 'NETTUR_MEUR')))),
    fact('quota-imprese', 'Quota delle imprese', formatShare(share(firms, publishedValue(total, year, 'ENT_NR')))),
    fact('quota-addetti', 'Quota degli addetti', formatShare(share(employed, publishedValue(total, year, 'EMP_NR')))),
    fact('rango-va', 'Posto per valore aggiunto', vaRank ? `${vaRank.rank}° su ${vaRank.of}` : null, 'Tra i fratelli dello stesso padre'),
    fact('rango-fatt', 'Posto per fatturato', turnoverRank ? `${turnoverRank.rank}° su ${turnoverRank.of}` : null, 'Tra i fratelli dello stesso padre'),
    fact(
      'produttivita',
      'VA per addetto',
      productivity == null ? null : `${formatNumber(productivity, 1)} mila €`,
      [
        parentProductivity == null ? null : `padre ${formatNumber(parentProductivity, 1)}`,
        italyProductivity == null ? null : `Italia ${formatNumber(italyProductivity, 1)}`,
      ].filter(Boolean).join(' · ') || null,
    ),
    fact('acquisti', 'Acquisti su fatturato', formatShare(share(purchases, turnover))),
    fact('rivendita', 'Rivendita su fatturato', formatShare(share(resale, turnover)), 'Acquisti per rivendita / fatturato'),
    fact('rivendita-acquisti', 'Rivendita sugli acquisti', formatShare(share(resale, purchases))),
    fact('lavoro-wage', 'Retribuzioni sul VA', formatShare(share(wages, valueAdded))),
    fact('lavoro-costo', 'Costo del personale sul VA', formatShare(share(personnel, valueAdded))),
    fact(
      'mol-va',
      'MOL sul VA',
      formatShare(share(gos, valueAdded)),
      parent && publishedValue(parent, year, 'GOS_MEUR') != null
        ? `padre ${formatShare(share(publishedValue(parent, year, 'GOS_MEUR'), publishedValue(parent, year, 'AV_MEUR')))}`
        : null,
    ),
    fact(
      'gor',
      'GOR',
      gor == null ? null : `${formatNumber(gor, 2)}%`,
      [parentGor == null ? null : `padre ${formatNumber(parentGor, 2)}%`, italyGor == null ? null : `Italia ${formatNumber(italyGor, 2)}%`].filter(Boolean).join(' · ') || null,
    ),
    fact('var-2324', 'Fatturato 2023→2024', has('2023') && has('2024') ? formatVariation(publishedValue(sector, '2024', 'NETTUR_MEUR'), publishedValue(sector, '2023', 'NETTUR_MEUR')) : null),
    fact('var-2124', 'Fatturato 2021→2024', has('2021') && has('2024') ? formatVariation(publishedValue(sector, '2024', 'NETTUR_MEUR'), publishedValue(sector, '2021', 'NETTUR_MEUR')) : null),
    fact(
      'ue-prod',
      'VA per addetto, Italia e UE27',
      productivity == null || euProductivity == null ? null : `${formatNumber(productivity, 1)} contro ${formatNumber(euProductivity, 1)} mila €`,
    ),
    fact('ue-quota', 'Quota del fatturato UE27', formatShare(share(turnover, euTurnover))),
  ].filter(Boolean).filter((item) => item.id !== 'var-2324-check')
}

export function sizeSnapshot(sector, year, indicator) {
  const yearBucket = sector?.size?.[year]
  if (!yearBucket) return null
  const rows = SIZE_ORDER.map((code) => {
    const cell = yearBucket[code]?.[indicator]
    if (!cell) return { code, status: 'missing', value: null }
    if (cell.s === 'c' || cell.v == null) return { code, status: 'reserved', value: null }
    return { code, status: 'value', value: cell.v }
  })
  const published = rows.filter((row) => row.status === 'value')
  const total = published.reduce((sum, row) => sum + row.value, 0)
  if (!published.length || total === 0) return { rows, total: null }
  return {
    rows: rows.map((row) => ({ ...row, share: row.value == null ? null : row.value / total })),
    total,
    partial: published.length < SIZE_ORDER.length,
  }
}

function regionEmployment(allSeries, areaCode, year) {
  const sections = Object.keys(allSeries).filter((code) => /^[A-Z]$/.test(code))
  let sum = 0
  let any = false
  for (const section of sections) {
    const value = cellValue(allSeries[section]?.[areaCode]?.[year], 'EMP_LOC_NR')
    if (value != null) {
      sum += value
      any = true
    }
  }
  return any ? sum : null
}

export function regionalRows(seriesForCode, areas, year, allSeries) {
  if (!seriesForCode || !allSeries) return []
  const comparable = []
  for (const area of areas) {
    const sectorEmployed = cellValue(seriesForCode[area.code]?.[year], 'EMP_LOC_NR')
    const regionTotal = regionEmployment(allSeries, area.code, year)
    if (sectorEmployed != null && regionTotal != null) comparable.push(area.code)
  }
  const italySector = comparable.reduce((sum, code) => sum + cellValue(seriesForCode[code][year], 'EMP_LOC_NR'), 0)
  const italyTotal = comparable.reduce((sum, code) => sum + regionEmployment(allSeries, code, year), 0)
  return areas.map((area) => {
    const bucket = seriesForCode[area.code]?.[year] || {}
    const employed = cellValue(bucket, 'EMP_LOC_NR')
    const regionTotal = regionEmployment(allSeries, area.code, year)
    const quotient = comparable.includes(area.code)
      ? locationQuotient(employed, regionTotal, italySector, italyTotal)
      : null
    return {
      code: area.code,
      name: area.name,
      localUnits: cellValue(bucket, 'LOC_NR'),
      employed,
      wages: cellValue(bucket, 'WAGE_LOC_MEUR'),
      labourCost: cellValue(bucket, 'LC_EMP_LOC_TEUR'),
      quotient,
      reserved: bucket.EMP_LOC_NR?.s === 'c',
    }
  }).filter((row) => row.localUnits != null || row.employed != null || row.wages != null || row.reserved)
    .sort((left, right) => (right.employed ?? -1) - (left.employed ?? -1))
}
