'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VCM_FILTER_STORAGE_KEY, VCM_SEARCH_STORAGE_KEY } from "@/lib/vcm-constants";
import type { FilterOptions } from "@/components/analytics/types";

const DEFAULT_FILTERS: FilterOptions = {
  registry: [],
  projectType: [],
  region: [],
  methodology: [],
};

function readStoredFilters(): FilterOptions {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const stored = window.localStorage.getItem(VCM_FILTER_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as FilterOptions) : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function readStoredSearch(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(VCM_SEARCH_STORAGE_KEY) ?? "";
}

export function useVcmFilters() {
  const [filters, setFiltersState] = useState<FilterOptions>(readStoredFilters);
  const [search, setSearchState] = useState<string>(readStoredSearch);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VCM_FILTER_STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VCM_SEARCH_STORAGE_KEY, search);
    }
  }, [search]);

  const setFilters = useCallback((next: FilterOptions) => {
    setFiltersState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.registry.length) params.set("registry", next.registry.join(","));
    else params.delete("registry");
    if (next.projectType.length) params.set("type", next.projectType.join(","));
    else params.delete("type");
    if (next.region.length) params.set("region", next.region.join(","));
    else params.delete("region");
    if (next.methodology.length) params.set("methodology", next.methodology.join(","));
    else params.delete("methodology");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setSearchState("");
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  return { filters, setFilters, clearFilters, search, setSearch };
}
