import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { UPTAKE_BAND_COLORS } from "@/lib/vcm-constants";
import type { Project } from "./types";

interface ProjectBenchmarkPanelProps {
  project: Project | null;
  onClose: () => void;
  registryAverage: {
    totalIssued: number;
    totalRetired: number;
    bufferPercent: number;
  };
  variant?: "overlay" | "inline";
}

export function ProjectBenchmarkPanel({
  project,
  onClose,
  registryAverage,
  variant = "overlay",
}: ProjectBenchmarkPanelProps) {
  if (!project) {
    if (variant === "inline") {
      return (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Select a project to view benchmark insights.
        </Card>
      );
    }
    return null;
  }

  const comparison = [
    { label: "Total Issued", projectValue: project.totalIssued, averageValue: registryAverage.totalIssued },
    { label: "Total Retired", projectValue: project.totalRetired, averageValue: registryAverage.totalRetired },
    { label: "Buffer %", projectValue: project.bufferPercent, averageValue: registryAverage.bufferPercent, isPercent: true },
  ];

  const relativePerformance = comparison.map(({ projectValue, averageValue }) =>
    averageValue ? (projectValue / averageValue) * 100 : 0,
  );
  const highestValue = Math.max(120, ...relativePerformance);
  const performanceBadgeClass = UPTAKE_BAND_COLORS[project.uptakeBand] ?? "";
  const registryDocsUrl = project.registryDocumentsUrl ?? getRegistryDocumentsUrl(project.registry);
  const verifier = project.verifier ?? "Not reported";
  const voluntaryStatus = project.voluntaryStatus ?? project.status ?? "Unknown";
  const country = project.country ?? "Unknown";

  const containerClasses =
    variant === "inline"
      ? "rounded-2xl border border-border/60 bg-card shadow-sm"
      : "fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-border bg-card shadow-2xl md:w-[480px]";
  const headerClasses =
    variant === "inline"
      ? "flex items-center justify-between border-b border-border px-6 py-4"
      : "sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur-sm";

  return (
    <div className={containerClasses}>
      <div className={headerClasses}>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{project.id}</p>
          <h2>{project.name}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6 p-6">
        <Card className="space-y-6 border-primary/30 bg-primary/5 p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Performance</p>
              <Badge className={`mt-1 ${performanceBadgeClass}`}>{project.uptakeBand}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Methodology / Protocol</p>
              <p className="text-sm">{project.methodology ?? "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Country</p>
              <p className="text-sm">{country}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verifier</p>
              <p className="text-sm">{verifier}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reduction/Removal</p>
              <p className="text-sm">{project.reductionRemoval}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm">{project.projectType}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Voluntary Status</p>
              <p className="text-sm">{voluntaryStatus}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Registry Documents</p>
              {registryDocsUrl ? (
                <a
                  href={registryDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-4"
                >
                  {project.registry} Link
                </a>
              ) : (
                <p className="text-sm">Not available</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground">Relative performance</h3>
          <div className="space-y-6">
            {comparison.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.label}</span>
                  <span>
                    {item.isPercent
                      ? `${item.projectValue.toFixed(1)}% vs ${item.averageValue.toFixed(1)}%`
                      : `${item.projectValue.toLocaleString()} vs ${item.averageValue.toLocaleString()}`}
                  </span>
                </div>
                <ComparisonBars
                  projectValue={item.projectValue}
                  averageValue={item.averageValue}
                  isPercent={item.isPercent}
                />
              </div>
            ))}
          </div>
        </Card>

        <Separator className="bg-border/60" />

        <Card className="space-y-5 p-6">
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground">% of registry average</h3>
          <div className="space-y-3">
            {comparison.map((item) => {
              const percent = (item.projectValue / Math.max(item.averageValue, 1)) * 100;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.label}</span>
                    <span>{percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${Math.min(100, (percent / highestValue) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ComparisonBars({
  projectValue,
  averageValue,
  isPercent,
}: {
  projectValue: number;
  averageValue: number;
  isPercent?: boolean;
}) {
  const maxValue = Math.max(projectValue, averageValue, 1);
  const format = (value: number) => (isPercent ? `${value.toFixed(1)}%` : value.toLocaleString());
  const projectPercent = (projectValue / maxValue) * 100;
  const averagePercent = (averageValue / maxValue) * 100;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Project</span>
          <span>{format(projectValue)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-full rounded-full bg-accent" style={{ width: `${projectPercent}%` }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Registry Avg</span>
          <span>{format(averageValue)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${averagePercent}%` }} />
        </div>
      </div>
    </div>
  );
}

function getRegistryDocumentsUrl(registry: string): string {
  const urls: Record<string, string> = {
    Verra: "https://verra.org/programs/verified-carbon-standard/",
    "Gold Standard": "https://www.goldstandard.org/our-work/our-standards",
    CAR: "https://www.climateactionreserve.org/",
    ACR: "https://americancarbonregistry.org/",
    ART: "https://www.artredd.org/",
  };
  return urls[registry] ?? "";
}
