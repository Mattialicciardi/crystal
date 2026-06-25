# Pagina Mercato (TAM/SAM/SOM) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a Sfera una 4ª modalità "Mercato" che, dato il prodotto/PRD e i settori scelti, calcola TAM/SAM/SOM (come range, con leva Competi-nel/Vendi-al) + arena competitiva + dettagli settore + cross-check europeo.

**Architecture:** Motore di calcolo puro e testato (`web/src/market.js`, test con `node --test`), consumato da un componente `MarketView.jsx`. Tutto client-side, nessun nuovo fetch (riusa `countries/*.json` e `compare.json`), prodotto salvato in `localStorage`. SAM/SOM sono assunzioni dichiarate (range low/base/high); TAM è dato (o spesa stimata in modo Vendi-al).

**Tech Stack:** Vite + React; calcolo JS puro testato con il test runner nativo di Node (`node --test`).

**Riferimento spec:** `docs/superpowers/specs/2026-06-25-mercato-tam-sam-som-design.md`

---

## File Structure

**Creati:**
- `web/src/market.js` — funzioni pure: `clamp`, `tamFromSectors`, `applyFraction`, `somSuggestion`, `weighted`, `computeMarket`.
- `web/test/market.test.js` — test `node --test`.
- `web/src/components/MarketView.jsx` — la pagina Mercato.

**Modificati:**
- `web/src/App.jsx` — 4° tab "Mercato".
- `web/src/styles.css` — stili Mercato (imbuto, pannello input, arena).

---

## Task 1: Motore di calcolo `market.js` + test (TDD)

**Files:**
- Create: `web/src/market.js`
- Test: `web/test/market.test.js`

- [ ] **Step 1: Write the failing test** in `web/test/market.test.js`

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clamp, tamFromSectors, applyFraction, somSuggestion, weighted, computeMarket } from '../src/market.js'

test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-1, 0, 10), 0)
  assert.equal(clamp(99, 0, 10), 10)
})

test('tamFromSectors compete = numero unico', () => {
  const t = tamFromSectors(100, 'compete', null)
  assert.deepEqual(t, { low: 100, base: 100, high: 100 })
})

test('tamFromSectors sellinto scala per spend ratio', () => {
  const t = tamFromSectors(100, 'sellinto', { low: 0.01, base: 0.02, high: 0.05 })
  assert.deepEqual(t, { low: 1, base: 2, high: 5 })
})

test('applyFraction moltiplica scenari allineati', () => {
  const r = applyFraction({ low: 100, base: 100, high: 100 }, { low: 0.2, base: 0.3, high: 0.4 })
  assert.deepEqual(r, { low: 20, base: 30, high: 40 })
})

test('somSuggestion: concentrato -> quota bassa, frammentato -> alta, con clamp', () => {
  assert.ok(Math.abs(somSuggestion(0).base - 0.15) < 1e-9)        // qg=0 -> 0.15
  assert.equal(somSuggestion(1).base, 0.01)                        // qg=1 -> floor 0.01
  const s = somSuggestion(0.9)
  assert.ok(s.base > 0.01 && s.base < 0.05)                        // concentrato -> bassa
  assert.ok(Math.abs(s.low - s.base * 0.5) < 1e-9)
  assert.ok(Math.abs(s.high - s.base * 1.5) < 1e-9)
})

test('weighted: media ponderata, null se nessun peso', () => {
  const items = [{ v: 10, w: 1 }, { v: 20, w: 3 }]
  assert.equal(weighted(items, (i) => i.v, (i) => i.w), 17.5)
  assert.equal(weighted([], (i) => i.v, (i) => i.w), null)
})

