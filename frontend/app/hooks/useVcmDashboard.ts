"use client";

import { useEffect, useState } from "react";
import type {
  ApiProject,
  ApiProjectSummary,
  ApiTimelineDatum,
  Project,
  RegistryDatum,
  RegistryTypeDatum,
} from "@/components/analytics/types";

const UPTAKE_BANDS = new Set(["High", "Medium", "Low"]);

function normalizeUptakeBand(v?: string | null): Project["uptakeBand"] {
  return v && UPTAKE_BANDS.has(v) ? (v as Project["uptakeBand"]) : "Medium";
}

function normalizeRegistry(v?: string | null): string {
  if (!v) return "Unknown";
  switch (v.toUpperCase()) {
    case "VCS": return "Verra";
    case "GOLD": return "Gold Standard";
    case "CAR": return "CAR";
    case "ACR": return "ACR";
    case "ART": return "ART";
    default: return v;
  }
}

function normalizeRegion(v?: string | null): string {
  if (!v) return "Unknown";
  const l = v.toLowerCase();
  if (l.includes("africa")) return "Africa";
  if (l.includes("asia")) return "Asia";
  if (l.includes("europe")) return "Europe";
  if (l.includes("latin america")) return "Latin America";
  if (l.includes("north america")) return "North America";
  if (l.includes("oceania")) return "Oceania";
  return v;
}

function registryColor(name: string): string {
  switch (name) {
    case "Verra": return "hsl(346 77% 49%)";
    case "Gold Standard": return "hsl(45 93% 58%)";
    case "CAR": return "hsl(24 95% 53%)";
    case "ACR": return "hsl(262 83% 58%)";
    case "ART": return "hsl(0 84% 60%)";
    default: return "hsl(210 18% 82%)";
  }
}

export interface VcmDashboardData {
  projects: Project[];
  timeline: { month: string; issued: number; retired: number }[];
  registryDistribution: RegistryDatum[];
  registryTypeBreakdown: RegistryTypeDatum[];
  projectTypeBreakdown: { name: string; value: number }[];
  totalIssued: number;
  totalRetired: number;
  activeProjects: number;
  loading: boolean;
  error: string | null;
}

export function useVcmDashboard(): VcmDashboardData {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeline, setTimeline] = useState<{ month: string; issued: number; retired: number }[]>([]);
  const [registryDistribution, setRegistryDistribution] = useState<RegistryDatum[]>([]);
  const [registryTypeBreakdown, setRegistryTypeBreakdown] = useState<RegistryTypeDatum[]>([]);
  const [projectTypeBreakdown, setProjectTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [totalIssued, setTotalIssued] = useState(0);
  const [totalRetired, setTotalRetired] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [projRes, sumRes, tlRes] = await Promise.all([
          fetch("/api/analytics/projects?limit=500", { signal: controller.signal }),
          fetch("/api/analytics/projects/summary", { signal: controller.signal }),
          fetch("/api/analytics/dashboard/timeline", { signal: controller.signal }),
        ]);

        if (!projRes.ok) throw new Error(`Projects request failed: ${projRes.status}`);
        if (!sumRes.ok) throw new Error(`Summary request failed: ${sumRes.status}`);
        if (!tlRes.ok) throw new Error(`Timeline request failed: ${tlRes.status}`);

        const apiProjects = (await projRes.json()) as ApiProject[];
        const apiSummary = (await sumRes.json()) as ApiProjectSummary;
        const apiTimeline = (await tlRes.json()) as ApiTimelineDatum[];

        const mapped: Project[] = apiProjects.map((p) => ({
          id: p.project_id,
          name: p.project_name,
          registry: normalizeRegistry(p.registry),
          status: p.status ?? "Unknown",
          scope: p.scope ?? null,
          projectType: p.project_type?.trim() || "Unknown",
          region: normalizeRegion(p.region),
          country: p.country ?? "Unknown",
          methodology: p.methodology?.trim() || "Unknown",
          verifier: p.verifier ?? "Unknown",
          registryDocumentsUrl: p.registry_documents ?? undefined,
          reductionRemoval: p.reduction_removal ?? "Unknown",
          totalIssued: Number(p.issued_total ?? 0),
          totalRetired: Number(p.retired_total ?? 0),
          uptakeBand: normalizeUptakeBand(p.uptake_band),
          bufferPercent: Number(p.buffer_percent ?? 0),
        }));

        const regDist: RegistryDatum[] = (apiSummary.registry_breakdown ?? []).map((e) => ({
          name: normalizeRegistry(e.registry),
          value: e.project_count,
          color: registryColor(normalizeRegistry(e.registry)),
        }));

        const regTypeMap = new Map<string, Map<string, number>>();
        mapped.forEach((p) => {
          if (!regTypeMap.has(p.registry)) regTypeMap.set(p.registry, new Map());
          const m = regTypeMap.get(p.registry)!;
          m.set(p.projectType, (m.get(p.projectType) ?? 0) + 1);
        });
        const regTypes: RegistryTypeDatum[] = Array.from(regTypeMap.entries()).map(([name, m]) => {
          const types = Array.from(m.entries()).map(([n, v]) => ({ name: n, value: v }));
          return { name, value: types.reduce((s, t) => s + t.value, 0), color: registryColor(name), types: types.sort((a, b) => b.value - a.value) };
        });

        const scopeMap = new Map<string, number>();
        mapped.forEach((p) => {
          const s = (p.scope ?? "Unknown").trim() || "Unknown";
          scopeMap.set(s, (scopeMap.get(s) ?? 0) + p.totalIssued);
        });
        const projTypes = Array.from(scopeMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const tl = apiTimeline.map((item) => ({
          month: item.month,
          issued: Number(item.issued_total ?? 0),
          retired: Number(item.retired_total ?? 0),
        }));

        const issued = mapped.reduce((s, p) => s + p.totalIssued, 0);
        const retired = mapped.reduce((s, p) => s + p.totalRetired, 0);

        setProjects(mapped);
        setRegistryDistribution(regDist);
        setRegistryTypeBreakdown(regTypes.sort((a, b) => b.value - a.value));
        setProjectTypeBreakdown(projTypes);
        setTimeline(tl);
        setTotalIssued(issued);
        setTotalRetired(retired);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return {
    projects,
    timeline,
    registryDistribution,
    registryTypeBreakdown,
    projectTypeBreakdown,
    totalIssued,
    totalRetired,
    activeProjects: projects.length,
    loading,
    error,
  };
}
