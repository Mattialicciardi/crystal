# Crystal — migrazione UI a componenti Astryx

**Data:** 2026-07-03
**Stato:** approvato per implementazione (spec review con l'utente pendente prima dell'esecuzione)
**Handoff:** questa spec è scritta per essere eseguita da un agente diverso da quello che l'ha prodotta, in una sessione futura senza il contesto di questa conversazione. Tutto ciò che serve per implementare è qui dentro o linkato con percorso assoluto.

## Contesto

**Crystal** (ex "Sfera") è un tool di market intelligence che mappa l'economia europea settore per settore, con drill-down da paese → sezione → divisione → classe ATECO/NACE. Repo: `~/Desktop/Progetti/crystal` (git, branch `main`, pulito). Live su https://mattialicciardi.github.io/crystal/, deploy manuale via `./deploy.sh` (build + push su branch `gh-pages`) — **non auto-deploy**.

Frontend: `web/` — Vite + React 18 + `d3-hierarchy`/`d3-scale`, **zero librerie di componenti**. Tutta l'interfaccia è HTML a mano con un tema CSS custom scritto in `web/src/styles.css` (743 righe): sfondo navy scuro, accento teal, identità "sfera di cristallo".

**Obiettivo di questo lavoro:** sostituire il "chrome" scritto a mano (bottoni, tabelle, input, card, breadcrumb, navigazione) con componenti [Astryx](https://astryx.atmeta.com) (design system open-source di Meta, React + StyleX, 150+ componenti), **preservando esattamente l'identità visiva attuale** tramite un tema Astryx custom. La logica dati e le visualizzazioni D3 (treemap, bar chart) restano intoccate.

Questo NON è un restyling: a fine lavoro l'app deve avere lo stesso aspetto di oggi, pixel per pixel dove possibile, ma costruita su Astryx invece che su CSS scritto a mano.

## Decisioni già prese (non riaprire)

Queste sono state validate esplicitamente con l'utente durante il brainstorming — non richiedono ulteriore conferma:

1. **Perimetro: tutto in un colpo solo.** Shell globale (`App.jsx`) + le 4 viste (`CompareView`, `ScreenerView`, `MarketView`, `SectorLens`). Non un pilota parziale.
2. **Identità visiva invariata.** Tema Astryx custom che ricalca esattamente i colori/token attuali — non l'occasione per un restyling.
3. **Consolidamento strutturale sì.** Il codice attuale reimplementa a mano ~8 varianti quasi identiche del pattern "card con etichetta + valore + nota + colore" (`MetricCard`, `HierarchyCard`, `PeerCard`, i div `business-signal`/`company-model-card`/dependency, gli `arena-card` di MarketView). Vanno consolidate in **un solo componente condiviso** (`StatCard`, sezione 4) invece di essere mappate 1:1 sui confini di file esistenti. Idem per le barre percentuale (`ShareBar`, `.peer-bar`, `.company-track`) → un solo `ProgressRow`.
4. **Nessun deploy fa parte di questo lavoro.** Tutto resta locale/dev (`npm run dev`) finché l'utente non approva esplicitamente un deploy separato. Non toccare `./deploy.sh` né il branch `gh-pages`.

## Cosa NON cambia (confini espliciti)

Zero modifiche a:
- `web/src/lib.js`, `web/src/metrics.js`, `web/src/market.js`, `web/src/match.js` — logica pura (formattazione, scale colore dati, motore TAM/SAM/SOM, matcher PRD). Sono consumati dai componenti, non ne fanno parte.
- `web/src/components/Treemap.jsx` — visualizzazione D3 SVG. Astryx è una libreria di componenti UI, non un motore di grafici; non ha un sostituto. Resta com'è, eventualmente solo i colori esterni (bordo/sfondo del contenitore) seguono il nuovo tema.
- I bar-chart custom dentro `CompareView.jsx` (`.bars`/`.bar-row`/`.bar-fill`) e `MarketView.jsx` (`.market-cross .bars`) — barre orizzontali con colore guidato da `growthColor()` (scala diverging rosso→verde sul CAGR). Sono data-viz con colore data-driven, non componenti di chrome. Astryx `ProgressBar` non supporta colore custom per-istanza in quel modo; non forzarlo lì.
- `growthColor()`, `confidenceColor()`, `STATE_COLOR` in `lib.js` — scale colore dati, non token di brand. Non toccarle, non provare a farle emergere dal tema Astryx.
- Pipeline Python (`pipeline/`), test (`tests/`, `web/test/market.test.js`) — fuori scope, non toccarli.
- Nessun test React esiste oggi (i test coprono solo Python e `market.js`). Non aggiungerne per questa migrazione — è un cambio di layer di presentazione, la verifica è visiva/funzionale manuale (sezione 7).

## 1. Setup Astryx nel progetto

Nella cartella `~/Desktop/Progetti/crystal/web/`:

```bash
cd ~/Desktop/Progetti/crystal/web
npm install @astryxdesign/core @astryxdesign/cli
```

Non installare `@astryxdesign/theme-neutral` — costruiamo un tema custom da zero (sezione 2), non partiamo da un tema pubblicato.

Verifica: `npx astryx component --list --dense` deve stampare l'elenco di ~150 componenti. Se fallisce, l'installazione è incompleta — non procedere.

Non serve rilanciare `astryx init` con setup interattivo per l'app (quello è pensato per progetti nuovi); questa spec sostituisce quel ruolo. Se si vuole comunque generare il cheat-sheet per agenti in `CLAUDE.md` di progetto, è opzionale: `npx astryx init --features agents --agent claude` (non tocca file applicativi, solo genera un blocco `<!-- ASTRYX:START/END -->` in `web/CLAUDE.md` o alla root del repo — verificare dove atterra e spostarlo se necessario).

**MCP Astryx**: è già collegato a livello globale (`claude mcp get astryx` → connesso, `https://astryx.atmeta.com/mcp`, tool `search`/`get`). Utile per query rapide sulla documentazione durante l'implementazione, ma la fonte di verità per le prop è sempre `npx astryx component <Nome> --dense` sulla versione installata nel progetto (l'MCP riflette la doc pubblica più recente, potenzialmente diversa dalla versione pinnata qui).

