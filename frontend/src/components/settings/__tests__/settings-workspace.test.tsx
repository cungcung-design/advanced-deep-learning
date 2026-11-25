import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/components/settings/settings-view";
import type {
  HealthResponse,
  ReadinessResponse,
  SettingsResponse,
} from "@/lib/api/types";
import { SETTINGS_PREFS_STORAGE_KEY } from "@/lib/settings";

const MOCK_HEALTH: HealthResponse = {
  status: "ok",
  version: "1.0.0",
  app: "DeepVision AI Studio",
};

const MOCK_READY: ReadinessResponse = {
  status: "ready",
  database: true,
  artifact_root: true,
  artifact_root_writable: true,
};

const MOCK_SETTINGS: SettingsResponse = {
  runtime: {
    app_version: "1.0.0",
    python_version: "3.14.10",
    torch_version: "2.15.0+cpu",
    transformers_version: "5.24.0",
    device: "cpu",
    cuda_available: false,
    cpu_count: 16,
    threads: 8,
    platform: "Windows-11-10.0.26300-SP0",
  },
  memory: {
    total_bytes: 34_002_464_768,
    available_bytes: 12_283_252_736,
  },
  storage: {
    artifact_root: "D:\\Developer\\Projects\\advanced-deep-learning\\artifacts",
    artifact_bytes: 464_622_578,
    artifact_files: 39,
    data_root: "D:\\Developer\\Projects\\advanced-deep-learning\\data",
    data_bytes: 423_256_955,
    data_files: 19,
    disk_total_bytes: 647_239_823_360,
    disk_free_bytes: 634_226_057_216,
  },
  models: [
    {
      model_id: "resnet18_finetuned",
      display_name: "ResNet18 Fine-tuned",
      task: "image_classification",
      capabilities: ["predict", "evaluate", "top_k"],
    },
    {
      model_id: "distilbert_imdb_finetuned",
      display_name: "DistilBERT IMDb Sentiment",
      task: "sentiment_analysis",
      capabilities: ["sentiment", "batch"],
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

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

describe("SettingsView workspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders live health, readiness, runtime, storage paths, model capabilities, and local preference toggle/reset", async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/health/ready")) {
        return Promise.resolve(jsonResponse(MOCK_READY));
      }
      if (url.endsWith("/health")) {
        return Promise.resolve(jsonResponse(MOCK_HEALTH));
      }
      if (url.endsWith("/settings")) {
        return Promise.resolve(jsonResponse(MOCK_SETTINGS));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText("Online · v1.0.0")).toBeInTheDocument();
    });

    // Runtime & compute
    expect(screen.getByText("3.14.10")).toBeInTheDocument();
    expect(screen.getByText("2.15.0+cpu")).toBeInTheDocument();
    expect(screen.getByText("CPU-only execution active")).toBeInTheDocument();

    // Copyable paths
    expect(
      screen.getByRole("button", { name: "Copy API Base URL" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Artifact Root Path" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Data Root Path" }),
    ).toBeInTheDocument();

    // Model capabilities & registry link
    expect(
      screen.getByText("Registered Model Capabilities (2)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open Model Registry/i }),
    ).toHaveAttribute("href", "/registry");

    // Dark theme is fixed; no theme switcher
    expect(screen.getByText("Dark (fixed)")).toBeInTheDocument();

    // Auto-refresh OFF by default, persists when toggled, resets cleanly
    const toggle = screen.getByRole("switch", {
      name: /Auto-refresh diagnostics/i,
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem(SETTINGS_PREFS_STORAGE_KEY)).toContain(
      "true",
    );

    await user.click(
      screen.getByRole("button", { name: /Reset local preferences/i }),
    );
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(window.localStorage.getItem(SETTINGS_PREFS_STORAGE_KEY)).toBeNull();
  });

  it("renders structured degraded readiness state on HTTP 503 without treating it as a connection failure", async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/health/ready")) {
        return Promise.resolve(
          jsonResponse(
            {
              status: "not_ready",
              database: true,
              artifact_root: true,
              artifact_root_writable: false,
            },
            503,
          ),
        );
      }
      if (url.endsWith("/health")) {
        return Promise.resolve(jsonResponse(MOCK_HEALTH));
      }
      if (url.endsWith("/settings")) {
        return Promise.resolve(jsonResponse(MOCK_SETTINGS));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    renderWithQueryClient(<SettingsView />);

    await waitFor(() => {
      expect(
        screen.getByText("Service readiness degraded (HTTP 503)"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Degraded (503)")).toBeInTheDocument();
    expect(screen.getByText("Fail")).toBeInTheDocument();
    expect(
      screen.queryByText("Backend offline or unreachable"),
    ).not.toBeInTheDocument();
  });

  it("renders offline state when backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderWithQueryClient(<SettingsView />);

    await waitFor(() => {
      expect(
        screen.getByText("Backend offline or unreachable"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Retry connection/i }),
    ).toBeInTheDocument();
  });
});
