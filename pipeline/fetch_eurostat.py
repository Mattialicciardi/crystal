#!/usr/bin/env python3
"""
Crystal — fetch SBS Eurostat (dataset sbs_sc_ovw) per TUTTI i paesi europei.
Granularità NACE: fino a 3 cifre (gruppo) — Eurostat NON pubblica le 4 cifre.
Una query per indicatore restituisce tutti i ~36 geo × tutte le voci NACE × tutti gli anni.
Eurostat non ha il rate limit aggressivo di ISTAT; teniamo comunque un piccolo sleep.
"""
import time
import subprocess
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw"

# indic_sbs -> nome leggibile (livelli base da cui derivare i campi nucleo)
INDICATORS = {
    "NETTUR_MEUR": "turnover",       # fatturato netto (M€)
    "AV_MEUR": "value_added",        # valore aggiunto (M€)
    "EMP_NR": "employed",            # occupati
    "ENT_NR": "enterprises",         # imprese
    "GOS_MEUR": "gos",               # margine operativo lordo (M€)
}


def fetch(ind: str, name: str) -> str:
    out = RAW / f"eurostat_{ind}.json"
    if out.exists() and out.stat().st_size > 5000:
        return f"skip ({out.stat().st_size}b)"
    url = f"{BASE}?format=JSON&lang=EN&indic_sbs={ind}&size_emp=TOTAL"
    cmd = ["curl", "-sS", "-m", "180", "-o", str(out), "-w", "%{http_code} %{size_download}", url]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return (r.stdout or "ERR").strip()


def main():
    items = list(INDICATORS.items())
    print(f"Fetch {len(items)} indicatori Eurostat (tutti i paesi, tutti gli anni)")
    for i, (ind, name) in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {ind:14s} {name:14s} -> {fetch(ind, name)}", flush=True)
        if i < len(items):
            time.sleep(3)
    print("FETCH EUROSTAT COMPLETO")


if __name__ == "__main__":
    main()
