import type { DatasetSummary } from "./api/types";
import { formatTrainingApiError, type FormattedApiError } from "./training";

export interface DatasetSummaryStats {
  total: number;
  available: number;
  unavailable: number;
  totalSizeBytes: number;
  totalFiles: number;
  totalSamples: number;
}

export function summarizeDatasets(
  datasets: readonly DatasetSummary[],
): DatasetSummaryStats {
  let available = 0;
  let unavailable = 0;
  let totalSizeBytes = 0;
  let totalFiles = 0;
  let totalSamples = 0;

  for (const ds of datasets) {
    if (ds.available && ds.status === "available") {
      available += 1;
    } else {
      unavailable += 1;
    }

    if (
      typeof ds.local_size_bytes === "number" &&
      Number.isFinite(ds.local_size_bytes) &&
      ds.local_size_bytes > 0
    ) {
      totalSizeBytes += ds.local_size_bytes;
    }
    if (
      typeof ds.local_file_count === "number" &&
      Number.isFinite(ds.local_file_count) &&
      ds.local_file_count > 0
    ) {
      totalFiles += ds.local_file_count;
    }
    const train =
      typeof ds.train_size === "number" && Number.isFinite(ds.train_size)
        ? ds.train_size
        : 0;
    const test =
      typeof ds.test_size === "number" && Number.isFinite(ds.test_size)
        ? ds.test_size
        : 0;
    totalSamples += train + test;
  }

  return {
    total: datasets.length,
    available,
    unavailable,
    totalSizeBytes,
    totalFiles,
    totalSamples,
  };
}

export interface DatasetFilterState {
  search: string;
  status: "ALL" | "available" | "unavailable";
  type: string;
  task: string;
}

export const DEFAULT_DATASET_FILTERS: DatasetFilterState = {
  search: "",
  status: "ALL",
  type: "ALL",
  task: "ALL",
};

export function hasActiveDatasetFilters(filters: DatasetFilterState): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "ALL" ||
    filters.type !== "ALL" ||
    filters.task !== "ALL"
  );
}

export function filterDatasets(
  datasets: readonly DatasetSummary[],
  filters: DatasetFilterState,
): DatasetSummary[] {
  const query = filters.search.trim().toLowerCase();

  return datasets.filter((ds) => {
    if (filters.status === "available" && !ds.available) {
      return false;
    }
    if (filters.status === "unavailable" && ds.available) {
      return false;
    }
    if (filters.type !== "ALL" && ds.dataset_type !== filters.type) {
      return false;
    }
    if (filters.task !== "ALL" && ds.task !== filters.task) {
      return false;
    }
    if (!query) {
      return true;
    }

    return (
      ds.dataset_id.toLowerCase().includes(query) ||
      ds.display_name.toLowerCase().includes(query) ||
      (ds.description ?? "").toLowerCase().includes(query) ||
      (ds.dataset_type ?? "").toLowerCase().includes(query) ||
      (ds.task ?? "").toLowerCase().includes(query) ||
      (ds.source ?? "").toLowerCase().includes(query)
    );
  });
}

export function getUniqueDatasetTypes(
  datasets: readonly DatasetSummary[],
): string[] {
  return Array.from(
    new Set(
      datasets
        .map((d) => d.dataset_type)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
}

export function getUniqueDatasetTasks(
  datasets: readonly DatasetSummary[],
): string[] {
  return Array.from(
    new Set(
      datasets
        .map((d) => d.task)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );
}

export function formatSampleCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "Not reported";
  }
  return value.toLocaleString("en-US");
}

export function formatInputSpec(
  input: Record<string, unknown> | undefined,
): string {
  if (!input || Object.keys(input).length === 0) {
    return "Not reported";
  }
  if (
    typeof input.channels === "number" &&
    typeof input.height === "number" &&
    typeof input.width === "number"
  ) {
    return `${input.channels} × ${input.height} × ${input.width}`;
  }
  if (input.text === true) {
    const maxLen =
      typeof input.max_length === "number" ? ` · max ${input.max_length} tokens` : "";
    return `Text${maxLen}`;
  }
  return Object.entries(input)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
}

export function formatValidationCheckLabel(name: string): string {
  const labels: Record<string, string> = {
    supported_id: "Supported Dataset ID",
    local_files: "Required Local Files Present",
    split_totals: "Train / Test Split Totals",
    class_metadata: "Class Labels & Count",
    input_spec: "Input Tensor / Token Specification",
  };
  return labels[name] ?? name.replace(/_/g, " ");
}

export interface DatasetWorkspaceLink {
  label: string;
  href: "/training" | "/evaluation";
  description: string;
}

export function getDatasetWorkspaceLinks(
  dataset: DatasetSummary,
): DatasetWorkspaceLink[] {
  if (!dataset.available) {
    return [];
  }

  const links: DatasetWorkspaceLink[] = [
    {
      label: "Model Evaluation",
      href: "/evaluation",
      description:
        "Open the Evaluation workspace to run held-out test evaluations.",
    },
  ];

  // Training presets currently support mnist and cifar10
  if (dataset.dataset_id === "mnist" || dataset.dataset_id === "cifar10") {
    links.unshift({
      label: "Model Training",
      href: "/training",
      description:
        "Open the Training workspace to configure and launch a local CPU training job.",
    });
  }

  return links;
}

export function formatDatasetsApiError(error: unknown): FormattedApiError {
  return formatTrainingApiError(error);
}
