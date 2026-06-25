#!/usr/bin/env python3
"""
Sfera — costruisce i dataset per-paese dell'economia europea da Eurostat (sbs_sc_ovw).
Granularità: 3 cifre NACE (gruppo). Schema identico a quello italiano (build.py) così
il front-end è agnostico rispetto al paese. Nomi settore in italiano (riuso codelist ATECO).

Italia NON viene generata qui: resta la versione ISTAT a 4 cifre (countries/IT.json).
Genera anche index.json con l'elenco dei paesi disponibili.

Esegui DOPO build.py (serve countries/IT.json per l'indice).
"""
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

try:
    from pipeline import metrics as M
except ImportError:
    import metrics as M

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed" / "countries"
WEB = ROOT / "web" / "public" / "countries"
PROC.mkdir(parents=True, exist_ok=True)
WEB.mkdir(parents=True, exist_ok=True)

INDICATORS = {
    "NETTUR_MEUR": "turnover",
    "AV_MEUR": "value_added",
    "EMP_NR": "employed",
    "ENT_NR": "enterprises",
    "GOS_MEUR": "gos",
}

COUNTRY_NAMES = {
    "EU27_2020": "Unione Europea (27)", "BE": "Belgio", "BG": "Bulgaria", "CZ": "Cechia",
    "DK": "Danimarca", "DE": "Germania", "EE": "Estonia", "IE": "Irlanda", "EL": "Grecia",
    "ES": "Spagna", "FR": "Francia", "HR": "Croazia", "IT": "Italia", "CY": "Cipro",
    "LV": "Lettonia", "LT": "Lituania", "LU": "Lussemburgo", "HU": "Ungheria", "MT": "Malta",
    "NL": "Paesi Bassi", "AT": "Austria", "PL": "Polonia", "PT": "Portogallo", "RO": "Romania",
    "SI": "Slovenia", "SK": "Slovacchia", "FI": "Finlandia", "SE": "Svezia", "IS": "Islanda",
    "NO": "Norvegia", "CH": "Svizzera", "BA": "Bosnia ed Erzegovina", "ME": "Montenegro",
    "MK": "Macedonia del Nord", "AL": "Albania", "RS": "Serbia",
}
EXCLUDED_SECTIONS = {"K", "O"}


# ---- nomi ATECO italiani dalla DSD ISTAT
def strip_ns(t): return re.sub(r"\{[^}]*\}", "", t)


def name_of(el):
    names = {ch.get("{http://www.w3.org/XML/1998/namespace}lang"): (ch.text or "").strip()
             for ch in el if strip_ns(ch.tag) == "Name"}
    return names.get("it") or names.get("en") or next((v for v in names.values() if v), "")


def load_ateco_names():
    names = {}
    p = RAW / "istat_dsd.xml"
    if not p.exists():
        return names
    root = ET.fromstring(p.read_bytes())
    for el in root.iter():
        if strip_ns(el.tag) == "Codelist" and el.get("id") == "CL_ATECO_2007":
            for c in el:
                if strip_ns(c.tag) == "Code":
                    names[c.get("id")] = name_of(c)
            break
    return names


def nace_to_ateco(code):
    """NACE Eurostat -> (level, ateco_code, parent, section). None per aggregati."""
    if "-" in code or "_" in code or "+" in code:
        return None
    m = re.fullmatch(r"([A-Z])(\d*)", code)
    if not m:
        return None
    letter, digits = m.group(1), m.group(2)
    if digits == "":
        return ("section", letter, None, letter)
    if len(digits) == 2:
        return ("div", digits, letter, letter)
    if len(digits) == 3:
        return ("group", digits, digits[:2], letter)
    return None


# ---- lettura JSON-stat Eurostat
def inv(cat_index):
    arr = [None] * len(cat_index)
    for code, pos in cat_index.items():
        arr[pos] = code
    return arr


def load_indicator(path):
    """ritorna nace -> geo -> {year: value}."""
    d = json.load(open(path, encoding="utf-8"))
    dim = d["dimension"]
    nace_arr = inv(dim["nace_r2"]["category"]["index"])
    geo_arr = inv(dim["geo"]["category"]["index"])
    time_arr = inv(dim["time"]["category"]["index"])
    ng, nt = len(geo_arr), len(time_arr)
    out = defaultdict(lambda: defaultdict(dict))
    for k, v in d["value"].items():
        k = int(k)
        ti = k % nt
        rest = k // nt
        gi = rest % ng
        ni = rest // ng
        out[nace_arr[ni]][geo_arr[gi]][time_arr[ti]] = v
    return out, geo_arr


