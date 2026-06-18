export interface ApiProject {
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

export interface ApiProjectSummary {
  registry_breakdown: { registry: string; project_count: number }[];
}

export interface ApiTimelineDatum {
  month: string;
  issued_total: number;
  retired_total: number;
}

export interface FilterOptions {
  registry: string[];
  projectType: string[];
  region: string[];
  methodology: string[];
}

export interface Project {
  id: string;
  name: string;
  registry: string;
  projectType: string;
  region: string;
  country?: string;
  scope?: string | null;
  status?: string;
  methodology?: string;
  reductionRemoval?: string;
  totalIssued: number;
  totalRetired: number;
  uptakeBand: "High" | "Medium" | "Low";
  bufferPercent: number;
  verifier?: string;
  voluntaryStatus?: string;
  registryDocumentsUrl?: string;
}

export interface TimelineData {
  month: string;
  issued: number;
  retired: number;
}

export interface RegistryDatum {
  name: string;
  value: number;
  color: string;
}

export interface RegistryTypeDatum {
  name: string;
  value: number;
  color: string;
  types: { name: string; value: number }[];
}

export interface ProjectTypeDatum {
  name: string;
  value: number;
}

export type MetricMode = "issued" | "retired";
