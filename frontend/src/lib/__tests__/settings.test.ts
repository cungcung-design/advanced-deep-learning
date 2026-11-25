import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { getReadiness } from "@/lib/api/endpoints";
import {
  HealthResponseSchema,
  MemoryInfoSchema,
  ModelCapabilitySchema,
  ReadinessResponseSchema,
  RuntimeInfoSchema,
  SettingsResponseSchema,
  StorageInfoSchema,
} from "@/lib/api/types";
import {
  DEFAULT_LOCAL_SETTINGS_PREFERENCES,
  SETTINGS_PREFS_STORAGE_KEY,
  clampPercentage,
  computeDiskUsage,
  computeMemoryUsage,
  getReadinessChecks,
  isReadinessHealthy,
  loadLocalSettingsPreferences,
  resetLocalSettingsPreferences,
  saveLocalSettingsPreferences,
} from "@/lib/settings";

describe("Settings & Health Zod schemas", () => {
  it("parses valid HealthResponse and ReadinessResponse payloads", () => {
    const health = HealthResponseSchema.parse({
      status: "ok",
      version: "1.0.0",
      app: "DeepVision AI Studio",
    });
    expect(health.version).toBe("1.0.0");

    const ready = ReadinessResponseSchema.parse({
      status: "ready",
      database: true,
      artifact_root: true,
      artifact_root_writable: true,
    });
    expect(isReadinessHealthy(ready)).toBe(true);
  });

  it("parses full SettingsResponse including nullable fields", () => {
    const runtime = RuntimeInfoSchema.parse({
      app_version: "1.0.0",
      python_version: "3.14.10",
      torch_version: "2.15.0+cpu",
      transformers_version: null,
      device: "cpu",
      cuda_available: false,
      cpu_count: 16,
      threads: 8,
      platform: "Windows-11",
    });
    const memory = MemoryInfoSchema.parse({
      total_bytes: null,
      available_bytes: null,
    });
    const storage = StorageInfoSchema.parse({
      artifact_root: "D:\\artifacts",
      artifact_bytes: 0,
      artifact_files: 0,
      data_root: "D:\\data",
      data_bytes: 1024,
      data_files: 2,
      disk_total_bytes: null,
      disk_free_bytes: null,
    });
    const capability = ModelCapabilitySchema.parse({
      model_id: "mnist_cnn",
      display_name: "MNIST CNN",
      task: "image_classification",
      capabilities: ["predict", "evaluate", "top_k"],
    });

    const parsed = SettingsResponseSchema.parse({
      runtime,
      memory,
      storage,
      models: [capability],
    });
    expect(parsed.models).toHaveLength(1);
    expect(parsed.memory.total_bytes).toBeNull();
  });
});

describe("Memory, disk, and readiness helpers", () => {
  it("computes clamped memory and disk usage safely and handles null/zero values", () => {
    expect(clampPercentage(-10)).toBe(0);
    expect(clampPercentage(150)).toBe(100);
    expect(clampPercentage(Number.NaN)).toBe(0);

    expect(
      computeMemoryUsage({ total_bytes: null, available_bytes: 100 }),
    ).toBeNull();
    expect(
      computeMemoryUsage({ total_bytes: 0, available_bytes: 0 }),
    ).toBeNull();

    const mem = computeMemoryUsage({
      total_bytes: 1000,
      available_bytes: 250,
    });
    expect(mem).toEqual({
      totalBytes: 1000,
      availableBytes: 250,
      usedBytes: 750,
      usedPercent: 75,
    });

    // Guard when available > total
    const clampedDisk = computeDiskUsage({
      artifact_root: "a",
      artifact_bytes: 0,
      artifact_files: 0,
      data_root: "d",
      data_bytes: 0,
      data_files: 0,
      disk_total_bytes: 500,
      disk_free_bytes: 700,
    });
    expect(clampedDisk?.usedBytes).toBe(0);
    expect(clampedDisk?.usedPercent).toBe(0);
  });

  it("identifies degraded readiness checks cleanly", () => {
    const degraded = {
      status: "not_ready",
      database: true,
      artifact_root: true,
      artifact_root_writable: false,
    };
    expect(isReadinessHealthy(degraded)).toBe(false);
    const checks = getReadinessChecks(degraded);
    expect(checks.map((c) => c.ok)).toEqual([true, true, false]);
  });
});

describe("getReadiness 503 handling", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses structured 503 readiness payload instead of throwing a generic error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "not_ready",
          database: true,
          artifact_root: true,
          artifact_root_writable: false,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await getReadiness();
    expect(result).toEqual({
      status: "not_ready",
      database: true,
      artifact_root: true,
      artifact_root_writable: false,
    });
  });

  it("rethrows ApiError when 503 body is not a valid ReadinessResponse", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Upstream unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getReadiness()).rejects.toBeInstanceOf(ApiError);
  });
});

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe("Browser-local settings preferences", () => {
  let memoryStorage: Storage;

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to auto-refresh off, persists changes, and resets cleanly", () => {
    expect(loadLocalSettingsPreferences()).toEqual(
      DEFAULT_LOCAL_SETTINGS_PREFERENCES,
    );

    expect(
      saveLocalSettingsPreferences({ autoRefreshDiagnostics: true }),
    ).toBe(true);
    expect(memoryStorage.getItem(SETTINGS_PREFS_STORAGE_KEY)).toContain("true");
    expect(loadLocalSettingsPreferences()).toEqual({
      autoRefreshDiagnostics: true,
    });

    expect(resetLocalSettingsPreferences()).toEqual({
      autoRefreshDiagnostics: false,
    });
    expect(memoryStorage.getItem(SETTINGS_PREFS_STORAGE_KEY)).toBeNull();
  });

  it("handles restricted or corrupted localStorage gracefully", () => {
    memoryStorage.setItem(SETTINGS_PREFS_STORAGE_KEY, "{not-json");
    expect(loadLocalSettingsPreferences()).toEqual(
      DEFAULT_LOCAL_SETTINGS_PREFERENCES,
    );

    vi.spyOn(memoryStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(
      saveLocalSettingsPreferences({ autoRefreshDiagnostics: true }),
    ).toBe(false);
  });
});
