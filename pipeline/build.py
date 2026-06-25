#!/usr/bin/env python3
"""
Sfera — truth layer deterministico.

Legge i CSV grezzi ISTAT (data/raw/istat_*.csv) + la DSD per l'albero ATECO,
calcola gli 8 campi nucleo con stato {osservato, stimato, assente}, i campi
derivati (con propagazione dello stato peggiore), e i meta-punteggi
Coverage / Confidence secondo i pesi del PRD. Emette data/processed/sectors.json.

Principio: ogni numero ricostruibile da zero, nessun override manuale invisibile.
Nessun LLM nel truth layer.
"""
import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

try:
    from pipeline import metrics as M
except ImportError:
    import metrics as M

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed" / "countries" / "IT.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- pesi PRD
WEIGHTS = {
    "dimensione": 20,
    "redditivita": 20,
    "struttura": 15,
    "crescita": 15,
    "produttivita": 10,
    "turnover": 10,
    "concentrazione": 5,
    "qualita_dato": 5,
}
STATE_VALUE = {"osservato": 1.0, "stimato": 0.5, "assente": 0.0}

# DATA_TYPE -> nome file (allineato a fetch_istat.py)
INDICATORS = {
    "11110": "imprese",
    "11210": "unita_locali",
    "12110": "fatturato",
    "12150": "valore_aggiunto",
    "12170": "mol",
    "13310": "costi_personale",
    "13320": "salari",
    "16110": "occupati",
    "16130": "dipendenti",
    "15110": "investimenti",
    "E12110_Q1": "fatt_q1",
    "E12110_Q3": "fatt_q3",
    "E12110_STD": "fatt_std",
}

# mappa flag ISTAT -> stato Sfera
FLAG_STATE = {
    "": "osservato", "p": "osservato", "r": "osservato", "b": "osservato",
    "e": "stimato", "f": "stimato", "i": "stimato",
    "c": "assente", "g": "assente", "n": "assente", "u": "assente",
}

# sezioni ATECO 2007: lettera -> range divisioni (per derivare il padre di sezione)
SECTION_RANGES = {
    "A": (1, 3), "B": (5, 9), "C": (10, 33), "D": (35, 35), "E": (36, 39),
    "F": (41, 43), "G": (45, 47), "H": (49, 53), "I": (55, 56), "J": (58, 63),
    "K": (64, 66), "L": (68, 68), "M": (69, 75), "N": (77, 82), "O": (84, 84),
    "P": (85, 85), "Q": (86, 88), "R": (90, 93), "S": (94, 96), "T": (97, 98),
    "U": (99, 99),
}
# sezioni fuori copertura SBS (nascono a coverage zero): K finanza, O PA, div.94
EXCLUDED_SECTIONS = {"K", "O"}


def flag_to_state(flag: str) -> str:
    return FLAG_STATE.get((flag or "").strip().lower(), "stimato")


def section_of_division(div2: str):
    try:
        n = int(div2)
    except ValueError:
        return None
    for sec, (lo, hi) in SECTION_RANGES.items():
        if lo <= n <= hi:
            return sec
    return None


# ----------------------------------------------------- albero ATECO da DSD
def strip_ns(tag: str) -> str:
    return re.sub(r"\{[^}]*\}", "", tag)


def name_of(el) -> str:
    names = {ch.get("{http://www.w3.org/XML/1998/namespace}lang"): (ch.text or "").strip()
             for ch in el if strip_ns(ch.tag) == "Name"}
    return names.get("it") or names.get("en") or next((v for v in names.values() if v), "")


def ateco_level(code: str):
    """Ritorna ('section'|'div'|'group'|'class'|None, parent_code|None)."""
    if code is None:
        return None, None
    if re.fullmatch(r"[A-Z]", code):
        return "section", None
    digits = re.sub(r"\D", "", code)
    if code.startswith("00"):           # aggregati economici speciali (TOTALE, beni intermedi...)
        return None, None
    if len(digits) == 2:
        return "div", section_of_division(code)
    if len(digits) == 3:
        return "group", code[:2]
    if len(digits) == 4:
        return "class", code[:3]
    return None, None


