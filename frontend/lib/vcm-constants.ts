export const REGISTRY_NAME_MAP: Record<string, string> = {
  VCS: "Verra",
  GOLD: "Gold Standard",
  CAR: "CAR",
  ACR: "ACR",
  ART: "ART",
};

export const REGISTRY_COLORS: Record<string, string> = {
  Verra: "hsl(346 77% 49%)",
  "Gold Standard": "hsl(45 93% 58%)",
  CAR: "hsl(24 95% 53%)",
  ACR: "hsl(262 83% 58%)",
  ART: "hsl(0 84% 60%)",
  Unknown: "hsl(210 18% 82%)",
};

export const REGION_KEYWORDS: [string, string][] = [
  ["africa", "Africa"],
  ["asia", "Asia"],
  ["europe", "Europe"],
  ["latin america", "Latin America"],
  ["north america", "North America"],
  ["oceania", "Oceania"],
];

export const UPTAKE_BANDS = ["High", "Medium", "Low"] as const;
export type UptakeBand = (typeof UPTAKE_BANDS)[number];

export const UPTAKE_BAND_COLORS: Record<UptakeBand, string> = {
  High: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Low: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const VCM_API_ENDPOINTS = {
  projects: "/api/vcm/projects",
  projectsSummary: "/api/vcm/projects/summary",
  dashboardTimeline: "/api/vcm/dashboard/timeline",
} as const;

export const VCM_FILTER_STORAGE_KEY = "vcm-filters";
export const VCM_SEARCH_STORAGE_KEY = "vcm-search";
