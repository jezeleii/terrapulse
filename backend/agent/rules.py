import json
from pathlib import Path
from typing import Any, Dict, List, Optional

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


def _load_thresholds() -> Dict[str, float]:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("thresholds", {})


def compute_flags(
    current: Dict[str, Any],
    previous: Optional[Dict[str, Any]],
    benchmarks: Optional[Dict[str, Any]],
    percentiles: Optional[Dict[str, Any]],
) -> List[str]:
    thresholds = _load_thresholds()
    flags: List[str] = []

    retirement_ratio = current.get("retirement_ratio")
    issued_t = current.get("issued_t") or 0
    retired_t = current.get("retired_t") or 0
    issued_yoy_pct = current.get("issued_yoy_pct")
    retired_yoy_pct = current.get("retired_yoy_pct")
    ratio_yoy_delta = current.get("ratio_yoy_delta")

    if benchmarks:
        p25 = benchmarks.get("p25_retirement_ratio")
        p75 = benchmarks.get("p75_retirement_ratio")
        if retirement_ratio is not None and p75 is not None and retirement_ratio >= p75:
            flags.append("uptake_above_registry_p75")
        if retirement_ratio is not None and p25 is not None and retirement_ratio <= p25:
            flags.append("uptake_below_registry_p25")

    if ratio_yoy_delta is not None:
        if ratio_yoy_delta <= thresholds.get("ratio_decline_delta", -0.1):
            flags.append("uptake_declined_materially")
        if ratio_yoy_delta >= thresholds.get("ratio_surge_delta", 0.1):
            flags.append("uptake_improved_materially")

    if issued_yoy_pct is not None and issued_yoy_pct >= thresholds.get("issuance_surge_pct", 0.5):
        flags.append("issuance_surge_outlier")
    if retired_yoy_pct is not None and retired_yoy_pct >= thresholds.get("retirement_surge_pct", 0.5):
        flags.append("retirements_surge_outlier")

    if issued_t >= thresholds.get("stagnant_min_issued", 1) and retired_t == 0:
        flags.append("stagnant_no_retirements")

    if previous:
        prev_issued = previous.get("issued_t") or 0
        prev_retired = previous.get("retired_t") or 0
        if prev_issued == 0 and issued_t > 0:
            flags.append("newly_active")
        if prev_retired == 0 and retired_t > 0:
            flags.append("newly_retiring")

    if percentiles:
        prev_pctile = percentiles.get("prev_retirement_ratio_pctile")
        curr_pctile = percentiles.get("retirement_ratio_pctile")
        if (
            prev_pctile is not None
            and curr_pctile is not None
            and curr_pctile - prev_pctile >= thresholds.get("peer_rank_jump_pct", 20)
        ):
            flags.append("peer_rank_jump_20pct")

    return flags