def load_ateco_names(dsd_path: Path) -> dict:
    names = {}
    if not dsd_path.exists():
        return names
    root = ET.fromstring(dsd_path.read_bytes())
    for el in root.iter():
        if strip_ns(el.tag) == "Codelist" and el.get("id") == "CL_ATECO_2007":
            for c in el:
                if strip_ns(c.tag) == "Code":
                    names[c.get("id")] = name_of(c)
            break
    return names


# ------------------------------------------------------- lettura indicatori
def load_indicator(path: Path):
    """nace -> {'series': {year: (val, state)}, 'latest': (year, val, state)}."""
    if not path.exists() or path.stat().st_size < 200:
        return {}
    out = {}
    with path.open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    by_nace = defaultdict(dict)
    for r in rows:
        nace = r.get("ECON_ACTIVITY_NACE_2007")
        year = r.get("TIME_PERIOD")
        raw = (r.get("OBS_VALUE") or "").strip()
        state = flag_to_state(r.get("OBS_STATUS"))
        val = None
        if raw:
            try:
                val = float(raw)
            except ValueError:
                val = None
        if val is None:
            state = "assente"
        by_nace[nace][year] = (val, state)
    for nace, series in by_nace.items():
        years = sorted(series.keys())
        latest = None
        for y in reversed(years):
            v, s = series[y]
            if v is not None:
                latest = (y, v, s)
                break
        if latest is None and years:
            latest = (years[-1], None, "assente")
        out[nace] = {"series": series, "latest": latest}
    return out


def worst_state(*states) -> str:
    order = {"assente": 0, "stimato": 1, "osservato": 2}
    present = [s for s in states if s]
    if not present:
        return "assente"
    return min(present, key=lambda s: order.get(s, 0))


def cagr(series: dict):
    """CAGR sull'orizzonte disponibile (valori non assenti). -> (rate, state, n_anni)."""
    pts = [(int(y), v) for y, (v, s) in series.items() if v not in (None, 0) and s != "assente"]
    pts.sort()
    if len(pts) < 2:
        return None, "assente", 0
    (y0, v0), (y1, v1) = pts[0], pts[-1]
    n = y1 - y0
    if n <= 0 or v0 <= 0 or v1 <= 0:
        return None, "assente", 0
    rate = (v1 / v0) ** (1.0 / n) - 1.0
    state = "osservato" if n >= 4 else "stimato"
    return rate, state, n


def field(value, state, source, year, unit=None):
    return {"value": value, "state": state, "source": source, "year": year, "unit": unit}


def safe_div(a, b):
    return a / b if (a is not None and b not in (None, 0)) else None


def load_sizeclass(path):
    """CSV SBS per una singola classe di addetti -> {nace: ultimo valore non oscurato (keur)}."""
    out = {}
    if not path.exists():
        return out
    by = defaultdict(dict)
    for r in csv.DictReader(path.open(encoding="utf-8")):
        v = (r.get("OBS_VALUE") or "").strip()
        if v:
            try:
                by[r["ECON_ACTIVITY_NACE_2007"]][r["TIME_PERIOD"]] = float(v)
            except ValueError:
                pass
    for nace, series in by.items():
        if series:
            out[nace] = series[max(series)]
    return out


