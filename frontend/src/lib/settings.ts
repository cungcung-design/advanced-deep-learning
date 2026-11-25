import type {
  MemoryInfo,
  ReadinessResponse,
  StorageInfo,
} from "./api/types";
import { formatTrainingApiError, type FormattedApiError } from "./training";

export const SETTINGS_PREFS_STORAGE_KEY = "deepvision.settings.preferences.v1";
export const DIAGNOSTICS_POLL_INTERVAL_MS = 30_000;

export interface LocalSettingsPreferences {
  autoRefreshDiagnostics: boolean;
}

export const DEFAULT_LOCAL_SETTINGS_PREFERENCES: LocalSettingsPreferences = {
  autoRefreshDiagnostics: false,
};

export interface UsageBreakdown {
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function computeUsageBreakdown(
  totalBytes: number | null | undefined,
  availableBytes: number | null | undefined,
): UsageBreakdown | null {
  if (
    typeof totalBytes !== "number" ||
    typeof availableBytes !== "number" ||
    !Number.isFinite(totalBytes) ||
    !Number.isFinite(availableBytes) ||
    totalBytes <= 0 ||
    availableBytes < 0
  ) {
    return null;
  }

  const clampedAvailable = Math.min(totalBytes, availableBytes);
  const usedBytes = Math.max(0, totalBytes - clampedAvailable);
  const usedPercent = clampPercentage((usedBytes / totalBytes) * 100);

  return {
    totalBytes,
    availableBytes: clampedAvailable,
    usedBytes,
    usedPercent,
  };
}

export function computeMemoryUsage(memory: MemoryInfo): UsageBreakdown | null {
  return computeUsageBreakdown(memory.total_bytes, memory.available_bytes);
}

export function computeDiskUsage(storage: StorageInfo): UsageBreakdown | null {
  return computeUsageBreakdown(
    storage.disk_total_bytes,
    storage.disk_free_bytes,
  );
}

export interface ReadinessCheckItem {
  key: "database" | "artifact_root" | "artifact_root_writable";
  label: string;
  description: string;
  ok: boolean;
}

export function getReadinessChecks(
  readiness: ReadinessResponse,
): ReadinessCheckItem[] {
  return [
    {
      key: "database",
      label: "SQLite Metadata Database",
      description: "Verifies the local database connection responds to queries.",
      ok: readiness.database,
    },
    {
      key: "artifact_root",
      label: "Artifact Root Directory",
      description: "Checks that the configured local artifact directory exists.",
      ok: readiness.artifact_root,
    },
    {
      key: "artifact_root_writable",
      label: "Artifact Root Writable",
      description:
        "Verifies write permissions by creating and removing a temporary .write_probe file.",
      ok: readiness.artifact_root_writable,
    },
  ];
}

export function isReadinessHealthy(
  readiness: ReadinessResponse | null | undefined,
): boolean {
  if (!readiness) {
    return false;
  }
  return (
    readiness.status === "ready" &&
    readiness.database &&
    readiness.artifact_root &&
    readiness.artifact_root_writable
  );
}

export function loadLocalSettingsPreferences(): LocalSettingsPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_LOCAL_SETTINGS_PREFERENCES };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_PREFS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_LOCAL_SETTINGS_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "autoRefreshDiagnostics" in parsed &&
      typeof (parsed as { autoRefreshDiagnostics: unknown })
        .autoRefreshDiagnostics === "boolean"
    ) {
      return {
        autoRefreshDiagnostics: (
          parsed as { autoRefreshDiagnostics: boolean }
        ).autoRefreshDiagnostics,
      };
    }
    return { ...DEFAULT_LOCAL_SETTINGS_PREFERENCES };
  } catch {
    return { ...DEFAULT_LOCAL_SETTINGS_PREFERENCES };
  }
}

const preferenceListeners = new Set<() => void>();

function notifyPreferenceListeners(): void {
  for (const listener of preferenceListeners) {
    listener();
  }
}

export function subscribeLocalSettingsPreferences(
  listener: () => void,
): () => void {
  preferenceListeners.add(listener);
  if (typeof window === "undefined") {
    return () => {
      preferenceListeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SETTINGS_PREFS_STORAGE_KEY) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveLocalSettingsPreferences(
  prefs: LocalSettingsPreferences,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    window.localStorage.setItem(
      SETTINGS_PREFS_STORAGE_KEY,
      JSON.stringify({
        autoRefreshDiagnostics: Boolean(prefs.autoRefreshDiagnostics),
      }),
    );
    notifyPreferenceListeners();
    return true;
  } catch {
    return false;
  }
}

export function resetLocalSettingsPreferences(): LocalSettingsPreferences {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SETTINGS_PREFS_STORAGE_KEY);
    } catch {
      // Ignore restricted storage errors
    }
  }
  notifyPreferenceListeners();
  return { ...DEFAULT_LOCAL_SETTINGS_PREFERENCES };
}

export function formatSettingsApiError(error: unknown): FormattedApiError {
  return formatTrainingApiError(error);
}
