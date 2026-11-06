#!/usr/bin/env python3
"""Costruisce la mappa SBS Italia (Eurostat sbs_ovw_act, NACE Rev. 2) per il sito.

Input versionati:
  data/sbs/sbs_ovw_act_IT.csv     estratto geo=IT, anni 2023-2024
  data/sbs/ateco2007_it.json      titoli italiani ISTAT, codelist CL_ATECO_2007

Output:
  web/public/sbs-it.json

Le celle con CONF_STATUS=C restano riservate (nessun numero, mai 0).
I rapporti derivati si calcolano solo se entrambi i valori ufficiali sono pubblicati
e il denominatore non è zero. Non si ricostruisce un indicatore ufficiale riservato.
"""

from __future__ import annotations

import csv
import json
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "sbs" / "sbs_ovw_act_IT.csv"
EU_PATH = ROOT / "data" / "sbs" / "sbs_ovw_act_EU27.csv"
SIZE_PATH = ROOT / "data" / "sbs" / "sbs_sc_ovw_IT.csv"
NUTS_PATH = ROOT / "data" / "sbs" / "sbs_r_nuts2021_IT.csv"
LABELS_PATH = ROOT / "data" / "sbs" / "ateco2007_it.json"
OUT_PATH = ROOT / "web" / "public" / "sbs-it.json"

TOTAL_CODE = "B-S_X_O_S94"
YEARS = ("2021", "2022", "2023", "2024")
INDICATORS = (
    "ENT_NR",
    "EMP_NR",
    "SAL_NR",
    "SAL_FTE_NR",
    "HW_NR",
    "NETTUR_MEUR",
    "VAL_OUT_MEUR",
    "PUR_MEUR",
    "PUR_RS_MEUR",
    "PUR_AGN_MEUR",
    "PUR_NRG_MEUR",
    "GM_GD_RS_MEUR",
    "AV_MEUR",
    "WAGE_MEUR",
    "EXPN_SAL_BEN_MEUR",
    "SS_COST_MEUR",
    "GOS_MEUR",
    "GRSINV_TNCA_MEUR",
    "GRSINV_MAC_MEUR",
    "LC_EMP_TEUR",
    "NETTUR_EMP_TEUR",
    "GOR_PC",
)
EU_INDICATORS = (
    "ENT_NR",
    "EMP_NR",
    "NETTUR_MEUR",
    "PUR_MEUR",
    "AV_MEUR",
    "WAGE_MEUR",
    "GOS_MEUR",
    "GOR_PC",
)
SIZE_INDICATORS = ("ENT_NR", "EMP_NR", "NETTUR_MEUR", "AV_MEUR")
SIZE_CLASSES = ("0-9", "10-19", "20-49", "50-249", "GE250")
NUTS_INDICATORS = ("LOC_NR", "EMP_LOC_NR", "WAGE_LOC_MEUR", "LC_EMP_LOC_TEUR")
NUTS_NAMES = {
    "ITC1": "Piemonte",
    "ITC2": "Valle d'Aosta",
    "ITC3": "Liguria",
    "ITC4": "Lombardia",
    "ITH1": "Bolzano",
    "ITH2": "Trento",
    "ITH3": "Veneto",
    "ITH4": "Friuli-Venezia Giulia",
    "ITH5": "Emilia-Romagna",
    "ITI1": "Toscana",
    "ITI2": "Umbria",
    "ITI3": "Marche",
    "ITI4": "Lazio",
    "ITF1": "Abruzzo",
    "ITF2": "Molise",
    "ITF3": "Campania",
    "ITF4": "Puglia",
    "ITF5": "Basilicata",
    "ITF6": "Calabria",
    "ITG1": "Sicilia",
    "ITG2": "Sardegna",
}
# Rapporti non pubblicati da Eurostat. Gli indicatori ufficiali riservati
# (GOR, fatturato/addetto, costo del lavoro/addetto) non vengono ricalcolati.
DERIVED = {
    "fatturato_per_impresa_eur": ("NETTUR_MEUR", "ENT_NR", Decimal("1000000"), "0.01"),
    "addetti_per_impresa": ("EMP_NR", "ENT_NR", Decimal("1"), "0.01"),
    "va_per_addetto_teur": ("AV_MEUR", "EMP_NR", Decimal("1000"), "0.01"),
}
LEVEL_ORDER = {"section": 0, "division": 1, "group": 2, "class": 3}


