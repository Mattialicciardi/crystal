import { fmtMoneyKeur, fmtCount, fmtPct, fmtRatio } from './lib.js'

const fmtYears = (v) => (v == null ? '—' : `${v} ${v === 1 ? 'anno' : 'anni'}`)

// Registro UNICO di tutte le metriche calcolate. Fonte di verità per Esplora, Screener, Mercato.
// Ogni metrica: label, get(sector), fmt(value), info, unit + factor (per i filtri: valore×factor = unità di filtro).
export const METRICS = {
  fatturato: {
    label: 'Fatturato', get: (s) => s.raw.fatturato_keur, fmt: fmtMoneyKeur, unit: 'Mln €', factor: 1 / 1000,
    info: 'Fatturato annuo del settore. Fonte ISTAT/Eurostat, dato osservato.',
  },
  valore_agg: {
    label: 'Valore aggiunto', get: (s) => s.raw.valore_aggiunto_keur, fmt: fmtMoneyKeur, unit: 'Mln €', factor: 1 / 1000,
    info: 'Valore aggiunto al costo dei fattori. Dato osservato.',
  },
  produttivita: {
    label: 'VA / addetto', get: (s) => s.fields.produttivita.value, fmt: fmtMoneyKeur, unit: 'k€/add.', factor: 1,
    info: 'Valore aggiunto diviso gli occupati: produttività apparente del lavoro (€ per addetto).',
  },
  margine: {
    label: 'Margine', get: (s) => s.fields?.margine?.value, fmt: fmtPct, unit: '%', factor: 100,
    info: 'Margine operativo lordo su fatturato (MOL/fatturato): potere di prezzo / vantaggio di costo. Alto = settore con margini; basso = spremuto.',
  },
  redditivita: {
    label: 'MOL / VA', get: (s) => s.fields.redditivita?.value, fmt: fmtPct, unit: '%', factor: 100,
    info: 'Margine operativo lordo su valore aggiunto: quota del valore aggiunto che resta come margine operativo.',
  },
  struttura: {
    label: 'Add. / impresa', get: (s) => s.fields.struttura.value, fmt: fmtRatio, unit: 'add./impr.', factor: 1,
    info: 'Addetti per impresa: misura la frammentazione. Basso = tante piccole imprese; alto = poche grandi.',
  },
  crescita: {
    label: 'CAGR fatt.', get: (s) => s.fields.crescita.value, fmt: fmtPct, unit: '%', factor: 100,
    info: 'Crescita media annua composta del fatturato sull’orizzonte disponibile. Retrospettiva, non una previsione.',
  },
  trend: {
    label: 'Trend', get: (s) => s.trend?.anni_crescita, fmt: fmtYears, unit: 'anni', factor: 1,
    info: 'Anni consecutivi di crescita, dal più recente all’indietro. ≥3 = trend sostenuto; 1–2 = recente; ultimo anno in calo = in calo. Solo dati passati, nessuna proiezione.',
  },
  conc_grandi: {
    label: 'Quota grandi', get: (s) => s.concentrazione?.quota_grandi, fmt: fmtPct, unit: '%', factor: 100,
    info: 'Quota del fatturato nelle imprese ≥250 addetti: quanto il mercato è dominato dai grandi. NON è l’HHI azienda-per-azienda (quello richiede dati di bilancio a pagamento).',
  },
  conc_micro: {
    label: 'Quota micro', get: (s) => s.concentrazione?.quota_micro, fmt: fmtPct, unit: '%', factor: 100,
    info: 'Quota del fatturato nelle micro-imprese (<10 addetti): quanto il mercato è polverizzato in tanti piccoli attori.',
  },
  barriera: {
    label: 'Barriera', get: (s) => s.barriera?.value, fmt: fmtMoneyKeur, unit: 'k€/add.', factor: 1, itOnly: true,
    info: 'Investimenti per addetto: proxy della barriera d’ingresso / capitale necessario per stare nel settore. Pieno per l’Italia; non disponibile per gli altri paesi (Eurostat non pubblica gli investimenti).',
  },
  occupati: {
    label: 'Occupati', get: (s) => s.raw.occupati, fmt: fmtCount, unit: 'n.', factor: 1,
    info: 'Persone occupate nel settore. Dato osservato.',
  },
  imprese: {
    label: 'Imprese', get: (s) => s.raw.imprese, fmt: fmtCount, unit: 'n.', factor: 1,
    info: 'Numero di imprese attive nel settore. Dato osservato.',
  },
}

// Ordine canonico: TUTTE le metriche, usate identiche in ogni vista.
export const ALL_METRIC_IDS = [
  'fatturato', 'valore_agg', 'produttivita', 'margine', 'redditivita', 'struttura',
  'crescita', 'trend', 'conc_grandi', 'conc_micro', 'barriera', 'occupati', 'imprese',
]
