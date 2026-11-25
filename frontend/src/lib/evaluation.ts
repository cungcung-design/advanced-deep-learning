import { ApiError } from "./api/client";
import type {
  Evaluation,
  EvaluationPreset,
  EvaluationState,
} from "./api/types";
import { formatTrainingApiError, type FormattedApiError } from "./training";

export const ALL_EVALUATION_STATES: readonly EvaluationState[] = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

export function isActiveEvaluationState(state: EvaluationState): boolean {
  return state === "QUEUED" || state === "RUNNING";
}

export function isTerminalEvaluationState(state: EvaluationState): boolean {
  return state === "SUCCEEDED" || state === "FAILED" || state === "CANCELLED";
}

export function isCancellableEvaluation(
  evaluation: Pick<Evaluation, "state">,
): boolean {
  return isActiveEvaluationState(evaluation.state);
}

export interface EvaluationSummaryStats {
  total: number;
  queued: number;
  running: number;
  active: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  highestAccuracy: number | null;
}

export function summarizeEvaluations(
  evaluations: readonly Evaluation[],
): EvaluationSummaryStats {
  let queued = 0;
  let running = 0;
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;
  let highestAccuracy: number | null = null;

  for (const item of evaluations) {
    switch (item.state) {
      case "QUEUED":
        queued += 1;
        break;
      case "RUNNING":
        running += 1;
        break;
      case "SUCCEEDED":
        succeeded += 1;
        if (
          typeof item.metrics.accuracy === "number" &&
          Number.isFinite(item.metrics.accuracy)
        ) {
          highestAccuracy =
            highestAccuracy === null
              ? item.metrics.accuracy
              : Math.max(highestAccuracy, item.metrics.accuracy);
        }
        break;
      case "FAILED":
        failed += 1;
        break;
      case "CANCELLED":
        cancelled += 1;
        break;
    }
  }

  return {
    total: evaluations.length,
    queued,
    running,
    active: queued + running,
    succeeded,
    failed,
    cancelled,
    highestAccuracy,
  };
}

export interface EvaluationFilterState {
  search: string;
  status: "ALL" | EvaluationState;
  model: string;
  dataset: string;
}

export const DEFAULT_EVALUATION_FILTERS: EvaluationFilterState = {
  search: "",
  status: "ALL",
  model: "ALL",
  dataset: "ALL",
};

export function hasActiveEvaluationFilters(
  filters: EvaluationFilterState,
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "ALL" ||
    filters.model !== "ALL" ||
    filters.dataset !== "ALL"
  );
}

export function getEvaluationPresetByModel(
  model: string,
  presets?: readonly EvaluationPreset[],
): EvaluationPreset | undefined {
  return presets?.find((preset) => preset.model === model);
}

export function getEvaluationDisplayName(
  model: string,
  presets?: readonly EvaluationPreset[],
): string {
  return getEvaluationPresetByModel(model, presets)?.display_name ?? model;
}

export function filterEvaluations(
  evaluations: readonly Evaluation[],
  filters: EvaluationFilterState,
  presets?: readonly EvaluationPreset[],
): Evaluation[] {
  const query = filters.search.trim().toLowerCase();

  return evaluations.filter((item) => {
    if (filters.status !== "ALL" && item.state !== filters.status) {
      return false;
    }
    if (filters.model !== "ALL" && item.model !== filters.model) {
      return false;
    }
    if (filters.dataset !== "ALL" && item.dataset !== filters.dataset) {
      return false;
    }
    if (!query) {
      return true;
    }

    const displayName = getEvaluationDisplayName(item.model, presets).toLowerCase();
    return (
      item.evaluation_id.toLowerCase().includes(query) ||
      item.model.toLowerCase().includes(query) ||
      displayName.includes(query) ||
      item.dataset.toLowerCase().includes(query) ||
      item.architecture.toLowerCase().includes(query) ||
      item.task.toLowerCase().includes(query) ||
      item.state.toLowerCase().includes(query)
    );
  });
}

export function getUniqueEvaluationModels(
  evaluations: readonly Evaluation[],
  presets?: readonly EvaluationPreset[],
): string[] {
  const seen = new Set<string>();
  if (presets) {
    for (const preset of presets) {
      seen.add(preset.model);
    }
  }
  for (const item of evaluations) {
    seen.add(item.model);
  }
  return Array.from(seen);
}

export function getUniqueEvaluationDatasets(
  evaluations: readonly Evaluation[],
  presets?: readonly EvaluationPreset[],
): string[] {
  const seen = new Set<string>();
  if (presets) {
    for (const preset of presets) {
      seen.add(preset.dataset);
    }
  }
  for (const item of evaluations) {
    seen.add(item.dataset);
  }
  return Array.from(seen);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "Not reported";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatMetricScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not reported";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function getConfusionMatrixMax(matrix: readonly (readonly number[])[]): number {
  let max = 0;
  for (const row of matrix) {
    for (const cell of row) {
      if (cell > max) {
        max = cell;
      }
    }
  }
  return max;
}

export function formatEvaluationApiError(error: unknown): FormattedApiError {
  if (error instanceof ApiError) {
    if (error.code === "MODEL_UNAVAILABLE") {
      return {
        title: "Model checkpoint unavailable",
        message:
          error.message ||
          "The selected model checkpoint is missing or unavailable locally.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "RESULTS_NOT_AVAILABLE") {
      return {
        title: "Evaluation results not available yet",
        message:
          error.message ||
          "Detailed classification results are available only after an evaluation succeeds.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "QUEUE_FULL") {
      const maxQueue =
        typeof error.details?.max_queue === "number"
          ? error.details.max_queue
          : null;
      return {
        title: "Evaluation queue is full",
        message:
          maxQueue !== null
            ? `The backend rejected this evaluation because the pending queue has reached its limit (${maxQueue} pending evaluations).`
            : error.message ||
              "The backend pending evaluation queue is currently full.",
        code: error.code,
        isOffline: false,
      };
    }
  }

  return formatTrainingApiError(error);
}
