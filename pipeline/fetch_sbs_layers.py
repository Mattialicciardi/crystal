#!/usr/bin/env python3
"""Scarica gli strati SBS Eurostat usati dalla mappa, senza stimare celle mancanti.

Output in data/sbs/:
  sbs_ovw_act_IT.csv          Italia, sbs_ovw_act, 2021-2024, conti di classe
  sbs_ovw_act_EU27.csv        EU27_2020, indicatori di confronto
  sbs_sc_ovw_IT.csv           Italia per classe di addetti, fino al gruppo NACE
  sbs_r_nuts2021_IT.csv       regioni NUTS 2, unità locali
"""

from __future__ import annotations

import csv
import io
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "sbs"
BASE = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data"
YEARS = "startPeriod=2021&endPeriod=2024"

IT_INDICATORS = (
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
SIZE_CLASSES = "0-9+10-19+20-49+50-249+GE250"
NUTS_INDICATORS = ("LOC_NR", "EMP_LOC_NR", "WAGE_LOC_MEUR", "LC_EMP_LOC_TEUR")
NUTS_GEOS = (
    "ITC1+ITC2+ITC3+ITC4+ITH1+ITH2+ITH3+ITH4+ITH5+"
    "ITI1+ITI2+ITI3+ITI4+ITF1+ITF2+ITF3+ITF4+ITF5+ITF6+ITG1+ITG2"
)


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "crystal-sbs/1.0"})
    last_error = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")[:300]
            raise SystemExit(f"HTTP {error.code} {url}\n{body}") from error
        except Exception as error:  # noqa: BLE001 - retry di rete
            last_error = error
            time.sleep(2 ** attempt)
    raise SystemExit(f"Download fallito {url}: {last_error}")


def write_merged(path: Path, texts: list[str]) -> None:
    header = None
    rows = []
    for text in texts:
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames is None:
            raise SystemExit(f"CSV senza intestazione per {path.name}")
        if header is None:
            header = reader.fieldnames
        elif reader.fieldnames != header:
            raise SystemExit(f"Intestazioni diverse in {path.name}")
        rows.extend(reader)
    if not rows or header is None:
        raise SystemExit(f"Nessuna riga per {path.name}")
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{path.name}: {len(rows)} righe", flush=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    it_parts = []
    for index, indicator in enumerate(IT_INDICATORS, 1):
        url = f"{BASE}/sbs_ovw_act/A..{indicator}.IT?{YEARS}&format=SDMX-CSV"
        print(f"[IT {index}/{len(IT_INDICATORS)}] {indicator}", flush=True)
        it_parts.append(fetch(url))
        time.sleep(0.4)
    write_merged(OUT / "sbs_ovw_act_IT.csv", it_parts)

    eu_parts = []
    for index, indicator in enumerate(EU_INDICATORS, 1):
        url = f"{BASE}/sbs_ovw_act/A..{indicator}.EU27_2020?{YEARS}&format=SDMX-CSV"
        print(f"[EU {index}/{len(EU_INDICATORS)}] {indicator}", flush=True)
        eu_parts.append(fetch(url))
        time.sleep(0.4)
    write_merged(OUT / "sbs_ovw_act_EU27.csv", eu_parts)

    size_parts = []
    for index, indicator in enumerate(SIZE_INDICATORS, 1):
        url = (
            f"{BASE}/sbs_sc_ovw/A.{indicator}..{SIZE_CLASSES}.IT?{YEARS}&format=SDMX-CSV"
        )
        print(f"[SIZE {index}/{len(SIZE_INDICATORS)}] {indicator}", flush=True)
        size_parts.append(fetch(url))
        time.sleep(0.4)
    write_merged(OUT / "sbs_sc_ovw_IT.csv", size_parts)

    nuts_parts = []
    for index, indicator in enumerate(NUTS_INDICATORS, 1):
        url = f"{BASE}/sbs_r_nuts2021/A..{indicator}.{NUTS_GEOS}?{YEARS}&format=SDMX-CSV"
        print(f"[NUTS {index}/{len(NUTS_INDICATORS)}] {indicator}", flush=True)
        nuts_parts.append(fetch(url))
        time.sleep(0.4)
    write_merged(OUT / "sbs_r_nuts2021_IT.csv", nuts_parts)
    print("DOWNLOAD COMPLETO")


if __name__ == "__main__":
    main()
