import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabase.ts";

const toKey = (value: string | null) => value?.trim() || "Unknown";

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(table: string, select: string) {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const baseQuery = supabase.from(table).select(select);
    const { data, error } = await baseQuery.range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }
  return rows;
}

type ProjectSummaryRow = {
  project_id: string;
  registry: string | null;
  uptake_band: string | null;
  as_of_date?: string | null;
};

const toDateValue = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const dedupeLatest = (rows: ProjectSummaryRow[]) => {
  const map = new Map<string, ProjectSummaryRow>();
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
    const rows = await fetchAllRows<ProjectSummaryRow>(
      "v_project_explorer",
      "project_id,registry,uptake_band,as_of_date",
    );
    const dedupedRows = dedupeLatest(rows);

    const totalProjects = dedupedRows.length;
    const registryRows = dedupedRows;
    const uptakeRows = dedupedRows;
    const metricsRows = dedupedRows.length;

    const { data: latestRow, error: latestError } = await supabase
      .from("vcm_projects")
      .select("as_of_date")
      .order("as_of_date", { ascending: false })
      .limit(1);

    if (latestError) {
      throw new Error(latestError.message);
    }

    const registryCount = new Map<string, number>();
    for (const row of registryRows ?? []) {
      const key = toKey(row.registry as string | null);
      registryCount.set(key, (registryCount.get(key) ?? 0) + 1);
    }

    const uptakeCount = new Map<string, number>();
    for (const row of uptakeRows ?? []) {
      const key = toKey(row.uptake_band as string | null);
      uptakeCount.set(key, (uptakeCount.get(key) ?? 0) + 1);
    }

    const registryBreakdown = Array.from(registryCount.entries())
      .map(([registry, project_count]) => ({ registry, project_count }))
      .sort((a, b) => b.project_count - a.project_count);

    const uptakeBreakdown = Array.from(uptakeCount.entries())
      .map(([uptake_band, project_count]) => ({ uptake_band, project_count }))
      .sort((a, b) => b.project_count - a.project_count);

    const payload = {
      total_projects: totalProjects ?? 0,
      latest_snapshot: latestRow?.[0]?.as_of_date ?? null,
      registry_breakdown: registryBreakdown,
      uptake_breakdown: uptakeBreakdown,
      metrics_rows: metricsRows ?? 0,
    };

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