## 2. Tema custom — token exact-match

Astryx costruisce temi con `defineTheme()` (`@astryxdesign/core/theme`). Crystal **non ha modalità chiara** — è sempre dark — quindi il tema monterà `<Theme theme={crystalTheme} mode="dark">` fisso, mai `mode="system"`.

Mappa dei colori attuali (da `web/src/styles.css:1-10`) verso i token Astryx (da `npx astryx docs tokens`):

| CSS var attuale | Valore | Token Astryx da sovrascrivere |
|---|---|---|
| `--bg` | `#0c1018` | `--color-background-body` |
| `--panel` | `#121826` | `--color-background-surface`, `--color-background-card` |
| `--panel2` | `#18203049` | `--color-overlay-hover` (hover righe tabella/menu) |
| `--line` | `#232c3d` | `--color-border` |
| `--txt` | `#e6ebf3` | `--color-text-primary` |
| `--mut` | `#8b97ab` | `--color-text-secondary` |
| `--teal` | `#2dd4bf` | `color.accent` (motore di derivazione HCT) + verificare che `--color-text-accent`/`--color-icon-accent`/`--color-border-blue`-equivalenti risultanti combacino a occhio; se no, override esplicito in `tokens` |
| `--accent` | `#5b8cff` | usato oggi per i link/crumb — mappare su `--color-text-accent` SE il teal derivato da `color.accent` non basta a coprire due ruoli diversi (bottoni "on" = teal, link = blu). Verificare visivamente; questi sono due accenti concettualmente diversi nell'app attuale (stato attivo vs link), Astryx ha un solo `accent` primario — usare `variant="blue"` locale sui componenti che oggi usano `--accent` invece di un secondo token globale. |

Struttura del file (nuovo: `web/src/theme/crystalTheme.js`):

```js
import { defineTheme } from '@astryxdesign/core/theme'

export const crystalTheme = defineTheme({
  name: 'crystal',
  color: { accent: '#2dd4bf', neutralStyle: 'cool' },
  tokens: {
    '--color-background-body': ['#0c1018', '#0c1018'],
    '--color-background-surface': ['#121826', '#121826'],
    '--color-background-card': ['#121826', '#121826'],
    '--color-border': ['#232c3d', '#232c3d'],
    '--color-text-primary': ['#e6ebf3', '#e6ebf3'],
    '--color-text-secondary': ['#8b97ab', '#8b97ab'],
    '--color-overlay-hover': ['#18203049', '#18203049'],
  },
})
```

