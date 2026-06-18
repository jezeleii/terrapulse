import { corsHeaders } from "../_shared/cors.ts";

const getEnv = (key: string, fallback?: string) => Deno.env.get(key) ?? fallback;

const KAPSARC_API_BASE = getEnv("KAPSARC_API_BASE", "https://datasource.kapsarc.org/api/explore/v2.1");
const KAPSARC_CATEGORY_DATASET = getEnv(
  "KAPSARC_CATEGORY_DATASET",
  "vcm-transaction-volumes-values-and-prices-by-project-category",
);
const KAPSARC_REGION_DATASET = getEnv(
  "KAPSARC_REGION_DATASET",
  "vcm-transaction-volumes-values-and-prices-by-project-region",
);
const KAPSARC_MARKET_SIZE_DATASET = getEnv(
  "KAPSARC_MARKET_SIZE_DATASET",
  "voluntary-carbon-market-size-by-value-and-volume-of-traded-carbon-credits",
);
const KAPSARC_TRANSACTION_PRICE_DATASET = getEnv(
  "KAPSARC_TRANSACTION_PRICE_DATASET",
  "annual-voluntary-carbon-market-transaction-price",
);
const KAPSARC_ISSUANCES_BY_MECHANISM_DATASET = getEnv(
  "KAPSARC_ISSUANCES_BY_MECHANISM_DATASET",
  "annual-volume-of-issuances-by-crediting-mechanism",
);
const KAPSARC_ISSUANCES_BY_SECTOR_DATASET = getEnv(
  "KAPSARC_ISSUANCES_BY_SECTOR_DATASET",
  "issuance-volumes-by-sector-and-type-of-mechanism",
);
const KAPSARC_CREDITING_MECHANISMS_DATASET = getEnv(
  "KAPSARC_CREDITING_MECHANISMS_DATASET",
  "government-administrated-carbon-crediting-mechanisms",
);
const KAPSARC_COMPLIANCE_INSTRUMENTS_DATASET = getEnv(
  "KAPSARC_COMPLIANCE_INSTRUMENTS_DATASET",
  "compliance-carbon-pricing-instruments",
);
const KAPSARC_COMPLIANCE_PRICES_DATASET = getEnv(
  "KAPSARC_COMPLIANCE_PRICES_DATASET",
  "compliance-carbon-pricing-instruments-prices",
);
const KAPSARC_API_KEY = getEnv("KAPSARC_API_KEY");

const toFloat = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const getField = (row: Record<string, unknown>, ...candidates: string[]) => {
  for (const key of candidates) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
};