def load_eurostat_bysize(path):
    """nace -> geo -> {'grandi': {year:val}, 'micro': {year:val}} da NETTUR per GE250/0-9."""
    out = defaultdict(lambda: defaultdict(lambda: {"grandi": {}, "micro": {}}))
    if not path.exists():
        return out
    d = json.load(open(path, encoding="utf-8"))
    dim = d["dimension"]
    nace_arr = inv(dim["nace_r2"]["category"]["index"])
    size_arr = inv(dim["size_emp"]["category"]["index"])
    geo_arr = inv(dim["geo"]["category"]["index"])
    time_arr = inv(dim["time"]["category"]["index"])
    ns, ng, nt = len(size_arr), len(geo_arr), len(time_arr)
    bucket_for = {"GE250": "grandi", "0-9": "micro"}
    for k, v in d["value"].items():
        k = int(k)
        ti = k % nt
        r = k // nt
        gi = r % ng
        r2 = r // ng
        si = r2 % ns
        ni = r2 // ns
        bucket = bucket_for.get(size_arr[si])
        if bucket:
            out[nace_arr[ni]][geo_arr[gi]][bucket][time_arr[ti]] = v
    return out


def latest(series):
    for y in sorted(series, reverse=True):
        if series.get(y) is not None:
            return series[y]
    return None


def cagr(series):
    pts = sorted((int(y), v) for y, v in series.items() if v not in (None, 0))
    if len(pts) < 2:
        return None
    (y0, v0), (y1, v1) = pts[0], pts[-1]
    n = y1 - y0
    if n <= 0 or v0 <= 0 or v1 <= 0:
        return None
    return (v1 / v0) ** (1.0 / n) - 1.0


def safe_div(a, b):
    return a / b if (a is not None and b not in (None, 0)) else None


def field(v):
    return {"value": v}


