import { ApiError } from "./api/client";
import type {
  TrainingConfig,
  TrainingJob,
  TrainingJobState,
  TrainingPreset,
} from "./api/types";

export const ACTIVE_JOB_STATES: readonly TrainingJobState[] = [
  "QUEUED",
  "RUNNING",
];

export const TERMINAL_JOB_STATES: readonly TrainingJobState[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

export const ALL_JOB_STATES: readonly TrainingJobState[] = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

export const FIXED_IMAGE_SIZES: Record<string, number> = {
  cifar_cnn: 32,
  mnist_cnn: 28,
};

export const PRETRAINED_WEIGHT_MODELS = new Set<string>([
  "resnet18_feature_extraction",
  "resnet18_finetuning",
]);

export function isActiveJobState(state: TrainingJobState): boolean {
  return state === "QUEUED" || state === "RUNNING";
}

export function isTerminalJobState(state: TrainingJobState): boolean {
  return state === "SUCCEEDED" || state === "FAILED" || state === "CANCELLED";
}

export function isCancellableJob(job: Pick<TrainingJob, "state">): boolean {
  return isActiveJobState(job.state);
}

export function getFixedImageSize(model: string): number | null {
  return Object.prototype.hasOwnProperty.call(FIXED_IMAGE_SIZES, model)
    ? FIXED_IMAGE_SIZES[model]
    : null;
}

export function usesPretrainedWeights(model: string): boolean {
  return PRETRAINED_WEIGHT_MODELS.has(model);
}

export interface TrainingSummaryStats {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  completedOrFailed: number;
}

export function summarizeTrainingJobs(
  jobs: readonly TrainingJob[],
): TrainingSummaryStats {
  let queued = 0;
  let running = 0;
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;

  for (const job of jobs) {
    switch (job.state) {
      case "QUEUED":
        queued += 1;
        break;
      case "RUNNING":
        running += 1;
        break;
      case "SUCCEEDED":
        succeeded += 1;
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
    total: jobs.length,
    queued,
    running,
    succeeded,
    failed,
    cancelled,
    completedOrFailed: succeeded + failed,
  };
}

export interface TrainingFilterState {
  search: string;
  status: "ALL" | TrainingJobState;
  model: string;
  dataset: string;
}

export const DEFAULT_TRAINING_FILTERS: TrainingFilterState = {
  search: "",
  status: "ALL",
  model: "ALL",
  dataset: "ALL",
};

export function hasActiveTrainingFilters(
  filters: TrainingFilterState,
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "ALL" ||
    filters.model !== "ALL" ||
    filters.dataset !== "ALL"
  );
}

export function filterTrainingJobs(
  jobs: readonly TrainingJob[],
  filters: TrainingFilterState,
  presets?: readonly TrainingPreset[],
): TrainingJob[] {
  const query = filters.search.trim().toLowerCase();

  return jobs.filter((job) => {
    if (filters.status !== "ALL" && job.state !== filters.status) {
      return false;
    }
    if (filters.model !== "ALL" && job.model !== filters.model) {
      return false;
    }
    if (filters.dataset !== "ALL" && job.dataset !== filters.dataset) {
      return false;
    }
    if (!query) {
      return true;
    }

    const displayName = getPresetDisplayName(job.model, presets).toLowerCase();
    return (
      job.job_id.toLowerCase().includes(query) ||
      job.model.toLowerCase().includes(query) ||
      displayName.includes(query) ||
      job.dataset.toLowerCase().includes(query) ||
      job.state.toLowerCase().includes(query)
    );
  });
}

export function getUniqueJobModels(
  jobs: readonly TrainingJob[],
  presets?: readonly TrainingPreset[],
): string[] {
  const seen = new Set<string>();
  if (presets) {
    for (const preset of presets) {
      seen.add(preset.model);
    }
  }
  for (const job of jobs) {
    seen.add(job.model);
  }
  return Array.from(seen);
}

export function getUniqueJobDatasets(
  jobs: readonly TrainingJob[],
  presets?: readonly TrainingPreset[],
): string[] {
  const seen = new Set<string>();
  if (presets) {
    for (const preset of presets) {
      seen.add(preset.dataset);
    }
  }
  for (const job of jobs) {
    seen.add(job.dataset);
  }
  return Array.from(seen);
}

export function getPresetByModel(
  model: string,
  presets?: readonly TrainingPreset[],
): TrainingPreset | undefined {
  return presets?.find((preset) => preset.model === model);
}

export function getPresetDisplayName(
  model: string,
  presets?: readonly TrainingPreset[],
): string {
  return getPresetByModel(model, presets)?.display_name ?? model;
}

export function clonePresetConfig(preset: TrainingPreset): TrainingConfig {
  return {
    epochs: preset.default_config.epochs,
    batch_size: preset.default_config.batch_size,
    learning_rate: preset.default_config.learning_rate,
    weight_decay: preset.default_config.weight_decay,
    val_fraction: preset.default_config.val_fraction,
    seed: preset.default_config.seed,
    num_workers: preset.default_config.num_workers,
    image_size:
      getFixedImageSize(preset.model) ?? preset.default_config.image_size,
  };
}

export function clampProgressPercent(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  const percent = progress * 100;
  return Math.max(0, Math.min(100, percent));
}

export function formatProgressPercent(progress: number): string {
  return `${clampProgressPercent(progress).toFixed(1)}%`;
}

export function formatLoss(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not reported";
  }
  return value.toFixed(4);
}