I token sono tuple `[light, dark]`; dato che l'app forza `mode="dark"`, mettere lo stesso valore in entrambi gli slot evita ambiguità (nessuna modalità chiara esisterà mai, ma se in futuro qualcuno passa `mode="system"` per errore, il risultato resta corretto).

Dopo la prima stesura, **confrontare visivamente** (dev server fianco a fianco con lo screenshot/versione attuale) bottoni "on" (`.chip.on`, `.mode.on` oggi `background: var(--teal)`), badge di tono (teal/blue/amber/neutral — sezione 4), bordi tabella, hover righe. Iterare i `tokens` finché non combaciano. Non è richiesta fedeltà matematica sui token derivati da `color.accent` (es. hover states, focus ring) — solo sui 7 token esplicitamente elencati in tabella, che sono quelli visibili costantemente.

**Build per produzione**: non necessario per lo sviluppo (`npx astryx theme build` genera CSS statico per SSR — Crystal è una SPA client-only via Vite, non serve). Usare l'iniezione runtime (`<Theme theme={crystalTheme} mode="dark">` diretto, senza `/built`).

Montaggio in `web/src/main.jsx` (leggere il file prima di modificarlo: oggi probabilmente monta solo `<App />` dentro `createRoot`): avvolgere con `<Theme theme={crystalTheme} mode="dark"><App /></Theme>`, import `Theme` da `@astryxdesign/core`. Rimuovere l'import di `styles.css` con le regole ora gestite da Astryx (vedi sezione 6 per cosa resta in `styles.css`).

## 3. Tone mapping (usato ovunque nella sezione 4-6)

Il codice attuale usa 4 "tone" ricorrenti su badge/card/segnali: `'teal' | 'blue' | 'amber' | 'neutral'`. Astryx non ha "amber" come nome — il più vicino è `'orange'`. Mappa fissa da usare in **tutta** l'app, senza eccezioni locali:

| Tone Crystal | `Badge`/`Card` variant Astryx |
|---|---|
| `teal` | `teal` |
| `blue` | `blue` |
| `amber` | `orange` |
| `neutral` | `neutral` (Badge) / `default` (Card) |

## 4. Primitiva condivisa nuova: `StatCard`

Nuovo file: `web/src/components/StatCard.jsx`. Sostituisce (elimina come componenti separati, tenendo la logica di calcolo dati che li alimenta invariata):

- `MetricCard` (App.jsx / SectorLens.jsx)
- `HierarchyCard` (SectorLens.jsx)
- `PeerCard` (SectorLens.jsx) — versione con barra percentile, vedi variante sotto
- i blocchi inline `.business-signal`, `.company-model-card`, i div dependency in `SectorLens.jsx`
- gli `.arena-card` in `MarketView.jsx`

Props:

```
label: string        // es. "Fatturato", "Margine"
value: ReactNode      // es. "€1,2 Mrd", "18,4%"
detail?: ReactNode     // nota secondaria, es. "MOL su fatturato"
tone?: 'teal' | 'blue' | 'amber' | 'neutral'   // default 'neutral', mappato via sezione 3
percentile?: { value: number, rank: number, total: number, descriptor: string }  // opzionale: se presente, renderizza una ProgressBar sotto value/detail (sostituisce PeerCard's .peer-bar) — value 0..1
```

Implementazione: `Card` (Astryx, `padding={3}`, `variant` derivato dal tone SOLO quando serve enfasi cromatica forte — per il caso comune label+valore+nota preferire `variant="default"` con un `Badge` piccolo per il tone, seguendo la regola di best-practice di Astryx stesso ("Don't use color variants for status; use Banner or Badge") — quindi: `Card` neutro come contenitore, `Badge` col tone-mapping per il colore, `Text` per label/value/detail. Se in fase di verifica visiva il risultato è troppo diverso dall'attuale (che oggi tinge l'intero bordo/sfondo della card in base al tono), è accettabile usare `Card variant={toneMap[tone]}` direttamente — priorità 1 resta la fedeltà visiva (decisione 2 sopra), non l'aderenza dogmatica alle best practice di Astryx.

Quando `percentile` è presente: `ProgressBar` Astryx, `value={percentile.value * 100}`, `max={100}`, `hasValueLabel`, `label` accessibile descrittivo (es. `${label} percentile`), `variant` derivato dal tone.

## 5. Primitiva condivisa nuova: `ProgressRow`