def build():
    names = load_ateco_names()
    data, geos = {}, None
    for ind in INDICATORS:
        d, geo_arr = load_indicator(RAW / f"eurostat_{ind}.json")
        data[ind] = d
        geos = geos or geo_arr

    bysize = load_eurostat_bysize(RAW / "eurostat_NETTUR_MEUR_bysize.json")

    # universo nace per geo
    geo_nace = defaultdict(set)
    for ind in INDICATORS:
        for nace, by_geo in data[ind].items():
            for geo in by_geo:
                geo_nace[geo].add(nace)

    index_entries = []
    compare = {}

    def add_to_compare(geo, secs):
        for s in secs:
            if s["level"] == "class":
                continue  # livello comune cross-country = fino a 3 cifre
            e = compare.setdefault(s["code"], {"code": s["code"], "name": s["name"], "level": s["level"], "by": {}})
            if not e["name"] and s["name"]:
                e["name"] = s["name"]
            e["by"][geo] = {
                "fatturato_keur": s["raw"]["fatturato_keur"],
                "va_keur": s["raw"]["valore_aggiunto_keur"],
                "produttivita": s["fields"]["produttivita"]["value"],
                "redditivita": s["fields"]["redditivita"]["value"],
                "margine": (s["fields"].get("margine") or {}).get("value"),
                "struttura": s["fields"]["struttura"]["value"],
                "crescita": s["fields"]["crescita"]["value"],
                "trend": (s.get("trend") or {}).get("anni_crescita"),
                "quota_grandi": (s.get("concentrazione") or {}).get("quota_grandi"),
                "quota_micro": (s.get("concentrazione") or {}).get("quota_micro"),
                "barriera": (s.get("barriera") or {}).get("value"),
                "occupati": s["raw"]["occupati"],
                "imprese": s["raw"]["imprese"],
            }

    for geo in sorted(geo_nace):
        if geo == "IT":
            continue  # Italia = ISTAT 4 cifre (build.py)
        sectors = []
        latest_year = 0
        for nace in sorted(geo_nace[geo]):
            parsed = nace_to_ateco(nace)
            if not parsed:
                continue
            level, ateco, parent, section = parsed
            ser = {ind: data[ind].get(nace, {}).get(geo, {}) for ind in INDICATORS}
            fatt = latest(ser["NETTUR_MEUR"])
            va = latest(ser["AV_MEUR"])
            emp = latest(ser["EMP_NR"])
            ent = latest(ser["ENT_NR"])
            gos = latest(ser["GOS_MEUR"])
            for s in ser.values():
                for y, v in s.items():
                    if v is not None:
                        latest_year = max(latest_year, int(y))
            # Eurostat pubblica anche K/O dove disponibili: mostriamo ciò che esiste.
            fatt_k = fatt * 1000 if fatt is not None else None
            va_k = va * 1000 if va is not None else None
            gos_k = gos * 1000 if gos is not None else None
            dim_v = fatt_k if fatt_k is not None else va_k
            prod = safe_div(va_k, emp)
            red = safe_div(gos, va)
            struc = safe_div(emp, ent)
            grow = cagr(ser["NETTUR_MEUR"])
            margine = M.gross_margin(gos, fatt)
            bs = bysize.get(nace, {}).get(geo, {})
            grandi = latest(bs.get("grandi", {}))
            micro = latest(bs.get("micro", {}))
            conc = M.concentration({"totale": fatt, "grandi": grandi, "micro": micro})
            trend = M.growth_trend(ser["NETTUR_MEUR"])

            sectors.append({
                "code": ateco,
                "name": names.get(ateco, "") or nace,
                "level": level,
                "parent": parent,
                "section": section,
                "excluded": False,
                "fields": {
                    "dimensione": field(dim_v),
                    "produttivita": field(prod),
                    "redditivita": field(red),
                    "struttura": field(struc),
                    "crescita": field(grow),
                    "margine": field(margine),
                    "turnover": field(None),
                    "concentrazione": field(None),
                    "qualita_dato": field(None),
                },
                "raw": {
                    "fatturato_keur": fatt_k, "valore_aggiunto_keur": va_k, "mol_keur": gos_k,
                    "occupati": emp, "imprese": ent, "dipendenti": None, "costi_personale_keur": None,
                    "investimenti_keur": None,
                },
                "concentrazione": conc,
                "trend": trend,
                "barriera": {"value": None},
            })

        payload = {
            "meta": {
                "country": geo,
                "country_name": COUNTRY_NAMES.get(geo, geo),
                "max_level": "group",
                "source": "Eurostat — Structural Business Statistics (sbs_sc_ovw), NACE Rev.2 3 cifre",
                "latest_year": latest_year,
                "n_sectors": len(sectors),
            },
            "sectors": sectors,
        }
        blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        (PROC / f"{geo}.json").write_text(blob)
        (WEB / f"{geo}.json").write_text(blob)
        index_entries.append({
            "code": geo, "name": COUNTRY_NAMES.get(geo, geo),
            "latest_year": latest_year, "max_level": "group", "n_sectors": len(sectors),
        })
        add_to_compare(geo, sectors)

    # Italia dall'indice ISTAT (countries/IT.json già scritto da build.py)
    it_path = ROOT / "data" / "processed" / "countries" / "IT.json"
    if it_path.exists():
        it_doc = json.loads(it_path.read_text())
        itm = it_doc["meta"]
        index_entries.insert(0, {
            "code": "IT", "name": "Italia", "latest_year": itm.get("latest_year"),
            "max_level": "class", "n_sectors": itm.get("n_classes_4d", itm.get("n_sectors")),
        })
        add_to_compare("IT", it_doc["sectors"])  # Italia al livello comune 3 cifre

    # ordina: Italia prima, poi UE27, poi alfabetico per nome
    def sort_key(e):
        return (0 if e["code"] == "IT" else 1 if e["code"] == "EU27_2020" else 2, e["name"])
    index_entries.sort(key=sort_key)

    index = {"countries": index_entries, "default": "IT"}
    iblob = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    (ROOT / "data" / "processed" / "index.json").write_text(iblob)
    (ROOT / "web" / "public" / "index.json").write_text(iblob)

    # compare.json: ogni settore (sezione/divisione/gruppo) con le metriche per paese
    compare_doc = {
        "sectors": sorted(compare.values(), key=lambda e: ({"section": 0, "div": 1, "group": 2}.get(e["level"], 3), e["code"])),
        "countries": {e["code"]: e["name"] for e in index_entries},
    }
    cblob = json.dumps(compare_doc, ensure_ascii=False, separators=(",", ":"))
    (ROOT / "data" / "processed" / "compare.json").write_text(cblob)
    (ROOT / "web" / "public" / "compare.json").write_text(cblob)
    print(f"compare.json: {len(compare_doc['sectors'])} settori cross-country")

    print(f"Paesi generati (oltre IT): {len(index_entries) - 1}")
    big = sorted(index_entries, key=lambda e: -(e['n_sectors'] or 0))[:6]
    for e in index_entries:
        if e['code'] in ('IT', 'DE', 'FR', 'ES', 'EU27_2020'):
            print(f"  {e['code']:10s} {e['name']:22s} settori={e['n_sectors']} anno={e['latest_year']}")
    print(f"-> index.json con {len(index_entries)} paesi")


if __name__ == "__main__":
    build()
