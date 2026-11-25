export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export interface StructuredApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  detail?: unknown;
}

export class ApiError extends Error {
  public code?: string;
  public details?: Record<string, unknown>;
  public isNetworkError: boolean;

  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
    options?: {
      code?: string;
      details?: Record<string, unknown>;
      isNetworkError?: boolean;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options?.code;
    this.details = options?.details;
    this.isNetworkError = options?.isNetworkError ?? false;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to reach the local backend API";
    throw new ApiError(message, 0, error, {
      code: "NETWORK_ERROR",
      isNetworkError: true,
    });
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    const body =
      typeof detail === "object" && detail !== null
        ? (detail as StructuredApiErrorBody)
        : undefined;
    const code = body?.error?.code;
    const details = body?.error?.details;
    const message =
      body?.error?.message ??
      (body && "detail" in body && body.detail !== undefined
        ? String(body.detail)
        : `API request failed (${response.status})`);
    throw new ApiError(message, response.status, detail, {
      code,
      details,
      isNetworkError: false,
    });
  }

  return response.json() as Promise<T>;
}

export const apiPaths = {
  health: "/health",
  readiness: "/health/ready",
  settings: "/settings",
  runtime: "/settings/runtime",
  storage: "/settings/storage",
  models: "/registry/models",
  datasets: "/datasets",
  trainingPresets: "/training/presets",
  trainingJobs: "/training/jobs",
  evaluationPresets: "/evaluations/presets",
  evaluations: "/evaluations",
  imageModels: "/inference/image/models",
  nlpModels: "/inference/nlp/models",
} as const;

export interface Health {
  status: string;
  version: string;
  app: string;
}

export interface Readiness {
  status: string;
  [key: string]: unknown;
}

export interface TrainingJob {
  job_id: string;
  model: string;
  dataset: string;
  state: string;
  current_epoch: number;
  total_epochs: number;
  current_batch: number;
  total_batches: number;
  progress: number;
  metrics: {
    train_loss?: number | null;
    train_acc?: number | null;
    val_loss?: number | null;
    val_acc?: number | null;
  };
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  elapsed_seconds: number | null;
  cancel_requested: boolean;
  queue_position: number | null;
  device: string | null;
  artifact_dir: string;
  checkpoint_path: string | null;
  history_path: string | null;
  metrics_path: string | null;
  metadata_path: string | null;
  config_path: string | null;
  error: Record<string, string> | null;
}

export interface TrainingPreset {
  model: string;
  dataset: string;
  display_name: string;
  architecture: string;
  default_config: Record<string, number>;
}

export interface Evaluation {
  evaluation_id: string;
  model: string;
  dataset: string;
  architecture: string;
  task: string;
  state: string;
  progress: number;
  samples_evaluated: number;
  total_samples: number;
  metrics: {
    accuracy: number | null;
    macro_precision: number | null;
    macro_recall: number | null;
    macro_f1: number | null;
  };
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  elapsed_seconds: number | null;
  cancel_requested: boolean;
  queue_position: number | null;
  device: string | null;
  artifact_dir: string;
  source_checkpoint: string;
  results_path: string | null;
  metrics_path: string | null;
  metadata_path: string | null;
  error: Record<string, string> | null;
}

export interface Dataset {
  [key: string]: unknown;
}

export interface RegistryModel {
  [key: string]: unknown;
}