export function formatAccuracy(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not reported";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "Not reported";
  }
  if (seconds < 0) {
    return "0.0s";
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
  }
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) {
    return "Not reported";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export type LogSeverity = "info" | "warning" | "error";

export interface ParsedLogLine {
  raw: string;
  timestamp: string | null;
  message: string;
  severity: LogSeverity;
}

const LOG_TIMESTAMP_RE = /^\[([^\]]+)\]\s*(.*)$/;

export function classifyLogLine(line: string): LogSeverity {
  const lower = line.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("exception") ||
    lower.includes("traceback")
  ) {
    return "error";
  }
  if (
    lower.includes("warn") ||
    lower.includes("cancel") ||
    lower.includes("interrupted")
  ) {
    return "warning";
  }
  return "info";
}

export function parseLogLine(line: string): ParsedLogLine {
  const match = LOG_TIMESTAMP_RE.exec(line);
  const timestamp = match ? match[1] : null;
  const message = match ? match[2] : line;
  return {
    raw: line,
    timestamp,
    message,
    severity: classifyLogLine(line),
  };
}

export interface FormattedApiError {
  title: string;
  message: string;
  code?: string;
  isOffline: boolean;
}

export function formatTrainingApiError(error: unknown): FormattedApiError {
  if (error instanceof ApiError) {
    if (error.isNetworkError || error.status === 0) {
      return {
        title: "Backend offline or unreachable",
        message:
          "Could not connect to the local FastAPI training service. Verify that the backend server is running and try again.",
        code: "NETWORK_ERROR",
        isOffline: true,
      };
    }

    if (error.code === "QUEUE_FULL") {
      const maxQueue =
        typeof error.details?.max_queue === "number"
          ? error.details.max_queue
          : null;
      return {
        title: "Training queue is full",
        message:
          maxQueue !== null
            ? `The backend rejected this run because the pending queue has reached its limit (${maxQueue} pending jobs). Wait for a queued job to start or cancel one before submitting again.`
            : error.message ||
              "The backend pending training queue is currently full. Wait for an active or queued job to finish before submitting again.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "DATASET_UNAVAILABLE") {
      return {
        title: "Dataset unavailable locally",
        message:
          error.message ||
          "Required local dataset files are missing. Prepare the dataset locally before starting training.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "CANCELLED") {
      return {
        title: "Job can no longer be cancelled",
        message:
          error.message ||
          "This training job has already reached a terminal state.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "VALIDATION_ERROR") {
      return {
        title: "Invalid training configuration",
        message: error.message || "Check your configuration values and retry.",
        code: error.code,
        isOffline: false,
      };
    }

    return {
      title: error.code ? `Request failed (${error.code})` : "Request failed",
      message: error.message || `API request failed (${error.status}).`,
      code: error.code,
      isOffline: false,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Unexpected error",
      message: error.message,
      isOffline: false,
    };
  }

  return {
    title: "Unexpected error",
    message: "An unknown error occurred while communicating with the backend.",
    isOffline: false,
  };
}
