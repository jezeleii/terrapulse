import argparse
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

from hashing import stable_hash
from model_runner import run_model
from payloads import build_payload
from prompt import PROMPT_VERSION, build_prompt
from rules import compute_flags
from validate import validate_output

from pdf_semantic import build_pdf_index, retrieve_sources, summarize_index

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / "backend" / ".env")
load_dotenv(BASE_DIR / "etl" / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

MODEL_NAME = os.environ.get("INSIGHTS_MODEL_NAME", "google/flan-t5-base")
PDF_MODEL_NAME = os.environ.get("INSIGHTS_PDF_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
DEFAULT_PDF_DIR = Path(__file__).resolve().parent / "pdf"
DEFAULT_PDF_INDEX = Path(__file__).resolve().parent / "pdf_index.sqlite"


def _format_value(value: Any) -> str:
    if value is None:
        return "insufficient data"
    return str(value)


def _extract_source_snippet(sources: Dict[str, Any]) -> Optional[str]:
    if not sources:
        return None
    first_key = sorted(sources.keys())[0]
    first = sources.get(first_key) or {}
    text = first.get("text")
    if not isinstance(text, str) or not text.strip():
        return None
    return text.strip()


def build_fallback_insight(payload: Dict[str, Any]) -> Dict[str, Any]:
    current = payload.get("current") or {}
    sources = payload.get("sources") or {}
    source_snippet = _extract_source_snippet(sources)
    summary = [
        {
            "text": (
                "Issued credits: "
                f"{_format_value(current.get('issued_t'))}; retired: "
                f"{_format_value(current.get('retired_t'))}."
            ),
            "citations": ["current.issued_t", "current.retired_t"],
        },
        {
            "text": (
                "Retirement ratio: "
                f"{_format_value(current.get('retirement_ratio'))}; net balance: "
                f"{_format_value(current.get('net_balance_t'))}."
            ),
            "citations": ["current.retirement_ratio", "current.net_balance_t"],
        },
    ]
    if source_snippet:
        summary.append(
            {
                "text": f"Report context: {source_snippet}",
                "citations": ["sources.src1"],
            }
        )
    else:
        summary.append(
            {
                "text": (
                    "YoY issued change: "
                    f"{_format_value(current.get('issued_yoy_pct'))}; YoY retired change: "
                    f"{_format_value(current.get('retired_yoy_pct'))}."
                ),
                "citations": ["current.issued_yoy_pct", "current.retired_yoy_pct"],
            }
        )
    return {
        "summary": summary,
        "peer_comparison": "insufficient data",
        "confidence": "low",
    }


def build_deterministic_insight(payload: Dict[str, Any]) -> Dict[str, Any]:
    current = payload.get("current") or {}
    benchmarks = payload.get("benchmarks") or {}
    percentiles = payload.get("percentiles") or {}
    flags = payload.get("flags") or []
    sources = payload.get("sources") or {}
    source_snippet = _extract_source_snippet(sources)

    summary: List[Dict[str, Any]] = []
    summary.append(
        {
            "text": (
                "Issued credits: "
                f"{_format_value(current.get('issued_t'))}; retired: "
                f"{_format_value(current.get('retired_t'))}. "
                "Net balance is "
                f"{_format_value(current.get('net_balance_t'))}."
            ),
            "citations": ["current.issued_t", "current.retired_t", "current.net_balance_t"],
        }
    )

    ratio = current.get("retirement_ratio")
    median_ratio = benchmarks.get("median_retirement_ratio")
    ratio_text = f"Retirement ratio is { _format_value(ratio) }."
    ratio_cites = ["current.retirement_ratio"]
    if median_ratio is not None:
        ratio_text += f" Registry median is {_format_value(median_ratio)}."
        ratio_cites.append("benchmarks.median_retirement_ratio")
    summary.append({"text": ratio_text, "citations": ratio_cites})

    issued_pctile = percentiles.get("issued_yoy_pctile")
    retired_pctile = percentiles.get("retired_yoy_pctile")
    pctile_text = (
        "Percentile positioning: issued YoY percentile "
        f"{_format_value(issued_pctile)}; retired YoY percentile "
        f"{_format_value(retired_pctile)}."
    )
    summary.append(
        {
            "text": pctile_text,
            "citations": ["percentiles.issued_yoy_pctile", "percentiles.retired_yoy_pctile"],
        }
    )

    if flags:
        summary.append(
            {
                "text": "Flags: " + ", ".join(flags) + ".",
                "citations": ["flags"],
            }
        )

    if source_snippet:
        summary.append(
            {
                "text": f"Report context: {source_snippet}",
                "citations": ["sources.src1"],
            }
        )

    summary = summary[:5]
    if len(summary) < 3:
        summary.extend(build_fallback_insight(payload)["summary"][: 3 - len(summary)])

    return {
        "summary": summary,
        "peer_comparison": "insufficient data",
        "confidence": "low",
    }


def build_source_query(
    project_id: str,
    registry: str,
    year: int,
    payload: Dict[str, Any],
    flags: List[str],
) -> str:
    current = payload.get("current") or {}
    parts = [
        project_id,
        registry,
        str(year),
        "voluntary carbon market",
        "retirement ratio",
        "issuance",
        "retirements",
    ]
    if flags:
        parts.extend(flags)
    for key in ("issued_t", "retired_t", "retirement_ratio"):
        value = current.get(key)
        if value is not None:
            parts.append(f"{key} {value}")
    return " ".join(str(part) for part in parts if part)


def get_connection() -> psycopg.Connection:
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        raise RuntimeError("SUPABASE_DB_URL is not set.")
    return psycopg.connect(db_url, row_factory=dict_row, connect_timeout=10)


def fetch_worklist(limit: int, project_id: Optional[str], year: Optional[int]) -> List[Dict[str, Any]]:
    query = """
        select canonical_project_id, registry, year
        from project_year_metrics
        where (%s::text is null or canonical_project_id = %s)
          and (%s::int is null or year = %s)
        order by year desc
        limit %s;
    """
    params = [project_id, project_id, year, year, limit]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return [dict(row) for row in (cur.fetchall() or [])]


def fetch_metrics(project_id: str, registry: str, year: int) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    query = """
        select *
        from project_year_metrics
        where canonical_project_id = %s and registry = %s and year in (%s, %s)
        order by year desc;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (project_id, registry, year, year - 1))
            rows = [dict(row) for row in (cur.fetchall() or [])]

    current = next((row for row in rows if row["year"] == year), None)
    previous = next((row for row in rows if row["year"] == year - 1), None)
    if not current:
        raise ValueError("Missing current year metrics")
    return current, previous


def fetch_benchmarks(registry: str, year: int) -> Optional[Dict[str, Any]]:
    query = """
        select *
        from registry_year_benchmarks
        where registry = %s and year = %s;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (registry, year))
            row = cur.fetchone()
    return dict(row) if row else None


def fetch_percentiles(project_id: str, registry: str, year: int) -> Optional[Dict[str, Any]]:
    query = """
        select *
        from project_year_percentiles
        where canonical_project_id = %s and registry = %s and year in (%s, %s)
        order by year desc;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (project_id, registry, year, year - 1))
            rows = [dict(row) for row in (cur.fetchall() or [])]

    current = next((row for row in rows if row["year"] == year), None)
    previous = next((row for row in rows if row["year"] == year - 1), None)
    if current and previous:
        current["prev_retirement_ratio_pctile"] = previous.get("retirement_ratio_pctile")
    return current


def fetch_cache(project_id: str, year: int, model_name: str, metrics_hash: str) -> bool:
    query = """
        select 1
        from project_year_insights
        where canonical_project_id = %s and year = %s and model_name = %s and metrics_hash = %s
        limit 1;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (project_id, year, model_name, metrics_hash))
            return cur.fetchone() is not None


