#!/usr/bin/env python3
"""
Crystal — fetch deterministico degli indicatori SBS ISTAT (Ateco 4 cifre).

Fonte: dataflow IT1,161_267_DF_DCSP_SBSNAZ_2,1.0 (DSD DCSP_SBSNAZ).
Una query per indicatore -> tutte le classi ATECO + tutta la gerarchia, tutti gli anni.

VINCOLO ISTAT: 5 query/minuto per IP, oltre -> ban 1-2 giorni.
=> seriale, >=16s tra le query, mai in parallelo. Idempotente: salta i file gia' scaricati.
"""
import sys
import time
import subprocess
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

FLOW = "IT1,161_267_DF_DCSP_SBSNAZ_2,1.0"
BASE = "https://esploradati.istat.it/SDMXWS/rest/data"
ACCEPT = "application/vnd.sdmx.data+csv;version=1.0.0"
UA = "Mozilla/5.0 (crystal-pipeline)"
START = "2015"
SLEEP = 16  # margine sotto i 5/min

# DATA_TYPE -> nome file leggibile
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
    # dispersione/concentrazione (proxy): possono non essere in questo dataflow -> best effort
    "E12110_Q1": "fatt_q1",
    "E12110_Q3": "fatt_q3",
    "E12110_STD": "fatt_std",
}


def fetch(dt: str, name: str) -> str:
    out = RAW / f"istat_{dt}_{name}.csv"
    if out.exists() and out.stat().st_size > 1000:
        return f"skip ({out.stat().st_size}b)"
    key = f"A.IT.{dt}..TOTAL.9.9"
    url = f"{BASE}/{FLOW}/{key}?startPeriod={START}"
    cmd = [
        "curl", "-sS", "-L", "--compressed", "-A", UA, "-m", "240",
        "-H", f"Accept: {ACCEPT}",
        "-o", str(out),
        "-w", "%{http_code} %{size_download}",
        url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    status = (r.stdout or "ERR").strip()
    err = (r.stderr or "").strip()[:100]
    return f"{status} {err}".strip()


def main():
    items = list(INDICATORS.items())
    print(f"Fetch {len(items)} indicatori ISTAT (>=16s tra query, ban-safe)")
    for i, (dt, name) in enumerate(items, 1):
        res = fetch(dt, name)
        print(f"[{i}/{len(items)}] {dt:12s} {name:18s} -> {res}", flush=True)
        if i < len(items):
            time.sleep(SLEEP)
    print("FETCH COMPLETO")


if __name__ == "__main__":
    main()
