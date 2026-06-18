/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import * as d3 from "d3";
import type { LabelProps } from "recharts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { GlobalProjectMap, type MetricMode } from "./GlobalProjectMap";
import type { Project } from "./types";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimelineData {
  month: string;
  issued: number;
  retired: number;
}

interface RegistryDatum {
  name: string;
  value: number;
  color: string;
}

interface RegistryTypeDatum {
  name: string;
  value: number;
  color: string;
  types: { name: string; value: number }[];
}

interface SunburstTypeDatum {
  name: string;
  value: number;
  color: string;
  opacity: number;
  buffer?: boolean;
}

interface ProjectTypeDatum {
  name: string;
  value: number;
}

interface AnalyticsDashboardProps {
  timeline: TimelineData[];
  registry: RegistryDatum[];
  registryTypes?: RegistryTypeDatum[];
  projectTypeBreakdown?: ProjectTypeDatum[];
  projects?: Project[];
}

const chartConfig = {
  issued: {
    label: "Issued",
    color: "hsl(210 80% 50%)",
  },
  retired: {
    label: "Retired",
    color: "hsl(142 70% 45%)",
  },
  longDuration: {
    label: "Long-duration removal",
    color: "hsl(204 72% 45%)",
  },
  impermanent: {
    label: "Impermanent removal",
    color: "hsl(188 62% 45%)",
  },
  mixed: {
    label: "Mixed",
    color: "hsl(38 90% 55%)",
  },
  reduction: {
    label: "Reduction",
    color: "hsl(286 65% 55%)",
  },
  registry: {
    label: "Projects",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

type TimelineMetricView = "both" | "issued" | "retired";

const reductionCategories = [
  { key: "longDuration", label: "Long-duration removal" },
  { key: "impermanent", label: "Impermanent removal" },
  { key: "mixed", label: "Mixed" },
  { key: "reduction", label: "Reduction" },
] as const;

type ReductionCategoryKey = (typeof reductionCategories)[number]["key"];

type TimelineTooltipProps = TooltipProps<ValueType, NameType> & {
  hideLabel?: boolean;
};

function TimelineTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  hideLabel,
}: TimelineTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const sortedPayload = [...payload].sort((a, b) => {
    const aValue = typeof a.value === "number" ? a.value : Number(a.value) || 0;
    const bValue = typeof b.value === "number" ? b.value : Number(b.value) || 0;
    return bValue - aValue;
  });
  const displayLabel = labelFormatter ? labelFormatter(label ?? "", payload ?? []) : label;
  return (
    <div className="min-w-[160px] rounded-2xl border border-border/60 bg-card/75 p-3 text-xs text-foreground shadow-lg backdrop-blur-sm">
      {!hideLabel && displayLabel && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground/80">
          {displayLabel}
        </p>
      )}
      <div className="space-y-1.5">
        {sortedPayload.map((item) => (
          <div key={item.dataKey?.toString()} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? "var(--primary)" }} />
              {item.name ?? item.dataKey}
            </span>
            <span className="font-mono text-foreground">
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDashboard({
  timeline,
  registry,
  registryTypes,
  projectTypeBreakdown,
  projects = [],
}: AnalyticsDashboardProps) {
  const totalProjectsAll = registry.reduce((sum, item) => sum + item.value, 0) || 1;
  const registryNames = React.useMemo(() => registry.map((entry) => entry.name), [registry]);
  const [activeRegistry, setActiveRegistry] = React.useState("All");
  const [selectedRegistries, setSelectedRegistries] = React.useState<string[]>([]);
  const [timeRange, setTimeRange] = React.useState("all");
  const [timelineMetricView, setTimelineMetricView] = React.useState<TimelineMetricView>("both");
  const [mapMetric, setMapMetric] = React.useState<MetricMode>("issued");
  const [legendExpanded, setLegendExpanded] = React.useState(false);
  const [sunburstTooltip, setSunburstTooltip] = React.useState<{
    name: string;
    value: number;
    percent: number;
    x: number;
    y: number;
  } | null>(null);
  const [focusInfo, setFocusInfo] = React.useState<{ depth: number; name: string; parentName?: string; value: number }>({
    depth: 0,
    name: "Registry",
    value: totalProjectsAll,
  });
  const sunburstRef = React.useRef<SVGSVGElement | null>(null);
  const focusInfoRef = React.useRef(focusInfo);

  React.useEffect(() => {
    focusInfoRef.current = focusInfo;
  }, [focusInfo]);

  React.useEffect(() => {
    if (!registryNames.length) {
      return;
    }
    if (selectedRegistries.length && activeRegistry !== "All" && !selectedRegistries.includes(activeRegistry)) {
      setActiveRegistry("All");
    }
    if (activeRegistry !== "All" && !registryNames.includes(activeRegistry)) {
      setActiveRegistry("All");
    }
  }, [registryNames, activeRegistry, selectedRegistries]);

  const isAllRegistries = activeRegistry === "All";
  const registryHierarchy = React.useMemo(() => {
    if (registryTypes?.length) {
      return registryTypes;
    }
    return registry.map((entry) => ({
      name: entry.name,
      value: entry.value,
      color: entry.color,
      types: [],
    }));
  }, [registry, registryTypes]);
  const visibleRegistryHierarchy = React.useMemo(() => {
    if (!selectedRegistries.length) {
      return registryHierarchy;
    }
    return registryHierarchy.filter((entry) => selectedRegistries.includes(entry.name));
  }, [registryHierarchy, selectedRegistries]);
  const registryTypeMax = React.useMemo(() => {
    const maxMap = new Map<string, number>();
    visibleRegistryHierarchy.forEach((entry) => {
      const maxValue = Math.max(0, ...(entry.types ?? []).map((type) => type.value));
      maxMap.set(entry.name, maxValue);
    });
    return maxMap;
  }, [visibleRegistryHierarchy]);
  const filteredRegistryHierarchy = React.useMemo(() => {
    if (isAllRegistries) {
      return visibleRegistryHierarchy;
    }
    return visibleRegistryHierarchy.filter((entry) => entry.name === activeRegistry);
  }, [visibleRegistryHierarchy, activeRegistry, isAllRegistries]);
  const showAllTypes = focusInfo.depth >= 1;
  const filteredProjects = React.useMemo(() => {
    if (isAllRegistries) {
      return projects;
    }
    return projects.filter((project) => project.registry === activeRegistry);
  }, [projects, activeRegistry, isAllRegistries]);
  const reductionCategoryTotals = React.useMemo(() => {
    const totals: Record<ReductionCategoryKey, { issued: number; retired: number }> = {
      longDuration: { issued: 0, retired: 0 },
      impermanent: { issued: 0, retired: 0 },
      mixed: { issued: 0, retired: 0 },
      reduction: { issued: 0, retired: 0 },
    };
    filteredProjects.forEach((project) => {
      const category = normalizeReductionCategory(project.reductionRemoval);
      totals[category].issued += project.totalIssued;
      totals[category].retired += project.totalRetired;
    });
    return totals;
  }, [filteredProjects]);
  const scopeBreakdown = React.useMemo(() => {
    if (!filteredProjects.length) {
      return (projectTypeBreakdown ?? []).map((entry) => ({ ...entry, retired: 0 }));
    }
    const scopeMap = new Map<string, { issued: number; retired: number }>();
    filteredProjects.forEach((project) => {
      const scopeValue = (project.scope ?? "Unknown").trim() || "Unknown";
      const current = scopeMap.get(scopeValue) ?? { issued: 0, retired: 0 };
      current.issued += project.totalIssued;
      current.retired += project.totalRetired;
      scopeMap.set(scopeValue, current);
    });
    return Array.from(scopeMap.entries())
      .map(([name, value]) => ({ name, value: value.issued, retired: value.retired }))
      .sort((a, b) => b.value - a.value);
  }, [filteredProjects, projectTypeBreakdown]);
  const legendItems = React.useMemo(() => {
    if (focusInfo.depth === 0) {
      return isAllRegistries ? registry : filteredRegistryHierarchy;
    }
    const match = visibleRegistryHierarchy.find(
      (entry) => entry.name === (focusInfo.depth === 1 ? focusInfo.name : focusInfo.parentName),
    );
    if (!match) {
      return [];
    }
    return (match.types ?? []).map((type, index) => ({
      name: type.name,
      value: type.value,
      color: getTintedColor(match.color ?? "var(--chart-3)", index, match.types.length ?? 0),
    }));
  }, [focusInfo, registry, visibleRegistryHierarchy]);
  const legendItemsSorted = React.useMemo(() => {
    return [...legendItems].sort((a, b) => b.value - a.value);
  }, [legendItems]);
  const activeRegistryColor = React.useMemo(() => {
    if (focusInfo.depth === 0) {
      return null;
    }
    const targetName = focusInfo.depth === 1 ? focusInfo.name : focusInfo.parentName;
    const match = visibleRegistryHierarchy.find((entry) => entry.name === targetName);
    return match?.color ?? null;
  }, [focusInfo, visibleRegistryHierarchy]);
  const legendTotal = React.useMemo(() => {
    if (focusInfo.depth === 0) {
      return isAllRegistries
        ? totalProjectsAll
        : filteredRegistryHierarchy.reduce((sum, entry) => sum + entry.value, 0) || 1;
    }
    if (focusInfo.depth === 1) {
      return focusInfo.value ?? totalProjectsAll;
    }
    return focusInfo.parentName
      ? visibleRegistryHierarchy.find((entry) => entry.name === focusInfo.parentName)?.value ?? totalProjectsAll
      : totalProjectsAll;
  }, [focusInfo, visibleRegistryHierarchy, totalProjectsAll, filteredRegistryHierarchy, isAllRegistries]);
  const totalProjectsFiltered = React.useMemo(() => {
    if (isAllRegistries) {
      return totalProjectsAll;
    }
    return filteredRegistryHierarchy.reduce((sum, entry) => sum + entry.value, 0) || 1;
  }, [isAllRegistries, filteredRegistryHierarchy, totalProjectsAll]);
  React.useEffect(() => {
    if (focusInfo.depth !== 0) {
      return;
    }
    if (focusInfo.name !== "Registry" || focusInfo.value !== totalProjectsFiltered) {
      setFocusInfo({ depth: 0, name: "Registry", value: totalProjectsFiltered });
    }
  }, [activeRegistry, totalProjectsFiltered, focusInfo]);
  const fullTimeline = React.useMemo(() => buildYearRange(timeline, 1996, 2025), [timeline]);
  const filteredTimeline = React.useMemo(() => {
    if (timeRange === "all") {
      return fullTimeline;
    }
    const range = timeRange === "1y" ? 1 : timeRange === "5y" ? 5 : 10;
    return fullTimeline.slice(-range);
  }, [fullTimeline, timeRange]);
  const timelineData = filteredTimeline.length
    ? filteredTimeline
    : [{ month: "N/A", issued: 0, retired: 0 }];
  const showCombinedTimeline = timelineMetricView !== "issued" && timelineMetricView !== "retired";
  const timelineTicks = React.useMemo(() => {
    if (timeRange === "all") {
      return ["1996", "2000", "2005", "2010", "2015", "2020", "2025"];
    }
    const ticks = filteredTimeline
      .map((item) => item.month)
      .filter((value) => value && value !== "N/A");
    return Array.from(new Set(ticks));
  }, [filteredTimeline, timeRange]);
  const categorizedTimelineData = React.useMemo(() => {
    if (showCombinedTimeline) {
      return [];
    }
    const issuedTotal = reductionCategories.reduce(
      (sum, category) => sum + reductionCategoryTotals[category.key].issued,
      0,
    );
    const retiredTotal = reductionCategories.reduce(
      (sum, category) => sum + reductionCategoryTotals[category.key].retired,
      0,
    );
    return timelineData.map((entry) => {
      const next: Record<string, number | string> = { month: entry.month };
      reductionCategories.forEach((category) => {
        const base = timelineMetricView === "issued" ? entry.issued : entry.retired;
        const total = timelineMetricView === "issued" ? issuedTotal : retiredTotal;
        const value =
          total > 0
            ? (timelineMetricView === "issued"
                ? reductionCategoryTotals[category.key].issued
                : reductionCategoryTotals[category.key].retired) /
              total
            : 0;
        next[category.key] = base * value;
      });
      return next;
    });
  }, [timelineData, reductionCategoryTotals, timelineMetricView, showCombinedTimeline]);
  const yAxisTicks = React.useMemo(() => {
    const increment = 50_000_000;
    const data = showCombinedTimeline ? timelineData : categorizedTimelineData;
    const maxValue = data.reduce((max, entry) => {
      if (showCombinedTimeline) {
        const issued = Number((entry as TimelineData).issued ?? 0);
        const retired = Number((entry as TimelineData).retired ?? 0);
        return Math.max(max, issued, retired);
      }
      return reductionCategories.reduce((currentMax, category) => {
        const value = Number((entry as Record<string, number | string>)[category.key] ?? 0);
        return Math.max(currentMax, value);
      }, max);
    }, 0);
    const upperBound = Math.max(increment, Math.ceil(maxValue / increment) * increment);
    const ticks = [];
    for (let value = 0; value <= upperBound; value += increment) {
      ticks.push(value);
    }
    return ticks;
  }, [categorizedTimelineData, showCombinedTimeline, timelineData]);
  const timelineTitle = showCombinedTimeline
    ? "Issuance vs Retirement"
    : timelineMetricView === "issued"
      ? "Issued by Reduction / Removal"
      : "Retired by Reduction / Removal";

  React.useEffect(() => {
    const svgElement = sunburstRef.current;
    if (!svgElement || !filteredRegistryHierarchy.length) {
      return;
    }

    const width = 520;
    const height = width;
    const radius = width / 6.2;
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`).style("font", "11px sans-serif");

    const data = {
      name: "Registry",
      children: filteredRegistryHierarchy.map((entry) => ({
        name: entry.name,
        color: entry.color,
        children: (() => {
          const totalValue = entry.value ?? 0;
          const sortedTypes = [...(entry.types ?? [])].sort((a, b) => b.value - a.value);
          const maxCollapsed =
            entry.name === "ACR" || entry.name === "CAR"
              ? 2
              : 3;
          const visibleTypes = showAllTypes ? sortedTypes : sortedTypes.slice(0, maxCollapsed);
          const sumTypes = visibleTypes.reduce((sum, type) => sum + type.value, 0);
          const bufferValue = Math.max(0, totalValue - sumTypes);
          const maxValue = registryTypeMax.get(entry.name) ?? 0;
          const mappedTypes: SunburstTypeDatum[] = visibleTypes.map((type) => {
            const ratio = maxValue > 0 ? type.value / maxValue : 0;
            return {
              name: type.name,
              value: type.value,
              color: getScaledRegistryColor(entry.color, ratio),
              opacity: getScaledRegistryOpacity(ratio),
            };
          });
          if (bufferValue > 0) {
            mappedTypes.push({
              name: "Others",
              value: bufferValue,
              color: getScaledRegistryColor(entry.color, 0),
              opacity: 0.12,
              buffer: true,
            });
          }
          return mappedTypes;
        })(),
        value: entry.value,
      })),
    };

    const hierarchy = d3
      .hierarchy(data)
      .sum((d: any) => d.value)
      .sort((a: any, b: any) => {
        if (a.depth === 1 && b.depth === 1) {
          return (b.value ?? 0) - (a.value ?? 0);
        }
        return 0;
      });

    const root = d3.partition<any>().size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
    root.each((d: any) => {
      d.current = d;
    });

    const arc = d3
      .arc<any>()
      .startAngle((d: any) => d.x0)
      .endAngle((d: any) => d.x1)
      .padAngle((d: any) => Math.min((d.x1 - d.x0) / 2, 0.008))
      .padRadius(radius * 1.8)
      .innerRadius((d: any) => d.y0 * radius)
      .outerRadius((d: any) => Math.max(d.y0 * radius, d.y1 * radius - 1.2));

    const arcVisible = (d: any) => d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    const labelVisible = (d: any) => {
      const areaVisible = d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.025;
      const ringThickness = (d.y1 - d.y0) * radius;
      return areaVisible && ringThickness >= 14;
    };
    const calloutLabelVisible = (d: any) => {
      if (focusInfoRef.current.depth < 1) {
        return false;
      }
      if (d.depth !== 2 || d.data?.buffer) {
        return false;
      }
      const ringThickness = (d.y1 - d.y0) * radius;
      return !labelVisible(d) && ringThickness >= 6;
    };
    const labelTransform = (d: any) => {
      const x = ((d.x0 + d.x1) / 2) * (180 / Math.PI);
      const y = ((d.y0 + d.y1) / 2) * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    };

    const g = svg.append("g");

    const path = g
      .selectAll("path")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("fill", (d: any) => {
        if (d.depth > 1 && d.data.color) {
          return d.data.color;
        }
        let current = d;
        while (current.depth > 1) current = current.parent;
        return createGradientFill(svg, current.data.name ?? "segment", current.data.color ?? "var(--chart-3)");
      })
      .attr("fill-opacity", (d: any) => {
        if (!arcVisible(d.current)) {
          return 0;
        }
        if (d.depth > 1) {
          return d.data.opacity ?? 0.6;
        }
        return d.children ? 0.72 : 0.55;
      })
      .attr("stroke", "rgba(255,255,255,0.18)")
      .attr("stroke-width", 0.9)
      .attr("pointer-events", (d: any) => (arcVisible(d.current) ? "auto" : "none"))
      .attr("d", (d: any) => arc(d.current));

    path.style("filter", "drop-shadow(0 0 10px rgba(34,197,94,0.25))");

    path
      .filter((d: any) => d.children)
      .style("cursor", "pointer")
      .on("click", (event: any, d: any) => {
        const registryName = d.depth >= 2 ? d.parent?.data?.name : d.data.name;
        setActiveRegistry(registryName ?? activeRegistry);
        setFocusInfo({
          depth: d.depth,
          name: d.data.name,
          parentName: d.parent?.data?.name,
          value: d.value ?? 0,
        });
        clicked(event, d);
      });

    path
      .on("mousemove", (event: any, d: any) => {
        const rect = sunburstRef.current?.getBoundingClientRect();
        if (!rect) return;
        const base = d.depth === 1 ? totalProjectsFiltered : d.parent?.value ?? totalProjectsFiltered;
        setSunburstTooltip({
          name: d.data.name,
          value: d.value ?? 0,
          percent: (d.value ?? 0) / base,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      })
      .on("mouseleave", () => setSunburstTooltip(null));

    path
      .append("title")
      .text((d: any) => `${d.ancestors().map((n: any) => n.data.name).reverse().join("/")}\n${d.value}`);

    const label = g
      .append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
      .selectAll("text")
      .data(root.descendants().slice(1))
      .join("text")
      .attr("fill-opacity", (d: any) => +labelVisible(d.current))
      .attr("transform", (d: any) => labelTransform(d.current))
      .style("fill", "var(--foreground)");

    label
      .append("tspan")
      .attr("x", 0)
      .attr("dy", "-0.1em")
      .attr("font-weight", 600)
      .text((d: any) => truncateSunburstLabel(d.data.name ?? "", d.depth));

    label
      .append("tspan")
      .attr("x", 0)
      .attr("dy", "1.2em")
      .attr("class", "fill-muted-foreground text-[10px]")
      .text((d: any) => {
        if (!d.parent || !d.parent.value) {
          return "";
        }
        const percent = ((d.value ?? 0) / d.parent.value) * 100;
        return `${percent.toFixed(1)}%`;
      });

    const calloutData = root.descendants().filter((d: any) => calloutLabelVisible(d.current));
    const calloutGroup = g.append("g").attr("pointer-events", "none");

    calloutGroup
      .selectAll("polyline")
      .data(calloutData)
      .join("polyline")
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.6)")
      .attr("stroke-width", 0.8)
      .attr("points", (d: any) => {
        const angle = ((d.current.x0 + d.current.x1) / 2) - Math.PI / 2;
        const midRadius = ((d.current.y0 + d.current.y1) / 2) * radius;
        const labelRadius = d.current.y1 * radius + 18;
        const x1 = Math.cos(angle) * midRadius;
        const y1 = Math.sin(angle) * midRadius;
        const x2 = Math.cos(angle) * labelRadius;
        const y2 = Math.sin(angle) * labelRadius;
        const x3 = Math.cos(angle) * (labelRadius + 10);
        const y3 = Math.sin(angle) * (labelRadius + 10);
        return `${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      });

    calloutGroup
      .selectAll("text")
      .data(calloutData)
      .join("text")
      .attr("text-anchor", (d: any) => {
        const angle = ((d.current.x0 + d.current.x1) / 2) - Math.PI / 2;
        return Math.cos(angle) >= 0 ? "start" : "end";
      })
      .attr("transform", (d: any) => {
        const angle = ((d.current.x0 + d.current.x1) / 2) - Math.PI / 2;
        const labelRadius = d.current.y1 * radius + 30;
        const x = Math.cos(angle) * labelRadius;
        const y = Math.sin(angle) * labelRadius;
        return `translate(${x},${y})`;
      })
      .attr("class", "fill-foreground text-[10px]")
      .text((d: any) => truncateSunburstLabel(d.data.name ?? "", d.depth));

    const centerLabel = g
      .append("g")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none");
    centerLabel
      .append("text")
      .attr("y", -8)
      .attr("class", "fill-foreground text-3xl font-semibold")
      .style("fill", "var(--primary)")
      .text(totalProjectsFiltered);
    centerLabel
      .append("text")
      .attr("y", 16)
      .attr("class", "fill-muted-foreground text-xs")
      .style("fill", "var(--foreground)")
      .text("Total Projects");

    const parent = g
      .append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", (event: any, d: any) => {
        setFocusInfo({ depth: 0, name: "Registry", value: root.value ?? totalProjectsFiltered });
        clicked(event, d);
      });

    svg.on("click", (event: any) => {
      if (event.target !== svg.node()) {
        return;
      }
      const current = focusInfoRef.current;
      if (current.depth === 2) {
        const parentName = current.parentName ?? "All";
        const target = root
          .descendants()
          .find((node: any) => node.depth === 1 && node.data.name === parentName);
        if (target) {
          setActiveRegistry(parentName);
          setFocusInfo({
            depth: 1,
            name: target.data.name ?? parentName,
            value: target.value ?? totalProjectsFiltered,
          });
          clicked(event, target);
        }
        return;
      }
      if (current.depth === 1) {
        setActiveRegistry("All");
        setFocusInfo({ depth: 0, name: "Registry", value: totalProjectsFiltered });
        clicked(event, root);
      }
    });

    function clicked(event: any, p: any) {
      if (p.depth === 1 && root.height <= 2) {
        return;
      }
      parent.datum(p.parent || root);
      root.each((d: any) => {
        d.target = {
          x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth),
        };
      });

      const t = svg
        .transition()
        .duration(event.altKey ? 4000 : 1200)
        .ease(d3.easeCubicOut) as unknown as d3.Transition<d3.BaseType, any, any, any>;

      path
        .transition(t)
        .tween("data", (d: any) => {
          const i = d3.interpolate(d.current, d.target);
          return (t: number) => (d.current = i(t));
        })
        .filter(function (this: d3.BaseType, d: any): boolean {
          const opacity = (this as Element)?.getAttribute("fill-opacity");
          return !!(+(opacity ?? 0) || arcVisible(d.target));
        })
        .attr("fill-opacity", (d: any) => {
          if (!arcVisible(d.target)) {
            return 0;
          }
          if (d.depth > 1) {
            return d.data.opacity ?? 0.6;
          }
          return d.children ? 0.65 : 0.45;
        })
        .attr("pointer-events", (d: any) => (arcVisible(d.target) ? "auto" : "none"))
        .attrTween("d", (d: any) => () => arc(d.current) ?? "");

      label
        .filter(function (this: d3.BaseType, d: any): boolean {
          const opacity = (this as Element)?.getAttribute("fill-opacity");
          return !!(+(opacity ?? 0) || labelVisible(d.target));
        })
        .transition(t)
        .attr("fill-opacity", (d: any) => +labelVisible(d.target))
        .attrTween("transform", (d: any) => () => labelTransform(d.current));
    }
  }, [filteredRegistryHierarchy, totalProjectsFiltered, activeRegistry, registryTypeMax, visibleRegistryHierarchy, showAllTypes]);

  return (
    <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4">
      <div className="space-y-4">
        <div>
          <span className="text-[9px] font-bold text-[#7ef6e0]/50 tracking-[0.2em]">VCM ANALYTICS</span>
          <h2 className="text-lg font-black tracking-[0.1em] text-white mt-0.5">VCM PROJECT ANALYTICS</h2>
        </div>

        {/* Row 1: Timeline — full width */}
        <ChartContainer config={chartConfig} className="border border-[#7ef6e0]/15 bg-[#080808] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">TIMELINE</p>
              <p className="text-sm font-black tracking-[0.1em] text-white">{timelineTitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ChartLegend content={<ChartLegendContent />} />
              <Select value={timelineMetricView} onValueChange={(value) => setTimelineMetricView(value as TimelineMetricView)}>
                <SelectTrigger className="h-7 w-[190px] rounded-none border-[#7ef6e0]/20 bg-[#0c0c0c] text-[10px] text-[#7ef6e0]/70 tracking-widest">
                  <SelectValue placeholder="View" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-none bg-[#0c0c0c] border-[#7ef6e0]/20">
                  <SelectItem value="both" className="rounded-none text-[10px] tracking-wider">Issued vs Retired</SelectItem>
                  <SelectItem value="issued" className="rounded-none text-[10px] tracking-wider">Issued only</SelectItem>
                  <SelectItem value="retired" className="rounded-none text-[10px] tracking-wider">Retired only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-7 w-[160px] rounded-none border-[#7ef6e0]/20 bg-[#0c0c0c] text-[10px] text-[#7ef6e0]/70 tracking-widest">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-none bg-[#0c0c0c] border-[#7ef6e0]/20">
                  <SelectItem value="1y" className="rounded-none text-[10px] tracking-wider">Last 1 year</SelectItem>
                  <SelectItem value="5y" className="rounded-none text-[10px] tracking-wider">Last 5 years</SelectItem>
                  <SelectItem value="10y" className="rounded-none text-[10px] tracking-wider">Last 10 years</SelectItem>
                  <SelectItem value="all" className="rounded-none text-[10px] tracking-wider">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="w-full" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              {showCombinedTimeline ? (
                <AreaChart key="combined" data={timelineData}>
                  <defs>
                    <linearGradient id="issuedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-issued)" stopOpacity={0.65} />
                      <stop offset="95%" stopColor="var(--color-issued)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="retiredGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-retired)" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="var(--color-retired)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="hsla(var(--muted-foreground),0.3)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} ticks={timelineTicks} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatMillions(value)} width={60} ticks={yAxisTicks} domain={[0, yAxisTicks[yAxisTicks.length - 1] ?? 0]} />
                  <ChartTooltip content={<TimelineTooltipContent labelFormatter={(value) => `Year ${value}`} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
                  <Area type="natural" dataKey="retired" name={chartConfig.retired.label} fill="url(#retiredGradient)" stroke="var(--color-retired)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="natural" dataKey="issued" name={chartConfig.issued.label} fill="url(#issuedGradient)" stroke="var(--color-issued)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              ) : (
                <AreaChart key={timelineMetricView} data={categorizedTimelineData}>
                  <CartesianGrid strokeDasharray="2 2" stroke="hsla(var(--muted-foreground),0.3)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} ticks={timelineTicks} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatMillions(value)} width={60} ticks={yAxisTicks} domain={[0, yAxisTicks[yAxisTicks.length - 1] ?? 0]} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Year ${value}`} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
                  {reductionCategories.map((category) => (
                    <Area key={category.key} type="natural" dataKey={category.key} name={category.label} stackId="1" fill={`var(--color-${category.key})`} stroke={`var(--color-${category.key})`} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Row 2: Map (left) + Credits by Scope (right) */}
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          {/* Map */}
          <div className="border border-[#7ef6e0]/15 bg-[#080808] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">PROJECT LOCATIONS</p>
                <p className="text-sm font-black tracking-[0.1em] text-white">Global Distribution</p>
              </div>
              <div className="flex items-center gap-1">
                {(["retired", "issued"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={mapMetric === mode}
                    onClick={() => setMapMetric(mode)}
                    className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                      mapMetric === mode
                        ? "bg-[#7ef6e0] text-[#0a0a0a]"
                        : "border border-[#7ef6e0]/30 text-[#7ef6e0]/55 hover:text-[#7ef6e0]"
                    }`}
                  >
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <GlobalProjectMap projects={filteredProjects} variant="embedded" metric={mapMetric} />
          </div>

          {/* Credits by Scope */}
          <div className="border border-[#7ef6e0]/15 bg-[#080808] p-4">
            <p className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">CREDITS BY SCOPE</p>
            <p className="text-sm font-black tracking-[0.1em] text-white mt-0.5">Credits Issued by Scope</p>
            <div className="mt-4">
              <ChartContainer config={chartConfig} style={{ height: Math.max(320, scopeBreakdown.length * 72) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={scopeBreakdown.map((entry) => ({
                      scope: entry.name,
                      issued: entry.value,
                      retired: entry.retired ?? 0,
                    }))}
                    layout="vertical"
                    barCategoryGap={20}
                    barGap={6}
                    margin={{ left: 120, right: 48 }}
                  >
                    <YAxis dataKey="scope" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={<ScopeTick />} />
                    <XAxis dataKey="issued" type="number" hide />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(value) => `Scope ${value}`} />} />
                    <Bar dataKey="issued" layout="vertical" radius={8} barSize={22} fill="var(--color-issued)">
                      <LabelList dataKey="issued" content={renderScopeLabel} />
                    </Bar>
                    <Bar dataKey="retired" layout="vertical" radius={8} barSize={22} fill="var(--color-retired)">
                      <LabelList dataKey="retired" content={renderScopeLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              {scopeBreakdown.length ? (
                <p className="mt-3 text-[9px] text-[#7ef6e0]/35 tracking-wider">
                  Showing issued credits across {scopeBreakdown.length} scopes.
                </p>
              ) : (
                <p className="mt-3 text-[9px] text-[#7ef6e0]/35 tracking-wider">Scope breakdown unavailable.</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Registry Distribution — full width */}
        <ChartContainer config={chartConfig} className="border border-[#7ef6e0]/15 bg-[#080808] p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">REGISTRY</p>
              <p className="text-sm font-black tracking-[0.1em] text-white">Distribution</p>
            </div>
            {registryNames.length > 0 ? (
              <Select value={activeRegistry} onValueChange={setActiveRegistry}>
                <SelectTrigger className="h-7 w-[160px] rounded-none border-[#7ef6e0]/20 bg-[#0c0c0c] text-[10px] text-[#7ef6e0]/70 tracking-widest">
                  <SelectValue placeholder="Select registry" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-none bg-[#0c0c0c] border-[#7ef6e0]/20">
                  <SelectItem value="All" className="rounded-none text-[10px] tracking-wider">All registries</SelectItem>
                  {registryNames.map((name) => {
                    const entry = registry.find((item) => item.name === name);
                    return (
                      <SelectItem key={name} value={name} className="rounded-none text-[10px] tracking-wider">
                        <div className="flex items-center gap-2">
                          <span className="flex h-2.5 w-2.5 shrink-0" style={{ backgroundColor: entry?.color ?? "var(--primary)" }} />
                          {name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {registryNames.length ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setSelectedRegistries([]); setActiveRegistry("All"); }}
                className={`text-[9px] px-2 py-0.5 tracking-wider transition-colors ${
                  selectedRegistries.length === 0
                    ? "bg-[#7ef6e0] text-[#0a0a0a] font-bold"
                    : "border border-[#7ef6e0]/20 text-[#7ef6e0]/45 hover:text-[#7ef6e0]"
                }`}
              >
                All
              </button>
              {registryNames.map((name) => {
                const entry = registry.find((item) => item.name === name);
                const isSelected = selectedRegistries.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedRegistries((prev) => prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]);
                    }}
                    className={`flex items-center gap-1.5 text-[9px] px-2 py-0.5 tracking-wider transition-colors ${
                      isSelected
                        ? "border border-[#7ef6e0]/60 text-[#7ef6e0] bg-[#7ef6e0]/10"
                        : "border border-[#7ef6e0]/15 text-[#7ef6e0]/40 hover:text-[#7ef6e0]"
                    }`}
                  >
                    <span className="h-2 w-2" style={{ backgroundColor: isSelected ? "transparent" : entry?.color ?? "var(--primary)" }} />
                    {name}
                  </button>
                );
              })}
            </div>
          ) : null}
          {registry.length ? (
            <div className="relative pb-12">
              <ChartContainer config={chartConfig} className="mx-auto w-full max-w-[560px]" style={{ height: 560 }}>
                <div className="relative flex h-full items-center justify-center px-2">
                  <svg ref={sunburstRef} className="h-full w-full" />
                  {sunburstTooltip ? (
                    <div
                      className="pointer-events-none absolute rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-xs text-foreground shadow-lg"
                      style={{ left: sunburstTooltip.x + 12, top: sunburstTooltip.y + 12 }}
                    >
                      <div className="font-medium">{sunburstTooltip.name}</div>
                      <div className="text-muted-foreground">
                        {sunburstTooltip.value.toLocaleString()} ({(sunburstTooltip.percent * 100).toFixed(1)}%)
                      </div>
                    </div>
                  ) : null}
                </div>
              </ChartContainer>
              <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 w-[170px] border border-[#7ef6e0]/20 bg-[#0c0c0c]/95 p-2 text-[10px] shadow-sm backdrop-blur">
                <div className="mb-2 text-[9px] tracking-[0.2em] text-[#7ef6e0]/40">LEGEND</div>
                <div className={`space-y-1 ${legendExpanded ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
                  {(legendExpanded ? legendItemsSorted : legendItemsSorted.slice(0, 5)).map((entry) => {
                    const fallbackColor = registry.find((item) => item.name === entry.name)?.color ?? "var(--chart-3)";
                    const baseColor = focusInfo.depth === 0 ? fallbackColor : activeRegistryColor ?? fallbackColor;
                    const legendColor =
                      focusInfo.depth === 0
                        ? entry.color ?? fallbackColor
                        : getScaledRegistryColor(baseColor, entry.value / (legendItemsSorted[0]?.value || 1));
                    const displayColor = `color-mix(in oklab, ${legendColor} 80%, var(--foreground))`;
                    return (
                      <div key={entry.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full border border-border/40" style={{ backgroundColor: displayColor }} />
                          <span style={{ color: displayColor }}>{entry.name}</span>
                        </div>
                        <span className="font-mono" style={{ color: displayColor }}>
                          {((entry.value / legendTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                {legendItemsSorted.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setLegendExpanded((prev) => !prev)}
                    className="mt-2 w-full border border-[#7ef6e0]/20 px-2 py-1 text-[9px] tracking-[0.2em] text-[#7ef6e0]/40 transition hover:text-[#7ef6e0]"
                  >
                    {legendExpanded ? "Show less" : `More (${legendItemsSorted.length - 5})`}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No registry distribution data available.</p>
          )}
          <p className="mt-3 text-[9px] text-[#7ef6e0]/35 tracking-wider">
            Total projects tracked: <span className="font-bold text-white">{totalProjectsFiltered}</span>
          </p>
        </ChartContainer>
      </div>
    </div>
  );
}

function truncateSunburstLabel(label: string, depth: number) {
  if (depth < 2) {
    return label;
  }
  return label.length > 10 ? `${label.slice(0, 10)}...` : label;
}

function getScaledRegistryColor(baseColor: string, ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const color = d3.color(baseColor);
  if (!color) {
    return baseColor;
  }
  const hsl = d3.hsl(color);
  hsl.s = Math.max(0.35, hsl.s * (0.6 + 0.4 * clamped));
  hsl.l = Math.min(0.88, hsl.l + (1 - clamped) * 0.25);
  return hsl.formatHex();
}

function getScaledRegistryOpacity(ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return 0.3 + clamped * 0.6;
}

function normalizeReductionCategory(value?: string | null): ReductionCategoryKey {
  const normalized = value?.toLowerCase().trim() ?? "";
  if (!normalized) {
    return "reduction";
  }
  if (normalized.includes("long") || normalized.includes("durable") || normalized.includes("permanent")) {
    return "longDuration";
  }
  if (normalized.includes("impermanent") || normalized.includes("short") || normalized.includes("temporary")) {
    return "impermanent";
  }
  if (normalized.includes("mixed")) {
    return "mixed";
  }
  if (normalized.includes("reduction")) {
    return "reduction";
  }
  if (normalized.includes("removal")) {
    return "impermanent";
  }
  return "reduction";
}

function formatMillions(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

function renderScopeLabel(props: LabelProps) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  const xValue = Number(x) || 0;
  const yValue = Number(y) || 0;
  const widthValue = Number(width) || 0;
  const heightValue = Number(height) || 0;
  const numericValue = Number(value);
  if (!numericValue) {
    return null;
  }
  const label = formatMillions(numericValue);
  const fitsInside = widthValue >= 56;
  const labelX = fitsInside ? xValue + widthValue - 6 : xValue + widthValue + 6;
  const anchor = fitsInside ? "end" : "start";
  const fill = fitsInside ? "var(--background)" : "var(--muted-foreground)";

  return (
    <text
      x={labelX}
      y={yValue + heightValue / 2}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill={fill}
      fontSize={12}
    >
      {label}
    </text>
  );
}

function formatScopeLabelLines(label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    return { line1: "", line2: "" };
  }
  if (trimmed.includes("&")) {
    const [left, right] = trimmed.split("&");
    const line1 = left ? `${left.trim()} &` : "&";
    const line2 = right ? right.trim() : "";
    return { line1, line2 };
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { line1: trimmed, line2: "" };
  }
  if (words.length === 2) {
    return { line1: words[0], line2: words[1] };
  }
  const splitIndex = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, splitIndex).join(" "),
    line2: words.slice(splitIndex).join(" "),
  };
}

function ScopeTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const label = payload?.value ?? "";
  const { line1, line2 } = formatScopeLabelLines(label);
  if (!line1) {
    return null;
  }
  return (
    <text x={x} y={y} textAnchor="end" className="fill-foreground/80 text-xs">
      <tspan x={x} dy={line2 ? "-0.2em" : "0.35em"}>
        {line1}
      </tspan>
      {line2 ? (
        <tspan x={x} dy="1.2em">
          {line2}
        </tspan>
      ) : null}
    </text>
  );
}

function getTintedColor(baseColor: string, index: number, total: number) {
  const color = d3.color(baseColor);
  if (!color || total <= 1) {
    return baseColor;
  }
  const hsl = d3.hsl(color);
  const step = total > 1 ? 0.08 / Math.max(total - 1, 1) : 0;
  hsl.l = Math.min(0.9, hsl.l + 0.12 + index * step);
  hsl.s = Math.max(0.35, hsl.s * 0.85);
  return hsl.formatHex();
}

function createGradientFill(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, key: string, baseColor: string) {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  const gradientId = `sunburst-gradient-${safeKey || "segment"}`;
  const existing = svg.select(`#${gradientId}`);
  if (existing.empty()) {
    const gradient = svg
      .append("defs")
      .append("radialGradient")
      .attr("id", gradientId)
      .attr("cx", "35%")
      .attr("cy", "35%")
      .attr("r", "75%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", getTintedColor(baseColor, 1, 3));
    gradient.append("stop").attr("offset", "70%").attr("stop-color", baseColor);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.color(baseColor)?.darker(0.4)?.formatHex() ?? baseColor);
  }
  return `url(#${gradientId})`;
}

function buildYearRange(data: TimelineData[], startYear: number, endYear: number) {
  const totalsByYear = new Map<number, { issued: number; retired: number }>();
  for (const entry of data) {
    const year = extractYear(entry.month);
    if (!year) {
      continue;
    }
    const current = totalsByYear.get(year) ?? { issued: 0, retired: 0 };
    current.issued += entry.issued;
    current.retired += entry.retired;
    totalsByYear.set(year, current);
  }

  const timeline: TimelineData[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const total = totalsByYear.get(year);
    timeline.push({
      month: year.toString(),
      issued: total?.issued ?? 0,
      retired: total?.retired ?? 0,
    });
  }
  return timeline;
}

function extractYear(value: string) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}