test('computeMarket: esempio dello spec (100 x 0.3 x 0.05 -> SOM 1.5)', () => {
  const m = computeMarket({
    sumFatt: 100, mode: 'compete', spendRatio: null,
    addressable: { low: 0.3, base: 0.3, high: 0.3 },
    capturable: { low: 0.05, base: 0.05, high: 0.05 },
  })
  assert.deepEqual(m.tam, { low: 100, base: 100, high: 100 })
  assert.deepEqual(m.sam, { low: 30, base: 30, high: 30 })
  assert.ok(Math.abs(m.som.base - 1.5) < 1e-9)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/mattialicciardi/Desktop/Progetti/sfera && node --test web/test/market.test.js`
Expected: FAIL (Cannot find module ../src/market.js).

- [ ] **Step 3: Implement** `web/src/market.js`

```javascript
// Sfera — motore di calcolo del mercato (puro, testabile). Nessun import UI.

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

// range = { low, base, high }
export function tamFromSectors(sumFatt, mode, spendRatio) {
  if (mode === 'sellinto' && spendRatio) {
    return { low: sumFatt * spendRatio.low, base: sumFatt * spendRatio.base, high: sumFatt * spendRatio.high }
  }
  return { low: sumFatt, base: sumFatt, high: sumFatt }
}

export function applyFraction(range, frac) {
  return { low: range.low * frac.low, base: range.base * frac.base, high: range.high * frac.high }
}

export function somSuggestion(quotaGrandi) {
  const base = clamp(0.15 * (1 - (quotaGrandi ?? 0)), 0.01, 0.20)
  return { low: base * 0.5, base, high: base * 1.5 }
}

export function weighted(items, valueOf, weightOf) {
  let num = 0, den = 0
  for (const it of items) {
    const w = weightOf(it), v = valueOf(it)
    if (w != null && v != null) { num += v * w; den += w }
  }
  return den ? num / den : null
}

export function computeMarket({ sumFatt, mode, spendRatio, addressable, capturable }) {
  const tam = tamFromSectors(sumFatt, mode, spendRatio)
  const sam = applyFraction(tam, addressable)
  const som = applyFraction(sam, capturable)
  return { tam, sam, som }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/mattialicciardi/Desktop/Progetti/sfera && node --test web/test/market.test.js`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add web/src/market.js web/test/market.test.js
git commit -m "feat(web): motore di calcolo Mercato (market.js) + test node"
```

---

## Task 2: MarketView — input + TAM/SAM/SOM

**Files:**
- Create: `web/src/components/MarketView.jsx`
- Modify: `web/src/App.jsx` (4° tab "Mercato")
- Modify: `web/src/styles.css`

- [ ] **Step 1: Implement** `web/src/components/MarketView.jsx` (parte input + imbuto)

Comportamento:
- Props: `data` (paese corrente), `country`, `countries`.
- Stato (con `localStorage` chiave `sfera-mercato`): `prd` (testo), `mode` ('compete'|'sellinto'), `picked` (array di codici settore), `geo` (country code | 'EU'), `spend` `{low,base,high}` (frazioni, default 0.005/0.01/0.02), `addr` `{low,base,high}` (default 0.2/0.35/0.5), `capt` `{low,base,high}` (default 0.02/0.05/0.08), `anchor` (bool).
- Settori disponibili: i settori-foglia di `data` (`s.level === data.meta.max_level`); selezione via input+datalist (come CometView) → chips dei selezionati.
- `sumFatt` = somma `raw.fatturato_keur` dei settori selezionati (nel paese corrente; per geo='EU' vedi Task 4).
- `qgWeighted` = `weighted(selezionati, s => s.concentrazione?.quota_grandi, s => s.raw.fatturato_keur)`.
- Se `anchor` ON: `capt` = `somSuggestion(qgWeighted)` (ricalcolato; l'utente può poi modificare i campi → `anchor` si spegne).
- `market = computeMarket({ sumFatt, mode, spendRatio: mode==='sellinto'?toFrac(spend):null, addressable: toFrac(addr), capturable: toFrac(capt) })` dove i valori % nell'UI sono in percentuale (input "5" → 0.05): helper `toFrac`.
- Output imbuto: tre livelli TAM / SAM / SOM, ognuno con `base` grande (formattato `fmtMoneyKeur`) e `low–high` sotto. Badge onestà (🟢 TAM compete / 🟡 sell-into e SAM/SOM).

Persistenza: `useEffect(() => localStorage.setItem('sfera-mercato', JSON.stringify(state)), [state])`; init leggendo `localStorage`.

Usa `InfoDot` per spiegare TAM/SAM/SOM e le assunzioni; `METRICS`/`fmtMoneyKeur`/`fmtPct` da `lib.js`/`metrics.js`.

- [ ] **Step 2: Wire in App.jsx** — 4° tab

Aggiungere `import MarketView from './components/MarketView.jsx'`; bottone "Mercato" in `.modes`; ramo `mode === 'mercato' ? <MarketView data={data} country={country} countries={countries} /> : ...`.

- [ ] **Step 3: Styles** in `web/src/styles.css`

Aggiungere `.market`, `.funnel` (tre fasce a larghezza decrescente TAM>SAM>SOM con valore e range), `.assumptions` (griglia di input low/base/high), `.market-input` (textarea PRD), riusando `.chip/.filter/.grid` dove possibile.

- [ ] **Step 4: Verify in browser**

Via preview: tab Mercato → seleziona 1-2 settori (es. 6201) → l'imbuto mostra TAM = fatturato, SAM e SOM coi range. Cambia modo a "Vendi al settore" → compare il campo spend e il TAM diventa la spesa stimata (range). Attiva il checkbox "ancora alla parte contendibile" → `capt` si aggiorna dal qg. Ricarica la pagina → il prodotto/PRD e le scelte sono ripristinati da localStorage.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MarketView.jsx web/src/App.jsx web/src/styles.css
git commit -m "feat(web): pagina Mercato — input + imbuto TAM/SAM/SOM (range, compete/sell-into, anchor)"
```

---

## Task 3: Arena competitiva + dettagli settore + cross-check europeo

**Files:**
- Modify: `web/src/components/MarketView.jsx`

- [ ] **Step 1: Arena competitiva** (sotto l'imbuto)

Aggregati ponderati per fatturato sui settori selezionati:
- `quota_grandi`, `quota_micro` (`weighted(...)`).
- `addetti/impresa` = `Σ occupati / Σ imprese`; `n_imprese` = `Σ imprese`.
- "Player tipo" = `Σ fatturato_keur / Σ imprese` (sintetico). Etichetta: "media sintetica, non un'azienda reale".
Mostrare come blocchi con `InfoDot`.

- [ ] **Step 2: Dettagli settore**

Tabella (riusa `.grid` + `METRICS` + `InfoDot`) con una riga per settore selezionato e le colonne metrica (margine, crescita, trend, produttività, struttura, barriera). Se più settori, anche una riga "aggregato" ponderato.

- [ ] **Step 3: Cross-check europeo**

Caricare `compare.json` (lazy, come CompareView). Per i settori selezionati mappati a 3 cifre (`code.slice(0,3)` per le classi IT), sommare il `fatturato_keur` per ciascun paese (escluso EU27) → classifica dei paesi per dimensione di quel mercato (barre come in CompareView). Mostra dove il mercato è più grande.

- [ ] **Step 4: Verify in browser**

Via preview: con settori selezionati, l'arena mostra concentrazione/frammentazione/player-tipo; la tabella dettagli mostra le metriche; il cross-check elenca i paesi per dimensione del mercato (es. software: Germania/Irlanda in testa). Console senza errori.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MarketView.jsx
git commit -m "feat(web): Mercato — arena competitiva + dettagli settore + cross-check europeo"
```

---

## Task 4: Verifica finale + deploy

- [ ] **Step 1: Test JS + Python verdi**

Run: `cd /Users/mattialicciardi/Desktop/Progetti/sfera && node --test web/test/ && .venv/bin/pytest tests/ -q`
Expected: tutti PASS.

- [ ] **Step 2: Verifica browser end-to-end**

Le 4 modalità (Esplora/Confronta/Screener/Mercato) funzionano; Mercato: imbuto coi range, compete/sell-into, anchor, arena, dettagli, cross-check, persistenza. Console pulita.

- [ ] **Step 3: Deploy**

Run: `./deploy.sh` poi attendi la propagazione Pages (3-5 min) e conferma con `curl` di `index.json` e dell'HTML (nuovo bundle).

- [ ] **Step 4: Commit finale + docs/memoria**

```bash
git add -A && git commit -m "feat: pagina Mercato (TAM/SAM/SOM) live" && git push origin main
```
Aggiornare README (4ª modalità) e la memoria di progetto.

---

## Note di esecuzione
- Nessun fetch ISTAT/Eurostat nuovo → nessun rischio rate limit.
- `node --test` usa il runner nativo (Node 25): nessuna dipendenza nuova.
- I valori % nell'UI sono percentuali (5 = 5%); `market.js` lavora in frazioni (0.05) — convertire all'ingresso/uscita.
