import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistryView } from "@/components/registry/registry-view";
import type { Evaluation, RegistryModelSummary } from "@/lib/api/types";

const MOCK_MODELS: RegistryModelSummary[] = [
  {
    model_id: "resnet18_finetuned",
    display_name: "ResNet-18 (Full Fine-Tuning)",
    architecture: "ResNet18",
    task: "image_classification",
    artifact_path: "models/checkpoints/resnet18_finetuned.pt",
    checkpoint_size_bytes: 117_440_512,
    config_path: "results/transfer/resnet18_finetuned_config.json",
    evaluation_path: "results/transfer/resnet18_finetuned_eval.json",
    metrics: {
      accuracy: 0.8644,
      macro_f1: 0.8621,
      macro_precision: 0.865,
      macro_recall: 0.8644,
    },
    available: true,
    status: "available",
    error: null,
  },
  {
    model_id: "cifar10_custom_cnn_baseline",
    display_name: "CIFAR-10 Custom CNN (Baseline)",
    architecture: "CIFAR10CNN",
    task: "image_classification",
    artifact_path: "models/checkpoints/cifar10_baseline.pt",
    checkpoint_size_bytes: null,
    config_path: null,
    evaluation_path: null,
    metrics: {
      accuracy: null,
      macro_f1: null,
      macro_precision: null,
      macro_recall: null,
    },
    available: false,
    status: "missing",
    error: "Checkpoint file not found",
  },
  {
    model_id: "distilbert_imdb_finetuned",
    display_name: "DistilBERT IMDb Sentiment",
    architecture: "DistilBERT",
    task: "sentiment_analysis",
    artifact_path: "models/checkpoints/distilbert_imdb_finetuned.pt",
    checkpoint_size_bytes: 280_900_000,
    config_path: null,
    evaluation_path: null,
    metrics: {
      accuracy: null,
      macro_f1: null,
      macro_precision: null,
      macro_recall: null,
    },
    available: true,
    status: "available",
    error: null,
  },
  {
    model_id: "job_a6fba186c0a34ff0",
    display_name: "Trained Job · mnist_cnn",
    architecture: "MNISTCNN",
    task: "image_classification",
    artifact_path: "models/checkpoints/jobs/job_a6fba186c0a34ff0.pt",
    checkpoint_size_bytes: 5_316_000,
    config_path: null,
    evaluation_path: null,
    metrics: {
      accuracy: 0.9572,
      macro_f1: null,
      macro_precision: null,
      macro_recall: null,
    },
    available: true,
    status: "available",
    error: null,
  },
];

const MOCK_EVALUATIONS: Evaluation[] = [
  {
    evaluation_id: "eval_resnet_001",
    model: "resnet18_finetuned",
    dataset: "cifar10",
    architecture: "ResNet18",
    task: "image_classification",
    state: "SUCCEEDED",
    progress: 1,
    samples_evaluated: 10000,
    total_samples: 10000,
    created_at: "2026-11-24T05:10:00Z",
    started_at: "2026-11-24T05:10:02Z",
    completed_at: "2026-11-24T05:10:45Z",
    elapsed_seconds: 43,
    cancel_requested: false,
    queue_position: null,
    device: "cpu",
    artifact_dir: "results/evaluations/eval_resnet_001",
    source_checkpoint: "models/checkpoints/resnet18_finetuned.pt",
    results_path: "results/evaluations/eval_resnet_001/results.json",
    metrics_path: "results/evaluations/eval_resnet_001/metrics.json",
    metadata_path: "results/evaluations/eval_resnet_001/metadata.json",
    metrics: {
      accuracy: 0.8644,
      macro_precision: 0.865,
      macro_recall: 0.8644,
      macro_f1: 0.8621,
    },
    error: null,
  },
];

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

