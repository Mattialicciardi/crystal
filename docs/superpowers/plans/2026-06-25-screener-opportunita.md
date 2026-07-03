# Screener Opportunità — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a Crystal un livello "opportunità" come **screener a filtri** (no punteggio composito, no forecast), con 4 nuovi segnali (margine, concentrazione size-class, trend di crescita, barriera) e spiegazioni contestuali dei campi.

**Architecture:** Estrarre i calcoli metrici in un modulo Python puro e testato (`pipeline/metrics.py`), usato sia da `build.py` (Italia 4 cifre) sia da `build_europe.py` (Europa 3 cifre). Aggiungere fetch della distribuzione per classe di addetti (Eurostat + ISTAT) per la concentrazione. Nel web: registro centrale delle metriche (`metrics.js`), componente `InfoDot`, e nuova modalità `Screener` con filtri range, ambito paese/Europa, risultati tabella, preset-scorciatoia.

**Tech Stack:** Python 3.14 + pytest (logica metrica); Vite + React + d3 (web); dati ISTAT SDMX + Eurostat JSON-stat.

**Riferimento spec:** `docs/superpowers/specs/2026-06-25-livello-opportunita-screener-design.md`

---

## File Structure

**Creati:**
- `pipeline/metrics.py` — funzioni pure: `gross_margin`, `value_added_per_worker`, `workers_per_firm`, `barrier_capex_per_worker`, `cagr`, `growth_trend`, `concentration`.
- `tests/test_metrics.py` — pytest per le funzioni sopra.
- `pipeline/fetch_sizeclass.py` — fetch distribuzione per classe di addetti (Eurostat + ISTAT).
- `web/src/metrics.js` — registro definizioni metriche (label, formula, caveat) + accessor condivisi.
- `web/src/components/InfoDot.jsx` — icona "i" + popover.
- `web/src/components/ScreenerView.jsx` — modalità screener.
- `web/src/components/Legend.jsx` — legenda/metodo espandibile.

**Modificati:**
- `pipeline/build.py` — usa `metrics.py`; aggiunge campi margine/concentrazione/trend/barriera a `IT.json`.
- `pipeline/build_europe.py` — idem per i paesi Eurostat + `compare.json` (campi nuovi, barriera null).
- `web/src/App.jsx` — terzo→quarto tab `Screener`; usa `metrics.js` per le colonne; `InfoDot` nelle intestazioni.
- `web/src/components/CompareView.jsx` — `InfoDot` sui chip metrica.
- `web/src/lib.js` — riusa accessor da `metrics.js` (evita duplicazione).
- `web/src/styles.css` — stili InfoDot, Screener, Legend.

---

## Task 1: Modulo metriche puro + test (TDD)

**Files:**
- Create: `pipeline/metrics.py`
- Test: `tests/test_metrics.py`

- [ ] **Step 1: Setup pytest**

```bash
cd /Users/mattialicciardi/Desktop/Progetti/crystal
python3 -m venv .venv
.venv/bin/pip install -q pytest
mkdir -p tests
```

- [ ] **Step 2: Write failing tests** in `tests/test_metrics.py`

