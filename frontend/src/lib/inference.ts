import { ApiError } from "./api/client";
import type { ImageInferenceResponse, ImageModelInfo } from "./api/types";
import { formatTrainingApiError, type FormattedApiError } from "./training";

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

export const MIN_TOP_K = 1;
export const MAX_TOP_K = 10;
export const DEFAULT_TOP_K = 3;

export interface ImageFileValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateImageFile(file: File): ImageFileValidationResult {
  if (file.size === 0) {
    return {
      valid: false,
      error: "The selected file is empty. Choose a valid PNG, JPEG, or WebP image.",
    };
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      valid: false,
      error: "Image exceeds the 5 MB upload limit. Choose a smaller image file.",
    };
  }

  const mimeOk = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
    file.type.toLowerCase(),
  );
  const lowerName = file.name.toLowerCase();
  const extOk = ALLOWED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

  if (!mimeOk && !extOk) {
    return {
      valid: false,
      error:
        "Unsupported file format. Please upload a PNG, JPEG, or WebP image.",
    };
  }

  return { valid: true, error: null };
}

export function selectFirstAvailableModel(
  models: readonly ImageModelInfo[],
): ImageModelInfo | null {
  return models.find((m) => m.available) ?? null;
}

export function formatConfidencePercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const clamped = Math.max(0, Math.min(1, value));
  return `${(clamped * 100).toFixed(2)}%`;
}

export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms)) {
    return "Not reported";
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

export function clampTopK(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TOP_K;
  }
  return Math.max(MIN_TOP_K, Math.min(MAX_TOP_K, Math.round(value)));
}

export interface SessionInferenceEntry {
  id: string;
  timestamp: string;
  fileName: string;
  modelDisplayName: string;
  result: ImageInferenceResponse;
}

export function formatInferenceApiError(error: unknown): FormattedApiError {
  if (error instanceof ApiError) {
    if (error.code === "FILE_TOO_LARGE" || error.status === 413) {
      return {
        title: "Image too large",
        message:
          error.message || "Image uploads are limited to 5 MB.",
        code: error.code ?? "FILE_TOO_LARGE",
        isOffline: false,
      };
    }

    if (error.status === 415) {
      return {
        title: "Unsupported image format",
        message:
          error.message ||
          "Only PNG, JPEG, and WebP images are accepted by the inference service.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "MODEL_UNAVAILABLE") {
      return {
        title: "Selected model unavailable",
        message:
          error.message ||
          "The selected model checkpoint is not available locally.",
        code: error.code,
        isOffline: false,
      };
    }
  }

  return formatTrainingApiError(error);
}