def level_of(code: str) -> str | None:
    if re.fullmatch(r"[A-Z]", code):
        return "section"
    if re.fullmatch(r"[A-Z]\d{2}", code):
        return "division"
    if re.fullmatch(r"[A-Z]\d{3}", code):
        return "group"
    if re.fullmatch(r"[A-Z]\d{4}", code):
        return "class"
    return None


def parent_of(code: str, level: str) -> str | None:
    if level == "section":
        return None
    if level == "division":
        return code[0]
    if level == "group":
        return code[:3]
    if level == "class":
        return code[:4]
    return None


def section_of(code: str) -> str:
    return code[0]


def ateco_key(code: str) -> str:
    return code if re.fullmatch(r"[A-Z]", code) else code[1:]


def load_labels() -> dict[str, str]:
    payload = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    labels = payload["labels"]
    if not isinstance(labels, dict) or not labels:
        raise SystemExit(f"Etichette ATECO assenti in {LABELS_PATH}")
    return labels


def load_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise SystemExit(f"Manca {path}. Lancia python3 pipeline/fetch_sbs_layers.py")
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise SystemExit(f"CSV vuoto: {path}")
    return rows


def cell_from_row(row: dict[str, str]) -> dict:
    if row["CONF_STATUS"] == "C" or row["OBS_VALUE"] == "":
        if row["CONF_STATUS"] != "C":
            raise SystemExit(
                f"Cella vuota senza CONF_STATUS=C: {row['nace_r2']} {row['indic_sbs']} {row['TIME_PERIOD']}"
            )
        return {"s": "c"}
    value = float(row["OBS_VALUE"])
    status = "e" if row["OBS_FLAG"] == "e" else "v"
    return {"s": status, "v": value}


def quantize(value: Decimal, places: str) -> float:
    rounded = value.quantize(Decimal(places), rounding=ROUND_HALF_UP)
    return float(rounded)


def derive(indicators: dict) -> dict:
    derived = {}
    estimated = False
    for key, (num_id, den_id, scale, places) in DERIVED.items():
        num = indicators.get(num_id)
        den = indicators.get(den_id)
        if not num or not den or num["s"] == "c" or den["s"] == "c":
            continue
        if num["s"] not in ("v", "e") or den["s"] not in ("v", "e"):
            continue
        if den["v"] == 0:
            continue
        ratio = (Decimal(str(num["v"])) * scale) / Decimal(str(den["v"]))
        derived[key] = quantize(ratio, places)
        estimated = estimated or num["s"] == "e" or den["s"] == "e"
    if not derived:
        return {}
    if estimated:
        derived["_estimated"] = True
    return derived


def year_payload(indicators: dict) -> dict:
    out = {ind: indicators[ind] for ind in INDICATORS if ind in indicators}
    derived = derive(indicators)
    if derived:
        out["derived"] = derived
    return out


def nest_cells(rows: list[dict[str, str]], key_fields: tuple[str, ...], allowed: tuple[str, ...]) -> dict:
    """Chiave composta -> indicatore -> cella. Le celle vuote non riservate fermano la build."""
    out: dict = {}
    for row in rows:
        if row["indic_sbs"] not in allowed:
            continue
        if row["TIME_PERIOD"] not in YEARS:
            continue
        cursor = out
        for field in key_fields:
            cursor = cursor.setdefault(row[field], {})
        year_bucket = cursor.setdefault(row["TIME_PERIOD"], {})
        if row["indic_sbs"] in year_bucket:
            raise SystemExit(f"Duplicato {row['indic_sbs']} {row['TIME_PERIOD']}")
        year_bucket[row["indic_sbs"]] = cell_from_row(row)
    return out


def attach_eu(sectors: list[dict], total: dict, rows: list[dict[str, str]]) -> str:
    nested = nest_cells(rows, ("nace_r2",), EU_INDICATORS)
    last = sorted({row["LAST UPDATE"] for row in rows})[0]
    for node in sectors + [total]:
        series = nested.get(node["code"])
        if not series:
            continue
        node["eu"] = {year: series.get(year, {}) for year in YEARS if series.get(year)}
    return last


