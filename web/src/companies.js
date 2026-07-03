// Crystal — layer aziende: caricamento lazy degli shard per classe ATECO.
//
// Gli shard sono statici (web/public/companies/<paese>/<ateco>.json) e vengono
// scaricati SOLO quando servono: l'indice (leggero) all'ingresso nel paese, lo
// shard della classe quando l'utente ci scende dentro. Così "tutte le aziende
// del settore" non gonfia il payload iniziale. Le fetch mancanti risolvono a
// null (dataset parziale) invece di lanciare, così la UI degrada con grazia.

const BASE = import.meta.env.BASE_URL

const indexCache = new Map() // country -> Promise<index|null>
const shardCache = new Map() // `${country}|${code}` -> Promise<shard|null>

function fetchJson(url) {
  return fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
}

export function loadCompanyIndex(country) {
  if (!indexCache.has(country)) {
    indexCache.set(country, fetchJson(`${BASE}companies/${country}/index.json`))
  }
  return indexCache.get(country)
}

export function loadCompanyShard(country, code) {
  const key = `${country}|${code}`
  if (!shardCache.has(key)) {
    shardCache.set(key, fetchJson(`${BASE}companies/${country}/${encodeURIComponent(code)}.json`))
  }
  return shardCache.get(key)
}
