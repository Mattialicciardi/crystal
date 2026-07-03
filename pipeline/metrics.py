"""Crystal — funzioni metriche pure e deterministiche (testate). Nessun I/O."""


def gross_margin(mol_keur, fatturato_keur):
    """MOL/fatturato (potere di prezzo). None se input mancante o fatturato<=0."""
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
    """Coppie (anno, valore) ordinate, solo valori positivi non nulli."""
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
    """Trend retrospettivo: {anni_crescita (consecutivi dal piu' recente), momentum, label}."""
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
    """by_size: {'totale', 'grandi', 'micro'} in keur (None se oscurato).
    Ritorna {quota_grandi, quota_micro} o None se manca il totale."""
    tot = by_size.get("totale")
    if not tot:
        return None
    g = by_size.get("grandi")
    mi = by_size.get("micro")
    return {
        "quota_grandi": (g / tot) if g is not None else None,
        "quota_micro": (mi / tot) if mi is not None else None,
    }