Nuovo file: `web/src/components/ProgressRow.jsx`. Sostituisce `ShareBar` (SectorLens.jsx) e le barre inline in `.company-track`/`.company-split`. Wrapper leggero su `ProgressBar` Astryx: props `{label, value, tone}` dove `value` è frazione 0..1 già clampata (riusa `clamp01()` esistente in SectorLens.jsx, spostarla in `lib.js` se serve condividerla — è pura, nessun rischio).

## 6. Mappatura componente per componente

Convenzione tabella: **File attuale** → elemento CSS/JSX oggi → **componente Astryx**. "Import" = riferimento rapido; il path esatto va verificato con `npx astryx component <Nome>` al momento dell'implementazione (i path in questa spec sono presi da `astryx component --list --dense`, ma la CLI è la fonte di verità).

### 6.1 `App.jsx` (shell globale)

| Oggi | Astryx |
|---|---|
| `.app` (div root, sidebar+main) | `AppShell` (`@astryxdesign/core/AppShell`), `height="fill"`, `contentPadding={0}` (l'app gestisce già il proprio padding interno via `.workspace`) |
| `.side` + `.brand` + `.modes` | `SideNav` (`@astryxdesign/core/SideNav`) come prop `sideNav` di `AppShell`. `.brand` → `SideNavHeading`. I 4 bottoni modo → `SideNavItem` dentro `SideNavSection`, `onClick={() => setMode(id)}` (sono cambi di stato locale, non navigazione — niente `href`) + `isSelected={mode === id}` per lo stato attivo (prop confermata: `SideNavItem.isSelected: boolean`) |
| `.side-path` (paese/focus/livello) | Testo semplice (`Text`) dentro il `topContent` o `footer` di `SideNav` — non è navigazione, non forzare in un componente di nav |
| `.topbar` h1+tagline | `Text` semplice, non serve `TopNav` (SideNav già copre la navigazione; TopNav sarebbe ridondante — vedi "Don't nest" nelle best practice AppShell) |
| `.command` input + `.command-menu` dropdown (ricerca settore/codice) | `Typeahead` (`@astryxdesign/core/Typeahead`). **searchSource**: usare `createStaticSource` da `@astryxdesign/core/Typeahead` (import: `import { createStaticSource } from '@astryxdesign/core/Typeahead'`) sopra l'array `[...index.values()]`, item shape `{id: sector.code, label: \`${sector.code} · ${sector.name}\`, auxiliaryData: sector}`. `onChange={(item) => item && jumpToSector(item.auxiliaryData.code)}`. `debounceMs={0}` (sorgente sincrona in-memory, niente rete). Il filtro attuale ordina anche per fatturato decrescente — `createStaticSource` fa solo match per substring, l'ordinamento va rifatto passando un array già pre-ordinato per fatturato come input, così l'ordine dei risultati filtrati lo eredita. |
| `.country-sel` (`<select>` nativo) | `Selector` (`@astryxdesign/core/Selector`), `options` = `countries.map(c => ({value: c.code, label: c.name}))` |
| `.crumbs` | `Breadcrumbs` + `BreadcrumbItem` (`@astryxdesign/core/Breadcrumbs`). `onClick` invece di `href` (navigazione interna via stato `path`, non URL) — verificare che `BreadcrumbItem` permetta `onClick` senza `href` (sì, da prop table sezione precedente: `onClick` esiste indipendentemente da `href`). L'ultimo crumb: `isCurrent` invece della classe `.here`. |
| `.controls .ctl` (chip Vista/Area) | `SegmentedControl` + `SegmentedControlItem` (`@astryxdesign/core/SegmentedControl`) — due istanze separate (Vista, Area), ciascuna `value`/`onChange` controllati dallo stato esistente (`preset`, `sizeKey`) |
| `.grid`/`.grid-wrap` (tabella principale) | `Table` (`@astryxdesign/core/Table`) + hook `useTableSortable` (`import { useTableSortable } from '@astryxdesign/core/Table'`) al posto della logica `clickHeader` scritta a mano. `useTableSortable` è un plugin headless: prende `sort` (stato ordinato `{sortKey, direction}[]`, equivalente all'attuale `{key, dir}`) e `onSortChange`; è single-sort qui (`isMultiSortEnabled` non serve, non c'è shift+click nell'app attuale), `allowUnsortedState={false}` per restare sul comportamento attuale (asc↔desc, mai "non ordinato" — coerente con `clickHeader` che alterna solo asc/desc). Renderizza gli indicatori di sort in automatico nelle header cell, non serve più il glifo `▾/▴` manuale. Colonne: ogni colonna needs `width` esplicito (`proportional()` o `pixel()`) per le regole di best-practice Astryx — non ometterlo. |
| `Legend.jsx` (`<details>`) | `Collapsible` (`@astryxdesign/core/Collapsible`), `trigger` = "Legenda / Metodo — cosa significano le colonne", `defaultIsOpen={false}` |
| `InfoDot.jsx` (bottone "i" + popover click-toggle) | `Popover` (`@astryxdesign/core/Popover`), `content` = il testo esplicativo, trigger = lo stesso bottone "i" (deve contenere un `<button>`, requisito di `Popover`, già soddisfatto oggi) |
| `.foot` | Testo semplice, opzionalmente dentro `LayoutFooter` se si usa `Layout` per l'area contenuto — non obbligatorio |
| `Treemap.jsx` | **invariato** (sezione "cosa non cambia") |

### 6.2 `CompareView.jsx`

| Oggi | Astryx |
|---|---|
| `.cmp-controls input[list=seclist]` + `<datalist>` | `Typeahead` con `createStaticSource` su `doc.sectors` (stesso pattern di 6.1), sostituisce sia l'input che il `<datalist>` nativo |
| `.controls` chip metrica (8 bottoni) | `SegmentedControl` (8 `SegmentedControlItem`, `layout="hug"` dato il numero — verificare leggibilità, eventualmente `size="sm"`) |
| `.cmp-ref` (riferimento UE27) | `Card` semplice o `Banner status="info"` (è informativo, non un errore/warning — `Banner` è più corretto semanticamente: "controls a value") |
| `.bars`/`.bar-row`/`.bar-fill` | **invariato** (data-viz, colore da `growthColor`, sezione "cosa non cambia") |

### 6.3 `ScreenerView.jsx`

| Oggi | Astryx |
|---|---|
| `.scope-toggle` (2 chip: paese/Europa) | `SegmentedControl` (2 item) |
| Preset chips (Bootstrapper/Venture/Value/Azzera) | `ToggleButtonGroup`/`SegmentedControl` — dato che "Azzera" non è un valore mutuamente esclusivo con gli altri tre ma un'azione (reset), non ci sta bene in un unico `SegmentedControl` a 4 valori. Preferire: `SegmentedControl` per i 3 preset + `Button variant="ghost"` separato per "Azzera". |
| `.filters` (griglia min/max per metrica) | Per ogni metrica: `FormLayout` (`@astryxdesign/core/FormLayout`) `direction="horizontal"` (fields left-to-right, equal flex-grow — esattamente il pattern min\|max attuale) contenente due `NumberInput` (`@astryxdesign/core/NumberInput`), ciascuno con `units` = l'unità della metrica (`f.unit`, oggi mostrata a parte in `({unit})`) e `placeholder="min"`/`"max"`. Il `label`/`InfoDot` della metrica resta come intestazione sopra il `FormLayout`, non dentro ogni `NumberInput` (che userebbe `isLabelHidden` con label accessibile "min {metrica}"/"max {metrica}"). |
| tabella risultati | `Table` (stesso approccio di 6.1) |
| `Legend` | `Collapsible` (stesso di 6.1, componente già condiviso) |

### 6.4 `MarketView.jsx`

| Oggi | Astryx |
|---|---|
| mode toggle (Competi/Vendi) | `SegmentedControl` (2 item) |
| `.market-prd` (`<textarea>`) | `TextArea` (`@astryxdesign/core/TextArea`), `rows` adeguato al contenuto attuale, `placeholder` invariato |
| suggerimenti PRD (`.suggested .pchip.sug`, chip cliccabili "+ aggiungi") | `Token` (`@astryxdesign/core/Token`) con `onClick` (non `onRemove` — qui aggiungono, non rimuovono), o `Badge` cliccabile se `Token.onClick` risulta semanticamente scorretto per un'azione di aggiunta (verificare best-practice: "Don't use tokens for actions" — se è così, preferire piccoli `Button variant="ghost" size="sm"` per i suggerimenti, e riservare `Token` solo ai settori già selezionati sotto) |
| `.market-pick input[list=msec]` | `Typeahead` con `createStaticSource` su `leafSectors` (stesso pattern) |
| `.picked .pchip ✕` (settori selezionati, rimovibili) | **`Tokenizer`** (`@astryxdesign/core/Tokenizer`) — sostituisce SIA il picker di ricerca CHE la lista di chip rimovibili in un solo componente (Tokenizer include già search input + token dropdown). Questo significa che il Typeahead separato sopra diventa ridondante per questo campo specifico: usare `Tokenizer` da solo per tutto il blocco "cerca+aggiungi+chip rimovibili", con `searchSource = createStaticSource(leafSectors...)`, `value = selected` (mappati a `{id, label, auxiliaryData}`), `onChange` che aggiorna `st.picked` estraendo `.map(i => i.auxiliaryData.code)`. |
| `RangeInput` (label + 3 `NumberInput` low/base/high) | 3× `NumberInput` in `Field`, layout invariato (già un componente locale ben isolato — non serve consolidare, ha già un solo scopo chiaro) |
| checkbox "ancora" | `CheckboxInput` (`@astryxdesign/core/CheckboxInput`) |
| `.funnel-row` (TAM/SAM/SOM) | `Card` per riga, contenuto invariato (badge emoji 🟢/🟡 + valore + range + sottotitolo) |
| `.arena-grid .arena-card` | `StatCard` (sezione 4) |
| tabella dettagli settore | `Table` |
| `.market-cross .bars` | **invariato** (data-viz) |

### 6.5 `SectorLens.jsx` (il file più grande — 1114 righe, massimo beneficio dal consolidamento)

| Oggi | Astryx |
|---|---|
| `MetricCard` (8 istanze in `.focus-grid`) | `StatCard` |
| `.focus-chip` (badge coverage/confidence/level/tag) | `Badge` (`@astryxdesign/core/Badge`) — attenzione alla best-practice Astryx "don't badge every default state": qui sono usati come tag descrittivi, non stati di sistema — usare varianti colore non-semantiche (`teal`/`blue`/`gray`) invece di `success`/`warning` per evitare falsi segnali di stato |
| `FocusSection` (componente locale: bottone toggle + contenuto) | **Eliminare, sostituire con `Collapsible`/`CollapsibleGroup`** (`@astryxdesign/core/Collapsible`) — è esattamente ciò che `FocusSection` reimplementa a mano. Le 5 sezioni (hierarchy/archetype/chain/dependency/peers) + quella condizionale (leaves) diventano `CollapsibleGroup type="multiple"` (oggi possono essere aperte independentemente, `openSections` è un oggetto multi-chiave, non single-select) con 6 `Collapsible` figli, `value` = stesso id usato oggi (`hierarchy`, `archetype`, ecc.) |
| `HierarchyCard`, `PeerCard` (senza barra → con barra via `percentile` prop), business-signal/company-model-card/dependency divs | Tutti → `StatCard` (sezione 4). `PeerCard` usa la variante con `percentile` |
| `ShareBar`, `.company-track`/`.company-split` | `ProgressRow` (sezione 5) |
| `.business-diagnostics` (`<ul><li>`) | `List`/`ListItem` (`@astryxdesign/core/List`) |
| tabella operativa (`operating-table`), tabella sotto-nicchie, tabella — tutte le 3 tabelle in questo file | `Table` (stesso approccio di 6.1) |
| `.focus-leaves .leaf-chip` (bottoni foglie cliccabili) | `Token` con `onClick` (non `onRemove` — qui navigano, non rimuovono; stesso ragionamento dei suggerimenti PRD in 6.4: se le best-practice Astryx sconsigliano `Token` per azioni, usare `Button variant="ghost" size="sm"` con lo stesso contenuto visivo) |

## 7. Sequenza di implementazione e verifica

Ordine (ogni step è un checkpoint con verifica visiva prima di passare al successivo — **non fare tutto in un unico commit/diff enorme**):

1. **Setup + tema** (sezione 1-2): installare pacchetti, creare `crystalTheme.js`, montare `<Theme>` in `main.jsx`. Verifica: l'app deve ancora costruire (`npm run dev`) e mostrare la UI attuale (invariata, perché nessun componente Astryx è ancora in uso) senza errori console.
2. **Primitive condivise** (sezioni 3-5): `StatCard.jsx`, `ProgressRow.jsx`. Nessun consumo ancora — verifica isolata (es. una pagina/route di scratch temporanea, o direttamente al primo punto di consumo nello step 3).
3. **App.jsx** (sezione 6.1): shell + tabella principale. Verifica: confronto visivo diretto con l'app pre-migrazione (screenshot prima/dopo, o due tab affiancate se si tiene un branch di riferimento). Zero regressioni funzionali: drill-down, ricerca, sort colonne, cambio paese, breadcrumb, legend, info-dot devono comportarsi identicamente.
4. **CompareView.jsx** (sezione 6.2).
5. **ScreenerView.jsx** (sezione 6.3).
6. **MarketView.jsx** (sezione 6.4) — attenzione particolare al comportamento di `Tokenizer` (localStorage persiste `st.picked` come array di codici stringa, non deve cambiare formato di persistenza).
7. **SectorLens.jsx** (sezione 6.5) — il più grande, beneficia di tutte le primitive già collaudate nei passi precedenti.
8. **Passata finale**: rimuovere da `web/src/styles.css` tutte le regole ormai morte (sostituite da componenti Astryx) — quello che resta legittimamente in `styles.css` dopo la migrazione: stili del `Treemap` SVG (`.cell`, `.cell-*`), le regole dei bar-chart custom (`.bars`, `.bar-*`), eventuali micro-aggiustamenti di layout non coperti da componenti (`.app` max-width, gap generali). Tutto il resto (chip, card, tabelle, crumbs, modes) dovrebbe essere sparito perché sostituito da Astryx.

**Cosa verificare ad ogni step** (manuale, nessun test automatico esiste per la UI — vedi "cosa non cambia"):
- `npm run dev`, aprire nel browser, controllare la console per errori/warning React
- Confronto visivo con l'aspetto pre-migrazione (stessi colori, stesso spacing percepito)
- Percorrere il flusso interattivo di quella vista specifica (click, drill-down, filtri, ricerca) e verificare che il comportamento sia identico a prima
- Nessuna chiamata a `./deploy.sh` finché l'utente non lo richiede esplicitamente in una richiesta separata

## 8. Rischi noti / cose da verificare in corsa

- **`Token`/`Badge` per azioni cliccabili** (suggerimenti PRD, foglie pesanti): le best-practice Astryx scoraggiano l'uso di `Token`/`Badge` per trigger di azione. Questa spec propone `Button variant="ghost" size="sm"` come fallback ma lascia la decisione finale a chi implementa, dopo aver visto il risultato visivo di entrambe le opzioni — priorità sempre alla fedeltà visiva (decisione 2).
- **Doppio accento (teal per stato attivo, blu per link)**: Astryx deriva un solo accento primario da `color.accent`. Se la differenza teal/blu oggi è percettivamente importante (probabile, sono usate per cose diverse: stato "on" vs link cliccabile), potrebbe servire usare esplicitamente `variant="blue"` sui componenti che oggi usano `--accent` invece di affidarsi al solo accento derivato. Verificare in sezione 2 durante il confronto visivo.
- **`Tokenizer` sostituisce il `Typeahead` di MarketView**: la sezione 6.4 nota che `Tokenizer` da solo copre sia la ricerca sia i chip rimovibili per il campo "settori selezionati" — verificare in fase di implementazione che non serva comunque un `Typeahead` separato altrove nello stesso file (i "suggerimenti dal PRD" sono un flusso diverso, di sola aggiunta via bottone, non uno start-from-search — restano `Button`/`Token` come da tabella, non `Typeahead`).

## 9. Criteri di completamento

- Tutti i file in `web/src/` (App.jsx + 4 viste + Legend/InfoDot) usano componenti Astryx per il chrome; nessun elemento HTML nativo di form/nav/tabella scritto a mano rimane, salvo dove esplicitamente escluso (Treemap, bar-chart custom).
- `styles.css` contiene solo le regole elencate nello step 8 della sequenza (Treemap, bar-chart, layout macro) — tutto il resto è stato rimosso perché ridondante.
- Nessuna differenza visiva percepibile rispetto alla versione pre-migrazione (stesso navy, stesso teal, stesso spacing) in nessuna delle 4 viste.
- Nessuna regressione funzionale in nessun flusso interattivo esistente.
- Zero modifiche a `lib.js`, `metrics.js`, `market.js`, `match.js`, `Treemap.jsx`, pipeline Python, test esistenti.
- `git status` pulito salvo i file effettivamente toccati da questa migrazione (nessun file generato accidentalmente da `astryx init` fuori posto, nessun `node_modules` committato).
- Nessun deploy eseguito.
