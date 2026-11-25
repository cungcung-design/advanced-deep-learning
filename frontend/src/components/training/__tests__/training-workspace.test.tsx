import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingView } from "@/components/training/training-view";
import type { TrainingJob, TrainingLogs, TrainingPreset } from "@/lib/api/types";

const REAL_PRESETS: TrainingPreset[] = [
  {
    model: "cifar_cnn",
    dataset: "cifar10",
    display_name: "CIFAR-10 Custom CNN",
    architecture: "CifarCNN",
    default_config: {
      epochs: 5,
      batch_size: 128,
      learning_rate: 0.001,
      weight_decay: 0.0005,
      val_fraction: 0.1,
      seed: 42,
      num_workers: 0,
      image_size: 32,
    },
  },
  {
    model: "resnet18_feature_extraction",
    dataset: "cifar10",
    display_name: "ResNet18 Feature Extraction",
    architecture: "ResNet18",
    default_config: {
      epochs: 2,
      batch_size: 32,
      learning_rate: 0.001,
      weight_decay: 0.0005,
      val_fraction: 0.1,
      seed: 42,
      num_workers: 0,
      image_size: 128,
    },
  },
  {
    model: "resnet18_finetuning",
    dataset: "cifar10",
    display_name: "ResNet18 Fine-tuning",
    architecture: "ResNet18",
    default_config: {
      epochs: 1,
      batch_size: 64,
      learning_rate: 0.0001,
      weight_decay: 0.0005,
      val_fraction: 0.1,
      seed: 42,
      num_workers: 2,
      image_size: 128,
    },
  },
  {
    model: "mnist_cnn",
    dataset: "mnist",
    display_name: "MNIST CNN",
    architecture: "MNISTCNN",
    default_config: {
      epochs: 1,
      batch_size: 64,
      learning_rate: 0.001,
      weight_decay: 0.0005,
      val_fraction: 0.1,
      seed: 42,
      num_workers: 0,
      image_size: 28,
    },
  },
];