```python
import math
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline import metrics as m

def test_gross_margin_basic():
    assert m.gross_margin(20.0, 100.0) == 0.2

def test_gross_margin_none_on_missing_or_zero():
    assert m.gross_margin(None, 100.0) is None
    assert m.gross_margin(20.0, 0) is None
    assert m.gross_margin(20.0, None) is None

def test_value_added_per_worker():
    assert m.value_added_per_worker(1000.0, 20) == 50.0
    assert m.value_added_per_worker(1000.0, 0) is None

def test_workers_per_firm():
    assert m.workers_per_firm(100, 25) == 4.0
    assert m.workers_per_firm(100, 0) is None

def test_barrier_capex_per_worker():
    assert m.barrier_capex_per_worker(500.0, 10) == 50.0
    assert m.barrier_capex_per_worker(None, 10) is None

def test_cagr():
    # 100 -> 121 in 2 anni = 10%/anno
    assert math.isclose(m.cagr({2020: 100, 2022: 121}), 0.1, rel_tol=1e-9)
    assert m.cagr({2020: 100}) is None          # un solo punto
    assert m.cagr({2020: 0, 2022: 100}) is None  # base nulla

def test_growth_trend_sostenuto():
    s = {2020: 100, 2021: 110, 2022: 121, 2023: 133}  # 3 YoY tutti positivi
    t = m.growth_trend(s)
    assert t["anni_crescita"] == 3
    assert t["label"] == "sostenuto"

def test_growth_trend_recente():
    s = {2020: 100, 2021: 95, 2022: 90, 2023: 99}  # solo l'ultimo cresce
    t = m.growth_trend(s)
    assert t["anni_crescita"] == 1
    assert t["label"] == "recente"

def test_growth_trend_in_calo():
    s = {2020: 100, 2021: 110, 2022: 105}  # ultimo YoY negativo
    t = m.growth_trend(s)
    assert t["label"] == "in_calo"

def test_growth_trend_gap_breaks_consecutive():
    s = {2018: 100, 2020: 110, 2021: 121}  # buco 2019: ultimi due consecutivi positivi
    t = m.growth_trend(s)
    assert t["anni_crescita"] == 1  # 2020->2021 ok; 2018->2020 non consecutivo

def test_concentration():
    c = m.concentration({"totale": 1000.0, "grandi": 600.0, "micro": 100.0})
    assert c["quota_grandi"] == 0.6
    assert c["quota_micro"] == 0.1

def test_concentration_none_on_missing_total():
    assert m.concentration({"totale": None, "grandi": 600.0}) is None

def test_concentration_partial():
    c = m.concentration({"totale": 1000.0, "grandi": None, "micro": 100.0})
    assert c["quota_grandi"] is None
    assert c["quota_micro"] == 0.1
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/test_metrics.py -q`
Expected: FAIL (ModuleNotFoundError: pipeline.metrics).

- [ ] **Step 4: Implement** `pipeline/metrics.py`

```python
"""Crystal — funzioni metriche pure e deterministiche (testate). Nessun I/O."""


def gross_margin(mol_keur, fatturato_keur):
    if mol_keur is None or not fatturato_keur:
        return None
    return mol_keur / fatturato_keur


def value_added_per_worker(va_keur, occupati):
    if va_keur is None or not occupati:
        return None
    return va_keur / occupati


def workers_per_firm(occupati, imprese):
    if occupati is None or not imprese:
        return None
    return occupati / imprese


def barrier_capex_per_worker(investimenti_keur, occupati):
    if investimenti_keur is None or not occupati:
        return None
    return investimenti_keur / occupati


def _points(series):
    return sorted((int(y), v) for y, v in series.items() if v is not None and v > 0)


def cagr(series):
    pts = _points(series)
    if len(pts) < 2:
        return None
    (y0, v0), (y1, v1) = pts[0], pts[-1]
    n = y1 - y0
    if n <= 0:
        return None
    return (v1 / v0) ** (1.0 / n) - 1.0


def growth_trend(series):
    pts = _points(series)
    if len(pts) < 2:
        return {"anni_crescita": 0, "momentum": None, "label": "nd"}
    yoy = []
    for (y0, v0), (y1, v1) in zip(pts, pts[1:]):
        yoy.append((y1, (v1 / v0 - 1.0) if y1 == y0 + 1 else None))
    n_consec = 0
    for _, g in reversed(yoy):
        if g is not None and g > 0:
            n_consec += 1
        else:
            break
    full = cagr(dict(pts))
    recent = cagr(dict(pts[-4:]))  # ultimi <=3 intervalli
    momentum = (recent - full) if (recent is not None and full is not None) else None
    last_g = yoy[-1][1]
    if last_g is None:
        label = "nd"
    elif last_g < 0:
        label = "in_calo"
    elif n_consec >= 3:
        label = "sostenuto"
    else:
        label = "recente"
    return {"anni_crescita": n_consec, "momentum": momentum, "label": label}


def concentration(by_size):
    tot = by_size.get("totale")
    if not tot:
        return None
    g = by_size.get("grandi")
    mi = by_size.get("micro")
    return {
        "quota_grandi": (g / tot) if g is not None else None,
        "quota_micro": (mi / tot) if mi is not None else None,
    }
```

