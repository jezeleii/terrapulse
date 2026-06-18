"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { LoadingState } from "@/components/analytics/LoadingState";
import { ProjectBenchmarkPanel } from "@/components/analytics/ProjectBenchmarkPanel";
import { ProjectFilters } from "@/components/analytics/ProjectFilters";
import { ProjectTable } from "@/components/analytics/ProjectTable";
import type { FilterOptions, Project } from "@/components/analytics/types";

interface ApiProject {
  project_id: string;
  project_name: string;
  registry: string;
  status?: string | null;
  scope?: string | null;
  project_type?: string | null;
  region?: string | null;
  country?: string | null;
  methodology?: string | null;
  verifier?: string | null;
  registry_documents?: string | null;
  reduction_removal?: string | null;
  issued_total: number;
  retired_total: number;
  buffer_percent: number;
  uptake_band?: string | null;
}

interface ApiProjectSummary {
  registry_breakdown: { registry: string; project_count: number }[];
}

interface ApiTimelineDatum {
  month: string;
  issued_total: number;
  retired_total: number;
}

const uptakeBands = new Set(["High", "Medium", "Low"]);

const normalizeUptakeBand = (value?: string | null): Project["uptakeBand"] => {
  if (value && uptakeBands.has(value)) {
    return value as Project["uptakeBand"];
  }
  return "Medium";
};

const normalizeRegistry = (value?: string | null) => {
  if (!value) return "Unknown";
  const upper = value.toUpperCase();
  switch (upper) {
    case "VCS": return "Verra";
    case "GOLD": return "Gold Standard";
    case "CAR": return "CAR";
    case "ACR": return "ACR";
    case "ART": return "ART";
    default: return value;
  }
};

const normalizeRegion = (value?: string | null) => {
  if (!value) return "Unknown";
  const lower = value.toLowerCase();
  if (lower.includes("africa")) return "Africa";
  if (lower.includes("asia")) return "Asia";
  if (lower.includes("europe")) return "Europe";
  if (lower.includes("latin america")) return "Latin America";
  if (lower.includes("north america")) return "North America";
  if (lower.includes("oceania")) return "Oceania";
  return value;
};

const normalizeScope = (value?: string | null) => {
  if (!value) return "Unknown";
  return value.trim() || "Unknown";
};

const splitDelimited = (value?: string | null) => {
  if (!value) return [];
  return value.split(";").map((item) => item.trim()).filter(Boolean);
};

const getRegistryColor = (name: string) => {
  switch (name) {
    case "Verra": return "hsl(346 77% 49%)";
    case "Gold Standard": return "hsl(45 93% 58%)";
    case "CAR": return "hsl(24 95% 53%)";
    case "ACR": return "hsl(262 83% 58%)";
    case "ART": return "hsl(0 84% 60%)";
    default: return "hsl(210 18% 82%)";
  }
};

function usePersistentFilters() {
  const defaultFilters: FilterOptions = { registry: [], projectType: [], region: [], methodology: [] };
  const [filters, setFilters] = useState<FilterOptions>(() => {
    if (typeof window === "undefined") return defaultFilters;
    const stored = window.localStorage.getItem("vcm-filters");
    if (!stored) return defaultFilters;
    try { return JSON.parse(stored) as FilterOptions; } catch { return defaultFilters; }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vcm-filters", JSON.stringify(filters));
    }
  }, [filters]);

  return { filters, setFilters, reset: () => setFilters(defaultFilters) };
}

