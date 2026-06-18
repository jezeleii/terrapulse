'use client';

import { useEffect, useMemo, useState } from "react";
import { VCM_API_ENDPOINTS } from "@/lib/vcm-constants";
import {
  getRegistryColor,
  normalizeRegistry,
  normalizeRegion,
  normalizeScope,
  normalizeUptakeBand,
  splitDelimited,
} from "@/components/analytics/utils";
import type {
  ApiProject,
  ApiProjectSummary,
  ApiTimelineDatum,
  FilterOptions,
  Project,
  RegistryDatum,
  RegistryTypeDatum,
  TimelineData,
} from "@/components/analytics/types";

function mapApiProject(project: ApiProject): Project {
  return {
    id: project.project_id,
    name: project.project_name,
    registry: normalizeRegistry(project.registry),
    status: project.status ?? "Unknown",
    scope: project.scope ?? null,
    projectType: project.project_type?.trim() || "Unknown",
    region: normalizeRegion(project.region),
    country: project.country ?? "Unknown",
    methodology: project.methodology?.trim() || "Unknown",
    verifier: project.verifier ?? "Unknown",
    registryDocumentsUrl: project.registry_documents ?? undefined,
    reductionRemoval: project.reduction_removal ?? "Unknown",
    totalIssued: Number(project.issued_total ?? 0),
    totalRetired: Number(project.retired_total ?? 0),
    uptakeBand: normalizeUptakeBand(project.uptake_band),
    bufferPercent: Number(project.buffer_percent ?? 0),
  };
}

interface VcmProjectsData {
  projects: Project[];
  registryDistribution: RegistryDatum[];
  registryTypeBreakdown: RegistryTypeDatum[];
  projectTypeBreakdown: { name: string; value: number }[];
  timeline: TimelineData[];
  isLoading: boolean;
  error: string | null;
}

export function useVcmProjects(): VcmProjectsData {
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [registryDistribution, setRegistryDistribution] = useState<RegistryDatum[]>([]);
  const [registryTypeBreakdown, setRegistryTypeBreakdown] = useState<RegistryTypeDatum[]>([]);
  const [projectTypeBreakdown, setProjectTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [projectsRes, summaryRes, timelineRes] = await Promise.all([
          fetch(`${VCM_API_ENDPOINTS.projects}?limit=500`, { signal: controller.signal }),
          fetch(VCM_API_ENDPOINTS.projectsSummary, { signal: controller.signal }),
          fetch(VCM_API_ENDPOINTS.dashboardTimeline, { signal: controller.signal }),
        ]);

        if (!projectsRes.ok) throw new Error(`Projects request failed: ${projectsRes.status}`);
        if (!summaryRes.ok) throw new Error(`Summary request failed: ${summaryRes.status}`);
        if (!timelineRes.ok) throw new Error(`Timeline request failed: ${timelineRes.status}`);

        const apiProjects = (await projectsRes.json()) as ApiProject[];
        const apiSummary = (await summaryRes.json()) as ApiProjectSummary;
        const apiTimeline = (await timelineRes.json()) as ApiTimelineDatum[];

        const mappedProjects = apiProjects.map(mapApiProject);

        const mappedRegistry = (apiSummary.registry_breakdown ?? []).map((entry) => ({
          name: normalizeRegistry(entry.registry),
          value: entry.project_count,
          color: getRegistryColor(normalizeRegistry(entry.registry)),
        }));

        const registryTypeMap = new Map<string, Map<string, number>>();
        mappedProjects.forEach((project) => {
          const reg = project.registry;
          const type = project.projectType;
          if (!registryTypeMap.has(reg)) registryTypeMap.set(reg, new Map());
          const typeMap = registryTypeMap.get(reg)!;
          typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
        });

        const registryTypes = Array.from(registryTypeMap.entries()).map(([name, typeMap]) => {
          const types = Array.from(typeMap.entries()).map(([typeName, value]) => ({ name: typeName, value }));
          const total = types.reduce((sum, e) => sum + e.value, 0);
          return {
            name,
            value: total,
            color: getRegistryColor(name),
            types: types.sort((a, b) => b.value - a.value),
          };
        });

        const scopeMap = new Map<string, number>();
        mappedProjects.forEach((project) => {
          const scopeName = normalizeScope(project.scope ?? null);
          scopeMap.set(scopeName, (scopeMap.get(scopeName) ?? 0) + project.totalIssued);
        });
        const projectTypes = Array.from(scopeMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const mappedTimeline = apiTimeline.map((item) => ({
          month: item.month,
          issued: Number(item.issued_total ?? 0),
          retired: Number(item.retired_total ?? 0),
        }));

        setRawProjects(mappedProjects);
        setRegistryDistribution(mappedRegistry);
        setRegistryTypeBreakdown(registryTypes.sort((a, b) => b.value - a.value));
        setProjectTypeBreakdown(projectTypes);
        setTimeline(mappedTimeline);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
    return () => controller.abort();
  }, []);

  return useMemo(() => ({
    projects: rawProjects,
    registryDistribution,
    registryTypeBreakdown,
    projectTypeBreakdown,
    timeline,
    isLoading,
    error,
  }), [rawProjects, registryDistribution, registryTypeBreakdown, projectTypeBreakdown, timeline, isLoading, error]);
}

export function useFilteredProjects(projects: Project[], filters: FilterOptions, search: string) {
  return useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        !search ||
        project.id.toLowerCase().includes(search.toLowerCase()) ||
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.region.toLowerCase().includes(search.toLowerCase());

      const matchesRegistry = filters.registry.length === 0 || filters.registry.includes(project.registry);
      const typeParts = splitDelimited(project.projectType);
      const methodologyParts = splitDelimited(project.methodology);
      const resolvedTypes = typeParts.length ? typeParts : ["Unknown"];
      const resolvedMethodologies = methodologyParts.length ? methodologyParts : ["Unknown"];
      const matchesType = filters.projectType.length === 0 || resolvedTypes.some((v) => filters.projectType.includes(v));
      const matchesRegion = filters.region.length === 0 || filters.region.includes(project.region);
      const matchesMethodology = filters.methodology.length === 0 || resolvedMethodologies.some((v) => filters.methodology.includes(v));

      return matchesSearch && matchesRegistry && matchesType && matchesRegion && matchesMethodology;
    });
  }, [projects, filters, search]);
}
