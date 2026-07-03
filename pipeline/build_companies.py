#!/usr/bin/env python3
"""
Crystal — layer aziende (drill-down fino alla singola impresa).

Legge un CSV *normalizzato* di imprese (una riga = un'azienda), lo aggancia
alle classi ATECO a 4 cifre già presenti nel truth layer settoriale
(web/public/countries/IT.json) e produce shard statici per classe + un indice
leggero coi conteggi.

  web/public/companies/IT/index.json      -> { meta, counts: { <ateco>: {...} } }
  web/public/companies/IT/<ateco>.json    -> { code, name, count, companies: [...] }

I campi finanziari sono OPZIONALI: se il CSV sorgente porta solo l'anagrafica
(nome, sede, forma giuridica) gli shard restano validi e la UI mostra la
directory; quando arriva una fonte con i bilanci (fatturato/addetti/VA), gli
stessi campi vengono popolati come enrichment drop-in, senza cambiare schema.

Schema CSV atteso (header, colonne finanziarie facoltative — lascia vuoto se assenti):
  ateco,name,comune,provincia,regione,forma_giuridica,stato,anno,
  fatturato_keur,addetti,va_keur,mol_keur,pec,website

Uso:
  python3 pipeline/build_companies.py                      # usa il seed dimostrativo
  python3 pipeline/build_companies.py --input path/to.csv  # usa un dataset reale
  python3 pipeline/build_companies.py --input real.csv --source "Registro Imprese 2025"

Principio, come il resto della pipeline: deterministico, nessun LLM, ogni numero
ricostruibile dalla fonte.
"""
import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTORS_IT = ROOT / "web" / "public" / "countries" / "IT.json"
SEED = Path(__file__).resolve().parent / "seed" / "companies_it_seed.csv"
OUT_DIR = ROOT / "web" / "public" / "companies" / "IT"


def load_class_index():
    """code(4 cifre) -> nome settore, per le sole classi (foglie ATECO italiane)."""
    doc = json.loads(SECTORS_IT.read_text())
    return {s["code"]: s["name"] for s in doc["sectors"] if s.get("level") == "class"}


def norm_ateco(raw):
    """Normalizza il codice ATECO a 4 cifre: toglie punti/spazi, tiene le cifre."""
    digits = re.sub(r"\D", "", raw or "")
    return digits[:4] if len(digits) >= 4 else digits


def num(raw):
    """Parsa un numero (o None se vuoto/illeggibile). Accetta virgola decimale."""
    if raw is None:
        return None
    s = str(raw).strip().replace(",", ".")
    if s == "":
        return None
    try:
        v = float(s)
        return int(v) if v.is_integer() else round(v, 4)
    except ValueError:
        return None


def field(value, unit=None):
    """Campo con stato {osservato|assente}, coerente col truth layer settoriale."""
    return {"value": value, "state": "osservato" if value is not None else "assente", "unit": unit}


def build_company(row, cid, ateco_label):
    fatturato = num(row.get("fatturato_keur"))
    addetti = num(row.get("addetti"))
    va = num(row.get("va_keur"))
    mol = num(row.get("mol_keur"))
    # Derivate: stesse definizioni delle metriche settoriali.
    margine = round(mol / fatturato, 4) if (mol is not None and fatturato) else None
    produttivita = round(va / addetti, 2) if (va is not None and addetti) else None

    def clean(key):
        v = (row.get(key) or "").strip()
        return v or None

    return {
        "id": cid,
        "name": clean("name") or "(senza nome)",
        "ateco": row["_ateco"],
        "ateco_label": ateco_label,
        "comune": clean("comune"),
        "provincia": clean("provincia"),
        "regione": clean("regione"),
        "forma_giuridica": clean("forma_giuridica"),
        "stato": clean("stato"),
        "pec": clean("pec"),
        "website": clean("website"),
        "anno": num(row.get("anno")),
        "fields": {
            "fatturato": field(fatturato, "keur"),
            "addetti": field(addetti, "n"),
            "valore_aggiunto": field(va, "keur"),
            "mol": field(mol, "keur"),
            "margine": field(margine, "ratio"),
            "produttivita": field(produttivita, "keur"),
        },
    }


def build(input_path, source_label, demo):
    class_index = load_class_index()
    valid = set(class_index)

    grouped = defaultdict(list)
    skipped = 0
    with open(input_path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            code = norm_ateco(row.get("ateco"))
            if code not in valid:
                skipped += 1
                continue
            row["_ateco"] = code
            grouped[code].append(row)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Pulisce shard vecchi (rebuild pulito).
    for old in OUT_DIR.glob("*.json"):
        old.unlink()

    counts = {}
    total = 0
    cid = 0
    any_financials = False
    for code, rows in sorted(grouped.items()):
        companies = []
        for row in rows:
            cid += 1
            companies.append(build_company(row, f"IT-{cid:05d}", class_index[code]))
        with_fin = sum(1 for c in companies if c["fields"]["fatturato"]["value"] is not None)
        fatt_tot = sum(c["fields"]["fatturato"]["value"] or 0 for c in companies) or None
        if with_fin:
            any_financials = True
        shard = {"code": code, "name": class_index[code], "count": len(companies), "companies": companies}
        (OUT_DIR / f"{code}.json").write_text(
            json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
        )
        counts[code] = {"companies": len(companies), "with_financials": with_fin, "fatturato_keur": fatt_tot}
        total += len(companies)

    index = {
        "meta": {
            "country": "IT",
            "source": source_label,
            "demo": demo,
            "has_financials": any_financials,
            "generated_classes": len(counts),
            "total_companies": total,
        },
        "counts": counts,
    }
    (OUT_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))

    print(f"Aziende: {total} su {len(counts)} classi ATECO  | scartate (ateco fuori perimetro): {skipped}")
    print(f"  bilanci presenti: {'sì' if any_financials else 'no (solo anagrafica)'}  | demo: {demo}")
    print(f"-> scritto {OUT_DIR}/index.json + {len(counts)} shard")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Costruisce gli shard aziende per classe ATECO.")
    ap.add_argument("--input", default=str(SEED), help="CSV normalizzato delle imprese (default: seed dimostrativo)")
    ap.add_argument("--source", default=None, help="Etichetta fonte mostrata nella UI")
    args = ap.parse_args()
    is_seed = Path(args.input).resolve() == SEED.resolve()
    source = args.source or ("Dati dimostrativi (seed) — sostituire con un dataset reale" if is_seed else Path(args.input).name)
    build(args.input, source, demo=is_seed)
