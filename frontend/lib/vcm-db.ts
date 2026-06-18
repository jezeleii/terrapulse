import prisma from "@/lib/prisma";

function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

type Row = Record<string, unknown>;

export async function listProjects(limit: number, offset: number): Promise<Row[]> {
  const safeLimit = Math.min(1000, Math.max(1, limit));
  const safeOffset = Math.max(0, offset);

  let rows: Row[];
  try {
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT
        project_id, project_name, registry, status, scope, project_type,
        reduction_removal, region, country, methodology, verifier,
        registry_documents,
        CAST(issued_total AS float8) AS issued_total,
        CAST(retired_total AS float8) AS retired_total,
        CAST(buffer_deposits_total AS float8) AS buffer_deposits_total,
        uptake_band
      FROM public.v_project_explorer
      ORDER BY issued_total DESC NULLS LAST
      LIMIT $1 OFFSET $2`,
      safeLimit, safeOffset,
    );
  } catch {
    // Fallback if the view doesn't exist
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT
        p.project_id, p.project_name, p.registry, p.status, p.scope, p.project_type,
        p.reduction_removal, p.region, p.country, p.methodology, p.verifier,
        p.registry_documents,
        CAST(p.issued_total AS float8) AS issued_total,
        CAST(p.retired_total AS float8) AS retired_total,
        CAST(p.buffer_deposits_total AS float8) AS buffer_deposits_total,
        m.uptake_band
      FROM public.vcm_projects p
      LEFT JOIN public.vcm_project_metrics m ON m.project_id = p.project_id
      ORDER BY p.issued_total DESC NULLS LAST
      LIMIT $1 OFFSET $2`,
      safeLimit, safeOffset,
    );
  }

  return rows.map((row) => {
    const issued = toNum(row.issued_total);
    const bufferTotal = toNum(row.buffer_deposits_total);
    return {
      project_id: row.project_id,
      project_name: row.project_name,
      registry: row.registry,
      status: row.status ?? null,
      scope: row.scope ?? null,
      project_type: row.project_type ?? null,
      reduction_removal: row.reduction_removal ?? null,
      region: row.region ?? null,
      country: row.country ?? null,
      methodology: row.methodology ?? null,
      verifier: row.verifier ?? null,
      registry_documents: row.registry_documents ?? null,
      issued_total: issued,
      retired_total: toNum(row.retired_total),
      buffer_percent: issued > 0 ? (bufferTotal / issued) * 100 : 0,
      uptake_band: row.uptake_band ?? null,
    };
  });
}

export async function getProjectSummary(): Promise<Row> {
  const [totalsRows, registries, uptake, metricsRows] = await Promise.all([
    prisma.$queryRawUnsafe<Row[]>(
      `SELECT COUNT(*) AS total_projects, MAX(as_of_date) AS latest_snapshot
       FROM public.vcm_projects`,
    ),
    prisma.$queryRawUnsafe<Row[]>(
      `SELECT registry, COUNT(*) AS project_count
       FROM public.vcm_projects
       GROUP BY registry
       ORDER BY project_count DESC`,
    ),
    prisma.$queryRawUnsafe<Row[]>(
      `SELECT uptake_band, COUNT(*) AS project_count
       FROM public.vcm_project_metrics
       GROUP BY uptake_band
       ORDER BY project_count DESC`,
    ),
    prisma.$queryRawUnsafe<Row[]>(
      `SELECT COUNT(*) AS total_metrics FROM public.vcm_project_metrics`,
    ),
  ]);

  const totals = totalsRows[0] ?? {};
  const metrics = metricsRows[0] ?? {};

  return {
    total_projects: toNum(totals.total_projects),
    latest_snapshot: totals.latest_snapshot ?? null,
    registry_breakdown: registries.map((r) => ({
      registry: r.registry,
      project_count: toNum(r.project_count),
    })),
    uptake_breakdown: uptake.map((u) => ({
      uptake_band: u.uptake_band,
      project_count: toNum(u.project_count),
    })),
    metrics_rows: toNum(metrics.total_metrics),
  };
}

export async function getProjectById(projectId: string): Promise<Row | null> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT
      p.project_id, p.project_name, p.registry, p.status, p.scope,
      p.project_type, p.reduction_removal, p.methodology, p.methodology_version,
      p.region, p.country, p.state, p.developer, p.operator,
      CAST(p.issued_total AS float8) AS issued_total,
      CAST(p.retired_total AS float8) AS retired_total,
      CAST(p.remaining_total AS float8) AS remaining_total,
      CAST(p.buffer_deposits_total AS float8) AS buffer_deposits_total,
      p.as_of_date,
      m.uptake_band
    FROM public.vcm_projects p
    LEFT JOIN public.vcm_project_metrics m ON m.project_id = p.project_id
    WHERE p.project_id = $1`,
    projectId,
  );

  if (!rows.length) return null;
  const row = rows[0];

  return {
    project_id: row.project_id,
    project_name: row.project_name,
    registry: row.registry,
    status: row.status ?? null,
    scope: row.scope ?? null,
    project_type: row.project_type ?? null,
    reduction_removal: row.reduction_removal ?? null,
    methodology: row.methodology ?? null,
    methodology_version: row.methodology_version ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    state: row.state ?? null,
    developer: row.developer ?? null,
    operator: row.operator ?? null,
    issued_total: toNum(row.issued_total),
    retired_total: toNum(row.retired_total),
    remaining_total: toNum(row.remaining_total),
    buffer_deposits_total: toNum(row.buffer_deposits_total),
    as_of_date: row.as_of_date ?? null,
    uptake_band: row.uptake_band ?? null,
  };
}

export async function getDashboardTimeline(): Promise<Row[]> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT
      year,
      CAST(SUM(issued_vintage) AS float8) AS issued_total,
      CAST(SUM(retired_total) AS float8) AS retired_total
    FROM public.vcm_project_yearly
    WHERE year >= 1996
    GROUP BY year
    ORDER BY year`,
  );

  return rows.map((row) => ({
    month: row.year != null ? String(row.year) : "Unknown",
    issued_total: toNum(row.issued_total),
    retired_total: toNum(row.retired_total),
  }));
}

export async function getDashboardOverview(): Promise<Row | null> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT * FROM public.v_dashboard_overview`,
  );
  return rows[0] ?? null;
}
