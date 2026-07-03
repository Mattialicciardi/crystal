"""
Crystal — fetch distribuzione per classe di addetti (per la concentrazione).

Eurostat: NETTUR_MEUR per le classi GE250 (grandi) e 0-9 (micro), tutti i paesi, 1 query.
ISTAT: fatturato (12110) per le classi W_GE250 e W0_9, tutte le classi ATECO 4 cifre,
       dalla dataflow CON classe di addetti (..._3). 2 query SERIALI >=16s (rate-limit 5/min).

Il TOTALE per ogni settore lo abbiamo gia' (istat_12110_fatturato.csv / eurostat_NETTUR_MEUR.json).
"""
import subprocess
import time
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)


def fetch_eurostat():
    out = RAW / "eurostat_NETTUR_MEUR_bysize.json"
    if out.exists() and out.stat().st_size > 5000:
        return f"skip ({out.stat().st_size}b)"
    url = ("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw"
           "?format=JSON&lang=EN&indic_sbs=NETTUR_MEUR&size_emp=GE250&size_emp=0-9")
    r = subprocess.run(["curl", "-sS", "-m", "180", "-o", str(out),
                        "-w", "%{http_code} %{size_download}", url], capture_output=True, text=True)
    return (r.stdout or "ERR").strip()


def fetch_istat_class(size_code, name):
    out = RAW / f"istat_12110_{name}.csv"
    if out.exists() and out.stat().st_size > 1000:
        return f"skip ({out.stat().st_size}b)"
    flow = "IT1,161_267_DF_DCSP_SBSNAZ_3,1.0"
    key = f"A.IT.12110..{size_code}.9.9"
    url = f"https://esploradati.istat.it/SDMXWS/rest/data/{flow}/{key}?startPeriod=2015"
    r = subprocess.run(["curl", "-sS", "-kL", "--compressed", "-A", "Mozilla/5.0 (crystal)",
                        "-m", "240", "-H", "Accept: application/vnd.sdmx.data+csv;version=1.0.0",
                        "-o", str(out), "-w", "%{http_code} %{size_download}", url],
                       capture_output=True, text=True)
    return (r.stdout or "ERR").strip()


if __name__ == "__main__":
    print("Eurostat by-size:", fetch_eurostat(), flush=True)
    print("[ISTAT 1/2] grandi (W_GE250):", fetch_istat_class("W_GE250", "grandi"), flush=True)
    time.sleep(16)
    print("[ISTAT 2/2] micro (W0_9):", fetch_istat_class("W0_9", "micro"), flush=True)
    print("DONE")
