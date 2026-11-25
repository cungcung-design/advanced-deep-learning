import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvaluationView } from "@/components/evaluation/evaluation-view";
import type {
  Evaluation,
  EvaluationLogs,
  EvaluationPreset,
  EvaluationResults,
  RegistryModelSummary,
} from "@/lib/api/types";

const REAL_PRESETS: EvaluationPreset[] = [
  {
    model: "mnist_cnn",
    dataset: "mnist",
    display_name: "MNIST CNN Baseline",
    architecture: "MNISTCNN",
    task: "image_classification",
    default_config: { batch_size: 64, max_samples: null, num_workers: 0 },
  },
  {
    model: "cifar10_custom_cnn",
    dataset: "cifar10",
    display_name: "CIFAR-10 Custom CNN",
    architecture: "CifarCNN",
    task: "image_classification",
    default_config: { batch_size: 64, max_samples: null, num_workers: 0 },
  },
  {
    model: "cifar10_custom_cnn_baseline",
    dataset: "cifar10",
    display_name: "CIFAR-10 Custom CNN (1 epoch baseline)",
    architecture: "CifarCNN",
    task: "image_classification",
    default_config: { batch_size: 64, max_samples: null, num_workers: 0 },
  },
  {
    model: "resnet18_feature_extraction",
    dataset: "cifar10",
    display_name: "ResNet18 Feature Extraction",
    architecture: "ResNet18",
    task: "image_classification",
    default_config: { batch_size: 64, max_samples: null, num_workers: 0 },
  },
  {
    model: "resnet18_finetuned",
    dataset: "cifar10",
    display_name: "ResNet18 Fine-tuned",
    architecture: "ResNet18",
    task: "image_classification",
    default_config: { batch_size: 64, max_samples: null, num_workers: 0 },
  },
  {
    model: "distilbert_imdb_finetuned",
    dataset: "imdb",
    display_name: "DistilBERT IMDb Sentiment",
    architecture: "DistilBERT",
    task: "sentiment_analysis",
    default_config: { batch_size: 64, max_samples: null, num_workers: 0 },
  },
];

const REGISTRY_MODELS: RegistryModelSummary[] = [
  {
    model_id: "mnist_cnn",
    display_name: "MNIST CNN Baseline",
    architecture: "MNISTCNN",
    task: "image_classification",
    available: true,
    status: "available",
    checkpoint_size_bytes: 5070221,
    error: null,
  },
  {
    model_id: "cifar10_custom_cnn_baseline",
    display_name: "CIFAR-10 Custom CNN (1 epoch baseline)",
    architecture: "CifarCNN",
    task: "image_classification",
    available: false,
    status: "missing",
    checkpoint_size_bytes: null,
    error: "Checkpoint file not found",
  },
];

function createEvalFixture(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    evaluation_id: "eval_succeeded_0001",
    model: "mnist_cnn",
    dataset: "mnist",
    architecture: "MNISTCNN",
    task: "image_classification",
    state: "SUCCEEDED",
    progress: 1,
    samples_evaluated: 256,
    total_samples: 256,
    metrics: {
      accuracy: 0.9805,
      macro_precision: 0.979,
      macro_recall: 0.98,
      macro_f1: 0.9795,
    },
    created_at: "2026-11-24T10:00:00Z",
    started_at: "2026-11-24T10:00:01Z",
    completed_at: "2026-11-24T10:00:04Z",
    elapsed_seconds: 3.1,
    cancel_requested: false,
    queue_position: null,
    device: "cpu",
    artifact_dir: "app/evaluations/eval_succeeded_0001",
    source_checkpoint: "artifacts/mnist_baseline.pt",
    results_path: "app/evaluations/eval_succeeded_0001/results.json",
    metrics_path: "app/evaluations/eval_succeeded_0001/metrics.json",
    metadata_path: "app/evaluations/eval_succeeded_0001/evaluation.json",
    error: null,
    ...overrides,
  };
}

