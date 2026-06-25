# Sfera — Ricognizione del dato reale (verificata)

> Questo documento registra ciò che è stato **verificato toccando le fonti**, distinguendolo
> dalle assunzioni del PRD. È la base fattuale della pipeline. Coerente con la filosofia del
> prodotto: nessun claim presentato come fatto senza averlo osservato.

Data ricognizione: 2026-06-25.

---

## 1. Fonti

| Fonte | Endpoint | Granularità ATECO/NACE | Note |
|---|---|---|---|
| **ISTAT SBS nazionale** | `https://esploradati.istat.it/SDMXWS/rest/` — dataflow `IT1,161_267_DF_DCSP_SBSNAZ_2,1.0` | **4 cifre** (678 codici, ~615 classi reali + ~63 aggregati speciali) | **Fonte primaria.** DSD `DCSP_SBSNAZ`. |
| **Eurostat SBS** | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw` | **3 cifre max** (gruppo) | Solo cross-check / fallback. **NON dà le 4 cifre.** |

### ⚠️ Correzione al PRD
Il PRD affermava: *"ISTAT ed Eurostat pubblicano i conti economici al livello ATECO 4 cifre"*.
**Verificato falso per Eurostat**: `sbs_sc_ovw` si ferma al 3° livello NACE
(distribuzione livelli: `{section:16, division:80, group:246}`, **zero classi a 4 cifre**).
→ Le 4 cifre per l'Italia vengono **solo da ISTAT**. Il rate limit ISTAT diventa quindi un vincolo
di prima classe, non un dettaglio.

---

## 2. Vincolo operativo ISTAT (critico)

- **Rate limit: 5 query/minuto per IP.** Superarlo → **ban di 1–2 giorni**.
- Regola autoimposta: **query seriali, ≥15s di distanza, mai in parallelo.**
  Vietato qualsiasi fan-out di agenti su ISTAT.
- Test con `?firstNObservations=N` prima dei download pieni; attenzione a `413/414`.
- Bug noto: `endPeriod=YYYY` restituisce anche l'anno successivo → usare `startPeriod` o `lastNObservations`.
- Header CSV: `Accept: application/vnd.sdmx.data+csv;version=1.0.0`.
- Latenza reale osservata: ~50–60s per risposta. La DSD completa pesa **11 MB**.

---

## 3. Struttura del cubo `DCSP_SBSNAZ`

Dimensioni (in ordine di chiave SDMX):

1. `FREQ` (A = annuale)
2. `REF_AREA` (IT = Italia)
3. `DATA_TYPE` → codelist `CL_TIPO_DATO29` (**118 indicatori**)
4. `ECON_ACTIVITY_NACE_2007` → codelist `CL_ATECO_2007` (2061 codici; **678 a 4 cifre**)
5. `PERS_EMPL_SIZE_CLASS` → `CL_CLLVT` (classi di addetti; `TOTAL` = totale)
6. `TURNOVER_CLASS` → `CL_CL_IMPORTO1` (`9` = totale)
7. `ENVIROM_DOMAIN` → `CL_AREEAMB` (`9` = totale)

Chiave-tipo per un singolo indicatore, tutte le classi: `A.IT.<DATA_TYPE>..TOTAL.9.9`

### Stato del dato leggibile nativamente (`CL_FLAG` / `OBS_STATUS`)
Scoperta architetturale: **lo stato a 3 livelli del PRD è già nel dato.**

| Flag ISTAT | Significato | Stato Sfera |
|---|---|---|
| (nessuno) | dato osservato | **osservato** (peso pieno) |
| `e` | dato stimato | **stimato** (peso dimezzato) |
| `c` | oscurato per segreto statistico | **assente** (peso zero) |
| `p` | provvisorio | osservato (provvisorio) |
| `f` | previsto | stimato |

→ Il **Confidence Score non è un'euristica**: deriva dai flag ufficiali ISTAT.

---

## 4. Mappatura 8 campi nucleo → indicatori ISTAT reali

| Campo (peso PRD) | Indicatori `DATA_TYPE` | Stato @4 cifre |
|---|---|---|
| **Dimensione** (20) | `11110` imprese · `12110` fatturato · `12150` valore aggiunto · `16110` occupati | ✅ osservato |
| **Redditività** (20) | `12170` MOL → MOL/VA, MOL/fatturato | ✅ osservato (derivato) |
| **Struttura** (15) | `11110` imprese · `16110` occupati → addetti/impresa · `11210` unità locali | ✅ osservato |
| **Produttività** (10) | `12150`/`16110` (VA per addetto) · `13310`/`16130` (costo lavoro/dip.) | ✅ osservato (derivato) |
| **Crescita** (15) | CAGR di `12110`/`16110` sulla serie storica | ✅ calcolato (flag orizzonte) |
| **Concentrazione** (5) | `E12110_Q1/Q2/Q3/STD` quartili fatturato · `E16110_Qx` addetti (proxy dispersione) | 🟡 parziale osservato (no HHI) |
| **Turnover** (10) | non presente in SBS → demografia d'impresa ISTAT (3 cifre) | 🔴 fallback/stimato |
| **Qualità dato** (5) | derivato dai flag | ✅ meta |

**≈ 6/8 campi solidi a 4 cifre** — l'assunzione del PRD regge, con due note:
- la **concentrazione** è proxy di dispersione (quartili/STD), non HHI: meglio di "assente" ma non vero indice di concentrazione;
- il **turnover** è l'unico genuinamente debole a 4 cifre.

### Decisioni di scope adottate (default PRD §12)
- **Turnover**: nel nucleo, con fallback a 3 cifre flaggato `stimato`.
- **Colore treemap**: Confidence fisso (metrica regina sempre in primo piano).

---

## 5. Indicatori da scaricare (MVP)

Core (1 query/indicatore, tutte le classi, tutti gli anni):
`11110, 11210, 12110, 12150, 12170, 13310, 13320, 16110, 16130, 15110`

Dispersione/concentrazione (bonus, spesso oscurati a 4 cifre):
`E12110_Q1, E12110_Q2, E12110_Q3, E12110_STD`

→ ~10–14 query ISTAT totali, spaziate ≥15s ≈ 3–4 minuti di ingest, ban-safe.
