# Sfera

**Caratterizzatore settoriale dell'economia italiana.** Ricostruisce la mappa strutturale
dell'economia fino al livello ATECO 4 cifre (~615 classi reali), attacca a ogni settore un
nucleo di metriche economiche dure, e — soprattutto — dichiara apertamente **quanto** di ogni
scheda è completo (*Coverage*) e **quanto** deriva da osservazione diretta vs. stima (*Confidence*).

> La forza di Sfera non è sapere tutto di tutto: è **dichiarare onestamente quanto sa**.

Spesa dati: **zero** · Stack cloud: **zero** · LLM nel calcolo: **zero**. Tutto deterministico e ricostruibile da zero.

🔗 **Live:** https://mattialicciardi.github.io/sfera/

## Architettura a 4 livelli

| Livello | Cosa | Dove |
|---|---|---|
| **L1 — Dati** | 8 campi nucleo + valori grezzi | `pipeline/` → `sectors.json` |
| **L2 — Meta** | Coverage / Confidence (deterministici) | `pipeline/build.py` |
| **L3 — Viste** | lenti di ordinamento (Dimensione, Produttività, Redditività, Crescita, Frammentazione) | `web/` |
| **L4 — Ranking** | preset di pesi (Venture/PE/Imprenditore) | *roadmap v2* |

## Dato

- **Fonte primaria:** ISTAT SBS — *Risultati economici delle imprese (Ateco 4 cifre)*, dataflow SDMX `IT1,161_267_DF_DCSP_SBSNAZ_2,1.0`.
- **Granularità:** 16 sezioni → 77 divisioni → 239 gruppi → **539 classi a 4 cifre** (2015–2023).
- **Stato del dato:** letto nativamente dai flag ISTAT `OBS_STATUS` (`c`=oscurato→assente, `e`=stimato, vuoto→osservato).
- Vedi `docs/DATA-RECON.md` per la ricognizione verificata e le correzioni al PRD (es. Eurostat NON dà le 4 cifre; il segreto statistico colpisce solo ~3% delle classi).

### Campi nucleo (peso)
Dimensione (20) · Redditività (20) · Struttura (15) · Crescita (15) · Produttività (10) ·
Turnover (10, *assente a 4 cifre — roadmap v1.1*) · Concentrazione (5, *proxy non disponibile in questo dataflow*) · Qualità dato (5).

**Coverage** = % di peso su campi non assenti. **Confidence** = qualità media (osservato=1, stimato=0,5) sui campi presenti.

## Come si rigenera

```bash
# 1. scarica gli indicatori ISTAT (seriale, rispetta il rate limit 5/min — NON parallelizzare)
python3 pipeline/fetch_istat.py          # idempotente: salta i file già presenti

# 2. costruisci sectors.json (truth layer deterministico)
python3 pipeline/build.py                # -> data/processed/sectors.json + web/public/sectors.json

# 3. sito statico
cd web && npm install && npm run dev      # sviluppo
npm run build                             # -> web/dist/

# 4. deploy su GitHub Pages (branch gh-pages)
./deploy.sh                               # build + push -> https://mattialicciardi.github.io/sfera/
```

Il deploy NON rigenera i dati: usa `web/public/sectors.json` versionato. Per aggiornare i dati a un
nuovo rilascio ISTAT, lancia prima la pipeline (passi 1–2), committa, poi `./deploy.sh`.
Il token GitHub in uso non ha lo scope `workflow`, quindi il deploy è via script (no GitHub Actions);
per passare ad auto-deploy: `gh auth refresh -s workflow` e aggiungi un workflow Pages.

⚠️ **ISTAT SDMX: 5 query/minuto per IP, oltre → ban 1–2 giorni.** La pipeline spazia le query ≥16s.
Mai lanciarla in parallelo o con agenti concorrenti.

## Struttura

```
pipeline/   fetch_istat.py (ingest) · build.py (normalizza + score)
data/raw/   CSV grezzi ISTAT (gitignored) + DSD
data/processed/sectors.json   artefatto
web/        Vite + React + d3 (treemap decomponibile + tabella + Viste)
docs/       PRD.md · DATA-RECON.md
```

## North Star
> % dell'economia (pesata sul fatturato) a 4 cifre con Confidence ≥ 70 — la quota di economia di cui ci si può davvero fidare.

## Stato
MVP (v1) completo: L1 + L2 + L3. Fuori scope v1: L4 ranking personalizzati, modulo bilanci/concentrazione, multi-paese (NACE), auth/backend.