const RESULTS_FIXTURE: EvaluationResults = {
  evaluation_id: "eval_succeeded_0001",
  model: "mnist_cnn",
  dataset: "mnist",
  task: "image_classification",
  state: "SUCCEEDED",
  classes: ["0", "1"],
  sample_count: 256,
  evaluation_seconds: 3.0,
  accuracy: 0.9805,
  macro_precision: 0.979,
  macro_recall: 0.98,
  macro_f1: 0.9795,
  macro: { precision: 0.979, recall: 0.98, f1: 0.9795 },
  per_class: {
    "0": { precision: 0.985, recall: 0.992, f1: 0.988, support: 128 },
    "1": { precision: 0.973, recall: 0.968, f1: 0.971, support: 128 },
  },
  confusion_matrix: [
    [127, 1],
    [4, 124],
  ],
  device: "cpu",
  completed_at: "2026-11-24T10:00:04Z",
  artifact_dir: "app/evaluations/eval_succeeded_0001",
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

describe("EvaluationView workspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders summary, available models strip, desktop table, mobile cards, and filtering", async () => {
    const evals: Evaluation[] = [
      createEvalFixture({ evaluation_id: "eval_succeeded_0001", state: "SUCCEEDED" }),
      createEvalFixture({
        evaluation_id: "eval_running_0002",
        model: "cifar10_custom_cnn",
        dataset: "cifar10",
        architecture: "CifarCNN",
        state: "RUNNING",
        progress: 0.4,
        samples_evaluated: 400,
        total_samples: 1000,
        metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null },
        device: null,
        completed_at: null,
      }),
    ];

    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/evaluations/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/registry/models")) {
        return Promise.resolve(jsonResponse({ models: REGISTRY_MODELS, count: REGISTRY_MODELS.length }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(jsonResponse({ datasets: [], count: 0 }));
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(jsonResponse({ evaluations: evals, count: evals.length }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<EvaluationView />);

    await waitFor(() => {
      expect(screen.getByText("Showing 2 of 2 loaded evaluations")).toBeInTheDocument();
    });

    // Models strip shows Ready vs Missing badges
    const strip = screen.getByLabelText("Available evaluation models");
    expect(within(strip).getByText("Ready")).toBeInTheDocument();
    expect(within(strip).getByText("Missing")).toBeInTheDocument();

    // Desktop table & mobile cards
    const table = screen.getByRole("table", { name: "Evaluation history" });
    expect(table).toBeInTheDocument();
    expect(screen.getByLabelText("Evaluation history cards")).toBeInTheDocument();

    // Active vs terminal actions
    expect(
      within(table).getByRole("button", { name: "Cancel evaluation eval_running_0002" }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: "Cancel evaluation eval_succeeded_0001" }),
    ).not.toBeInTheDocument();

    // Filter by status
    await user.selectOptions(screen.getByLabelText("Filter evaluations by status"), "SUCCEEDED");
    expect(screen.getByText("Showing 1 of 2 loaded evaluations")).toBeInTheDocument();

    // Search producing no results
    await user.type(screen.getByLabelText("Search evaluations"), "no_match");
    expect(screen.getByText("No matching evaluations")).toBeInTheDocument();
  });

  it("validates create dialog config, shows MODEL_UNAVAILABLE warning/error, and creates an evaluation", async () => {
    const createdEval = createEvalFixture({
      evaluation_id: "eval_new_1234",
      state: "QUEUED",
      queue_position: 1,
      progress: 0,
      samples_evaluated: 0,
      total_samples: 0,
      metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null },
      device: null,
      started_at: null,
      completed_at: null,
      elapsed_seconds: null,
    });

    let failFirst = true;
    let list: Evaluation[] = [];

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/evaluations/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/registry/models")) {
        return Promise.resolve(jsonResponse({ models: REGISTRY_MODELS, count: REGISTRY_MODELS.length }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(jsonResponse({ datasets: [], count: 0 }));
      }
      if (url.endsWith("/evaluations") && init?.method === "POST") {
        if (failFirst) {
          failFirst = false;
          return Promise.resolve(
            jsonResponse(
              { error: { code: "MODEL_UNAVAILABLE", message: "Checkpoint missing", details: {} } },
              409,
            ),
          );
        }
        list = [createdEval];
        return Promise.resolve(jsonResponse(createdEval, 201));
      }
      if (url.includes("/evaluations/eval_new_1234/logs")) {
        return Promise.resolve(
          jsonResponse({
            evaluation_id: "eval_new_1234",
            lines: [],
            since: 0,
            next_since: 0,
            total_lines: 0,
            complete: false,
          } satisfies EvaluationLogs),
        );
      }
      if (url.includes("/evaluations/eval_new_1234")) {
        return Promise.resolve(jsonResponse(createdEval));
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(jsonResponse({ evaluations: list, count: list.length }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<EvaluationView />);

    await waitFor(() => {
      expect(screen.getByText("No evaluation runs yet")).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: /New Evaluation/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /MNIST CNN Baseline/i })).toBeInTheDocument();
    });

    // Selecting missing baseline shows warning
    await user.click(screen.getByRole("radio", { name: /1 epoch baseline/i }));
    expect(screen.getByText(/Checkpoint unavailable locally/i)).toBeInTheDocument();

    // Validation error on batch_size > 512
    const batchInput = screen.getByLabelText(/Batch size/i);
    await user.clear(batchInput);
    await user.type(batchInput, "999");
    await user.click(screen.getByRole("button", { name: /Start evaluation/i }));
    expect(await screen.findByText(/Batch size must be at most 512/i)).toBeInTheDocument();

    // Fix batch_size -> hits MODEL_UNAVAILABLE error
    await user.clear(batchInput);
    await user.type(batchInput, "64");
    await user.click(screen.getByRole("button", { name: /Start evaluation/i }));
    expect(await screen.findByText(/Model checkpoint unavailable/i)).toBeInTheDocument();

    // Switch to MNIST CNN and submit -> succeeds and opens detail sheet
    await user.click(screen.getByRole("radio", { name: /MNIST CNN Baseline/i }));
    await user.click(screen.getByRole("button", { name: /Start evaluation/i }));

    expect(await screen.findAllByText("eval_new_1234")).not.toHaveLength(0);
  });

  it("renders per-class table, confusion matrix, incremental logs, and cancellation", async () => {
    const succeededEval = createEvalFixture({ evaluation_id: "eval_succeeded_0001" });
    const runningEval = createEvalFixture({
      evaluation_id: "eval_live_0002",
      state: "RUNNING",
      progress: 0.5,
      samples_evaluated: 500,
      total_samples: 1000,
      metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null },
      device: null,
      completed_at: null,
    });

    let currentRunning = runningEval;

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/evaluations/presets")) {
        return Promise.resolve(jsonResponse({ models: REAL_PRESETS }));
      }
      if (url.includes("/registry/models")) {
        return Promise.resolve(jsonResponse({ models: REGISTRY_MODELS, count: REGISTRY_MODELS.length }));
      }
      if (url.includes("/datasets")) {
        return Promise.resolve(jsonResponse({ datasets: [], count: 0 }));
      }
      if (url.includes("/evaluations/eval_succeeded_0001/results")) {
        return Promise.resolve(jsonResponse(RESULTS_FIXTURE));
      }
      if (url.includes("/evaluations/eval_succeeded_0001/logs")) {
        return Promise.resolve(
          jsonResponse({
            evaluation_id: "eval_succeeded_0001",
            lines: ["[2026-11-24T10:00:00Z] evaluation succeeded accuracy=0.9805"],
            since: 0,
            next_since: 1,
            total_lines: 1,
            complete: true,
          } satisfies EvaluationLogs),
        );
      }
      if (url.includes("/evaluations/eval_succeeded_0001")) {
        return Promise.resolve(jsonResponse(succeededEval));
      }
      if (url.includes("/evaluations/eval_live_0002/cancel") && init?.method === "POST") {
        currentRunning = { ...runningEval, state: "CANCELLED", cancel_requested: true };
        return Promise.resolve(jsonResponse(currentRunning));
      }
      if (url.includes("/evaluations/eval_live_0002/logs")) {
        return Promise.resolve(
          jsonResponse({
            evaluation_id: "eval_live_0002",
            lines: [],
            since: 0,
            next_since: 0,
            total_lines: 0,
            complete: false,
          } satisfies EvaluationLogs),
        );
      }
      if (url.includes("/evaluations/eval_live_0002")) {
        return Promise.resolve(jsonResponse(currentRunning));
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(jsonResponse({ evaluations: [succeededEval, currentRunning], count: 2 }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<EvaluationView />);

    await waitFor(() => {
      expect(screen.getByText("Showing 2 of 2 loaded evaluations")).toBeInTheDocument();
    });

    // Inspect succeeded evaluation -> Per-Class & Matrix & Logs tabs
    const table = screen.getByRole("table", { name: "Evaluation history" });
    await user.click(
      within(table).getByRole("button", { name: "Inspect evaluation eval_succeeded_0001" }),
    );

    await user.click(screen.getByRole("tab", { name: /Per-Class/i }));
    expect(
      await screen.findByRole("table", { name: "Per-class classification metrics" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Macro Average")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Matrix/i }));
    expect(
      await screen.findByRole("table", { name: "Confusion matrix" }),
    ).toBeInTheDocument();
    expect(screen.getByText("127")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Logs/i }));
    expect(
      await screen.findByText(/evaluation succeeded accuracy=0.9805/i),
    ).toBeInTheDocument();

    // Cancel running evaluation via confirmation dialog
    await user.keyboard("{Escape}");
    await user.click(
      within(table).getByRole("button", { name: "Cancel evaluation eval_live_0002" }),
    );
    expect(screen.getByText("Cancel evaluation run?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirm cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Cancel evaluation run?")).not.toBeInTheDocument();
    });
  });
});
