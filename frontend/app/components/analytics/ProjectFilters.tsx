'use client';

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "./types";

export type { FilterOptions };

interface ProjectFiltersProps {
  filters: FilterOptions;
  options: FilterOptions;
  methodologyByRegistry: Record<string, string[]>;
  onFilterChange: (filters: FilterOptions) => void;
  onReset: () => void;
  className?: string;
}

export function ProjectFilters({
  filters,
  options,
  methodologyByRegistry,
  onFilterChange,
  onReset,
  className,
}: ProjectFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { registry: registries, projectType: projectTypes, region: regions, methodology: methodologies } = options;

  return (
    <div className={cn("border border-[#7ef6e0]/15 bg-[#0c0c0c]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#7ef6e0]/15">
        <span className="text-[9px] font-bold text-[#7ef6e0]/50 tracking-[0.2em]">FILTERS</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[9px] text-[#7ef6e0]/35 hover:text-[#7ef6e0] tracking-wider transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="text-[9px] text-[#7ef6e0]/35 hover:text-[#7ef6e0] tracking-wider transition-colors"
          >
            {isCollapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-4">
          <FilterField
            label="Registry"
            values={filters.registry}
            options={registries}
            onChange={(values) => onFilterChange({ ...filters, registry: values })}
          />
          <FilterField
            label="Project Type"
            values={filters.projectType}
            options={projectTypes}
            maxVisibleOptions={7}
            onChange={(values) => onFilterChange({ ...filters, projectType: values })}
          />
          <FilterField
            label="Region"
            values={filters.region}
            options={regions}
            onChange={(values) => onFilterChange({ ...filters, region: values })}
          />
          <FilterField
            label="Methodology"
            values={filters.methodology}
            options={methodologies}
            onChange={(values) => onFilterChange({ ...filters, methodology: values })}
            renderCustom={() => (
              <MethodologyField
                values={filters.methodology}
                registries={registries}
                methodologyByRegistry={methodologyByRegistry}
                onChange={(values) => onFilterChange({ ...filters, methodology: values })}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}

interface FilterFieldProps {
  label: string;
  values: string[];
  options: string[];
  onChange: (value: string[]) => void;
  renderCustom?: () => ReactNode;
  maxVisibleOptions?: number;
}

function FilterField({ label, values, options, onChange, renderCustom, maxVisibleOptions }: FilterFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleValue = (option: string) => {
    onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option]);
  };

  const hasToggle = Boolean(maxVisibleOptions && options.length > maxVisibleOptions);
  const visibleOptions = hasToggle ? options.slice(0, maxVisibleOptions) : options;
  const hiddenOptions = hasToggle ? options.slice(maxVisibleOptions) : [];

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-bold text-[#7ef6e0]/50 tracking-[0.2em]">{label.toUpperCase()}</div>
      {renderCustom ? (
        renderCustom()
      ) : (
        <div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onChange([])}
              className={`text-[9px] px-2 py-0.5 tracking-wider transition-colors ${
                values.length === 0
                  ? "bg-[#7ef6e0] text-[#0a0a0a] font-bold"
                  : "border border-[#7ef6e0]/20 text-[#7ef6e0]/45 hover:text-[#7ef6e0]"
              }`}
            >
              All
            </button>
            {visibleOptions.map((option) => {
              const active = values.includes(option);
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => toggleValue(option)}
                  className={`text-[9px] px-2 py-0.5 tracking-wider transition-colors ${
                    active
                      ? "border border-[#7ef6e0]/60 text-[#7ef6e0] bg-[#7ef6e0]/10"
                      : "border border-[#7ef6e0]/15 text-[#7ef6e0]/40 hover:text-[#7ef6e0]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
            {hasToggle && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="text-[9px] px-2 py-0.5 border border-[#7ef6e0]/15 text-[#7ef6e0]/35 tracking-wider hover:text-[#7ef6e0] transition-colors"
              >
                {isExpanded ? "Less" : `+${hiddenOptions.length}`}
              </button>
            )}
          </div>
          {hasToggle && isExpanded && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {hiddenOptions.map((option) => {
                const active = values.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => toggleValue(option)}
                    className={`text-[9px] px-2 py-0.5 tracking-wider transition-colors ${
                      active
                        ? "border border-[#7ef6e0]/60 text-[#7ef6e0] bg-[#7ef6e0]/10"
                        : "border border-[#7ef6e0]/15 text-[#7ef6e0]/40 hover:text-[#7ef6e0]"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MethodologyFieldProps {
  values: string[];
  registries: string[];
  methodologyByRegistry: Record<string, string[]>;
  onChange: (value: string[]) => void;
}

function MethodologyField({ values, registries, methodologyByRegistry, onChange }: MethodologyFieldProps) {
  const toggleValue = (option: string) => {
    onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option]);
  };

  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`text-[9px] px-2 py-0.5 tracking-wider transition-colors ${
          values.length === 0
            ? "bg-[#7ef6e0] text-[#0a0a0a] font-bold"
            : "border border-[#7ef6e0]/20 text-[#7ef6e0]/45 hover:text-[#7ef6e0]"
        }`}
      >
        All
      </button>
      {registries.map((registry) => {
        const opts = methodologyByRegistry[registry] ?? [];
        return (
          <details key={registry} className="relative">
            <summary className="list-none border border-[#7ef6e0]/20 px-2 py-0.5 text-[9px] text-[#7ef6e0]/45 tracking-wider cursor-pointer hover:text-[#7ef6e0] transition-colors [&::-webkit-details-marker]:hidden">
              {registry}
            </summary>
            <div className="absolute left-0 top-full z-20 mt-1 w-56 border border-[#7ef6e0]/20 bg-[#0c0c0c] p-2 shadow-lg">
              <div className="max-h-56 space-y-1 overflow-auto">
                {opts.length ? (
                  opts.map((option) => {
                    const active = values.includes(option);
                    return (
                      <button
                        type="button"
                        key={`${registry}-${option}`}
                        onClick={() => toggleValue(option)}
                        className={`flex w-full items-center justify-between px-2 py-1 text-left text-[9px] tracking-wider transition-colors ${
                          active
                            ? "border border-[#7ef6e0]/40 text-[#7ef6e0] bg-[#7ef6e0]/10"
                            : "text-[#7ef6e0]/45 hover:text-[#7ef6e0]"
                        }`}
                      >
                        <span className="pr-2 truncate">{option}</span>
                        {active && <span className="text-[8px] tracking-[0.2em] shrink-0">ON</span>}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-[9px] text-[#7ef6e0]/30">No methods found.</div>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
