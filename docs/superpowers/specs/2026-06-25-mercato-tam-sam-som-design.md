# Sfera — Pagina "Mercato" (TAM/SAM/SOM) — Design

Data: 2026-06-25 · Stato: approvato (in attesa di review finale dello spec)

## Obiettivo

Una pagina dove Mattia descrive il prodotto che vuole costruire (PRD) e ottiene il dimensionamento
del **mercato vero** — TAM / SAM / SOM — fondato sui *nostri* dati, più l'**arena competitiva** del settore.
Scopo: individuare nel modo più onesto possibile il mercato reale, senza numeri-illusione.

## Principi (non negoziabili)

- **TAM = dato; SAM e SOM = assunzioni dichiarate.** Mai un numero secco spacciato per fatto: SAM/SOM si mostrano come **range low/base/high**.
- **Niente sotto le 4 cifre.** Ricerca multi-fonte verificata (2026-06-25): il dato economico gratuito si ferma alla classe a 4 cifre; sotto, segreto statistico. PRODCOM/dogane = solo beni fisici, *output di produzione ≠ ricavi di mercato* → fuori scope. La via fine è la **quota indirizzabile % manuale**.
- **Niente aziende reali nominate.** L'arena usa solo aggregati nostri (concentrazione, frammentazione, "player tipo" sintetico).
- **Deterministico, niente LLM/backend, nessun nuovo fetch.** Usa i dataset esistenti (`countries/*.json`, `compare.json`). Persistenza in `localStorage`.

## Architettura

Quarta modalità **"Mercato"** (tab accanto a Esplora / Confronta / Screener). Tutto client-side.
Nuovo componente `web/src/components/MarketView.jsx` + helper di calcolo puro `web/src/market.js`
(funzioni pure: la verifica avviene con input noti — es. TAM 100 × addressable 0,3 × capturable 0,05 → SOM 1,5 —
controllati nel browser; opzionale un test JS).

## Input (pannello)

1. **Prodotto / PRD**: textarea libera, salvata in `localStorage` (un prodotto, estendibile).
2. **Modo mercato** (leva n°1):
   - `Competi nel settore` — il prodotto È nel settore (TAM = fatturato del settore).
   - `Vendi al settore` — il settore è il **cliente** (TAM = la sua *spesa* per il tuo tipo di prodotto = dimensione settore × ratio di spesa).
3. **Settori** (multi-select, dalla ricerca esistente): uno o più, a 4 cifre IT / 3 cifre EU.
4. **Geografia**: paese (default Italia) o "tutta Europa".
5. **Assunzioni** (ognuna con tre valori *low / base / high*):
   - `spend_ratio` (solo se *Vendi al settore*): % della spesa del settore-cliente sul tuo tipo di prodotto.
   - `addressable` (TAM→SAM): quota del mercato che il tuo prodotto davvero indirizza (gestisce il "più fine delle 4 cifre" che i dati non vedono).
   - `capturable` (SAM→SOM): quota catturabile. Checkbox **"☑ ancora alla parte contendibile"**: se attivo, il valore *base* è **suggerito** dai dati (vedi formula); sempre modificabile. Se disattivo, valori manuali liberi.

## Calcoli (deterministici, `market.js`)

Notazione: `fatt(s, G)` = fatturato del settore `s` nella geografia `G` (somma sui paesi se G=Europa).
Scenari allineati: low con low, base con base, high con high (no esplosione combinatoria).

**TAM** (per scenario x ∈ {low, base, high}):
- Competi nel settore: `TAM = Σ_s fatt(s, G)` (numero unico, non dipende dalle assunzioni).
- Vendi al settore: `TAM_x = Σ_s fatt(s, G) × spend_ratio_x`.

**SAM**: `SAM_x = TAM_x × addressable_x`  (compete-in: `TAM_x = TAM` per ogni x).

**SOM**: `SOM_x = SAM_x × capturable_x`.

**Suggerimento SOM ancorato** (se checkbox ON):
- `qg` = quota_grandi media ponderata (per fatturato) dei settori selezionati.
- `capturable_base_suggerito = clamp(0.01, 0.20, 0.15 × (1 − qg))`  → mercato concentrato (qg alto) ⇒ quota bassa; frammentato ⇒ alta.
- `capturable_low = base × 0.5`, `capturable_high = base × 1.5`.
- È un suggerimento dichiarato, l'utente lo può sovrascrivere.

## Output

1. **Imbuto TAM → SAM → SOM**: tre livelli con valore *base* in grande e il **range low–high** sotto (es. "SOM €2–8 M"). TAM etichettato *top-down* (o "spesa stimata" in modo Vendi-al).
2. **Arena competitiva** (sui settori scelti, aggregata ponderata per fatturato):
   - Concentrazione: quota_grandi (≥250) vs quota_micro.
   - Frammentazione: addetti/impresa, n° imprese totali.
   - "Player tipo": fatturato medio per impresa = `Σ fatt(s,G) / n_imprese` (fatturato REALE del settore diviso le imprese — indipendente dal modo TAM; sintetico, **non** un'azienda reale).
3. **Dettagli settore**: tutte le metriche già calcolate (margine, crescita, trend, produttività, barriera, struttura), per settore e aggregate (riusa il registro `metrics.js` + `InfoDot`).
4. **Cross-check europeo**: per i settori selezionati (mappati a 3 cifre dove serve), il TAM in ciascuno dei 36 paesi, in classifica — così si vede se il mercato vero è nazionale o più grande altrove. Riusa i dati di Confronta (`compare.json`).

## Dati

Nessun nuovo fetch. Usa `web/public/countries/<GEO>.json` (fatturato, n. imprese, concentrazione
quota_grandi/quota_micro, tutte le metriche) e `web/public/compare.json` (cross-check europeo).
Il "player tipo" usa `fatturato / imprese` (già disponibili). Il numero di imprese *per fascia* (per un
"fatturato medio del grande") NON è disponibile → non lo mostriamo (servirebbe un fetch ENT per classe).

## Onestà (etichette in UI)

- TAM: badge 🟢 *dato* (compete-in) / 🟡 *stima di spesa* (sell-into, dipende da spend_ratio).
- SAM, SOM: badge 🟡 *assunzione* + range sempre visibile; mai un solo numero.
- Limite 4 cifre dichiarato: "sotto le 4 cifre il dato economico non esiste; la quota indirizzabile è la tua stima".
- "Player tipo" = media sintetica, non un'azienda reale. Niente concorrenti nominati.

## Fuori scope (esplicito)

- Dati sotto le 4 cifre / PRODCOM / dogane come motore del TAM (verificato non disponibile gratis per i servizi).
- Aziende reali nominate coi loro ricavi (servono bilanci a pagamento).
- Mapping PRD→settore via LLM (rivalutabile in futuro, BYOK).
- Forecast/proiezioni di mercato.

## Estensioni future

- Mapping semantico LLM-BYOK del PRD → settori candidati (l'utente conferma).
- Triangolazione *ad hoc* con PRODCOM per sotto-segmenti hardware/beni fisici (dichiarando "output di produzione").
- Salvataggio multi-prodotto e confronto tra prodotti.
