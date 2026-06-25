// Sfera — matcher deterministico PRD -> settore (puro, testabile). Nessun LLM, nessuna chiave.
// Strategia: tokenizza il PRD, espande con sinonimi verso i termini ATECO, e pesa per IDF
// (un termine raro nei nomi dei settori pesa più di uno comune).

const STOP = new Set([
  'del', 'della', 'dei', 'delle', 'degli', 'per', 'che', 'con', 'non', 'come', 'una', 'uno',
  'questo', 'questa', 'sono', 'gli', 'voglio', 'vorrei', 'costruire', 'creare', 'fare',
  'prodotto', 'servizio', 'azienda', 'impresa', 'imprese', 'mercato', 'clienti', 'utenti',
  'nuovo', 'nuova', 'mio', 'mia', 'tipo', 'base', 'altri', 'altre',
])

// PRD token -> termini che compaiono nei nomi ATECO (accenti rimossi, come la tokenizzazione)
const SYN = {
  software: ['software', 'informatica', 'programmazione', 'applicazioni'],
  app: ['software', 'informatica', 'applicazioni'],
  applicazione: ['software', 'informatica'],
  applicazioni: ['software', 'informatica'],
  piattaforma: ['software', 'informatica'],
  saas: ['software', 'informatica'],
  gestionale: ['software', 'gestione'],
  commerce: ['commercio', 'dettaglio', 'internet'],
  ecommerce: ['commercio', 'dettaglio', 'internet'],
  online: ['internet', 'dettaglio'],
  web: ['internet', 'informatica'],
  ristorante: ['ristorazione', 'ristoranti', 'somministrazione'],
  ristoranti: ['ristorazione', 'somministrazione'],
  cibo: ['ristorazione', 'alimentari'],
  food: ['ristorazione', 'alimentari'],
  pane: ['pane', 'pasticceria', 'panetteria'],
  moda: ['abbigliamento', 'tessile', 'confezione'],
  vestiti: ['abbigliamento', 'confezione'],
  fintech: ['finanziarie', 'informatica'],
  salute: ['sanitari', 'assistenza', 'sanita'],
  health: ['sanitari', 'assistenza'],
  formazione: ['istruzione', 'formazione'],
  edtech: ['istruzione', 'informatica'],
  logistica: ['trasporto', 'magazzinaggio', 'corrieri'],
  trasporti: ['trasporto'],
  marketing: ['pubblicita', 'comunicazione'],
  pubblicita: ['pubblicita'],
  immobiliare: ['immobiliari', 'immobili'],
  energia: ['energia', 'elettrica'],
  consulenza: ['consulenza', 'gestionale'],
}

export function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
}

export function buildIndex(sectors) {
  const df = new Map()
  const docs = sectors.map((s) => {
    const toks = new Set(tokenize(s.name))
    for (const t of toks) df.set(t, (df.get(t) || 0) + 1)
    return { code: s.code, name: s.name, toks }
  })
  return { docs, df, n: sectors.length }
}

export function suggestSectors(prd, index, topN = 8) {
  const prdTokens = tokenize(prd)
  if (prdTokens.length === 0) return []
  const want = new Set(prdTokens.flatMap((t) => (SYN[t] ? [t, ...SYN[t]] : [t])))
  const idf = (t) => Math.log((index.n + 1) / ((index.df.get(t) || 0) + 1)) + 1
  return index.docs
    .map(({ code, name, toks }) => {
      let score = 0
      for (const w of want) if (toks.has(w)) score += idf(w)
      return { code, name, score: +score.toFixed(3) }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