describe("RegistryView workspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders summary cards, table/cards, filters, and detail sheet for available, missing, and trained-job models", async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/registry/models")) {
        return Promise.resolve(
          jsonResponse({ models: MOCK_MODELS, count: MOCK_MODELS.length }),
        );
      }
      if (url.includes("/registry/models/")) {
        const id = url.split("/registry/models/")[1];
        const found = MOCK_MODELS.find((m) => m.model_id === id);
        if (found) {
          return Promise.resolve(jsonResponse(found));
        }
        return Promise.resolve(
          jsonResponse(
            { error: { code: "NOT_FOUND", message: "Model not found" } },
            404,
          ),
        );
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(
          jsonResponse({
            evaluations: MOCK_EVALUATIONS,
            count: MOCK_EVALUATIONS.length,
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<RegistryView />);

    await waitFor(() => {
      expect(screen.getByText("3 / 4 available")).toBeInTheDocument();
    });

    // Summary stats visible
    expect(screen.getByText("Showing 4 of 4 registered models")).toBeInTheDocument();

    // Filter to missing checkpoints
    await user.selectOptions(
      screen.getByLabelText("Filter by availability"),
      "missing",
    );
    expect(screen.getByText("Showing 1 of 4 registered models")).toBeInTheDocument();

    // Open detail sheet for missing model
    const missingButton = screen.getByRole("button", {
      name: "Inspect model cifar10_custom_cnn_baseline",
    });
    await user.click(missingButton);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Checkpoint missing")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Checkpoint file not found"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /No inference or evaluation actions are available while this model's checkpoint is unavailable locally/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: /AI Playground/i }),
    ).not.toBeInTheDocument();

    // Close dialog & reset filters
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(screen.getByText("Showing 4 of 4 registered models")).toBeInTheDocument();

    // Search for resnet18_finetuned and inspect detail sheet
    await user.type(
      screen.getByLabelText("Search registry models"),
      "resnet18",
    );
    expect(screen.getByText("Showing 1 of 4 registered models")).toBeInTheDocument();

    const resnetButton = screen.getByRole("button", {
      name: "Inspect model resnet18_finetuned",
    });
    await user.click(resnetButton);

    const resnetDialog = await screen.findByRole("dialog");
    expect(
      within(resnetDialog).getByText("models/checkpoints/resnet18_finetuned.pt"),
    ).toBeInTheDocument();
    expect(
      within(resnetDialog).getByRole("button", { name: "Copy Checkpoint Path" }),
    ).toBeInTheDocument();
    expect(
      within(resnetDialog).getByText("eval_resnet_001"),
    ).toBeInTheDocument();
    expect(
      within(resnetDialog).getByText(/Scoped to latest 50 loaded evaluations/i),
    ).toBeInTheDocument();
    expect(
      within(resnetDialog).getByRole("link", { name: /Model Evaluation/i }),
    ).toHaveAttribute("href", "/evaluation");
    expect(
      within(resnetDialog).getByRole("link", { name: /AI Playground/i }),
    ).toHaveAttribute("href", "/playground");

    // No download link should be fabricated
    expect(
      within(resnetDialog).queryByRole("link", { name: /download/i }),
    ).not.toBeInTheDocument();

    // Test filtered-empty state
    await user.keyboard("{Escape}");
    await user.clear(screen.getByLabelText("Search registry models"));
    await user.type(
      screen.getByLabelText("Search registry models"),
      "nonexistent-model-xyz",
    );
    expect(screen.getByText("No matching models")).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: /Reset filters/i })[0],
    );
    expect(
      screen.getByText("Showing 4 of 4 registered models"),
    ).toBeInTheDocument();
  });

  it("renders empty registry state when API returns zero models", async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/registry/models")) {
        return Promise.resolve(jsonResponse({ models: [], count: 0 }));
      }
      if (url.includes("/evaluations")) {
        return Promise.resolve(jsonResponse({ evaluations: [], count: 0 }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    renderWithQueryClient(<RegistryView />);

    await waitFor(() => {
      expect(
        screen.getByText("No registered models found"),
      ).toBeInTheDocument();
    });
  });

  it("renders offline state when backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderWithQueryClient(<RegistryView />);

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