function createJobFixture(overrides: Partial<TrainingJob> = {}): TrainingJob {
  return {
    job_id: "job_running_0001",
    model: "mnist_cnn",
    dataset: "mnist",
    state: "RUNNING",
    current_epoch: 1,
    total_epochs: 1,
    current_batch: 200,
    total_batches: 844,
    progress: 0.237,
    metrics: {
      train_loss: null,
      train_acc: null,
      val_loss: null,
      val_acc: null,
    },
    created_at: "2026-11-23T10:00:00Z",
    started_at: "2026-11-23T10:00:01Z",
    completed_at: null,
    elapsed_seconds: 14.5,
    cancel_requested: false,
    queue_position: null,
    device: null,
    artifact_dir: "artifacts/app/job_running_0001",
    checkpoint_path: "artifacts/app/job_running_0001/checkpoint.pt",
    history_path: "artifacts/app/job_running_0001/history.json",
    metrics_path: "artifacts/app/job_running_0001/metrics.json",
    metadata_path: "artifacts/app/job_running_0001/job.json",
    config_path: "artifacts/app/job_running_0001/config.json",
    error: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("TrainingView workspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders summary aggregation, desktop table, mobile cards, and search/filtering", async () => {
    const jobs: TrainingJob[] = [
      createJobFixture({
        job_id: "job_running_0001",
        model: "mnist_cnn",
        dataset: "mnist",
        state: "RUNNING",
        progress: 0.4,
      }),
      createJobFixture({
        job_id: "job_queued_0002",
        model: "cifar_cnn",
        dataset: "cifar10",
        state: "QUEUED",
        queue_position: 1,
        progress: 0,
        started_at: null,
        elapsed_seconds: null,
      }),
      createJobFixture({
        job_id: "job_succeeded_0003",
        model: "resnet18_finetuning",
        dataset: "cifar10",
        state: "SUCCEEDED",
        progress: 1,
        device: "cpu",
        completed_at: "2026-11-23T10:05:00Z",
        metrics: {
          train_loss: 0.215,
          train_acc: 0.931,
          val_loss: 0.241,
          val_acc: 0.918,
        },
      }),
      createJobFixture({
        job_id: "job_failed_0004",
        model: "mnist_cnn",
        dataset: "mnist",
        state: "FAILED",
        progress: 0.1,
        error: {
          code: "TRAINING_FAILED",
          message: "Out of memory",
        },
      }),
    ];

    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/training/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(
          jsonResponse({
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
          }),
        );
      }
      if (url.includes("/training/jobs")) {
        return Promise.resolve(jsonResponse({ jobs, count: jobs.length }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<TrainingView />);

    await waitFor(() => {
      expect(screen.getByText("Showing 4 of 4 loaded jobs")).toBeInTheDocument();
    });

    // Summary cards derived from real jobs
    const summary = screen.getByLabelText("Training job summary");
    expect(within(summary).getByText("4")).toBeInTheDocument();
    expect(within(summary).getByText("1 / 1")).toBeInTheDocument();

    // Both desktop table and mobile cards exist in responsive DOM
    expect(screen.getByRole("table", { name: "Training jobs" })).toBeInTheDocument();
    expect(screen.getByLabelText("Training job cards")).toBeInTheDocument();

    // Active vs terminal actions in desktop table
    const table = screen.getByRole("table", { name: "Training jobs" });
    expect(
      within(table).getByRole("button", { name: "Cancel job job_running_0001" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: "Cancel job job_queued_0002" }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: "Cancel job job_succeeded_0003" }),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: "Cancel job job_failed_0004" }),
    ).not.toBeInTheDocument();

    // Filter by status
    await user.selectOptions(screen.getByLabelText("Filter by status"), "SUCCEEDED");
    expect(screen.getByText("Showing 1 of 4 loaded jobs")).toBeInTheDocument();
    expect(within(table).getByText("91.80%")).toBeInTheDocument();

    // Search producing no results
    await user.type(screen.getByLabelText("Search training jobs"), "nonexistent_id");
    expect(screen.getByText("No matching training jobs")).toBeInTheDocument();

    // Reset filters
    await user.click(screen.getAllByRole("button", { name: /Reset filters/i })[0]);
    expect(screen.getByText("Showing 4 of 4 loaded jobs")).toBeInTheDocument();
  });

  it("renders empty state, API error state, and offline state cleanly", async () => {
    // 1. Empty state
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/training/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(jsonResponse({ datasets: [], count: 0 }));
      }
      return Promise.resolve(jsonResponse({ jobs: [], count: 0 }));
    });

    const { unmount } = renderWithQueryClient(<TrainingView />);
    await waitFor(() => {
      expect(screen.getByText("No training runs yet")).toBeInTheDocument();
    });
    unmount();

    // 2. Offline / network error state
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/training/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(jsonResponse({ datasets: [], count: 0 }));
      }
      return Promise.reject(new TypeError("Failed to fetch"));
    });

    renderWithQueryClient(<TrainingView />);
    await waitFor(() => {
      expect(
        screen.getByText("Backend offline or unreachable"),
      ).toBeInTheDocument();
    });
  });

  it("loads all four presets, validates form input, handles pending state, QUEUE_FULL, and successful creation", async () => {
    let resolveCreate: ((res: Response) => void) | null = null;
    const createdJob = createJobFixture({
      job_id: "job_created_9999",
      model: "mnist_cnn",
      dataset: "mnist",
      state: "QUEUED",
      queue_position: 1,
      progress: 0,
    });
    let jobsList: TrainingJob[] = [];
    let failNextCreateWithQueueFull = true;

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/training/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(
          jsonResponse({
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
          }),
        );
      }
      if (url.endsWith("/training/jobs") && init?.method === "POST") {
        if (failNextCreateWithQueueFull) {
          failNextCreateWithQueueFull = false;
          return Promise.resolve(
            jsonResponse(
              {
                error: {
                  code: "QUEUE_FULL",
                  message: "Pending queue is full",
                  details: { max_queue: 4 },
                },
              },
              409,
            ),
          );
        }
        return new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        });
      }
      if (url.includes("/training/jobs/job_created_9999/logs")) {
        return Promise.resolve(
          jsonResponse({
            job_id: "job_created_9999",
            lines: [],
            since: 0,
            next_since: 0,
            total_lines: 0,
            complete: false,
          } satisfies TrainingLogs),
        );
      }
      if (url.includes("/training/jobs/job_created_9999")) {
        return Promise.resolve(jsonResponse(createdJob));
      }
      if (url.includes("/training/jobs")) {
        return Promise.resolve(
          jsonResponse({ jobs: jobsList, count: jobsList.length }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<TrainingView />);

    await waitFor(() => {
      expect(screen.getByText("No training runs yet")).toBeInTheDocument();
    });

    await user.click(
      screen.getAllByRole("button", { name: /New Training Run/i })[0],
    );

    // All 4 real presets render
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /CIFAR-10 Custom CNN/i })).toBeInTheDocument();
    });
    expect(
      screen.getByRole("radio", { name: /ResNet18 Feature Extraction/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /ResNet18 Fine-tuning/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /MNIST CNN/i })).toBeInTheDocument();

    // CPU notice visible; no scheduler or thread-count controls
    expect(
      screen.getByText(/Local CPU-compatible execution/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/scheduler/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/thread/i)).not.toBeInTheDocument();

    // Selecting ResNet18 shows pretrained weights notice
    await user.click(
      screen.getByRole("radio", { name: /ResNet18 Feature Extraction/i }),
    );
    expect(
      screen.getByText(/Pretrained ResNet18 weights notice/i),
    ).toBeInTheDocument();

    // Selecting MNIST CNN locks image_size at 28
    await user.click(screen.getByRole("radio", { name: /MNIST CNN/i }));
    const imageSizeInput = screen.getByLabelText(/Image size/i) as HTMLInputElement;
    expect(imageSizeInput).toBeDisabled();
    expect(imageSizeInput.value).toBe("28");

    // Validation error for epochs > 20
    const epochsInput = screen.getByLabelText(/Epochs/i);
    await user.clear(epochsInput);
    await user.type(epochsInput, "25");
    await user.click(screen.getByRole("button", { name: /Start training run/i }));
    expect(
      await screen.findByText(/Epochs must be at most 20/i),
    ).toBeInTheDocument();

    // Fix epochs and submit -> hits QUEUE_FULL
    await user.clear(epochsInput);
    await user.type(epochsInput, "1");
    await user.click(screen.getByRole("button", { name: /Start training run/i }));
    expect(
      await screen.findByText(/Training queue is full/i),
    ).toBeInTheDocument();

    // Submit again -> pending state disables button
    await user.click(screen.getByRole("button", { name: /Start training run/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Starting run.../i }),
      ).toBeDisabled();
    });

    // Resolve creation -> closes dialog and opens detail sheet for created job
    jobsList = [createdJob];
    resolveCreate!(jsonResponse(createdJob, 201));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Starting run.../i }),
      ).not.toBeInTheDocument();
    });
    expect(await screen.findAllByText("job_created_9999")).not.toHaveLength(0);
  });

  it("displays nullable job details, latest metrics, incremental/empty logs, and cancellation flow with error handling", async () => {
    const runningJob = createJobFixture({
      job_id: "job_live_0001",
      model: "mnist_cnn",
      dataset: "mnist",
      state: "RUNNING",
      device: null,
      completed_at: null,
      metrics: {
        train_loss: 0.4123,
        train_acc: 0.875,
        val_loss: null,
        val_acc: null,
      },
    });
    const failedJob = createJobFixture({
      job_id: "job_fail_0002",
      model: "cifar_cnn",
      dataset: "cifar10",
      state: "FAILED",
      progress: 0.2,
      error: {
        code: "TRAINING_FAILED",
        message: "NaN loss encountered",
      },
    });

    let currentLiveJob = runningJob;
    let logsCallCount = 0;
    let failFirstCancel = true;

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/training/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(jsonResponse({ datasets: [], count: 0 }));
      }
      if (url.includes("/training/jobs/job_live_0001/cancel") && init?.method === "POST") {
        if (failFirstCancel) {
          failFirstCancel = false;
          return Promise.resolve(
            jsonResponse(
              {
                error: {
                  code: "CANCELLED",
                  message: "Transient cancel conflict",
                  details: {},
                },
              },
              409,
            ),
          );
        }
        currentLiveJob = {
          ...runningJob,
          state: "CANCELLED",
          cancel_requested: true,
        };
        return Promise.resolve(jsonResponse(currentLiveJob));
      }
      if (url.includes("/training/jobs/job_live_0001/logs")) {
        logsCallCount += 1;
        if (logsCallCount === 1) {
          return Promise.resolve(
            jsonResponse({
              job_id: "job_live_0001",
              lines: [
                "[2026-11-23T10:00:00Z] job created model=mnist_cnn",
                "[2026-11-23T10:00:01Z] warning: cpu mode active",
              ],
              since: 0,
              next_since: 2,
              total_lines: 2,
              complete: false,
            } satisfies TrainingLogs),
          );
        }
        return Promise.resolve(
          jsonResponse({
            job_id: "job_live_0001",
            lines: ["[2026-11-23T10:00:05Z] error: interrupted by cancel"],
            since: 2,
            next_since: 3,
            total_lines: 3,
            complete: true,
          } satisfies TrainingLogs),
        );
      }
      if (url.includes("/training/jobs/job_fail_0002/logs")) {
        return Promise.resolve(
          jsonResponse({
            job_id: "job_fail_0002",
            lines: [],
            since: 0,
            next_since: 0,
            total_lines: 0,
            complete: true,
          } satisfies TrainingLogs),
        );
      }
      if (url.includes("/training/jobs/job_live_0001")) {
        return Promise.resolve(jsonResponse(currentLiveJob));
      }
      if (url.includes("/training/jobs/job_fail_0002")) {
        return Promise.resolve(jsonResponse(failedJob));
      }
      if (url.includes("/training/jobs")) {
        return Promise.resolve(
          jsonResponse({ jobs: [currentLiveJob, failedJob], count: 2 }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<TrainingView />);

    await waitFor(() => {
      expect(screen.getByText("Showing 2 of 2 loaded jobs")).toBeInTheDocument();
    });

    // Inspect running job
    const table = screen.getByRole("table", { name: "Training jobs" });
    await user.click(
      within(table).getByRole("button", { name: "Inspect job job_live_0001" }),
    );

    // Nullable fields & latest metrics & checkpoint disclaimer
    await waitFor(() => {
      expect(screen.getByText("Latest Reported Metrics")).toBeInTheDocument();
    });
    expect(screen.getByText("0.4123")).toBeInTheDocument();
    expect(screen.getByText("87.50%")).toBeInTheDocument();
    expect(
      screen.getByText(/does not guarantee the file exists on disk/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Best Val Accuracy/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Not reported").length).toBeGreaterThanOrEqual(3);

    // Logs tab: incremental append & severity distinctions
    await user.click(screen.getByRole("tab", { name: /Logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/job created model=mnist_cnn/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/warning: cpu mode active/i)).toBeInTheDocument();

    // Refresh appends next_since=2 without duplicating earlier lines
    await user.click(screen.getByRole("button", { name: /^Refresh$/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/error: interrupted by cancel/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Stream complete")).toBeInTheDocument();
    expect(screen.getAllByText(/job created model=mnist_cnn/i)).toHaveLength(1);

    // Cancel flow: open confirmation -> error -> retry -> success
    await user.click(screen.getByRole("button", { name: /Cancel job/i }));
    expect(screen.getByText("Cancel training job?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirm cancel/i }));
    expect(
      await screen.findByText(/Transient cancel conflict/i),
    ).toBeInTheDocument();

    // Retry cancel succeeds and closes dialog
    await user.click(screen.getByRole("button", { name: /Confirm cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Cancel training job?")).not.toBeInTheDocument();
    });

    // Now inspect failed job: structured error & empty logs
    await user.keyboard("{Escape}");
    await user.click(
      within(table).getByRole("button", { name: "Inspect job job_fail_0002" }),
    );
    await waitFor(() => {
      expect(screen.getByText("TRAINING_FAILED")).toBeInTheDocument();
      expect(screen.getByText("NaN loss encountered")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("tab", { name: /Logs/i }));
    expect(
      await screen.findByText("No log entries reported yet"),
    ).toBeInTheDocument();
  });
});
