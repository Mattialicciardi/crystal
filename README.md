# Crystal

> *(Crystal)* — sfera di cristallo per market intelligence: dalla mappa settoriale dell'economia europea fino alle singole aziende.

**Caratterizzatore settoriale dell'economia europea.** Ricostruisce la mappa strutturale di
un'economia nazionale settore per settore e attacca a ciascuno un nucleo di metriche economiche
dure (dimensione, produttività, redditività, struttura, crescita). Esplorabile come **treemap
decomponibile + tabella** con **filtro paese** su tutta Europa, più una modalità **Confronta
paesi** ("dove è più grande il mercato del settore X?").

🔗 **Live:** https://mattialicciardi.github.io/crystal/

**Quattro modalità:** *Esplora paese* (treemap + tabella), *Confronta paesi* (un settore su tutta Europa),
*Screener* (filtri → i settori che convengono: margine, concentrazione, trend, barriera),
*Mercato* (scrivi il PRD → i settori sono suggeriti in automatico, poi TAM/SAM/SOM come range + arena competitiva + cross-check europeo).

Spesa dati: **zero** · Stack cloud: **zero** · LLM nel calcolo: **zero**. Tutto deterministico e ricostruibile da zero.

## Dati

| Area | Fonte | Granularità | Anni |
|---|---|---|---|
| **Italia** | ISTAT SBS — *Risultati economici delle imprese*, dataflow SDMX `IT1,161_267_DF_DCSP_SBSNAZ_2,1.0` | **4 cifre ATECO** (539 classi) | 2015–2023 |
| **Resto d'Europa** (35 paesi + UE27) | Eurostat SBS — `sbs_sc_ovw` | **3 cifre NACE** (gruppo) | 2021–2024 |

> ⚠️ Le 4 cifre esistono solo per l'Italia (ISTAT). Eurostat si ferma a 3 cifre per tutti i paesi.
> Il confronto cross-country avviene quindi al livello comune (3 cifre).

I nomi settore sono in italiano per tutti i paesi (mappatura NACE → codelist ATECO ISTAT).
Vedi `docs/DATA-RECON.md` per la ricognizione verificata.

### Campi (treemap + tabella)
Fatturato · Valore aggiunto · VA/addetto (produttività) · MOL/VA (redditività) · Addetti/impresa
(struttura) · CAGR fatturato (crescita) · Occupati · Imprese.
Treemap: **area = dimensione** (commutabile), **colore = crescita (CAGR)**, diverging rosso→verde.

> Nota: `build.py` calcola ancora i meta-punteggi *Coverage* e *Confidence* (dai flag ISTAT), ma
> non sono mostrati nell'UI: a livello di totale-settore la Confidence è ~100 ovunque (poco
> informativa). Restano nei dati italiani per un eventuale uso a granularità più fine.

## Come si rigenera

```bash
# --- Italia (ISTAT, 4 cifre) ---
python3 pipeline/fetch_istat.py     # ingest SBS; SERIALE, rate limit 5/min → NON parallelizzare
python3 pipeline/fetch_sizeclass.py # distribuzione per classe di addetti (ISTAT+Eurostat) per la concentrazione
python3 pipeline/build.py           # -> data/processed/countries/IT.json + web/public/countries/IT.json
.venv/bin/pytest tests/             # test metriche Python (margine, trend, concentrazione, barriera)
node --test web/test/market.test.js # test motore Mercato (TAM/SAM/SOM)

# --- Resto d'Europa (Eurostat, 3 cifre) ---
python3 pipeline/fetch_eurostat.py  # 5 indicatori, tutti i paesi
python3 pipeline/build_europe.py    # -> countries/<GEO>.json + index.json (esegui DOPO build.py)

# --- sito statico ---
cd web && npm install && npm run dev   # sviluppo
./deploy.sh                            # build + deploy su GitHub Pages (branch gh-pages)
```

`./deploy.sh` NON rigenera i dati: usa i JSON versionati in `web/public/`. Per aggiornare i dati a un
nuovo rilascio, rilancia le pipeline, committa, poi `./deploy.sh`.
Il token GitHub in uso non ha lo scope `workflow` (niente GitHub Actions); per auto-deploy:
`gh auth refresh -s workflow` e aggiungi un workflow Pages.

⚠️ **ISTAT SDMX: 5 query/minuto per IP, oltre → ban 1–2 giorni.** `fetch_istat.py` spazia le query ≥16s.
Mai lanciarla in parallelo o con agenti concorrenti. Eurostat non ha questo limite.

## Struttura

```
pipeline/   fetch_istat.py · build.py (Italia 4 cifre)
            fetch_eurostat.py · build_europe.py (Europa 3 cifre + index)
data/raw/         dati grezzi (gitignored): CSV ISTAT, JSON-stat Eurostat, DSD
data/processed/   output (gitignored, derivato)
web/public/       countries/<GEO>.json + index.json  ← artefatti serviti
web/src/          Vite + React + d3 (treemap + tabella + Viste + filtro paese)
docs/             PRD.md · DATA-RECON.md
deploy.sh         build + push gh-pages
```

## Roadmap
- **L4 — ranking personalizzati**: preset di pesi (Venture/PE/Imprenditore).
- Modulo concentrazione (quartili/bilanci), turnover via demografia d'impresa.
- Auto-deploy via GitHub Actions (richiede scope `workflow` sul token).
