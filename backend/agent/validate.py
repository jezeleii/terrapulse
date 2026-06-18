import json
import re
from typing import Any, Dict, Iterable, List, Set, Tuple


_NUMBER_RE = re.compile(r"-?\d[\d,]*\.?\d*%?")


def _collect_payload_numbers(payload: Dict[str, Any]) -> Set[str]:
    numbers: Set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)
        elif isinstance(value, (int, float)):
            raw = str(value)
            numbers.add(_normalize_number(raw))
        elif isinstance(value, str):
            for number in _extract_numbers(value):
                if number:
                    numbers.add(number)

    visit(payload)
    return numbers


def _normalize_number(raw: str) -> str:
    return raw.replace(",", "").replace("%", "")


def _extract_numbers(text: str) -> List[str]:
    return [_normalize_number(match.group(0)) for match in _NUMBER_RE.finditer(text)]


def _collect_payload_keys(payload: Dict[str, Any]) -> Set[str]:
    keys: Set[str] = set()

    def visit(prefix: str, value: Any) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                next_prefix = f"{prefix}.{key}" if prefix else key
                keys.add(next_prefix)
                visit(next_prefix, item)

    visit("", payload)
    return keys


def _extract_first_json_object(raw_text: str) -> str | None:
    start = raw_text.find("{")
    if start == -1:
        return None
    depth = 0
    for idx, char in enumerate(raw_text[start:], start=start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw_text[start : idx + 1]
    return None


def _extract_tagged_json(raw_text: str) -> str | None:
    tag_pairs = [
        ("<json>", "</json>"),
        ("json>", "/json>"),
        ("<json>", "/json>"),
    ]
    for start_tag, end_tag in tag_pairs:
        start = raw_text.find(start_tag)
        if start == -1:
            continue
        end = raw_text.find(end_tag, start + len(start_tag))
        if end == -1:
            continue
        return raw_text[start + len(start_tag) : end].strip()
    # Fallback split for malformed tags.
    if "json>" in raw_text and "/json>" in raw_text:
        _, _, rest = raw_text.partition("json>")
        content, _, _ = rest.partition("/json>")
        return content.strip()
    return None


def _extract_json_from_summary_fragment(raw_text: str) -> str | None:
    marker = "\"summary\""
    idx = raw_text.find(marker)
    if idx == -1:
        return None
    fragment = raw_text[idx:]
    if not fragment.startswith("{"):
        fragment = "{" + fragment
    if not fragment.rstrip().endswith("}"):
        fragment = fragment.rstrip()
        fragment += "}"
    return fragment


def validate_output(raw_text: str, payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any] | None, str | None]:
    parse_error: str | None = None
    parsed: Dict[str, Any] | None = None
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        parse_error = f"json_parse_error: {exc}"
        extracted = _extract_tagged_json(raw_text)
        if not extracted:
            extracted = _extract_first_json_object(raw_text)
        if not extracted:
            extracted = _extract_json_from_summary_fragment(raw_text)
        if extracted:
            candidate = extracted.strip()
            if candidate and not candidate.lstrip().startswith("{"):
                candidate = "{" + candidate + "}"
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                parsed = None

    if not isinstance(parsed, dict):
        return False, None, parse_error or "output_not_object"

    summary = parsed.get("summary")
    if not isinstance(summary, list) or not (3 <= len(summary) <= 5):
        return False, None, "summary_length_invalid"

    payload_numbers = _collect_payload_numbers(payload)
    payload_keys = _collect_payload_keys(payload)

    for item in summary:
        if not isinstance(item, dict):
            return False, None, "summary_item_not_object"
        text = item.get("text")
        citations = item.get("citations")
        if not isinstance(text, str) or not text.strip():
            return False, None, "summary_text_invalid"
        if not isinstance(citations, list) or not citations:
            return False, None, "summary_citations_missing"
        if not all(isinstance(cite, str) and cite in payload_keys for cite in citations):
            return False, None, "summary_citations_invalid"
        for number in _extract_numbers(text):
            if number and number not in payload_numbers:
                return False, None, "summary_contains_unknown_number"

    confidence = parsed.get("confidence")
    if confidence not in ("low", "medium", "high"):
        return False, None, "confidence_invalid"

    return True, parsed, None
