# Crystal — Livello opportunità: lo "Screener" — Design

Data: 2026-06-25 · Stato: approvato (in attesa di review finale dello spec)

## Obiettivo

Salire di un gradino: dal *descrivere* i settori al **aiutare Mattia a giudicare quale aggredire**,
senza tradire l'anima del prodotto (niente "punteggio magico", niente falsa sicurezza).

La risposta a *"che settore conviene aggredire?"* NON è un punteggio imposto dal tool, ma un
**screener a filtri**: l'utente seleziona criteri e soglie sui dati grezzi e ottiene i settori che li
rispettano. Il giudizio resta in mano all'utente; il tool fornisce i segnali, onestamente etichettati.

## Principi (non negoziabili)

- **Niente punteggio composito.** Nessun "Sector Score". La classifica nasce dall'ordinamento scelto dall'utente, non da pesi nascosti.
- **Niente proiezioni/forecast.** Scartata la "crescita a 10 anni": è una scommessa travestita da numero. Si guarda solo a ciò che è già successo.
- **Niente CAC.** Non derivabile dai dati SBS. Sostituito da un proxy di *barriera d'ingresso* (capitale/addetto), chiaramente etichettato.
- **Onestà sui limiti.** Ogni segnale porta il suo stato (osservato / proxy / parziale). La concentrazione è size-class, non HHI firm-level.

## 1. Forma — modalità "Screener"

Quarto tab accanto a *Esplora paese* e *Confronta paesi*: **Screener** ("Trova settore").

- **Interruttore Ambito:**
  - `Paese` (default Italia): filtra i settori del paese selezionato al massimo dettaglio (Italia 4 cifre ATECO, altri paesi 3 cifre NACE).
  - `Tutta Europa`: filtra su tutte le coppie *settore × paese* a 3 cifre; ogni risultato è "settore @ paese".
- **Pannello filtri:** un controllo *range* (min/max) per ogni segnale. Filtro lasciato vuoto = spento. I filtri si combinano in **AND**.
- **Risultati:** tabella ordinabile dei settori (o coppie settore@paese) che passano tutti i filtri attivi, con **contatore match**. Ordinabile per qualsiasi colonna.
- **Preset-scorciatoia** (opzionali): impostano un set di filtri, NON sono punteggi. Esempi:
  - *Bootstrapper*: frammentazione alta + margine alto + barriera bassa.
  - *Venture*: trend di crescita sostenuto + frammentazione alta.
  - *Value/PE*: margine alto + concentrazione medio-alta + dimensione grande.
  Dopo aver applicato un preset l'utente può ritoccare ogni filtro.

## 2. I segnali filtrabili

| Segnale | Definizione | Fonte | Stato onestà |
|---|---|---|---|
| Dimensione | fatturato | ISTAT/Eurostat | 🟢 osservato |
| Crescita storica | CAGR fatturato sull'orizzonte | calcolato | 🟢 osservato |
| **Trend di crescita** | anni consecutivi di crescita YoY (+ momentum) | calcolato | 🟢 osservato (retrospettivo) |
| Produttività | VA / addetto | calcolato | 🟢 osservato |
| Frammentazione | addetti / impresa | calcolato | 🟢 osservato |
| **Margine** | MOL / fatturato (potere di prezzo) | calcolato | 🟢 osservato |
| **Concentrazione** | % fatturato nelle imprese ≥250 addetti (e % nelle micro) | size-class | 🟡 proxy size-class, *non* HHI firm-level |
| **Barriera d'ingresso** | investimenti / addetto | ISTAT (IT) | 🟡 pieno IT; N.D. in Europa |

### Definizioni precise delle metriche nuove

**Margine** = `MOL / fatturato`. IT: `mol_keur / fatturato_keur`. Europa: `GOS_MEUR / NETTUR_MEUR`. Espresso in %.
Alto = potere di prezzo / vantaggio di costo; basso = settore spremuto.

**Trend di crescita** (retrospettivo, nessuna previsione):
- Calcola la crescita YoY `g_t = V_t / V_{t-1} − 1` per ogni coppia di anni consecutivi disponibili (non oscurati).
- `anni_crescita_consecutivi`: numero di anni consecutivi, partendo dal più recente all'indietro, con `g_t > 0`.
- `momentum` (bonus): `CAGR(ultimi 3 anni) − CAGR(intero periodo)`. >0 = accelera, <0 = rallenta.
- `trend_label`: `sostenuto` (consecutivi ≥ 3) · `recente` (1–2) · `in_calo` (ultimo g < 0) · `nd`.
- Orizzonti: Italia 2015–2023 (fino a 8 YoY), Europa 2021–2024 (fino a 3 YoY). La soglia "+3 anni" è significativa per entrambe.

