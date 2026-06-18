import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabase.ts";

type ProjectRow = {
  project_id: string;
  project_name: string;
  registry: string | null;
  status: string | null;
  scope: string | null;
  project_type: string | null;
  reduction_removal: string | null;
  region: string | null;
  country: string | null;
  methodology: string | null;
  verifier: string | null;
  registry_documents: string | null;
  issued_total: number | string | null;
  retired_total: number | string | null;
  buffer_deposits_total: number | string | null;
  as_of_date?: string | null;
  uptake_band?: string | null;
};

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const viewSelect = [
  "project_id",
  "project_name",
  "registry",
  "status",
  "scope",
  "project_type",
  "reduction_removal",
  "region",
  "country",
  "methodology",
  "verifier",
  "registry_documents",
  "issued_total",
  "retired_total",
  "buffer_deposits_total",
  "as_of_date",
  "uptake_band",
].join(",");

const tableSelect = [
  "project_id",
  "project_name",
  "registry",
  "status",
  "scope",
  "project_type",
  "reduction_removal",
  "region",
  "country",
  "methodology",
  "verifier",
  "registry_documents",
  "issued_total",
  "retired_total",
  "buffer_deposits_total",
  "as_of_date",
].join(",");

async function fetchProjects(limit: number | null, offset: number) {
  const from = offset;
  const to = limit ? offset + limit - 1 : null;
  const viewQuery = supabase.from("v_project_explorer").select(viewSelect).order("issued_total", { ascending: false });
  const viewResponse = await viewQuery.range(from, to ?? from + 999_999);

  if (!viewResponse.error) {
    return viewResponse.data as ProjectRow[];
  }

  const message = viewResponse.error.message.toLowerCase();
  if (!message.includes("does not exist") && !message.includes("relation")) {
    throw new Error(viewResponse.error.message);
  }

  const tableQuery = supabase.from("vcm_projects").select(tableSelect).order("issued_total", { ascending: false });
  const tableResponse = await tableQuery.range(from, to ?? from + 999_999);

  if (tableResponse.error) {
    throw new Error(tableResponse.error.message);
  }

  return tableResponse.data as ProjectRow[];
}

async function fetchAllProjects(offset: number) {
  const pageSize = 1000;
  const rows: ProjectRow[] = [];
  let pageOffset = offset;
  while (true) {
    const batch = await fetchProjects(pageSize, pageOffset);
    if (!batch.length) {
      break;
    }
    rows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    pageOffset += pageSize;
  }
  return rows;
}

const toDateValue = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const dedupeLatest = (rows: ProjectRow[]) => {
  const map = new Map<string, ProjectRow>();
  for (const row of rows) {
    const current = map.get(row.project_id);
    if (!current || toDateValue(row.as_of_date) >= toDateValue(current.as_of_date)) {
      map.set(row.project_id, row);
    }
  }
  return Array.from(map.values());
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

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : NaN;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, parsedLimit) : null;
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const rows = limit === null ? await fetchAllProjects(offset) : await fetchProjects(limit, offset);
    const resolvedRows = limit === null ? dedupeLatest(rows) : rows;
    const payload = resolvedRows.map((row) => {
      const issuedTotal = toNumber(row.issued_total);
      const bufferTotal = toNumber(row.buffer_deposits_total);
      const bufferPercent = issuedTotal > 0 ? (bufferTotal / issuedTotal) * 100 : 0;
      return {
        project_id: row.project_id,
        project_name: row.project_name,
        registry: row.registry,
        status: row.status,
        scope: row.scope,
        project_type: row.project_type,
        reduction_removal: row.reduction_removal,
        region: row.region,
        country: row.country,
        methodology: row.methodology,
        verifier: row.verifier,
        registry_documents: row.registry_documents,
        issued_total: issuedTotal,
        retired_total: toNumber(row.retired_total),
        buffer_percent: bufferPercent,
        uptake_band: row.uptake_band ?? null,
      };
    });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
