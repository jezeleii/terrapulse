import json
from typing import Any, Dict

PROMPT_VERSION = "v1"


def build_prompt(payload: Dict[str, Any]) -> str:
    payload_json = json.dumps(payload, ensure_ascii=True)
    sources = payload.get("sources")
    sources_block = ""
    if isinstance(sources, dict) and sources:
        sources_block = f"Sources:{json.dumps(sources, ensure_ascii=True)}\n"
    return (
        "You are a strict JSON generator.\n"
        "Return a single JSON object wrapped in <json>...</json>. No prose, no markdown.\n"
        "Write clear, detailed prose in summary[].text while staying grounded in the data.\n"
        "Focus insights on registry-level and regional projects; if missing, say 'insufficient data'.\n"
        "Use only numbers present in payload or sources; if missing say 'insufficient data'.\n"
        "Schema: {summary:[{text,citations}], peer_comparison, confidence}\n"
        "Summary must have 3-5 items, each 2-3 sentences. Citations must be payload keys or sources.<id>.\n"
        "confidence must be one of: low, medium, high.\n"
        "Example:\n"
        "<json>{\"summary\":[{\"text\":\"Issued credits: 123; retired: 45.\","
        "\"citations\":[\"current.issued_t\",\"current.retired_t\"]}],"
        "\"peer_comparison\":\"insufficient data\",\"confidence\":\"low\"}</json>\n"
        f"{sources_block}"
        f"Payload:{payload_json}\n"
    )
