import { corsHeaders } from "../_shared/cors.ts";
import { supabase } from "../_shared/supabase.ts";

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PAGE_SIZE = 1000;

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
    const rows: { year: number | string; issued_issuance: number | string | null; retired_total: number | string | null }[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("vcm_project_yearly")
        .select("year, issued_issuance, retired_total")
        .gte("year", 1996)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(error.message);
      }

      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    const aggregates = new Map<number, { issued: number; retired: number }>();
    for (const row of rows) {
      const yearValue = Number(row.year);
      if (!Number.isFinite(yearValue)) {
        continue;
      }
      const current = aggregates.get(yearValue) ?? { issued: 0, retired: 0 };
      current.issued += toNumber(row.issued_issuance);
      current.retired += toNumber(row.retired_total);
      aggregates.set(yearValue, current);
    }

    const payload = Array.from(aggregates.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, totals]) => ({
        month: String(year),
        issued_total: totals.issued,
        retired_total: totals.retired,
      }));

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
