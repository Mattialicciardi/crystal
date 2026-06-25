import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline import metrics as m


def test_gross_margin_basic():
    assert m.gross_margin(20.0, 100.0) == 0.2


def test_gross_margin_none_on_missing_or_zero():
    assert m.gross_margin(None, 100.0) is None
    assert m.gross_margin(20.0, 0) is None
    assert m.gross_margin(20.0, None) is None


def test_value_added_per_worker():
    assert m.value_added_per_worker(1000.0, 20) == 50.0
    assert m.value_added_per_worker(1000.0, 0) is None


def test_workers_per_firm():
    assert m.workers_per_firm(100, 25) == 4.0
    assert m.workers_per_firm(100, 0) is None


def test_barrier_capex_per_worker():
    assert m.barrier_capex_per_worker(500.0, 10) == 50.0
    assert m.barrier_capex_per_worker(None, 10) is None


def test_cagr():
    assert math.isclose(m.cagr({2020: 100, 2022: 121}), 0.1, rel_tol=1e-9)
    assert m.cagr({2020: 100}) is None
    assert m.cagr({2020: 0, 2022: 100}) is None


def test_growth_trend_sostenuto():
    s = {2020: 100, 2021: 110, 2022: 121, 2023: 133}
    t = m.growth_trend(s)
    assert t["anni_crescita"] == 3
    assert t["label"] == "sostenuto"


def test_growth_trend_recente():
    s = {2020: 100, 2021: 95, 2022: 90, 2023: 99}
    t = m.growth_trend(s)
    assert t["anni_crescita"] == 1
    assert t["label"] == "recente"


def test_growth_trend_in_calo():
    s = {2020: 100, 2021: 110, 2022: 105}
    t = m.growth_trend(s)
    assert t["label"] == "in_calo"


def test_growth_trend_gap_breaks_consecutive():
    s = {2018: 100, 2020: 110, 2021: 121}
    t = m.growth_trend(s)
    assert t["anni_crescita"] == 1


def test_concentration():
    c = m.concentration({"totale": 1000.0, "grandi": 600.0, "micro": 100.0})
    assert c["quota_grandi"] == 0.6
    assert c["quota_micro"] == 0.1


def test_concentration_none_on_missing_total():
    assert m.concentration({"totale": None, "grandi": 600.0}) is None


def test_concentration_partial():
    c = m.concentration({"totale": 1000.0, "grandi": None, "micro": 100.0})
    assert c["quota_grandi"] is None
    assert c["quota_micro"] == 0.1
