from __future__ import annotations

import os
from datetime import date
from pathlib import Path
import json
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Any, Dict, List, Optional

import psycopg
from psycopg import errors as pg_errors
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from psycopg.rows import dict_row


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / "etl" / ".env")
load_dotenv(BASE_DIR / "backend" / ".env")
KAPSARC_API_BASE = os.environ.get("KAPSARC_API_BASE", "https://datasource.kapsarc.org/api/explore/v2.1")
KAPSARC_CATEGORY_DATASET = os.environ.get(
    "KAPSARC_CATEGORY_DATASET",
    "vcm-transaction-volumes-values-and-prices-by-project-category",
)
KAPSARC_REGION_DATASET = os.environ.get(
    "KAPSARC_REGION_DATASET",
    "vcm-transaction-volumes-values-and-prices-by-project-region",
)
KAPSARC_MARKET_SIZE_DATASET = os.environ.get(
    "KAPSARC_MARKET_SIZE_DATASET",
    "voluntary-carbon-market-size-by-value-and-volume-of-traded-carbon-credits",
)
KAPSARC_TRANSACTION_PRICE_DATASET = os.environ.get(
    "KAPSARC_TRANSACTION_PRICE_DATASET",
    "annual-voluntary-carbon-market-transaction-price",
)
KAPSARC_ISSUANCES_BY_MECHANISM_DATASET = os.environ.get(
    "KAPSARC_ISSUANCES_BY_MECHANISM_DATASET",
    "annual-volume-of-issuances-by-crediting-mechanism",
)
KAPSARC_ISSUANCES_BY_SECTOR_DATASET = os.environ.get(
    "KAPSARC_ISSUANCES_BY_SECTOR_DATASET",
    "issuance-volumes-by-sector-and-type-of-mechanism",
)
KAPSARC_CREDITING_MECHANISMS_DATASET = os.environ.get(
    "KAPSARC_CREDITING_MECHANISMS_DATASET",
    "government-administrated-carbon-crediting-mechanisms",
)
KAPSARC_COMPLIANCE_INSTRUMENTS_DATASET = os.environ.get(
    "KAPSARC_COMPLIANCE_INSTRUMENTS_DATASET",
    "compliance-carbon-pricing-instruments",
)
KAPSARC_COMPLIANCE_PRICES_DATASET = os.environ.get(
    "KAPSARC_COMPLIANCE_PRICES_DATASET",
    "compliance-carbon-pricing-instruments-prices",
)
KAPSARC_CACHE_TTL = int(os.environ.get("KAPSARC_CACHE_TTL", "1800"))
KAPSARC_API_KEY = os.environ.get("KAPSARC_API_KEY")
_kapsarc_cache: Dict[str, Dict[str, Any]] = {}


def get_db_url() -> str:
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        raise RuntimeError("SUPABASE_DB_URL is not set. Configure it in your environment or etl/.env.")
    return db_url