**Concentrazione / saturazione** (da distribuzione per classe di addetti):
- `quota_grandi` = `fatturato(imprese ≥250 add) / fatturato(totale)`.
- `quota_micro` = `fatturato(imprese <10 add) / fatturato(totale)`.
- Lettura: `quota_grandi` alta = mercato dominato da pochi grandi (colmo/concentrato); `quota_micro` alta = polverizzato in tanti piccoli.
- **Limite dichiarato:** misura la quota nelle imprese grandi, NON "una sola azienda fa metà del fatturato" (servirebbe dato firm-level a pagamento, AIDA/Cerved). Etichetta esplicita nell'UI.
- Fallback: se il fatturato per classe è oscurato, usare la distribuzione per *occupati*.
- **Nota onestà:** i dati per classe di addetti subiscono più segreto statistico dei totali (specie a 4 cifre): la concentrazione sarà disponibile soprattutto per i settori non minuscoli; dove oscurata → "—" (non si inventa). Da misurare in fase di build (come fu fatto per il segreto sui totali).

**Barriera d'ingresso** = `investimenti_keur / occupati` (capitale per addetto). Alta = capital-intensive, barriera alta.
- Italia: pieno (indicatore ISTAT 15110 già scaricato).
- Europa: `sbs_sc_ovw` non ha l'investimento → il filtro barriera è **N.D./disattivato** in modalità Europa (onestà). Nessun proxy fasullo.

## 3. Dati da acquisire

- **Eurostat** (no rate limit aggressivo): rifetch di `NETTUR_MEUR` e `EMP_NR` su `sbs_sc_ovw` **per classe di addetti** (`size_emp` = tutte le classi, non solo TOTAL) → ~2 query → quote grandi/micro per la concentrazione.
- **ISTAT** (rate-limit 5/min → ban: seriale ≥16s, mai parallelo): fetch di `12110` (fatturato) e `16110` (occupati) con `PERS_EMPL_SIZE_CLASS` non filtrato → ~2 query → concentrazione a 4 cifre. Investimenti (`15110`) già scaricati.
- Mappatura classi di addetti: Eurostat `GE250`=grandi, `0-9`=micro; ISTAT `CL_CLLVT` `W_GE250`/`W0_9` (o equivalenti).

## 4. Schema dati (campi aggiunti)

Per ogni settore nei `countries/<GEO>.json` e in `compare.json`:
```
fields.margine.value            // MOL/fatturato
concentrazione: { quota_grandi, quota_micro }
trend: { anni_crescita, momentum, label }
barriera: { value }             // investimenti/addetto (IT); null in Europa
```
Generati da un nuovo step di build che arricchisce gli artefatti esistenti (idempotente, deterministico).

## 5. UI / onestà

- Pannello filtri con range per ognuno degli 8 segnali (barriera disattivata in modalità Europa).
- Colonne risultati con etichette di stato (🟢/🟡).
- Trend mostrato come label + n anni (es. "sostenuto · 4 anni"), niente numeri-previsione.

### Spiegazione dei campi (info contestuale + legenda) — app-wide

Richiesta esplicita: ogni campo/filtro "particolare" deve poter spiegare sé stesso.

- **Registro centrale delle definizioni** (`web/src/metrics.js`): per ogni metrica `{ label, definizione breve, formula, limite/onestà }`. Unica fonte di verità, riusata in Esplora, Confronta e Screener (stesse spiegazioni ovunque).
- **Icona "i" cliccabile** (componente `InfoDot` riutilizzabile) accanto alle intestazioni di colonna e ai filtri particolari (margine, concentrazione, trend, barriera, VA/addetto, addetti/impresa) → popover con definizione + formula + **caveat di onestà** (es. "concentrazione = quota fatturato delle imprese ≥250 add., NON 'una sola azienda fa metà'").
- **Sezione espandibile "Legenda / Metodo"** in fondo allo Screener (e a Esplora) che elenca tutte le metriche con definizione e limiti in un unico posto.
- Il popover chiude su clic fuori / Esc; accessibile da tastiera.

## Fuori scope (esplicito)

- Proiezione/forecast di mercato a N anni (scartata).
- CAC (non derivabile).
- HHI / concentrazione firm-level (richiede dato a pagamento).
- Punteggio composito "Sector Score" imposto.

## Estensioni future (non ora)

- Evidenziazione dei match sulla treemap (modalità C).
- Modulo concentrazione firm-level via bilanci a pagamento (HHI vero).
- Salvataggio/condivisione di set di filtri.