Crea anche `pipeline/__init__.py` vuoto se non esiste (per l'import `from pipeline import metrics`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/test_metrics.py -q`
Expected: PASS (13 passed).

- [ ] **Step 6: Commit**

```bash
git add pipeline/metrics.py pipeline/__init__.py tests/ .gitignore
git commit -m "feat(pipeline): modulo metriche puro + test (margine, trend, concentrazione, barriera)"
```
(Assicurarsi che `.gitignore` contenga `.venv/` — già presente.)

---

## Task 2: Fetch distribuzione per classe di addetti

**Files:**
- Create: `pipeline/fetch_sizeclass.py`

Serve il fatturato per classe di addetti, per "grandi" (≥250) e "micro" (<10), oltre al totale già scaricato.

- [ ] **Step 1: Implement** `pipeline/fetch_sizeclass.py`

```python
"""Crystal — fetch distribuzione per classe di addetti (per la concentrazione).
Eurostat: NETTUR_MEUR per GE250 e 0-9 (1 query). ISTAT: 12110 con tutte le classi (1 query, rate-limit)."""
import subprocess
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)


def fetch_eurostat_sizeclass():
    out = RAW / "eurostat_NETTUR_MEUR_bysize.json"
    if out.exists() and out.stat().st_size > 5000:
        return f"skip ({out.stat().st_size}b)"
    url = ("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw"
           "?format=JSON&lang=EN&indic_sbs=NETTUR_MEUR&size_emp=GE250&size_emp=0-9")
    r = subprocess.run(["curl", "-sS", "-m", "180", "-o", str(out),
                        "-w", "%{http_code} %{size_download}", url], capture_output=True, text=True)
    return (r.stdout or "ERR").strip()


def fetch_istat_sizeclass():
    out = RAW / "istat_12110_bysize.csv"
    if out.exists() and out.stat().st_size > 1000:
        return f"skip ({out.stat().st_size}b)"
    flow = "IT1,161_267_DF_DCSP_SBSNAZ_3,1.0"  # variante CON classe di addetti
    key = "A.IT.12110...9.9"  # PERS_EMPL_SIZE_CLASS non filtrato = tutte le classi
    url = f"https://esploradati.istat.it/SDMXWS/rest/data/{flow}/{key}?startPeriod=2015"
    r = subprocess.run(["curl", "-sS", "-kL", "--compressed", "-A", "Mozilla/5.0 (crystal)",
                        "-m", "240", "-H", "Accept: application/vnd.sdmx.data+csv;version=1.0.0",
                        "-o", str(out), "-w", "%{http_code} %{size_download}", url],
                       capture_output=True, text=True)
    return (r.stdout or "ERR").strip()


if __name__ == "__main__":
    print("Eurostat by-size:", fetch_eurostat_sizeclass())
    print("ISTAT by-size (rate-limit: una sola query):", fetch_istat_sizeclass())
```

> NOTA esecuzione: la dataflow ISTAT con classe di addetti è `..._3` (verificata in DATA-RECON). Se il key dà 0 righe o errore, ispezionare i codici di `CL_CLLVT` nella DSD (`data/raw/istat_dsd.xml`) per i codici esatti di "≥250" (`W_GE250`) e "0-9" (`W0_9`) e, se serve, scaricare le due classi separatamente con 2 query spaziate ≥16s.

- [ ] **Step 2: Run the fetch and inspect**

Run:
```bash
.venv/bin/python pipeline/fetch_sizeclass.py
.venv/bin/python - <<'PY'
import csv, collections
rows=list(csv.DictReader(open('data/raw/istat_12110_bysize.csv')))
sizes=collections.Counter(r['PERS_EMPL_SIZE_CLASS'] for r in rows)
print('classi addetti ISTAT presenti:', dict(sizes))
PY
```
Expected: HTTP 200 per Eurostat; il CSV ISTAT elenca i codici classe (cercare quello dei 250+ e dei 0-9). Annotare i codici reali per il Task 3.

- [ ] **Step 3: Commit**

```bash
git add pipeline/fetch_sizeclass.py
git commit -m "feat(pipeline): fetch distribuzione per classe di addetti (Eurostat + ISTAT)"
```

---

## Task 3: Integrare i nuovi campi nel build

**Files:**
- Modify: `pipeline/build.py` (Italia)
- Modify: `pipeline/build_europe.py` (Europa + compare.json)

Obiettivo: ogni settore guadagna `fields.margine`, `concentrazione {quota_grandi, quota_micro}`, `trend {anni_crescita, momentum, label}`, `barriera {value}`.

- [ ] **Step 1: build.py — importa metrics e size-class**

In testa a `build.py`: `from pipeline import metrics as M` (o `import metrics as M` con sys.path). Caricare il CSV `istat_12110_bysize.csv` in una mappa `nace -> {size_code: latest_value}` e ridurre a `{totale, grandi, micro}` usando i codici reali annotati nel Task 2 (es. `W_GE250`, `W0_9`, `TOTAL`).

Per ogni settore aggiungere:
```python
fields["margine"] = field(M.gross_margin(mol, fatt), worst_state(mol_s, fatt_s) if (mol is not None and fatt) else "assente", "ISTAT MOL/fatturato", fatt_y)
conc = M.concentration(size_map.get(code, {}))
sector["concentrazione"] = conc  # {quota_grandi, quota_micro} o None
sector["trend"] = M.growth_trend({y: v for y,(v,s) in data["12110"].get(code,{}).get("series",{}).items()})
inv, inv_s, _ = latest("15110")
sector["barriera"] = {"value": M.barrier_capex_per_worker(inv, occ)}
```
(adattare ai nomi/strutture reali già presenti in build.py; `field()` e `worst_state()` esistono già.)

- [ ] **Step 2: build_europe.py — stessi campi dai dati Eurostat**

Caricare `eurostat_NETTUR_MEUR_bysize.json` (size GE250 + 0-9) in `nace -> geo -> {grandi, micro}`; il totale è già in `data["NETTUR_MEUR"]`. Per ogni settore:
```python
e["fields"]["margine"] = field(M.gross_margin(gos, fatt))   # gos, fatt = M€ -> il rapporto è adimensionale
e["concentrazione"] = M.concentration({"totale": fatt, "grandi": grandi, "micro": micro})
e["trend"] = M.growth_trend(ser["NETTUR_MEUR"])
e["barriera"] = {"value": None}   # Eurostat non ha investimenti
```
Aggiungere gli stessi campi anche dentro `add_to_compare` (così `compare.json` espone margine/concentrazione/trend/barriera per ogni paese).

- [ ] **Step 3: Rigenera e verifica**

Run:
```bash
.venv/bin/python pipeline/build.py
.venv/bin/python pipeline/build_europe.py
.venv/bin/python - <<'PY'
import json
it=json.load(open('web/public/countries/IT.json'))
s=[x for x in it['sectors'] if x['code']=='6201'] or [x for x in it['sectors'] if x['level']=='class']
x=s[0]
print('esempio', x['code'], 'margine', x['fields'].get('margine',{}).get('value'),
      'conc', x.get('concentrazione'), 'trend', x.get('trend'), 'barriera', x.get('barriera'))
# quante classi hanno concentrazione (misura segreto su size-class)
cl=[c for c in it['sectors'] if c['level']=='class']
have=sum(1 for c in cl if c.get('concentrazione') and c['concentrazione'].get('quota_grandi') is not None)
print(f'concentrazione disponibile su {have}/{len(cl)} classi 4 cifre')
PY
```
Expected: i campi popolati su Italia; stampato quante classi hanno la concentrazione (atteso: meno dei totali, per il segreto statistico — è ok e dichiarato).

- [ ] **Step 4: Commit**

```bash
git add pipeline/build.py pipeline/build_europe.py web/public/
git commit -m "feat(build): integra margine, concentrazione, trend, barriera nei dataset"
```

---

## Task 4: Registro metriche + InfoDot (web)

**Files:**
- Create: `web/src/metrics.js`
- Create: `web/src/components/InfoDot.jsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Implement** `web/src/metrics.js`

```javascript
import { fmtMoneyKeur, fmtCount, fmtPct, fmtRatio } from './lib.js'

// Registro unico: id -> { label, get, fmt, info }
export const METRICS = {
  fatturato:    { label: 'Fatturato',      get: s => s.raw.fatturato_keur,           fmt: fmtMoneyKeur,
    info: 'Fatturato annuo del settore. Fonte: ISTAT/Eurostat. Osservato.' },
  valore_agg:   { label: 'Valore aggiunto', get: s => s.raw.valore_aggiunto_keur,     fmt: fmtMoneyKeur,
    info: 'Valore aggiunto al costo dei fattori. Osservato.' },
  produttivita: { label: 'VA / addetto',   get: s => s.fields.produttivita.value,    fmt: fmtMoneyKeur,
    info: 'Valore aggiunto diviso gli occupati: produttività apparente del lavoro (migliaia di € per addetto).' },
  margine:      { label: 'Margine (MOL/fatt.)', get: s => s.fields.margine?.value,    fmt: fmtPct,
    info: 'Margine operativo lordo su fatturato: potere di prezzo / vantaggio di costo. Alto = settore con margini; basso = spremuto.' },
  struttura:    { label: 'Add. / impresa', get: s => s.fields.struttura.value,        fmt: fmtRatio,
    info: 'Addetti per impresa: misura la frammentazione. Basso = tante piccole imprese; alto = poche grandi.' },
  crescita:     { label: 'CAGR fatt.',     get: s => s.fields.crescita.value,         fmt: fmtPct,
    info: 'Crescita media annua composta del fatturato sull’orizzonte disponibile. Retrospettiva, non una previsione.' },
  trend:        { label: 'Trend crescita', get: s => s.trend?.anni_crescita,          fmt: v => v == null ? '—' : `${v} anni`,
    info: 'Anni consecutivi di crescita (dal più recente). ≥3 = trend sostenuto; 1–2 = recente; ultimo anno in calo = in calo. Solo dati passati, nessuna proiezione.' },
  conc_grandi:  { label: 'Quota grandi',   get: s => s.concentrazione?.quota_grandi,  fmt: fmtPct,
    info: 'Quota del fatturato nelle imprese ≥250 addetti: quanto il mercato è dominato dai grandi. NON è l’HHI azienda-per-azienda (quello richiede dati di bilancio a pagamento).' },
  conc_micro:   { label: 'Quota micro',    get: s => s.concentrazione?.quota_micro,   fmt: fmtPct,
    info: 'Quota del fatturato nelle micro-imprese (<10 addetti): quanto il mercato è polverizzato.' },
  barriera:     { label: 'Barriera (cap./add.)', get: s => s.barriera?.value,         fmt: fmtMoneyKeur,
    info: 'Investimenti per addetto: proxy della barriera d’ingresso / capitale necessario. Pieno per l’Italia; non disponibile per gli altri paesi (Eurostat non pubblica gli investimenti).' },
  occupati:     { label: 'Occupati',       get: s => s.raw.occupati,                  fmt: fmtCount,
    info: 'Persone occupate nel settore. Osservato.' },
  imprese:      { label: 'Imprese',        get: s => s.raw.imprese,                   fmt: fmtCount,
    info: 'Numero di imprese attive nel settore. Osservato.' },
}
```

- [ ] **Step 2: Implement** `web/src/components/InfoDot.jsx`

```javascript
import { useState, useRef, useEffect } from 'react'

export default function InfoDot({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])
  return (
    <span className="infodot" ref={ref}>
      <button className="infodot-btn" aria-label="spiegazione" onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}>i</button>
      {open && <span className="infodot-pop" onClick={(e) => e.stopPropagation()}>{text}</span>}
    </span>
  )
}
```

- [ ] **Step 3: Add styles** in `web/src/styles.css`

```css
.infodot { position: relative; display: inline-flex; margin-left: 4px; }
.infodot-btn { width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--line); background: var(--panel2); color: var(--mut); font-size: 9px; font-style: italic; font-weight: 700; cursor: pointer; line-height: 1; padding: 0; }
.infodot-btn:hover { color: var(--teal); border-color: var(--teal); }
.infodot-pop { position: absolute; top: 18px; left: 0; z-index: 20; width: 260px; background: #0f1623; border: 1px solid var(--line); border-radius: 8px; padding: 9px 11px; font-size: 11.5px; font-weight: 400; color: var(--txt); line-height: 1.45; text-transform: none; letter-spacing: 0; box-shadow: 0 8px 24px #0008; white-space: normal; }
```

- [ ] **Step 4: Verify in browser** (dev server già attivo su :5173)

Inserire temporaneamente un `<InfoDot text="prova" />` in App e via preview_screenshot/preview_click verificare apertura/chiusura. Poi rimuovere il test temporaneo.

- [ ] **Step 5: Commit**

```bash
git add web/src/metrics.js web/src/components/InfoDot.jsx web/src/styles.css
git commit -m "feat(web): registro metriche + componente InfoDot"
```

---

## Task 5: Modalità Screener

**Files:**
- Create: `web/src/components/ScreenerView.jsx`
- Modify: `web/src/App.jsx` (aggiungi tab Screener)
- Modify: `web/src/styles.css`

- [ ] **Step 1: Implement** `web/src/components/ScreenerView.jsx`

Comportamento:
- Stato: `scope` ('paese'|'europa'), `filters` (mappa metricId -> {min, max}), `sortKey`, `preset`.
- Dati: in `paese` usa il dataset del paese selezionato (passato come prop `data` + `country`); in `europa` carica `compare.json` e costruisce le righe settore×paese.
- Filtri: per ogni metrica del set screener, due input numerici (min/max). `barriera` disabilitata se scope=europa o country≠IT.
- Match: una riga passa se per ogni filtro attivo `min<=valore<=max` (valore null ⇒ esclusa solo se quel filtro è attivo).
- Risultati: tabella ordinabile con le colonne metrica (usando `METRICS`), contatore match, ogni intestazione con `InfoDot`.
- Preset: bottoni che impostano `filters` (Bootstrapper/Venture/Value) — vedi spec.

Set metriche screener: `['fatturato','crescita','trend','margine','produttivita','struttura','conc_grandi','barriera']`.

Preset (impostano filtri; soglie iniziali ragionevoli, l’utente le ritocca):
```javascript
const PRESETS = {
  bootstrapper: { struttura: {max: 5}, margine: {min: 0.15}, barriera: {max: 50} },
  venture:      { trend: {min: 3}, struttura: {max: 8}, crescita: {min: 0.05} },
  value:        { margine: {min: 0.2}, conc_grandi: {min: 0.4}, fatturato: {min: 1_000_000} },
}
```

Struttura JSX: pannello filtri (sopra) + tabella risultati (sotto), legenda in fondo (`<Legend/>`). Riusare classi `.controls/.chip/.grid` esistenti dove possibile.

- [ ] **Step 2: Wire in App.jsx**

Aggiungere `'screener'` ai modi: terzo bottone "Screener" nel `.modes`. Quando `mode==='screener'` renderizzare `<ScreenerView data={data} country={country} countries={countries} />`. Le colonne di Esplora/Confronta migrano a `METRICS` (Task 6) ma lo Screener le usa già.

- [ ] **Step 3: Verify in browser**

Via preview: passare a Screener, impostare un filtro (es. crescita min 0.05), verificare il contatore match e l’ordinamento; provare un preset; passare scope a Europa e verificare le righe settore×paese; verificare che barriera sia disabilitata in Europa.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ScreenerView.jsx web/src/App.jsx web/src/styles.css
git commit -m "feat(web): modalità Screener a filtri (paese + Europa, preset, no punteggio composito)"
```

---

## Task 6: InfoDot + Legenda in tutte le viste

**Files:**
- Create: `web/src/components/Legend.jsx`
- Modify: `web/src/App.jsx` (colonne Esplora da `METRICS`, InfoDot nelle intestazioni, Legend in fondo)
- Modify: `web/src/components/CompareView.jsx` (InfoDot sui chip metrica)

- [ ] **Step 1: Implement** `web/src/components/Legend.jsx`

```javascript
import { METRICS } from '../metrics.js'

export default function Legend({ ids }) {
  return (
    <details className="legend-box">
      <summary>Legenda / Metodo — cosa significano le colonne</summary>
      <dl>
        {ids.map(id => (
          <div key={id}><dt>{METRICS[id].label}</dt><dd>{METRICS[id].info}</dd></div>
        ))}
      </dl>
    </details>
  )
}
```
Stili `.legend-box` in styles.css (summary cliccabile, dl a due colonne).

- [ ] **Step 2: Esplora — colonne da METRICS + InfoDot**

In `App.jsx` sostituire l’array `COLS` con riferimenti a `METRICS` (id), e nelle intestazioni di colonna affiancare `<InfoDot text={METRICS[id].info} />`. Aggiungere `<Legend ids={[...colonne...]} />` in fondo alla vista Esplora.

- [ ] **Step 3: Confronta — InfoDot sui chip metrica**

In `CompareView.jsx` affiancare un `InfoDot` alla metrica selezionata (o a ogni chip) usando `METRICS[...].info`.

- [ ] **Step 4: Verify in browser**

Via preview: in Esplora cliccare la "i" su "Margine"/"VA/addetto" → popover con definizione; aprire la Legenda in fondo; ripetere in Confronta e Screener.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Legend.jsx web/src/App.jsx web/src/components/CompareView.jsx web/src/styles.css
git commit -m "feat(web): info contestuale (i) + legenda metodo in Esplora/Confronta/Screener"
```

---

## Task 7: Verifica finale + deploy

- [ ] **Step 1: Test suite verde**

Run: `.venv/bin/pytest tests/ -q` → PASS.

- [ ] **Step 2: Verifica browser end-to-end**

Esplora (IT 4 cifre): nuove colonne popolate, InfoDot, Legenda. Confronta: invariato + InfoDot. Screener: filtri AND, preset, scope paese↔Europa, barriera disabilitata in Europa, contatore match. Console senza errori.

- [ ] **Step 3: Deploy**

Run: `./deploy.sh` → attendere propagazione Pages (può richiedere 3-5 min), poi `curl` di `index.json` e `compare.json` per confermare 200.

- [ ] **Step 4: Commit finale + memoria**

```bash
git add -A && git commit -m "feat: livello opportunità (Screener) live" && git push origin main
```
Aggiornare `docs/DATA-RECON.md` con i codici classe-addetti reali e la copertura concentrazione misurata; aggiornare la memoria di progetto.

---

## Note di esecuzione
- **ISTAT rate limit 5/min → ban 1–2 giorni**: i fetch size-class sono seriali, mai paralleli, mai con agenti concorrenti.
- Le date in script (`date`) sono ammesse; nei workflow no.
- Granularità mista (IT 4 cifre / Europa 3 cifre) già gestita dal front-end via `hasChildren`/`max_level`.