def get_connection():
    return psycopg.connect(
        get_db_url(),
        row_factory=dict_row,
        connect_timeout=10,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


app = FastAPI(
    title="VCM Analysis API",
    version="0.1.0",
    description="Metrics + memo endpoints backed by Supabase vcm_projects data.",
)

frontend_origins = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MemoRequest(BaseModel):
    project_id: str


class MemoResponse(BaseModel):
    project_id: str
    memo: str
    stats: Dict[str, Any]
    insights: List[str]


class InsightRecord(BaseModel):
    project_id: str
    registry: Optional[str]
    year: int
    insight_json: Dict[str, Any]
    model_name: str
    prompt_version: Optional[str]
    metrics_hash: Optional[str]
    generated_at: Optional[str]


def _to_float(value: Optional[Any]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Optional[Any]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _get_field(row: Dict[str, Any], *candidates: str) -> Optional[str]:
    for key in candidates:
        value = row.get(key)
        if value not in (None, ""):
            return value
    return None


def _fetch_kapsarc_dataset(dataset_id: str) -> List[Dict[str, Any]]:
    cached = _kapsarc_cache.get(dataset_id)
    now = time.time()
    if cached and now - cached["ts"] < KAPSARC_CACHE_TTL:
        return cached["rows"]

    query_params = {"limit": 100}
    if KAPSARC_API_KEY:
        query_params["apikey"] = KAPSARC_API_KEY
    query = urlencode(query_params)
    url = f"{KAPSARC_API_BASE}/catalog/datasets/{dataset_id}/records?{query}"
    headers = {"User-Agent": "VCM-Analysis/1.0"}
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"KAPSARC fetch failed: {exc}. URL: {url}") from exc

    rows = []
    for record in payload.get("results", []):
        if isinstance(record, dict) and "record" in record:
            rows.append(record.get("record", {}).get("fields", {}) or {})
        else:
            rows.append(record if isinstance(record, dict) else {})
    _kapsarc_cache[dataset_id] = {"ts": now, "rows": rows}
    return rows


def _load_carbon_price_rows_from_api(dataset_id: str, dimension: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
            year = _to_int(_get_field(row, "year", "transaction_year", "Year"))
            dimension_value = _get_field(row, dimension, "project_category", "project_region", "category", "region")
            volume = _to_float(
                _get_field(
                    row,
                    "transaction_volume_mtco2e",
                    "transaction_volume",
                    "transaction_volume_mt",
                    "volume_mtco2e",
                    "volume",
                )
            )
            value = _to_float(
                _get_field(
                    row,
                    "transaction_value_usd_millions",
                    "transaction_value_usd",
                    "transaction_value",
                    "value_million",
                    "value_usd_millions",
                    "value",
                )
            )
            avg_price = _to_float(
                _get_field(
                    row,
                    "average_price_per_tco2e",
                    "average_price",
                    "avg_price",
                    "price_tco2e",
                    "price",
                )
            )

            if year is None or not dimension_value:
                continue

            if avg_price is None and volume and value:
                avg_price = value / volume

            records.append(
                {
                    "year": year,
                    dimension: dimension_value,
                    "volume": volume,
                    "value": value,
                    "avg_price": avg_price,
                }
            )

    return records


def _load_market_size_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        year = _to_int(_get_field(row, "tramsaction_year", "transaction_year", "year", "Year"))
        annual_value = _to_float(_get_field(row, "annual_value_m", "annual_value"))
        annual_volume = _to_float(_get_field(row, "annual_volume_mtc2e", "annual_volume"))
        cumulative_value = _to_float(_get_field(row, "cumulative_value_m", "cumulative_value"))
        cumulative_volume = _to_float(_get_field(row, "cumulative_volume_mtc2e", "cumulative_volume"))

        if year is None:
            continue

        avg_price = None
        if annual_value is not None and annual_volume:
            avg_price = annual_value / annual_volume

        records.append(
            {
                "year": year,
                "annual_value_m": annual_value,
                "annual_volume_mtc2e": annual_volume,
                "cumulative_value_m": cumulative_value,
                "cumulative_volume_mtc2e": cumulative_volume,
                "avg_price": avg_price,
            }
        )

    return records


def _load_transaction_price_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        year = _to_int(_get_field(row, "year", "Year"))
        buyer = _get_field(row, "buyer", "Buyer")
        vintage_status = _get_field(row, "credit_vintage_status", "vintage_status", "Credit Vintage Status")
        value = _to_float(_get_field(row, "value", "price", "VALUE ($)"))

        if year is None:
            continue

        records.append(
            {
                "year": year,
                "buyer": buyer or "Unknown",
                "credit_vintage_status": vintage_status or "Unknown",
                "value": value,
            }
        )

    return records


def _load_issuances_by_mechanism_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        year = _to_int(_get_field(row, "year", "Year"))
        mechanism = _get_field(row, "mechanism", "Mechanism")
        issued = _to_float(_get_field(row, "issued_credits", "issued", "Issued credits"))

        if year is None or not mechanism:
            continue

        records.append({"year": year, "mechanism": mechanism, "issued_credits": issued})

    return records


def _load_issuances_by_sector_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        year = _to_int(_get_field(row, "year", "Year"))
        sector = _get_field(row, "sector", "Sector")
        mechanism_type = _get_field(row, "type_of_mechanism", "mechanism_type", "Type of mechanism")
        volume = _to_float(_get_field(row, "international", "issuance_volume", "Issuance volume (ktonCO2e)"))

        if year is None or not sector:
            continue

        records.append(
            {
                "year": year,
                "sector": sector,
                "type_of_mechanism": mechanism_type or "Unknown",
                "issuance_kton": volume,
            }
        )

    return records


def _load_crediting_mechanisms_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        mechanism = _get_field(row, "mechanism", "Mechanism")
        region = _get_field(row, "region", "Region")
        status = _get_field(row, "status", "Status")
        price_range = _get_field(row, "price_range", "Price (Range)")
        issued = _to_float(
            _get_field(
                row,
                "cumulative_credits_issued_in_kt_until_31_12_2024",
                "cumulative_credits_issued",
            )
        )
        retired = _to_float(
            _get_field(
                row,
                "cumulative_credits_retired_in_kt_until_31_12_2024",
                "cumulative_credits_retired",
            )
        )
        projects = _to_float(
            _get_field(
                row,
                "cumulative_projects_registered_until_31_12_2024",
                "cumulative_projects_registered",
            )
        )

        if not mechanism:
            continue

        records.append(
            {
                "mechanism": mechanism,
                "region": region or "Unknown",
                "status": status or "Unknown",
                "price_range": price_range,
                "cumulative_issued_kt": issued,
                "cumulative_retired_kt": retired,
                "cumulative_projects": projects,
            }
        )

    return records


def _load_compliance_instruments_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        instrument = _get_field(row, "instrument_name", "Instrument name", "name_of_the_initiative")
        instrument_type = _get_field(row, "instrument_type", "Instrument Type", "Type")
        region = _get_field(row, "region", "Region")
        status = _get_field(row, "status", "Status")
        price_2024 = _to_float(_get_field(row, "2024_price", "price_2024"))

        if not instrument:
            continue

        records.append(
            {
                "instrument": instrument,
                "instrument_type": instrument_type or "Unknown",
                "region": region or "Unknown",
                "status": status or "Unknown",
                "price_2024": price_2024,
            }
        )

    return records


def _load_compliance_prices_rows_from_api(dataset_id: str) -> List[Dict[str, Any]]:
    rows = _fetch_kapsarc_dataset(dataset_id)
    records: List[Dict[str, Any]] = []
    for row in rows:
        year = _to_int(_get_field(row, "year", "Price Year"))
        instrument_type = _get_field(row, "instrument_type", "Instrument Type")
        region = _get_field(row, "region", "Region")
        price = _to_float(_get_field(row, "price", "Price"))

        if year is None:
            continue

        records.append(
            {
                "year": year,
                "instrument_type": instrument_type or "Unknown",
                "region": region or "Unknown",
                "price": price,
            }
        )

    return records


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/projects/summary")
def project_summary() -> Dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("select count(*) as total_projects, max(as_of_date) as latest_snapshot from public.vcm_projects;")
            totals = cur.fetchone()
            totals = dict(totals) if totals else {"total_projects": 0, "latest_snapshot": None}

            cur.execute(
                """
                select registry, count(*) as project_count
                from public.vcm_projects
                group by registry
                order by project_count desc;
                """
            )
            registries = [dict(row) for row in (cur.fetchall() or [])]

            cur.execute(
                """
                select uptake_band, count(*) as project_count
                from public.vcm_project_metrics
                group by uptake_band
                order by project_count desc;
                """
            )
            uptake = [dict(row) for row in (cur.fetchall() or [])]

            cur.execute("select count(*) as total_metrics from public.vcm_project_metrics;")
            metrics_row = cur.fetchone()
            metrics_count = dict(metrics_row) if metrics_row else {"total_metrics": 0}

    return {
        "total_projects": totals["total_projects"],
        "latest_snapshot": totals["latest_snapshot"],
        "registry_breakdown": registries,
        "uptake_breakdown": uptake,
        "metrics_rows": metrics_count["total_metrics"],
    }


@app.get("/projects-summary")
def project_summary_alias() -> Dict[str, Any]:
    return project_summary()


@app.get("/projects")
def list_projects(limit: int | None = None, offset: int = 0) -> List[Dict[str, Any]]:
    offset = max(0, offset)
    view_query = """
        select
            project_id,
            project_name,
            registry,
            status,
            scope,
            project_type,
            reduction_removal,
            region,
            country,
            methodology,
            verifier,
            registry_documents,
            issued_total,
            retired_total,
            buffer_deposits_total,
            uptake_band,
            uptake_ratio,
            peer_uptake_percentile
        from public.v_project_explorer
        order by issued_total desc
        {limit_clause}
        offset %s;
    """
    fallback_query = """
        select
            project_id,
            project_name,
            registry,
            status,
            scope,
            project_type,
            reduction_removal,
            region,
            country,
            methodology,
            verifier,
            registry_documents,
            issued_total,
            retired_total,
            buffer_deposits_total,
            null::text as uptake_band
        from public.vcm_projects
        order by issued_total desc
        {limit_clause}
        offset %s;
    """
    limit_clause = ""
    params: list[object] = [offset]
    if limit is not None:
        limit_clause = "limit %s"
        params = [max(1, limit), offset]
    rows = []
    for attempt in range(2):
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    try:
                        cur.execute(view_query.format(limit_clause=limit_clause), params)
                    except pg_errors.UndefinedTable:
                        cur.execute(fallback_query.format(limit_clause=limit_clause), params)
                    rows = [dict(row) for row in (cur.fetchall() or [])]
            break
        except psycopg.OperationalError as exc:
            if attempt == 0:
                continue
            raise HTTPException(status_code=503, detail="Database connection error.") from exc

    payload = []
    for row in rows:
        issued = _to_float(row.get("issued_total")) or 0.0
        buffer_total = _to_float(row.get("buffer_deposits_total")) or 0.0
        buffer_percent = (buffer_total / issued * 100) if issued > 0 else 0.0
        payload.append(
            {
                "project_id": row["project_id"],
                "project_name": row["project_name"],
                "registry": row["registry"],
                "status": row.get("status"),
                "scope": row.get("scope"),
                "project_type": row.get("project_type"),
                "reduction_removal": row.get("reduction_removal"),
                "region": row.get("region"),
                "country": row.get("country"),
                "methodology": row.get("methodology"),
                "verifier": row.get("verifier"),
                "registry_documents": row.get("registry_documents"),
                "issued_total": issued,
                "retired_total": _to_float(row.get("retired_total")) or 0.0,
                "buffer_percent": buffer_percent,
                "uptake_band": row.get("uptake_band"),
            }
        )

    return JSONResponse(jsonable_encoder(payload))


@app.get("/projects/{project_id}")
def project_detail(project_id: str) -> Dict[str, Any]:
    query = """
        select
            p.project_id, p.project_name, p.registry, p.status, p.scope,
            p.project_type, p.reduction_removal, p.methodology, p.methodology_version,
            p.region, p.country, p.state, p.developer, p.operator,
            p.issued_total, p.retired_total, p.remaining_total, p.buffer_deposits_total,
            p.as_of_date,
            m.uptake_band
        from public.vcm_projects p
        left join public.vcm_project_metrics m on m.project_id = p.project_id
        where p.project_id = %s;
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (project_id,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    row = dict(row)

    payload = {
        "project_id": row["project_id"],
        "project_name": row["project_name"],
        "registry": row["registry"],
        "status": row["status"],
        "scope": row["scope"],
        "project_type": row["project_type"],
        "reduction_removal": row["reduction_removal"],
        "methodology": row["methodology"],
        "methodology_version": row["methodology_version"],
        "region": row["region"],
        "country": row["country"],
        "state": row["state"],
        "developer": row["developer"],
        "operator": row["operator"],
        "issued_total": _to_float(row["issued_total"]),
        "retired_total": _to_float(row["retired_total"]),
        "remaining_total": _to_float(row["remaining_total"]),
        "buffer_deposits_total": _to_float(row["buffer_deposits_total"]),
        "as_of_date": row["as_of_date"],
        "uptake_band": row.get("uptake_band"),
    }

    return JSONResponse(jsonable_encoder(payload))


@app.get("/dashboard/overview")
def dashboard_overview() -> Dict[str, Any]:
    query = "select * from public.v_dashboard_overview;"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Dashboard overview not available")

    return JSONResponse(jsonable_encoder(dict(row)))


@app.get("/dashboard/timeline")
def dashboard_timeline() -> List[Dict[str, Any]]:
    query = """
        select
            year,
            sum(issued_issuance) as issued_total,
            sum(retired_total) as retired_total
        from public.vcm_project_yearly
        where year >= 1996
        group by 1
        order by 1;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = [dict(row) for row in (cur.fetchall() or [])]

    payload = []
    for row in rows:
        year_value = row.get("year")
        month_label = str(year_value) if year_value is not None else "Unknown"
        payload.append(
            {
                "month": month_label,
                "issued_total": _to_float(row.get("issued_total")) or 0.0,
                "retired_total": _to_float(row.get("retired_total")) or 0.0,
            }
        )
    return JSONResponse(jsonable_encoder(payload))


@app.get("/dashboard-timeline")
def dashboard_timeline_alias() -> List[Dict[str, Any]]:
    return dashboard_timeline()


@app.get("/insights")
def list_insights(
    project_id: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    query = """
        select
            canonical_project_id,
            registry,
            year,
            insight_json,
            model_name,
            prompt_version,
            metrics_hash,
            generated_at
        from public.project_year_insights
        where (%s is null or canonical_project_id = %s)
          and (%s is null or year = %s)
        order by year desc, generated_at desc
        limit %s
        offset %s;
    """
    params = [project_id, project_id, year, year, limit, offset]
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = [dict(row) for row in (cur.fetchall() or [])]
    except pg_errors.UndefinedTable:
        rows = []

    payload: List[Dict[str, Any]] = []
    for row in rows:
        payload.append(
            {
                "project_id": row.get("canonical_project_id"),
                "registry": row.get("registry"),
                "year": _to_int(row.get("year")) or 0,
                "insight_json": row.get("insight_json") or {},
                "model_name": row.get("model_name"),
                "prompt_version": row.get("prompt_version"),
                "metrics_hash": row.get("metrics_hash"),
                "generated_at": row.get("generated_at"),
            }
        )

    return JSONResponse(jsonable_encoder(payload))


@app.get("/carbon-prices")
def carbon_prices() -> Dict[str, Any]:
    warnings: List[str] = []

    def safe_load(loader, dataset_label: str):
        try:
            return loader()
        except Exception as exc:
            warnings.append(f"{dataset_label}: {exc}")
            return []

    regions = safe_load(
        lambda: _load_carbon_price_rows_from_api(KAPSARC_REGION_DATASET, "region"),
        "regions",
    )
    market_size = safe_load(
        lambda: _load_market_size_rows_from_api(KAPSARC_MARKET_SIZE_DATASET),
        "market_size",
    )

    categories = safe_load(
        lambda: _load_carbon_price_rows_from_api(KAPSARC_CATEGORY_DATASET, "category"),
        "categories",
    )
    transaction_prices = safe_load(
        lambda: _load_transaction_price_rows_from_api(KAPSARC_TRANSACTION_PRICE_DATASET),
        "transaction_prices",
    )
    issuances_by_mechanism = safe_load(
        lambda: _load_issuances_by_mechanism_rows_from_api(KAPSARC_ISSUANCES_BY_MECHANISM_DATASET),
        "issuances_by_mechanism",
    )
    issuances_by_sector = safe_load(
        lambda: _load_issuances_by_sector_rows_from_api(KAPSARC_ISSUANCES_BY_SECTOR_DATASET),
        "issuances_by_sector",
    )
    crediting_mechanisms = safe_load(
        lambda: _load_crediting_mechanisms_rows_from_api(KAPSARC_CREDITING_MECHANISMS_DATASET),
        "crediting_mechanisms",
    )
    compliance_instruments = safe_load(
        lambda: _load_compliance_instruments_rows_from_api(KAPSARC_COMPLIANCE_INSTRUMENTS_DATASET),
        "compliance_instruments",
    )
    compliance_prices = safe_load(
        lambda: _load_compliance_prices_rows_from_api(KAPSARC_COMPLIANCE_PRICES_DATASET),
        "compliance_prices",
    )

    years = sorted({row["year"] for row in categories} | {row["year"] for row in regions})

    timeline_map: Dict[int, Dict[str, float]] = {}
    for row in categories:
        year = row["year"]
        volume = row.get("volume") or 0.0
        avg_price = row.get("avg_price")
        value = row.get("value") or 0.0
        entry = timeline_map.setdefault(
            year,
            {
                "year": year,
                "total_volume": 0.0,
                "total_value": 0.0,
                "weighted_price_sum": 0.0,
            },
        )
        entry["total_volume"] += volume
        entry["total_value"] += value
        if volume and avg_price is not None:
            entry["weighted_price_sum"] += volume * avg_price

    timeline = []
    for year in sorted(timeline_map.keys()):
        entry = timeline_map[year]
        total_volume = entry["total_volume"]
        avg_price = entry["weighted_price_sum"] / total_volume if total_volume else None
        timeline.append(
            {
                "year": year,
                "avg_price": avg_price,
                "total_volume": total_volume,
                "total_value": entry["total_value"],
            }
        )

    payload = {
        "years": years,
        "timeline": timeline,
        "categories": categories,
        "regions": regions,
        "market_size": market_size,
        "transaction_prices": transaction_prices,
        "issuances_by_mechanism": issuances_by_mechanism,
        "issuances_by_sector": issuances_by_sector,
        "crediting_mechanisms": crediting_mechanisms,
        "compliance_instruments": compliance_instruments,
        "compliance_prices": compliance_prices,
        "warnings": warnings,
    }
    return JSONResponse(jsonable_encoder(payload))


@app.post("/ai/memo", response_model=MemoResponse)
def ai_memo(request: MemoRequest) -> MemoResponse:
    query = """
        select
            p.project_id, p.project_name, p.registry, p.status, p.scope,
            p.project_type, p.reduction_removal, p.methodology,
            p.region, p.country, p.state, p.developer, p.operator,
            p.issued_total, p.retired_total, p.remaining_total, p.buffer_deposits_total,
            p.as_of_date,
            m.uptake_band
        from public.vcm_projects p
        left join public.vcm_project_metrics m on m.project_id = p.project_id
        where p.project_id = %s;
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (request.project_id,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    row = dict(row)

    issued = _to_float(row["issued_total"]) or 0.0
    retired = _to_float(row["retired_total"]) or 0.0
    remaining = _to_float(row["remaining_total"]) or 0.0
    uptake_pct = None

    location = ", ".join(filter(None, [row.get("state"), row.get("country")])) or "unknown location"
    memo_parts = [
        f"{row['project_name']} ({row['project_id']}) is a {row.get('project_type') or 'project'} in {location}.",
        f"It is listed with {row.get('registry') or 'an unknown registry'} and currently marked as {row.get('status') or 'unknown status'}.",
        f"Scope: {row.get('scope') or 'n/a'}, Methodology: {row.get('methodology') or 'n/a'}.",
        f"Credits issued: {issued:,.0f}, retired: {retired:,.0f}, remaining: {remaining:,.0f}."
    ]

    if uptake_pct is not None:
        memo_parts.append(f"Credit uptake is {uptake_pct:.1f}% based on Berkeley metrics.")
    if row.get("uptake_band"):
        memo_parts.append(f"This places the project in the '{row['uptake_band']}' uptake band.")
    if row.get("developer"):
        memo_parts.append(f"Developer: {row['developer']}.")
    if row.get("operator"):
        memo_parts.append(f"Operator / site location: {row['operator']}.")

    memo_text = " ".join(memo_parts)

    insights = []
    if retired > 0 and issued > 0:
        retire_ratio = retired / issued
        if retire_ratio > 0.6:
            insights.append("High retirement ratio relative to issuances.")
        elif retire_ratio < 0.2:
            insights.append("Most credits remain unretired.")
    if row.get("reduction_removal"):
        insights.append(f"Classified as a {row['reduction_removal'].lower()} project.")
    if row.get("uptake_band"):
        insights.append(f"Tagged under {row['uptake_band']} uptake.")

    response = MemoResponse(
        project_id=row["project_id"],
        memo=memo_text,
        stats={
            "issued_total": issued,
            "retired_total": retired,
            "remaining_total": remaining,
            "buffer_deposits_total": _to_float(row["buffer_deposits_total"]) or 0.0,
            "uptake_band": row.get("uptake_band"),
            "as_of_date": row.get("as_of_date"),
        },
        insights=insights,
    )
    return response