const fetchKapsarcDataset = async (datasetId: string): Promise<Record<string, unknown>[]> => {
  const params = new URLSearchParams({ limit: "100" });
  if (KAPSARC_API_KEY) {
    params.set("apikey", KAPSARC_API_KEY);
  }
  const url = `${KAPSARC_API_BASE}/catalog/datasets/${datasetId}/records?${params.toString()}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "VCM-Analysis/1.0" },
  });
  if (!response.ok) {
    throw new Error(`KAPSARC fetch failed (${response.status}): ${url}`);
  }
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((record) => {
    if (record && typeof record === "object") {
      const wrapped = record as Record<string, unknown>;
      const maybeRecord = wrapped.record as Record<string, unknown> | undefined;
      const fields = maybeRecord?.fields as Record<string, unknown> | undefined;
      if (fields) return fields;
      return wrapped;
    }
    return {};
  });
};

const loadCarbonPriceRows = async (datasetId: string, dimension: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const year = toInt(getField(row, "year", "transaction_year", "Year"));
    const dimensionValue = getField(row, dimension, "project_category", "project_region", "category", "region");
    const volume = toFloat(
      getField(
        row,
        "transaction_volume_mtco2e",
        "transaction_volume",
        "transaction_volume_mt",
        "volume_mtco2e",
        "volume",
      ),
    );
    const value = toFloat(
      getField(
        row,
        "transaction_value_usd_millions",
        "transaction_value_usd",
        "transaction_value",
        "value_million",
        "value_usd_millions",
        "value",
      ),
    );
    let avgPrice = toFloat(
      getField(
        row,
        "average_price_per_tco2e",
        "average_price",
        "avg_price",
        "price_tco2e",
        "price",
      ),
    );

    if (year === null || !dimensionValue) {
      continue;
    }

    if (avgPrice === null && volume && value !== null) {
      avgPrice = value / volume;
    }

    records.push({
      year,
      [dimension]: dimensionValue,
      volume,
      value,
      avg_price: avgPrice,
    });
  }
  return records;
};

const loadMarketSizeRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const year = toInt(getField(row, "tramsaction_year", "transaction_year", "year", "Year"));
    const annualValue = toFloat(getField(row, "annual_value_m", "annual_value"));
    const annualVolume = toFloat(getField(row, "annual_volume_mtc2e", "annual_volume"));
    const cumulativeValue = toFloat(getField(row, "cumulative_value_m", "cumulative_value"));
    const cumulativeVolume = toFloat(getField(row, "cumulative_volume_mtc2e", "cumulative_volume"));

    if (year === null) {
      continue;
    }

    const avgPrice = annualValue !== null && annualVolume ? annualValue / annualVolume : null;

    records.push({
      year,
      annual_value_m: annualValue,
      annual_volume_mtc2e: annualVolume,
      cumulative_value_m: cumulativeValue,
      cumulative_volume_mtc2e: cumulativeVolume,
      avg_price: avgPrice,
    });
  }
  return records;
};

const loadTransactionPriceRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const year = toInt(getField(row, "year", "Year"));
    const buyer = getField(row, "buyer", "Buyer");
    const vintageStatus = getField(row, "credit_vintage_status", "vintage_status", "Credit Vintage Status");
    const value = toFloat(getField(row, "value", "price", "VALUE ($)"));

    if (year === null) {
      continue;
    }

    records.push({
      year,
      buyer: buyer ?? "Unknown",
      credit_vintage_status: vintageStatus ?? "Unknown",
      value,
    });
  }
  return records;
};

const loadIssuancesByMechanismRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const year = toInt(getField(row, "year", "Year"));
    const mechanism = getField(row, "mechanism", "Mechanism");
    const issued = toFloat(getField(row, "issued_credits", "issued", "Issued credits"));

    if (year === null || !mechanism) {
      continue;
    }

    records.push({ year, mechanism, issued_credits: issued });
  }
  return records;
};

const loadIssuancesBySectorRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const year = toInt(getField(row, "year", "Year"));
    const sector = getField(row, "sector", "Sector");
    const mechanismType = getField(row, "type_of_mechanism", "mechanism_type", "Type of mechanism");
    const volume = toFloat(getField(row, "international", "issuance_volume", "Issuance volume (ktonCO2e)"));

    if (year === null || !sector) {
      continue;
    }

    records.push({
      year,
      sector,
      type_of_mechanism: mechanismType ?? "Unknown",
      issuance_kton: volume,
    });
  }
  return records;
};

const loadCreditingMechanismsRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mechanism = getField(row, "mechanism", "Mechanism");
    const region = getField(row, "region", "Region");
    const status = getField(row, "status", "Status");
    const priceRange = getField(row, "price_range", "Price (Range)");
    const issued = toFloat(
      getField(
        row,
        "cumulative_credits_issued_in_kt_until_31_12_2024",
        "cumulative_credits_issued",
      ),
    );
    const retired = toFloat(
      getField(
        row,
        "cumulative_credits_retired_in_kt_until_31_12_2024",
        "cumulative_credits_retired",
      ),
    );
    const projects = toFloat(
      getField(
        row,
        "cumulative_projects_registered_until_31_12_2024",
        "cumulative_projects_registered",
      ),
    );

    if (!mechanism) {
      continue;
    }

    records.push({
      mechanism,
      region: region ?? "Unknown",
      status: status ?? "Unknown",
      price_range: priceRange,
      cumulative_issued_kt: issued,
      cumulative_retired_kt: retired,
      cumulative_projects: projects,
    });
  }
  return records;
};

const loadComplianceInstrumentsRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const instrument = getField(row, "instrument_name", "Instrument name", "name_of_the_initiative");
    const instrumentType = getField(row, "instrument_type", "Instrument Type", "Type");
    const region = getField(row, "region", "Region");
    const status = getField(row, "status", "Status");
    const price2024 = toFloat(getField(row, "2024_price", "price_2024"));

    if (!instrument) {
      continue;
    }

    records.push({
      instrument,
      instrument_type: instrumentType ?? "Unknown",
      region: region ?? "Unknown",
      status: status ?? "Unknown",
      price_2024: price2024,
    });
  }
  return records;
};

const loadCompliancePricesRows = async (datasetId: string) => {
  const rows = await fetchKapsarcDataset(datasetId);
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const year = toInt(getField(row, "year", "Price Year"));
    const instrumentType = getField(row, "instrument_type", "Instrument Type");
    const region = getField(row, "region", "Region");
    const price = toFloat(getField(row, "price", "Price"));

    if (year === null) {
      continue;
    }

    records.push({
      year,
      instrument_type: instrumentType ?? "Unknown",
      region: region ?? "Unknown",
      price,
    });
  }
  return records;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const warnings: string[] = [];

  const safeLoad = async (loader: () => Promise<Record<string, unknown>[]>, label: string) => {
    try {
      return await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      warnings.push(`${label}: ${message}`);
      return [];
    }
  };

  try {
    const regions = await safeLoad(
      () => loadCarbonPriceRows(KAPSARC_REGION_DATASET, "region"),
      "regions",
    );
    const marketSize = await safeLoad(
      () => loadMarketSizeRows(KAPSARC_MARKET_SIZE_DATASET),
      "market_size",
    );
    const categories = await safeLoad(
      () => loadCarbonPriceRows(KAPSARC_CATEGORY_DATASET, "category"),
      "categories",
    );
    const transactionPrices = await safeLoad(
      () => loadTransactionPriceRows(KAPSARC_TRANSACTION_PRICE_DATASET),
      "transaction_prices",
    );
    const issuancesByMechanism = await safeLoad(
      () => loadIssuancesByMechanismRows(KAPSARC_ISSUANCES_BY_MECHANISM_DATASET),
      "issuances_by_mechanism",
    );
    const issuancesBySector = await safeLoad(
      () => loadIssuancesBySectorRows(KAPSARC_ISSUANCES_BY_SECTOR_DATASET),
      "issuances_by_sector",
    );
    const creditingMechanisms = await safeLoad(
      () => loadCreditingMechanismsRows(KAPSARC_CREDITING_MECHANISMS_DATASET),
      "crediting_mechanisms",
    );
    const complianceInstruments = await safeLoad(
      () => loadComplianceInstrumentsRows(KAPSARC_COMPLIANCE_INSTRUMENTS_DATASET),
      "compliance_instruments",
    );
    const compliancePrices = await safeLoad(
      () => loadCompliancePricesRows(KAPSARC_COMPLIANCE_PRICES_DATASET),
      "compliance_prices",
    );

    const years = [
      ...new Set([
        ...categories.map((row) => row.year),
        ...regions.map((row) => row.year),
      ]),
    ].filter((year) => typeof year === "number") as number[];

    const timelineMap = new Map<number, { total_volume: number; total_value: number; weighted_price_sum: number }>();
    for (const row of categories) {
      const year = row.year;
      if (typeof year !== "number") continue;
      const volume = typeof row.volume === "number" ? row.volume : 0;
      const avgPrice = typeof row.avg_price === "number" ? row.avg_price : null;
      const value = typeof row.value === "number" ? row.value : 0;
      const entry = timelineMap.get(year) ?? { total_volume: 0, total_value: 0, weighted_price_sum: 0 };
      entry.total_volume += volume;
      entry.total_value += value;
      if (volume && avgPrice !== null) {
        entry.weighted_price_sum += volume * avgPrice;
      }
      timelineMap.set(year, entry);
    }

    const timeline = Array.from(timelineMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, entry]) => ({
        year,
        avg_price: entry.total_volume ? entry.weighted_price_sum / entry.total_volume : null,
        total_volume: entry.total_volume,
        total_value: entry.total_value,
      }));

    const payload = {
      years: years.sort((a, b) => a - b),
      timeline,
      categories,
      regions,
      market_size: marketSize,
      transaction_prices: transactionPrices,
      issuances_by_mechanism: issuancesByMechanism,
      issuances_by_sector: issuancesBySector,
      crediting_mechanisms: creditingMechanisms,
      compliance_instruments: complianceInstruments,
      compliance_prices: compliancePrices,
      warnings,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, warnings }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
