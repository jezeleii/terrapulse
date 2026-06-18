from decimal import Decimal
from typing import Any, Dict, Optional


def _normalize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _normalize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    return value


_CURRENT_KEYS = [
    "issued_t",
    "retired_t",
    "retirement_ratio",
    "net_balance_t",
    "issued_yoy_pct",
    "retired_yoy_pct",
    "ratio_yoy_delta",
    "n_events",
]
_BENCHMARK_KEYS = [
    "median_retirement_ratio",
    "p25_retirement_ratio",
    "p75_retirement_ratio",
    "median_issued_yoy_pct",
    "median_retired_yoy_pct",
]
_PERCENTILE_KEYS = [
    "retirement_ratio_pctile",
    "issued_yoy_pctile",
    "retired_yoy_pctile",
    "prev_retirement_ratio_pctile",
]


def _filter_keys(source: Optional[Dict[str, Any]], keys: list[str]) -> Dict[str, Any]:
    if not source:
        return {}
    return {key: source.get(key) for key in keys}


def build_payload(
    current: Dict[str, Any],
    previous: Optional[Dict[str, Any]],
    benchmarks: Optional[Dict[str, Any]],
    percentiles: Optional[Dict[str, Any]],
    flags: list[str],
) -> Dict[str, Any]:
    payload = {
        "current": _filter_keys(current, _CURRENT_KEYS),
        "previous": _filter_keys(previous, _CURRENT_KEYS),
        "benchmarks": _filter_keys(benchmarks, _BENCHMARK_KEYS),
        "percentiles": _filter_keys(percentiles, _PERCENTILE_KEYS),
        "flags": flags,
    }
    return _normalize_value(payload)
