import type { ReadinessResponse } from "./api/types";
import { getReadinessChecks, isReadinessHealthy } from "./settings";

/**
 * Converts a backend-normalized training progress value (0..1) into a clamped
 * 0..100 percentage suitable for both progress bars and labels.
 */
export function normalizeTrainingProgressPercent(
  progress: number | null | undefined,
): number {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return 0;
  }
  const scaled = progress * 100;
  if (scaled <= 0) {
    return 0;
  }
  if (scaled >= 100) {
    return 100;
  }
  return scaled;
}

/**
 * Formats a normalized training progress value (0..1) as a human-readable
 * percentage string using the exact same clamped normalization as the bar.
 */
export function formatTrainingProgressPercent(
  progress: number | null | undefined,
): string {
  const pct = normalizeTrainingProgressPercent(progress);
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export interface ReadinessDisplayState {
  label: "Checking" | "Ready" | "Not ready" | "Unavailable";
  tone: "neutral" | "ok" | "warning" | "error";
  detail: string;
}

export function deriveReadinessDisplay(options: {
  readiness: ReadinessResponse | undefined;
  isLoading: boolean;
  isError: boolean;
}): ReadinessDisplayState {
  const { readiness, isLoading, isError } = options;

  if (isLoading) {
    return {
      label: "Checking",
      tone: "neutral",
      detail: "Checking database and artifact storage probes",
    };
  }

  if (isError || !readiness) {
    return {
      label: "Unavailable",
      tone: "error",
      detail: "Readiness endpoint could not be reached",
    };
  }

  if (isReadinessHealthy(readiness)) {
    return {
      label: "Ready",
      tone: "ok",
      detail: "Database and artifact storage verified",
    };
  }

  const failing = getReadinessChecks(readiness)
    .filter((check) => !check.ok)
    .map((check) => check.label);

  return {
    label: "Not ready",
    tone: "warning",
    detail:
      failing.length > 0
        ? `Failing: ${failing.join(", ")}`
        : `Readiness status: ${readiness.status}`,
  };
}
