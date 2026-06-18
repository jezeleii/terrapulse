import { REGISTRY_COLORS, REGISTRY_NAME_MAP, REGION_KEYWORDS, UPTAKE_BANDS } from "@/lib/vcm-constants";
import type { Project } from "./types";

export function normalizeRegistry(value?: string | null): string {
  if (!value) return "Unknown";
  const upper = value.toUpperCase();
  return REGISTRY_NAME_MAP[upper] ?? value;
}

export function normalizeRegion(value?: string | null): string {
  if (!value) return "Unknown";
  const lower = value.toLowerCase();
  for (const [keyword, label] of REGION_KEYWORDS) {
    if (lower.includes(keyword)) return label;
  }
  return value;
}

export function normalizeUptakeBand(value?: string | null): Project["uptakeBand"] {
  if (value && (UPTAKE_BANDS as readonly string[]).includes(value)) {
    return value as Project["uptakeBand"];
  }
  return "Medium";
}

export function normalizeScope(value?: string | null): string {
  if (!value) return "Unknown";
  const cleaned = value.trim();
  return cleaned || "Unknown";
}

export function splitDelimited(value?: string | null): string[] {
  if (!value) return [];
  return value.split(";").map((item) => item.trim()).filter(Boolean);
}

export function getRegistryColor(name: string): string {
  return REGISTRY_COLORS[name] ?? REGISTRY_COLORS.Unknown;
}
