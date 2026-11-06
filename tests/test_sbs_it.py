"""Controlli sul costruttore SBS Italia: i numeri restano quelli del CSV."""

from decimal import Decimal

from pipeline.build_sbs_it import TOTAL_CODE, build

# Controllo dichiarato sull'aggregato ufficiale. Se il file diverge, vince il file:
# questi valori sono stati letti dall'estratto sbs_ovw_act geo=IT.
EXPECTED = {
    "2023": {
        "ENT_NR": "4625476",
        "EMP_NR": "18638291",
        "NETTUR_MEUR": "4274532.51",
        "PUR_MEUR": "3162235.51",
        "AV_MEUR": "1178245.41",
        "WAGE_MEUR": "411155.43",
        "GOS_MEUR": "612468.18",
        "GRSINV_TNCA_MEUR": "157312.04",
        "LC_EMP_TEUR": "22.06",
        "GOR_PC": "14.33",
    },
    "2024": {
        "ENT_NR": "4652416",
        "NETTUR_MEUR": "4282294.49",
        "AV_MEUR": "1212883.22",
    },
}


def _cell(dataset, code, year, indicator):
    node = dataset["total"] if code == TOTAL_CODE else next(s for s in dataset["sectors"] if s["code"] == code)
    return node["years"][year].get(indicator)


def test_official_total_matches_extract():
    dataset = build()
    for year, indicators in EXPECTED.items():
        for indicator, raw in indicators.items():
            cell = _cell(dataset, TOTAL_CODE, year, indicator)
            assert cell["s"] == "v"
            assert Decimal(str(cell["v"])) == Decimal(raw)


def test_reserved_cells_have_no_number():
    dataset = build()
    finance = _cell(dataset, "K", "2023", "NETTUR_MEUR")
    assert finance == {"s": "c"}
    assert "v" not in finance
    enterprises = _cell(dataset, "K", "2023", "ENT_NR")
    assert enterprises["s"] == "v"
    assert enterprises["v"] == 116685
    oil = _cell(dataset, "B06", "2023", "NETTUR_MEUR")
    assert oil == {"s": "c"}


def test_true_zero_stays_zero():
    dataset = build()
    coal = _cell(dataset, "B05", "2023", "ENT_NR")
    assert coal["s"] == "v"
    assert coal["v"] == 0


def test_derived_only_from_published_values():
    dataset = build()
    derived = dataset["total"]["years"]["2023"]["derived"]
    assert derived["fatturato_per_impresa_eur"] == 924128.14
    assert derived["addetti_per_impresa"] == 4.03
    assert derived["va_per_addetto_teur"] == 63.22
    assert "_estimated" not in derived
    # K ha le imprese, il fatturato è riservato: il rapporto non si calcola.
    finance = next(s for s in dataset["sectors"] if s["code"] == "K")
    assert "derived" not in finance["years"]["2023"] or "fatturato_per_impresa_eur" not in finance["years"]["2023"].get("derived", {})


def test_hierarchy_and_coverage():
    dataset = build()
    counts = dataset["meta"]["coverage"]["counts"]
    assert counts == {"section": 16, "division": 80, "group": 246, "class": 547}
    assert dataset["meta"]["coverage"]["class_turnover"]["2023"]["published"] == 527
    codes = {s["code"] for s in dataset["sectors"]}
    assert "A" not in codes and "O" not in codes
    section_s = next(s for s in dataset["sectors"] if s["code"] == "S")
    assert section_s["published"] is False
    assert section_s["years"]["2023"] == {}
    assert section_s["name"] == "altre attività di servizi"
    children = [s["code"] for s in dataset["sectors"] if s["parent"] == "S"]
    assert children == ["S95", "S96"]
    food = next(s for s in dataset["sectors"] if s["code"] == "C1011")
    assert food["level"] == "class"
    assert food["parent"] == "C101"
    assert food["name"] == "lavorazione e conservazione di carne, escluso volatili"
    assert dataset["meta"]["last_update"].startswith("30/09/26")


def test_series_and_extra_layers_stay_official():
    dataset = build()
    assert [cell["v"] for cell in (
        _cell(dataset, TOTAL_CODE, "2021", "ENT_NR"),
        _cell(dataset, TOTAL_CODE, "2022", "ENT_NR"),
    )] == [4466356, 4587208]
    manufacturing = next(sector for sector in dataset["sectors"] if sector["code"] == "C")
    assert manufacturing["size"]["2023"]["0-9"]["ENT_NR"] == {"s": "v", "v": 284161}
    assert "size" not in next(sector for sector in dataset["sectors"] if sector["code"] == "C1011")
    lombardy = dataset["nuts"]["series"]["C"]["ITC4"]["2023"]
    assert lombardy["EMP_LOC_NR"]["v"] == 919021
    assert lombardy["LOC_NR"]["v"] == 80222
    assert dataset["nuts"]["nace_levels"]["class"] == 0
    assert dataset["meta"]["layers"]["size"]["levels_with_data"]["class"] == 0
    purchases = _cell(dataset, TOTAL_CODE, "2023", "PUR_RS_MEUR")
    assert purchases["s"] == "v"
    assert purchases["v"] == 1127457.71


def test_estimated_flag_is_preserved():
    dataset = build()
    cell = _cell(dataset, "K642", "2023", "ENT_NR")
    assert cell["s"] == "e"
    assert cell["v"] == 16426
