import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/page";

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

const HEALTH_OK = {
  status: "ok",
  version: "1.0.0",
  app: "DeepVision AI Studio",
};

const READY_OK = {
  status: "ready",
  database: true,
  artifact_root: true,
  artifact_root_writable: true,
};

const SETTINGS_OK = {
  runtime: {
    app_version: "1.0.0",
    python_version: "3.14.10",
    torch_version: "2.15.0+cpu",
    transformers_version: "5.24.0",
    device: "cpu",
    cuda_available: false,
    cpu_count: 16,
    threads: 8,
    platform: "Windows-11",
  },
  memory: {
    total_bytes: 34_000_000_000,
    available_bytes: 12_000_000_000,
  },
  storage: {
    artifact_root: "D:\\artifacts",
    artifact_bytes: 464_622_578,
    artifact_files: 39,
    data_root: "D:\\data",
    data_bytes: 423_256_955,
    data_files: 19,
    disk_total_bytes: 600_000_000_000,
    disk_free_bytes: 500_000_000_000,
  },
  models: [],
};

const DATASETS_OK = {
  datasets: [
    {
      dataset_id: "mnist",
      display_name: "MNIST",
      available: true,
      status: "available",
      missing_files: [],
    },
    {
      dataset_id: "cifar10",
      display_name: "CIFAR-10",
      available: true,
      status: "available",
      missing_files: [],
    },
  ],
  count: 2,
};

const REGISTRY_OK = {
  models: [
    {
      model_id: "resnet18_finetuned",
      display_name: "ResNet18 Fine-tuned",
      architecture: "ResNet18",
      task: "image_classification",
      available: true,
      status: "available",
    },
  ],
  count: 1,
};

const EVALUATIONS_OK = {
  evaluations: [],
  count: 0,
};

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    job_id: "job_running_0001",
    model: "mnist_cnn",
    dataset: "mnist",
    state: "RUNNING",
    current_epoch: 1,
    total_epochs: 2,
    current_batch: 30,
    total_batches: 60,
    progress: 0.5,
    metrics: {
      train_loss: 0.25,
      train_acc: 0.92,
      val_loss: null,
      val_acc: null,
    },
    created_at: "2026-11-24T05:00:00Z",
    started_at: "2026-11-24T05:00:01Z",
    completed_at: null,
    elapsed_seconds: 5.2,
    cancel_requested: false,
    queue_position: null,
    device: "cpu",
    artifact_dir: "artifacts/app/job_running_0001",
    checkpoint_path: null,
    history_path: null,
    metrics_path: null,
    metadata_path: null,
    config_path: null,
    error: null,
    ...overrides,
  };
}

describe("DashboardPage integration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders shared API data, converts 0..1 training progress to percentages, shows readiness separately from health, and preserves quick-access links", async () => {
    const jobs = [
      makeJob({ job_id: "job_half_0001", model: "mnist_cnn", progress: 0.5 }),
      makeJob({
        job_id: "job_zero_0002",
        model: "cifar_cnn",
        state: "QUEUED",
        progress: 0,
      }),
    ];

    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/health/ready")) {
        return Promise.resolve(jsonResponse(READY_OK));
      }
      if (url.endsWith("/health")) {
        return Promise.resolve(jsonResponse(HEALTH_OK));
      }
      if (url.endsWith("/settings")) {
        return Promise.resolve(jsonResponse(SETTINGS_OK));
      }
      if (url.endsWith("/datasets")) {
        return Promise.resolve(jsonResponse(DATASETS_OK));
      }
      if (url.endsWith("/registry/models")) {
        return Promise.resolve(jsonResponse(REGISTRY_OK));
      }
      if (url.includes("/training/jobs")) {
        return Promise.resolve(jsonResponse({ jobs, count: jobs.length }));
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(jsonResponse(EVALUATIONS_OK));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    // Progress conversion: 0.5 -> 50% and 0 -> 0%
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();

    // Runtime & storage readiness details
    expect(screen.getByText(/CPU · PyTorch 2\.15\.0\+cpu/i)).toBeInTheDocument();
    expect(screen.getByText(/Writable · 443\.1 MB/i)).toBeInTheDocument();

    // Quick access navigation links
    expect(screen.getByRole("link", { name: "Datasets" })).toHaveAttribute(
      "href",
      "/datasets",
    );
    expect(screen.getByRole("link", { name: "Evaluation" })).toHaveAttribute(
      "href",
      "/evaluation",
    );
    expect(screen.getByRole("link", { name: "AI Playground" })).toHaveAttribute(
      "href",
      "/playground",
    );
    expect(screen.getByRole("link", { name: "NLP Tools" })).toHaveAttribute(
      "href",
      "/nlp",
    );
  });

  it("displays degraded readiness on HTTP 503 even when /health is ok, and isolates partial service failures", async () => {
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
        return Promise.resolve(jsonResponse(HEALTH_OK));
      }
      if (url.endsWith("/settings")) {
        return Promise.resolve(jsonResponse(SETTINGS_OK));
      }
      if (url.endsWith("/datasets")) {
        return Promise.resolve(jsonResponse(DATASETS_OK));
      }
      if (url.endsWith("/registry/models")) {
        return Promise.resolve(jsonResponse(REGISTRY_OK));
      }
      if (url.includes("/training/jobs")) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(jsonResponse(EVALUATIONS_OK));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(screen.getByText("Not ready")).toBeInTheDocument();
    });

    expect(screen.getByText("Not writable")).toBeInTheDocument();
    expect(
      screen.getByText(/Failing: Artifact Root Writable/i),
    ).toBeInTheDocument();

    // Training jobs failed, but Datasets and Registry still render their real counts
    expect(
      screen.getByText(/Could not load training jobs/i),
    ).toBeInTheDocument();
    expect(screen.getByText("2 available locally")).toBeInTheDocument();
    expect(screen.getByText("1 checkpoints ready")).toBeInTheDocument();
  });
});