def upsert_insight(
    project_id: str,
    registry: str,
    year: int,
    insight_json: Dict[str, Any],
    metrics_hash: str,
    model_name: str,
) -> None:
    query = """
        insert into project_year_insights (
            canonical_project_id,
            registry,
            year,
            insight_json,
            model_name,
            prompt_version,
            metrics_hash
        ) values (%s, %s, %s, %s, %s, %s, %s)
        on conflict (canonical_project_id, year, model_name)
        do update set
            insight_json = excluded.insight_json,
            registry = excluded.registry,
            prompt_version = excluded.prompt_version,
            metrics_hash = excluded.metrics_hash,
            generated_at = now();
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    project_id,
                    registry,
                    year,
                    json.dumps(insight_json),
                    model_name,
                    PROMPT_VERSION,
                    metrics_hash,
                ),
            )
        conn.commit()


def log_run(
    project_id: str,
    registry: str,
    year: int,
    payload: Dict[str, Any],
    raw_output: str,
    status: str,
    duration_ms: int,
) -> None:
    query = """
        insert into project_year_insight_runs (
            canonical_project_id,
            registry,
            year,
            payload_snapshot,
            raw_model_output,
            parse_status,
            duration_ms
        ) values (%s, %s, %s, %s, %s, %s, %s);
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    project_id,
                    registry,
                    year,
                    json.dumps(payload),
                    raw_output,
                    status,
                    duration_ms,
                ),
            )
        conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--project-id", dest="project_id", type=str)
    parser.add_argument("--year", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--build-pdf-index", action="store_true")
    parser.add_argument("--pdf-dir", type=str, default=str(DEFAULT_PDF_DIR))
    parser.add_argument("--pdf-index", type=str, default=str(DEFAULT_PDF_INDEX))
    parser.add_argument("--pdf-top-k", type=int, default=3)
    parser.add_argument("--use-pdf-sources", action="store_true")
    parser.add_argument("--no-llm", action="store_true")
    args = parser.parse_args()

    if args.build_pdf_index:
        count = build_pdf_index(args.pdf_dir, args.pdf_index, PDF_MODEL_NAME)
        print(summarize_index(args.pdf_index))
        print(f"indexed_chunks={count}")
        return

    worklist = fetch_worklist(args.limit, args.project_id, args.year)
    processed = 0
    skipped = 0
    failures = 0
    started = time.time()

    for item in worklist:
        project_id = item["canonical_project_id"]
        registry = item["registry"]
        year = item["year"]
        start_time = time.time()

        current, previous = fetch_metrics(project_id, registry, year)
        benchmarks = fetch_benchmarks(registry, year)
        percentiles = fetch_percentiles(project_id, registry, year)
        flags = compute_flags(current, previous, benchmarks, percentiles)

        payload = build_payload(current, previous, benchmarks, percentiles, flags)
        metrics_hash = stable_hash(payload)

        if fetch_cache(project_id, year, MODEL_NAME, metrics_hash):
            skipped += 1
            continue

        if args.use_pdf_sources:
            source_query = build_source_query(project_id, registry, year, payload, flags)
            sources = retrieve_sources(
                source_query,
                args.pdf_index,
                args.pdf_top_k,
            )
            if sources:
                payload["sources"] = sources

        if args.no_llm:
            raw_output = ""
            parsed = build_deterministic_insight(payload)
            valid = True
            error = None
        else:
            prompt = build_prompt(payload)
            raw_output = run_model(prompt, MODEL_NAME)
            valid, parsed, error = validate_output(raw_output, payload)

        duration_ms = int((time.time() - start_time) * 1000)

        if not valid or parsed is None:
            print(
                json.dumps(
                    {
                        "project_id": project_id,
                        "year": year,
                        "error": error or "validation_failed",
                        "raw_output": raw_output[:1000],
                    },
                    indent=2,
                )
            )
            parsed = build_fallback_insight(payload)
            if not args.dry_run:
                upsert_insight(project_id, registry, year, parsed, metrics_hash, MODEL_NAME)
            log_run(project_id, registry, year, payload, raw_output, "fallback", duration_ms)
            processed += 1
            continue

        if not args.dry_run:
            upsert_insight(project_id, registry, year, parsed, metrics_hash, MODEL_NAME)
        status = "deterministic" if args.no_llm else "success"
        log_run(project_id, registry, year, payload, raw_output, status, duration_ms)
        processed += 1

    elapsed = time.time() - started
    print(
        json.dumps(
            {
                "processed": processed,
                "skipped": skipped,
                "failures": failures,
                "elapsed_seconds": round(elapsed, 2),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
