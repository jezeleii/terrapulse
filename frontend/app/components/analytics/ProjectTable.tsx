'use client';

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UPTAKE_BAND_COLORS } from "@/lib/vcm-constants";
import type { FilterOptions, Project } from "./types";

interface ProjectTableProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  selectedProjectId?: string;
  filters?: FilterOptions;
}

export function ProjectTable({ projects, onSelectProject, selectedProjectId, filters }: ProjectTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof Project | "performance">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const activeFilters = useMemo(() => {
    if (!filters) return [];
    const collected: string[] = [];
    if (filters.registry.length) collected.push(`Registry: ${filters.registry.join(", ")}`);
    if (filters.projectType.length) collected.push(`Type: ${filters.projectType.join(", ")}`);
    if (filters.region.length) collected.push(`Region: ${filters.region.join(", ")}`);
    if (filters.methodology.length) collected.push(`Methodology: ${filters.methodology.join(", ")}`);
    return collected;
  }, [filters]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) =>
      project.id.toLowerCase().includes(normalizedQuery) ||
      project.name.toLowerCase().includes(normalizedQuery) ||
      project.registry.toLowerCase().includes(normalizedQuery) ||
      project.projectType.toLowerCase().includes(normalizedQuery) ||
      project.region.toLowerCase().includes(normalizedQuery),
    );
  }, [projects, query]);

  const sortedProjects = useMemo(() => {
    const performanceRank: Record<Project["uptakeBand"], number> = { Low: 1, Medium: 2, High: 3 };
    return [...filteredProjects].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "performance") {
        comparison = performanceRank[a.uptakeBand] - performanceRank[b.uptakeBand];
      } else {
        const aValue = a[sortKey];
        const bValue = b[sortKey];
        comparison = typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredProjects, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProjects = sortedProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: keyof Project | "performance") => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, totalPages];
    if (currentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  }, [currentPage, totalPages]);

  const sortIcon = (key: keyof Project | "performance") => {
    if (sortKey !== key) return <ChevronDown className="h-3 w-3 opacity-40" />;
    return sortDirection === "asc"
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <Card className="border-border/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-[0.3em]">Table filter</span>
          <span className="text-xs text-muted-foreground/70">{sortedProjects.length} results</span>
        </div>
        <div className="w-full max-w-md">
          <Input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Filter projects by name, region, type, or registry"
            icon={<Search className="h-4 w-4" />}
            className="h-11 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-xs text-muted-foreground">
        {activeFilters.length === 0 ? (
          <span className="rounded-full border border-border/50 bg-muted/40 px-3 py-1">All filters</span>
        ) : (
          activeFilters.map((filter) => (
            <span key={filter} className="rounded-full border border-border/50 bg-muted/40 px-3 py-1">{filter}</span>
          ))
        )}
      </div>
      <div className="overflow-x-auto py-2">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 my-2 hover:bg-transparent">
              <TableHead>
                <button type="button" onClick={() => handleSort("id")} className="flex items-center gap-2">Project ID {sortIcon("id")}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => handleSort("name")} className="flex items-center gap-2">Name {sortIcon("name")}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => handleSort("registry")} className="flex items-center gap-2">Registry {sortIcon("registry")}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => handleSort("projectType")} className="flex items-center gap-2">Type {sortIcon("projectType")}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => handleSort("region")} className="flex items-center gap-2">Region {sortIcon("region")}</button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" onClick={() => handleSort("totalIssued")} className="ml-auto flex items-center gap-2">Total Issued {sortIcon("totalIssued")}</button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" onClick={() => handleSort("totalRetired")} className="ml-auto flex items-center gap-2">Total Retired {sortIcon("totalRetired")}</button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => handleSort("performance")} className="flex items-center gap-2">Performance {sortIcon("performance")}</button>
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedProjects.map((project) => (
              <TableRow
                key={project.id}
                className={`cursor-pointer border-border/30 p-2 transition-colors ${
                  selectedProjectId === project.id ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectProject(project)}
              >
                <TableCell className="font-mono text-sm">{project.id}</TableCell>
                <TableCell className="max-w-[200px] truncate">{project.name}</TableCell>
                <TableCell><span className="text-sm text-muted-foreground">{project.registry}</span></TableCell>
                <TableCell><span className="text-sm">{project.projectType}</span></TableCell>
                <TableCell><span className="text-sm text-muted-foreground">{project.region}</span></TableCell>
                <TableCell className="text-right font-mono">{project.totalIssued.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{project.totalRetired.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={UPTAKE_BAND_COLORS[project.uptakeBand]}>{project.uptakeBand}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 pb-4 text-xs text-muted-foreground">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {visiblePages.map((pageNumber, index) => {
              const showEllipsis = index > 0 && pageNumber - visiblePages[index - 1] > 1;
              if (showEllipsis) {
                return <span key={`ellipsis-${pageNumber}`} className="px-1 text-muted-foreground/70">...</span>;
              }
              return (
                <Button
                  key={pageNumber}
                  type="button"
                  variant={pageNumber === currentPage ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setPage(pageNumber)}
                  className="h-8 min-w-8 px-2"
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground/70">/ page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-8 rounded-full border border-border/60 bg-card px-3 pr-9 text-xs text-foreground shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
            >
              {[5, 10, 20, 30].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground/70">Go to Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const next = Math.min(Math.max(1, Number(e.target.value)), totalPages);
                if (!Number.isNaN(next)) setPage(next);
              }}
              className="h-8 w-16 rounded-full border border-border/60 bg-card px-3 text-xs text-foreground shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
