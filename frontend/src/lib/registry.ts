import type { Evaluation, RegistryModelSummary } from "./api/types";
import { formatTrainingApiError, type FormattedApiError } from "./training";

export type RegistryModelSource = "catalog" | "trained_job";

export function getRegistryModelSource(
  model: Pick<RegistryModelSummary, "model_id">,
): RegistryModelSource {
  return model.model_id.startsWith("job_") ? "trained_job" : "catalog";
}

export interface RegistrySummaryStats {
  total: number;
  available: number;
  missing: number;
  invalid: number;
  unavailable: number;
  catalogCount: number;
  trainedJobCount: number;
  totalCheckpointBytes: number;
}

export function summarizeRegistryModels(
  models: readonly RegistryModelSummary[],
): RegistrySummaryStats {
  let available = 0;
  let missing = 0;
  let invalid = 0;
  let catalogCount = 0;
  let trainedJobCount = 0;
  let totalCheckpointBytes = 0;

  for (const model of models) {
    if (model.available && model.status === "available") {
      available += 1;
    } else if (model.status === "invalid") {
      invalid += 1;
    } else {
      missing += 1;
    }

    if (getRegistryModelSource(model) === "trained_job") {
      trainedJobCount += 1;
    } else {
      catalogCount += 1;
    }

    if (
      typeof model.checkpoint_size_bytes === "number" &&
      Number.isFinite(model.checkpoint_size_bytes) &&
      model.checkpoint_size_bytes > 0
    ) {
      totalCheckpointBytes += model.checkpoint_size_bytes;
    }
  }

  return {
    total: models.length,
    available,
    missing,
    invalid,
    unavailable: missing + invalid,
    catalogCount,
    trainedJobCount,
    totalCheckpointBytes,
  };
}

export interface RegistryFilterState {
  search: string;
  status: "ALL" | "available" | "missing" | "invalid";
  architecture: string;
  task: string;
  source: "ALL" | RegistryModelSource;
}

export const DEFAULT_REGISTRY_FILTERS: RegistryFilterState = {
  search: "",
  status: "ALL",
  architecture: "ALL",
  task: "ALL",
  source: "ALL",
};

export function hasActiveRegistryFilters(
  filters: RegistryFilterState,
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "ALL" ||
    filters.architecture !== "ALL" ||
    filters.task !== "ALL" ||
    filters.source !== "ALL"
  );
}

export function filterRegistryModels(
  models: readonly RegistryModelSummary[],
  filters: RegistryFilterState,
): RegistryModelSummary[] {
  const query = filters.search.trim().toLowerCase();

  return models.filter((model) => {
    if (filters.status !== "ALL" && model.status !== filters.status) {
      return false;
    }
    if (
      filters.architecture !== "ALL" &&
      model.architecture !== filters.architecture
    ) {
      return false;
    }
    if (filters.task !== "ALL" && model.task !== filters.task) {
      return false;
    }
    if (
      filters.source !== "ALL" &&
      getRegistryModelSource(model) !== filters.source
    ) {
      return false;
    }
    if (!query) {
      return true;
    }

    return (
      model.model_id.toLowerCase().includes(query) ||
      model.display_name.toLowerCase().includes(query) ||
      model.architecture.toLowerCase().includes(query) ||
      model.task.toLowerCase().includes(query) ||
      model.status.toLowerCase().includes(query)
    );
  });
}

export function getUniqueRegistryArchitectures(
  models: readonly RegistryModelSummary[],
): string[] {
  return Array.from(new Set(models.map((m) => m.architecture)));
}

export function getUniqueRegistryTasks(
  models: readonly RegistryModelSummary[],
): string[] {
  return Array.from(new Set(models.map((m) => m.task)));
}

export interface WorkspaceLink {
  label: string;
  href: "/training" | "/evaluation" | "/playground" | "/nlp";
  description: string;
}

export function getCompatibleWorkspaceLinks(
  model: RegistryModelSummary,
): WorkspaceLink[] {
  const source = getRegistryModelSource(model);

  if (source === "trained_job") {
    return [
      {
        label: "Model Training",
        href: "/training",
        description:
          "View training workspace (trained job checkpoints are not part of the fixed 6-model evaluation/inference catalog).",
      },
    ];
  }

  if (!model.available) {
    return [];
  }

  if (model.task === "sentiment_analysis") {
    return [
      {
        label: "Model Evaluation",
        href: "/evaluation",
        description: "Run held-out IMDb test evaluation.",
      },
      {
        label: "NLP Playground",
        href: "/nlp",
        description: "Run local CPU sentiment inference.",
      },
    ];
  }

  return [
    {
      label: "Model Evaluation",
      href: "/evaluation",
      description: "Run held-out test split evaluation.",
    },
    {
      label: "AI Playground",
      href: "/playground",
      description: "Run local CPU image classification.",
    },
  ];
}

export function getRelatedEvaluations(
  evaluations: readonly Evaluation[],
  modelId: string,
): Evaluation[] {
  return evaluations.filter((item) => item.model === modelId);
}

export function formatRegistryApiError(error: unknown): FormattedApiError {
  return formatTrainingApiError(error);
}
