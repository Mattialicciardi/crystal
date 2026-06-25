// Sfera — helper di vista: scale colore, formattazione, accessor.

// Viste di DIMENSIONE per la treemap (area = metrica additiva positiva). Colore = sempre Confidence.
export const VIEWS = {
  fatturato:        { label: 'Fatturato',       sizeKey: 'fatturato_keur',       kind: 'money' },
  valore_aggiunto:  { label: 'Valore aggiunto', sizeKey: 'valore_aggiunto_keur', kind: 'money' },
  occupati:         { label: 'Occupati',        sizeKey: 'occupati',             kind: 'count' },
  imprese:          { label: 'Imprese',         sizeKey: 'imprese',              kind: 'count' },
}

export function sizeValue(sector, sizeKey) {
  const v = sector?.raw?.[sizeKey]
  return v && v > 0 ? v : 0
}

// Confidence (0..100) -> colore. Basso = grigio sbiadito ("non fidarti"), alto = teal vivo.
export function confidenceColor(conf) {
  const t = Math.max(0, Math.min(100, conf ?? 0)) / 100
  return mix('#38404e', '#2dd4bf', t)
}
const h2 = (n) => n.toString(16).padStart(2, '0')
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((x, i) => h2(Math.round(x + (pb[i] - x) * t))).join('')
}

export const STATE_COLOR = { osservato: '#2dd4bf', stimato: '#eab308', assente: '#5b6472' }

const moneyFmt = new Intl.NumberFormat('it-IT', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 1 })
const countFmt = new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 })
const pctFmt   = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 1 })
const ratioFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })

export const fmtMoneyKeur = (k) => (k == null ? '—' : moneyFmt.format(k * 1000))
export const fmtCount     = (n) => (n == null ? '—' : countFmt.format(n))
export const fmtPct       = (r) => (r == null ? '—' : pctFmt.format(r))
export const fmtRatio     = (r) => (r == null ? '—' : ratioFmt.format(r))

export const LEVEL_LABEL = { section: 'sezione', div: 'divisione', group: 'gruppo', class: 'classe' }
export const LEVEL_PLURAL = { section: 'sezioni', div: 'divisioni', group: 'gruppi', class: 'classi' }
