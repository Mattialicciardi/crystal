# Crystal

Mappa dei settori italiani sui conti strutturali delle imprese.

🔗 **Live:** https://mattialicciardi.github.io/crystal/

Si parte dalle sezioni e si scende a divisione, gruppo e classe. La tabella mostra i conti ufficiali
Eurostat e, solo quando entrambi gli ingredienti sono pubblicati, qualche rapporto calcolato.
Le celle riservate restano «riservato». I numeri descrivono la struttura del settore.

## Dati

| | |
|---|---|
| Fonte | Eurostat Structural Business Statistics, dataset [`sbs_ovw_act`](https://ec.europa.eu/eurostat/databrowser/view/sbs_ovw_act/default/table?lang=en) |
| Estratto | geo=IT, anni 2023 e 2024. Aggiornamento del file: 30 settembre 2026 |
| Classificazione | NACE Rev. 2 = prime 4 cifre di ATECO 2007. Non è ATECO 2025 |
| Titoli | italiano, codelist ISTAT `CL_ATECO_2007` |
| Produttore nazionale | ISTAT, che trasmette le SBS a Eurostat |
| Totale | aggregato ufficiale `B-S_X_O_S94`, economia delle imprese |

Granularità pubblicata per l'Italia in questo estratto: 16 sezioni, 80 divisioni, 246 gruppi, 547 classi.
Nel 2023 il fatturato è pubblicato per 527 classi. Mancano i totali di sezione A, O e S.
K ha imprese e addetti; i conti di bilancio sono riservati. Alcune divisioni di S sono presenti senza il totale di sezione.

Indicatori ufficiali: imprese, addetti, fatturato, acquisti di beni e servizi, valore aggiunto,
retribuzioni, MOL, investimenti lordi in attività materiali, costo del lavoro per addetto,
fatturato per addetto, GOR (MOL/fatturato). Gli acquisti non sono tutti i costi. Le retribuzioni
non sono il costo del lavoro completo.

File: `data/sbs/sbs_ovw_act_IT.csv` → `python3 pipeline/build_sbs_it.py` → `web/public/sbs-it.json`.

I JSON europei precedenti (`web/public/countries/`) restano nel repository e non sono la schermata principale:
arrivano da un altro dataset e da un'altra granularità.

## Come si rigenera

```bash
python3 pipeline/build_sbs_it.py     # CSV Eurostat + titoli ATECO 2007 → web/public/sbs-it.json
python3 -m pytest tests/             # totali ufficiali, celle riservate, rapporti calcolati
cd web && npm install && npm test && npm run dev
./deploy.sh                          # build + push del branch gh-pages
```

`./deploy.sh` non riscarica Eurostat. GitHub Pages pubblica il branch `gh-pages` (radice) su
https://mattialicciardi.github.io/crystal/ . Vite tiene `base: './'`.

Per un estratto nuovo, sostituire `data/sbs/sbs_ovw_act_IT.csv` con la risposta di:

`https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/sbs_ovw_act/A..<INDIC>.IT?startPeriod=2023&endPeriod=2024&format=SDMX-CSV`

Le pipeline ISTAT/Eurostat precedenti (`fetch_istat.py`, `fetch_eurostat.py`, `build.py`, `build_europe.py`)
ricostruiscono i JSON in `web/public/countries/`. ISTAT SDMX resta limitato a 5 query/minuto.

## Struttura

```
data/sbs/         estratto sbs_ovw_act Italia + titoli ATECO 2007
pipeline/build_sbs_it.py
web/public/sbs-it.json
web/src/          Vite + React, mappa sezioni → classi
deploy.sh         build + push gh-pages
```

## Roadmap
- **L4 — ranking personalizzati**: preset di pesi (Venture/PE/Imprenditore).
- Modulo concentrazione (quartili/bilanci), turnover via demografia d'impresa.
- Auto-deploy via GitHub Actions (richiede scope `workflow` sul token).