export default function ProjectsPage() {
  const { filters, setFilters, reset } = usePersistentFilters();
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("vcm-search") ?? "";
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeline, setTimeline] = useState<ApiTimelineDatum[]>([]);
  const [registryDistribution, setRegistryDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [registryTypeBreakdown, setRegistryTypeBreakdown] = useState<{ name: string; value: number; color: string; types: { name: string; value: number }[] }[]>([]);
  const [projectTypeBreakdown, setProjectTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useMemo<FilterOptions>(() => {
    const registries = new Set<string>();
    const projectTypes = new Set<string>();
    const regions = new Set<string>();
    const methodologies = new Set<string>();

    const addOptions = (set: Set<string>, value?: string | null) => {
      const parts = splitDelimited(value);
      if (!parts.length) { set.add("Unknown"); return; }
      parts.forEach((part) => set.add(part));
    };

    projects.forEach((project) => {
      if (project.registry) registries.add(project.registry);
      addOptions(projectTypes, project.projectType);
      if (project.region) regions.add(project.region);
      addOptions(methodologies, project.methodology);
    });

    const sort = (items: Set<string>) => Array.from(items).sort((a, b) => a.localeCompare(b));
    return {
      registry: sort(registries),
      projectType: sort(projectTypes),
      region: sort(regions),
      methodology: sort(methodologies),
    };
  }, [projects]);

  const methodologyByRegistry = useMemo<Record<string, string[]>>(() => {
    const map = new Map<string, Set<string>>();
    projects.forEach((project) => {
      const registry = project.registry || "Unknown";
      if (!map.has(registry)) map.set(registry, new Set<string>());
      const methods = splitDelimited(project.methodology);
      const resolvedMethods = methods.length ? methods : ["Unknown"];
      const target = map.get(registry)!;
      resolvedMethods.forEach((method) => target.add(method));
    });
    const result: Record<string, string[]> = {};
    map.forEach((values, registry) => {
      result[registry] = Array.from(values).sort((a, b) => a.localeCompare(b));
    });
    return result;
  }, [projects]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vcm-search", searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [projectsRes, summaryRes, timelineRes] = await Promise.all([
          fetch("/api/analytics/projects?limit=500", { signal: controller.signal }),
          fetch("/api/analytics/projects/summary", { signal: controller.signal }),
          fetch("/api/analytics/dashboard/timeline", { signal: controller.signal }),
        ]);

        if (!projectsRes.ok) throw new Error(`Projects request failed: ${projectsRes.status}`);
        if (!summaryRes.ok) throw new Error(`Summary request failed: ${summaryRes.status}`);
        if (!timelineRes.ok) throw new Error(`Timeline request failed: ${timelineRes.status}`);

        const apiProjects = (await projectsRes.json()) as ApiProject[];
        const apiSummary = (await summaryRes.json()) as ApiProjectSummary;
        const apiTimeline = (await timelineRes.json()) as ApiTimelineDatum[];

        const mappedProjects = apiProjects.map((project) => ({
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
        }));

        const mappedRegistry = (apiSummary.registry_breakdown || []).map((entry) => ({
          name: normalizeRegistry(entry.registry),
          value: entry.project_count,
          color: getRegistryColor(normalizeRegistry(entry.registry)),
        }));

        const registryTypeMap = new Map<string, Map<string, number>>();
        mappedProjects.forEach((project) => {
          const registry = project.registry;
          const type = project.projectType;
          if (!registryTypeMap.has(registry)) registryTypeMap.set(registry, new Map());
          const typeMap = registryTypeMap.get(registry)!;
          typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
        });

        const registryTypes = Array.from(registryTypeMap.entries()).map(([name, typeMap]) => {
          const types = Array.from(typeMap.entries()).map(([typeName, value]) => ({ name: typeName, value }));
          const total = types.reduce((sum, entry) => sum + entry.value, 0);
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

        setProjects(mappedProjects);
        setRegistryDistribution(mappedRegistry);
        setRegistryTypeBreakdown(registryTypes.sort((a, b) => b.value - a.value));
        setProjectTypeBreakdown(projectTypes);
        setTimeline(apiTimeline);
        setReady(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadData();
    return () => controller.abort();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.region.toLowerCase().includes(searchQuery.toLowerCase());

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
  }, [filters, searchQuery, projects]);

  const timelineData = useMemo(
    () => timeline.map((item) => ({
      month: item.month,
      issued: Number(item.issued_total ?? 0),
      retired: Number(item.retired_total ?? 0),
    })),
    [timeline],
  );

  const totalIssued = filteredProjects.reduce((sum, p) => sum + p.totalIssued, 0);
  const totalRetired = filteredProjects.reduce((sum, p) => sum + p.totalRetired, 0);
  const avgBuffer = filteredProjects.reduce((sum, p) => sum + p.bufferPercent, 0) / (filteredProjects.length || 1);
  const activeProjects = filteredProjects.length;

  const registryAverage = {
    totalIssued: activeProjects ? totalIssued / activeProjects : 0,
    totalRetired: activeProjects ? totalRetired / activeProjects : 0,
    bufferPercent: avgBuffer,
  };

  useEffect(() => {
    if (!filteredProjects.length) { setSelectedProject(null); return; }
    if (!selectedProject || !filteredProjects.some((p) => p.id === selectedProject.id)) {
      setSelectedProject(filteredProjects[0]);
    }
  }, [filteredProjects, selectedProject]);

  const registryActivity = useMemo(() => {
    const sorted = [...projects].sort((a, b) => b.totalIssued - a.totalIssued);
    return sorted.slice(0, 4).map((project, index) => ({
      id: project.id,
      registry: project.registry,
      action: project.totalRetired > project.totalIssued * 0.5 ? "Retirement" : "Issuance",
      volume: project.totalIssued.toLocaleString(),
      time: index === 0 ? "Latest" : `${index + 1} entries ago`,
    }));
  }, [projects]);

  const activeProject = selectedProject ?? filteredProjects[0] ?? null;

  if ((!ready || loading) && !error) {
    return (
      <div
        className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"
        style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
      >
        <LoadingState />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' }}
    >
      {/* Stats bar */}
      <div className="flex shrink-0 border-b border-[#7ef6e0]/15 bg-[#0c0c0c]">
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">ACTIVE PROJECTS</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">{activeProjects.toLocaleString()}</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]">▲ 12%</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">CREDITS ISSUED</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">{totalIssued.toLocaleString()}</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]">▲ 5%</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3 border-r border-[#7ef6e0]/15">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">CREDITS RETIRED</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">{totalRetired.toLocaleString()}</span>
            <span className="text-[11px] font-bold tracking-widest text-[#7ef6e0]">▲ 3%</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-3">
          <div className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em] mb-1">AVG PERFORMANCE</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              {(registryAverage.bufferPercent * 4 || 0).toFixed(0)}/100
            </span>
            <span className="text-[11px] font-bold tracking-widest text-red-400">▼ 2%</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Page title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-[0.15em] text-white">
              VCM CARBON MARKETS ANALYTICS
            </h1>
            <p className="text-[10px] text-[#7ef6e0]/35 tracking-wider mt-1">
              Global Registry Analysis&nbsp;&nbsp;|&nbsp;&nbsp;{projects.length} Projects Tracked&nbsp;&nbsp;|&nbsp;&nbsp;Showing {filteredProjects.length} filtered
            </p>
          </div>
          {/* Search */}
          <div className="flex items-center gap-2 border border-[#7ef6e0]/20 bg-[#0c0c0c] px-3 py-2">
            <Search className="h-3 w-3 text-[#7ef6e0]/40" />
            <input
              type="text"
              placeholder="SEARCH PROJECTS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[11px] text-white placeholder:text-[#7ef6e0]/25 outline-none w-52 tracking-wider"
            />
          </div>
        </div>

        {error && (
          <div className="border border-red-400/30 bg-red-400/10 p-4 text-[11px] text-red-400 tracking-wider">
            {error}
          </div>
        )}
        {loading && !error && <LoadingState />}

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Left: filters */}
          <div>
            <ProjectFilters
              filters={filters}
              options={filterOptions}
              methodologyByRegistry={methodologyByRegistry}
              onFilterChange={setFilters}
              onReset={reset}
            />
          </div>

          {/* Right: dashboard + table */}
          <section className="space-y-4">
            {loading ? (
              <LoadingState />
            ) : (
              <>
                <AnalyticsDashboard
                  timeline={timelineData}
                  registry={registryDistribution}
                  registryTypes={registryTypeBreakdown}
                  projectTypeBreakdown={projectTypeBreakdown}
                  projects={filteredProjects}
                />

                {/* Recent registry activity */}
                <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-bold text-[#7ef6e0]/50 tracking-[0.2em]">RECENT REGISTRY ACTIVITY</span>
                    <span className="text-[9px] text-[#7ef6e0] tracking-widest animate-pulse">● LIVE</span>
                  </div>
                  <div className="space-y-2">
                    {registryActivity.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border border-[#7ef6e0]/10 bg-[#080808] px-3 py-2">
                        <div>
                          <p className="text-[11px] font-bold text-[#7ef6e0]">{item.id}</p>
                          <p className="text-[9px] text-white/40 tracking-wider">
                            {item.registry} — {item.volume} CREDITS
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-white/40 tracking-widest">{item.time.toUpperCase()}</p>
                          <p className="text-[9px] text-[#7ef6e0]/40 tracking-widest">{item.action.toUpperCase()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project table section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">PROJECT COMPARISON</span>
                      <h2 className="text-lg font-black tracking-[0.1em] text-white mt-0.5">GLOBAL VCM REGISTRY ANALYSIS</h2>
                    </div>
                    <span className="text-[9px] text-white/30 tracking-widest">
                      {filteredProjects.length} / {projects.length} PROJECTS
                    </span>
                  </div>
                  <p className="text-[10px] text-white/35 tracking-wider mb-3">
                    Select a project to view benchmark details and registry averages.
                  </p>
                  <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                    <ProjectTable
                      projects={filteredProjects}
                      onSelectProject={setSelectedProject}
                      selectedProjectId={activeProject?.id}
                      filters={filters}
                    />
                    <ProjectBenchmarkPanel
                      variant="inline"
                      project={activeProject}
                      onClose={() => setSelectedProject(null)}
                      registryAverage={registryAverage}
                    />
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