def build():
    names = load_ateco_names(RAW / "istat_dsd.xml")
    data = {dt: load_indicator(RAW / f"istat_{dt}_{name}.csv")
            for dt, name in INDICATORS.items()}

    have = [INDICATORS[dt] for dt, d in data.items() if d]
    print(f"Indicatori caricati ({len(have)}/{len(INDICATORS)}): {', '.join(have)}")
    grandi = load_sizeclass(RAW / "istat_12110_grandi.csv")
    micro = load_sizeclass(RAW / "istat_12110_micro.csv")
    print(f"Size-class: grandi={len(grandi)} micro={len(micro)} (per concentrazione)")

    # universo NACE: unione dei codici visti negli indicatori dimensionali presenti
    universe = set()
    for dt in ("12110", "16110", "11110", "12150"):
        universe |= set(data.get(dt, {}).keys())
    universe = {c for c in universe if ateco_level(c)[0] is not None}

    latest_year = 0
    sectors = []
    for code in sorted(universe):
        level, parent = ateco_level(code)
        section = code if level == "section" else (
            parent if level == "div" else None)
        # risali alla sezione
        sec = None
        if level == "section":
            sec = code
        elif level == "div":
            sec = parent
        elif level == "group":
            sec = section_of_division(code[:2])
        elif level == "class":
            sec = section_of_division(code[:2])

        def latest(dt):
            rec = data.get(dt, {}).get(code)
            if not rec or not rec["latest"]:
                return None, "assente", None
            y, v, s = rec["latest"]
            return v, s, y

        fatt, fatt_s, fatt_y = latest("12110")
        va, va_s, va_y = latest("12150")
        mol, mol_s, _ = latest("12170")
        occ, occ_s, occ_y = latest("16110")
        imp, imp_s, imp_y = latest("11110")
        dip, dip_s, _ = latest("16130")
        costp, costp_s, _ = latest("13310")
        inv, inv_s, _ = latest("15110")
        for yy in (fatt_y, va_y, occ_y, imp_y):
            if yy:
                latest_year = max(latest_year, int(yy))

        # ---- campi nucleo
        fields = {}
        excluded = sec in EXCLUDED_SECTIONS

        # Dimensione: fatturato (fallback VA / occupati)
        if not excluded and fatt is not None:
            fields["dimensione"] = field(fatt, fatt_s, "ISTAT 12110 fatturato", fatt_y, "keur")
        elif not excluded and va is not None:
            fields["dimensione"] = field(va, va_s, "ISTAT 12150 valore aggiunto", va_y, "keur")
        else:
            fields["dimensione"] = field(None, "assente", "ISTAT 12110", None, "keur")

        # Redditivita: MOL/VA
        red = safe_div(mol, va)
        fields["redditivita"] = field(
            round(red, 4) if red is not None else None,
            "assente" if excluded else worst_state(mol_s, va_s) if red is not None else "assente",
            "ISTAT 12170/12150 (MOL/VA)", va_y)

        # Struttura: addetti per impresa
        struc = safe_div(occ, imp)
        fields["struttura"] = field(
            round(struc, 2) if struc is not None else None,
            "assente" if excluded else worst_state(occ_s, imp_s) if struc is not None else "assente",
            "ISTAT 16110/11110 (addetti/impresa)", occ_y)

        # Produttivita: VA per addetto
        prod = safe_div(va, occ)
        fields["produttivita"] = field(
            round(prod, 2) if prod is not None else None,
            "assente" if excluded else worst_state(va_s, occ_s) if prod is not None else "assente",
            "ISTAT 12150/16110 (VA/addetto, keur)", va_y, "keur")

        # Margine: MOL/fatturato (potere di prezzo)
        mar = M.gross_margin(mol, fatt)
        fields["margine"] = field(
            round(mar, 4) if mar is not None else None,
            "assente" if excluded else worst_state(mol_s, fatt_s) if mar is not None else "assente",
            "ISTAT 12170/12110 (MOL/fatturato)", fatt_y)

        # Crescita: CAGR fatturato
        rec_f = data.get("12110", {}).get(code)
        if not excluded and rec_f:
            rate, gstate, n = cagr(rec_f["series"])
            fields["crescita"] = field(
                round(rate, 4) if rate is not None else None, gstate,
                f"ISTAT 12110 CAGR ({n} anni)", latest_year or None, "rate")
        else:
            fields["crescita"] = field(None, "assente", "ISTAT 12110 CAGR", None, "rate")

        # Turnover: non in SBS -> assente (fallback demografia d'impresa = roadmap v1.1)
        fields["turnover"] = field(None, "assente", "demografia d'impresa (non ancora agganciata)", None)

        # Concentrazione: dispersione fatturato Q3/Q1 (proxy), best effort
        q1, q1_s, _ = latest("E12110_Q1")
        q3, q3_s, _ = latest("E12110_Q3")
        disp = safe_div(q3, q1)
        if not excluded and disp is not None:
            fields["concentrazione"] = field(round(disp, 3), worst_state(q1_s, q3_s),
                                             "ISTAT E12110 Q3/Q1 (dispersione fatturato)", fatt_y, "ratio")
        else:
            fields["concentrazione"] = field(None, "assente", "proxy dispersione (quartili)", None, "ratio")

        # Qualita dato: meta -> osservato se il settore ha almeno la dimensione osservata
        qstate = fields["dimensione"]["state"] if fields["dimensione"]["value"] is not None else "assente"
        fields["qualita_dato"] = field(1.0 if qstate != "assente" else None, qstate, "derivato dai flag", latest_year or None)

        # ---- nuovi segnali opportunità (top-level del settore)
        conc = None if excluded else M.concentration({
            "totale": fatt, "grandi": grandi.get(code), "micro": micro.get(code)})
        trend_series = {y: v for y, (v, st) in rec_f["series"].items()} if rec_f else {}
        trend = M.growth_trend(trend_series)
        barriera = {"value": None if excluded else M.barrier_capex_per_worker(inv, occ)}

        # ---- Coverage / Confidence
        tot_w = sum(WEIGHTS.values())
        cov_num = sum(w for k, w in WEIGHTS.items() if fields[k]["state"] != "assente")
        coverage = 100.0 * cov_num / tot_w
        conf_den = sum(w for k, w in WEIGHTS.items() if fields[k]["state"] != "assente")
        conf_num = sum(w * STATE_VALUE[fields[k]["state"]]
                       for k, w in WEIGHTS.items() if fields[k]["state"] != "assente")
        confidence = (100.0 * conf_num / conf_den) if conf_den else 0.0

        sectors.append({
            "code": code,
            "name": names.get(code, code),
            "level": level,
            "parent": parent,
            "section": sec,
            "excluded": excluded,
            "fields": fields,
            "raw": {
                "fatturato_keur": fatt, "valore_aggiunto_keur": va, "mol_keur": mol,
                "occupati": occ, "imprese": imp, "dipendenti": dip, "costi_personale_keur": costp,
                "investimenti_keur": inv,
            },
            "concentrazione": conc,
            "trend": trend,
            "barriera": barriera,
            "coverage": round(coverage, 1),
            "confidence": round(confidence, 1),
        })

    # ---- North Star: % economia (pesata su fatturato) a 4 cifre con Confidence alto
    THRESH = 70.0
    classes = [s for s in sectors if s["level"] == "class" and not s["excluded"]]
    tot_fatt = sum((s["raw"]["fatturato_keur"] or 0) for s in classes)
    hi_fatt = sum((s["raw"]["fatturato_keur"] or 0) for s in classes if s["confidence"] >= THRESH)
    north_star = round(100.0 * hi_fatt / tot_fatt, 1) if tot_fatt else 0.0

    payload = {
        "meta": {
            "country": "IT",
            "country_name": "Italia",
            "max_level": "class",
            "source": "ISTAT SBS — Risultati economici delle imprese (Ateco 4 cifre), dataflow 161_267",
            "latest_year": latest_year,
            "weights": WEIGHTS,
            "state_value": STATE_VALUE,
            "n_sectors": len(sectors),
            "n_classes_4d": len(classes),
            "confidence_threshold": THRESH,
            "north_star_pct_economy_high_conf": north_star,
            "note": "Coverage = % di peso su campi non assenti. Confidence = qualita' media (osservato=1, stimato=0.5) sui campi presenti.",
        },
        "sectors": sectors,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(blob)
    # copia servita dal sito statico
    web = ROOT / "web" / "public" / "countries" / "IT.json"
    web.parent.mkdir(parents=True, exist_ok=True)
    web.write_text(blob)

    # ---- report a video
    levels = defaultdict(int)
    for s in sectors:
        levels[s["level"]] += 1
    print(f"Settori: {dict(levels)}  | anno piu' recente: {latest_year}")
    if classes:
        import statistics as st
        covs = [s["coverage"] for s in classes]
        confs = [s["confidence"] for s in classes]
        print(f"Classi 4 cifre (escl. K/O): {len(classes)}")
        print(f"  Coverage   media {st.mean(covs):.1f}  mediana {st.median(covs):.1f}")
        print(f"  Confidence media {st.mean(confs):.1f}  mediana {st.median(confs):.1f}")
        print(f"  NORTH STAR: {north_star}% dell'economia (pesata fatturato) con Confidence >= {THRESH}")
    print(f"-> scritto {OUT} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    build()