def attach_size(sectors: list[dict], total: dict, rows: list[dict[str, str]]) -> tuple[str, dict]:
    nested = nest_cells(rows, ("nace_r2", "size_emp"), SIZE_INDICATORS)
    last = sorted({row["LAST UPDATE"] for row in rows})[0]
    levels = {"section": 0, "division": 0, "group": 0, "class": 0, "aggregate": 0}
    for node in sectors + [total]:
        by_size = nested.get(node["code"])
        if not by_size:
            continue
        level = node.get("level") or "aggregate"
        levels[level] = levels.get(level, 0) + 1
        payload = {}
        for size_code, years in by_size.items():
            if size_code not in SIZE_CLASSES:
                continue
            for year, indicators in years.items():
                payload.setdefault(year, {})[size_code] = indicators
        if payload:
            node["size"] = payload
    return last, levels


def build_nuts(rows: list[dict[str, str]]) -> dict:
    nested = nest_cells(rows, ("nace_r2", "geo"), NUTS_INDICATORS)
    last = sorted({row["LAST UPDATE"] for row in rows})[0]
    areas = []
    seen = []
    for row in rows:
        if row["geo"] not in seen:
            seen.append(row["geo"])
    for code in sorted(seen):
        areas.append({"code": code, "name": NUTS_NAMES.get(code, code)})
    levels = {"section": 0, "division": 0, "group": 0, "class": 0, "aggregate": 0}
    for code in nested:
        level = level_of(code) or "aggregate"
        levels[level] = levels.get(level, 0) + 1
    return {
        "dataset": "sbs_r_nuts2021",
        "last_update": last,
        "source_url": "https://ec.europa.eu/eurostat/databrowser/view/sbs_r_nuts2021/default/table?lang=en",
        "note": (
            "Unità locali per regione NUTS 2. Non sono i conti nazionali delle imprese: "
            "gli addetti e le retribuzioni si riferiscono alle unità locali."
        ),
        "nace_levels": levels,
        "indicators": list(NUTS_INDICATORS),
        "areas": areas,
        "series": nested,
    }


