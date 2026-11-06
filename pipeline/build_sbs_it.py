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
LABELS_PATH = ROOT / "data" / "sbs" / "ateco2007_it.json"
OUT_PATH = ROOT / "web" / "public" / "sbs-it.json"

TOTAL_CODE = "B-S_X_O_S94"
YEARS = ("2023", "2024")
INDICATORS = (
    "ENT_NR",
    "EMP_NR",
    "NETTUR_MEUR",
    "PUR_MEUR",
    "AV_MEUR",
    "WAGE_MEUR",
    "GOS_MEUR",
    "GRSINV_TNCA_MEUR",
    "LC_EMP_TEUR",
    "NETTUR_EMP_TEUR",
    "GOR_PC",
)
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


def load_rows() -> list[dict[str, str]]:
    with CSV_PATH.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise SystemExit(f"CSV vuoto: {CSV_PATH}")
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


def build() -> dict:
    labels = load_labels()
    rows = load_rows()
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