def build() -> dict:
    labels = load_labels()
    rows = load_rows(CSV_PATH)
    last_updates = sorted({row["LAST UPDATE"] for row in rows})
    if len(last_updates) != 1:
        raise SystemExit(f"Aggiornamenti dataset non univoci: {last_updates}")

    bucket: dict[tuple[str, str], dict[str, dict]] = {}
    for row in rows:
        if row["geo"] != "IT":
            raise SystemExit(f"Geo inattesa: {row['geo']}")
        if row["TIME_PERIOD"] not in YEARS:
            raise SystemExit(f"Anno inatteso: {row['TIME_PERIOD']}")
        if row["indic_sbs"] not in INDICATORS:
            raise SystemExit(f"Indicatore inatteso: {row['indic_sbs']}")
        key = (row["nace_r2"], row["TIME_PERIOD"])
        bucket.setdefault(key, {})
        if row["indic_sbs"] in bucket[key]:
            raise SystemExit(f"Duplicato {key} {row['indic_sbs']}")
        bucket[key][row["indic_sbs"]] = cell_from_row(row)

    codes = sorted({code for code, _year in bucket})
    detail_codes = []
    for code in codes:
        if level_of(code):
            detail_codes.append(code)
        elif code != TOTAL_CODE:
            continue

    by_code_years: dict[str, dict] = {}
    for code in detail_codes + [TOTAL_CODE]:
        by_code_years[code] = {}
        for year in YEARS:
            indicators = bucket.get((code, year), {})
            by_code_years[code][year] = year_payload(indicators)

    present = set(detail_codes)
    # La sezione S non è pubblicata, ma alcune divisioni sì: il nodo serve solo a navigare.
    if "S" not in present and any(code.startswith("S") for code in present):
        present.add("S")
        by_code_years["S"] = {year: {} for year in YEARS}

    missing_names = []
    sectors = []
    for code in sorted(present, key=lambda item: (LEVEL_ORDER[level_of(item)], item)):
        level = level_of(code)
        name = labels.get(ateco_key(code))
        if not name:
            missing_names.append(code)
            continue
        parent = parent_of(code, level)
        if parent and parent not in present:
            missing_names.append(f"{code}->parent:{parent}")
        sectors.append(
            {
                "code": code,
                "name": name,
                "level": level,
                "parent": parent,
                "section": section_of(code),
                "published": code != "S",
                "years": by_code_years[code],
            }
        )
    if missing_names:
        raise SystemExit("Titoli o padri mancanti: " + ", ".join(missing_names[:30]))

    counts = {level: sum(1 for sector in sectors if sector["level"] == level and sector["published"]) for level in LEVEL_ORDER}
    # S non pubblicata non entra nel conteggio sezioni.
    turnover = {}
    for year in YEARS:
        numeric = reserved = absent = 0
        for sector in sectors:
            if sector["level"] != "class":
                continue
            cell = sector["years"][year].get("NETTUR_MEUR")
            if not cell:
                absent += 1
            elif cell["s"] == "c":
                reserved += 1
            else:
                numeric += 1
        turnover[year] = {"published": numeric, "reserved": reserved, "absent": absent}

    total_name = (
        "Industria, costruzioni e servizi di mercato, esclusi pubblica amministrazione "
        "e attività delle organizzazioni associative"
    )
    dataset = {
        "meta": {
            "dataset": "sbs_ovw_act",
            "dataset_name": "Enterprises by detailed NACE Rev. 2 activity",
            "geo": "IT",
            "country_name": "Italia",
            "years": list(YEARS),
            "last_update": last_updates[0],
            "last_update_label": "30 settembre 2026",
            "source_url": "https://ec.europa.eu/eurostat/databrowser/view/sbs_ovw_act/default/table?lang=en",
            "classification": "NACE Rev. 2",
            "classification_note": (
                "NACE Rev. 2 coincide con le prime quattro cifre di ATECO 2007. "
                "Non è ATECO 2025: da J in poi le lettere non coincidono."
            ),
            "labels_source": "ISTAT, codelist CL_ATECO_2007",
            "producer_note": (
                "ISTAT è il produttore nazionale delle Structural Business Statistics "
                "italiane trasmesse a Eurostat."
            ),
            "total_code": TOTAL_CODE,
            "total_name": total_name,
            "total_name_en": (
                "Industry, construction and market services (except public administration and defence; "
                "compulsory social security; activities of membership organisations)"
            ),
            "coverage": {
                "sections_absent": ["A", "O"],
                "section_without_total": ["S"],
                "balance_reserved_sections": ["K"],
                "counts": counts,
                "class_turnover": turnover,
            },
            "indicators": list(INDICATORS),
        },
        "total": {
            "code": TOTAL_CODE,
            "name": total_name,
            "level": "aggregate",
            "published": True,
            "years": by_code_years[TOTAL_CODE],
        },
        "sectors": sectors,
    }
    eu_last = attach_eu(sectors, dataset["total"], load_rows(EU_PATH))
    size_last, size_levels = attach_size(sectors, dataset["total"], load_rows(SIZE_PATH))
    nuts = build_nuts(load_rows(NUTS_PATH))
    dataset["nuts"] = nuts
    dataset["meta"]["layers"] = {
        "accounts": {
            "dataset": "sbs_ovw_act",
            "last_update": last_updates[0],
            "source_url": dataset["meta"]["source_url"],
            "note": "Conti delle imprese fino alla classe NACE a 4 cifre. Sotto le 4 cifre non ci sono ricavi né costi ufficiali.",
        },
        "eu": {
            "dataset": "sbs_ovw_act",
            "geo": "EU27_2020",
            "last_update": eu_last,
            "source_url": dataset["meta"]["source_url"],
        },
        "size": {
            "dataset": "sbs_sc_ovw",
            "last_update": size_last,
            "source_url": "https://ec.europa.eu/eurostat/databrowser/view/sbs_sc_ovw/default/table?lang=en",
            "classes": list(SIZE_CLASSES),
            "levels_with_data": size_levels,
            "note": "Classe di addetti per attività. In questo estratto il dettaglio NACE arriva al gruppo (3 cifre), non alla classe.",
        },
        "nuts": {
            "dataset": "sbs_r_nuts2021",
            "last_update": nuts["last_update"],
            "source_url": nuts["source_url"],
            "nace_levels": nuts["nace_levels"],
            "note": nuts["note"],
        },
    }
    return dataset


def main() -> None:
    dataset = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = dataset["meta"]["coverage"]["counts"]
    print(
        f"Scritto {OUT_PATH} — sezioni {counts['section']}, divisioni {counts['division']}, "
        f"gruppi {counts['group']}, classi {counts['class']}"
    )


if __name__ == "__main__":
    main()
