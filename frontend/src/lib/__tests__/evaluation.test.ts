import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  CreateEvaluationRequestSchema,
  EvaluationConfigSchema,
  EvaluationListSchema,
  EvaluationLogsSchema,
  EvaluationPresetListSchema,
  EvaluationResultsSchema,
  type Evaluation,
  type EvaluationPreset,
} from "@/lib/api/types";
import {
  DEFAULT_EVALUATION_FILTERS,
  filterEvaluations,
  formatBytes,
  formatEvaluationApiError,
  formatMetricScore,
  getConfusionMatrixMax,
  isActiveEvaluationState,
  isCancellableEvaluation,
  isTerminalEvaluationState,
  summarizeEvaluations,
} from "@/lib/evaluation";

const PRESETS: EvaluationPreset[] = [
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
];

function makeEval(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    evaluation_id: "eval_0000000000000001",
    model: "mnist_cnn",
    dataset: "mnist",
    architecture: "MNISTCNN",
    task: "image_classification",
    state: "SUCCEEDED",
    progress: 1,
    samples_evaluated: 500,
    total_samples: 500,
    metrics: {
      accuracy: 0.982,
      macro_precision: 0.981,
      macro_recall: 0.982,
      macro_f1: 0.9815,
    },
    created_at: "2026-11-24T10:00:00Z",
    started_at: "2026-11-24T10:00:01Z",
    completed_at: "2026-11-24T10:00:05Z",
    elapsed_seconds: 4.1,
    cancel_requested: false,
    queue_position: null,
    device: "cpu",
    artifact_dir: "app/evaluations/eval_0000000000000001",
    source_checkpoint: "artifacts/mnist_baseline.pt",
    results_path: "app/evaluations/eval_0000000000000001/results.json",
    metrics_path: "app/evaluations/eval_0000000000000001/metrics.json",
    metadata_path: "app/evaluations/eval_0000000000000001/evaluation.json",
    error: null,
    ...overrides,
  };
}

describe("evaluation schemas and pure helpers", () => {
  it("validates presets, strict config, evaluation list, results, and logs", () => {
    expect(EvaluationPresetListSchema.parse({ models: PRESETS }).models).toHaveLength(2);
    expect(
      CreateEvaluationRequestSchema.parse({
        model: "mnist_cnn",
        dataset: "mnist",
        config: { batch_size: 64, max_samples: 256, num_workers: 0 },
      }).model,
    ).toBe("mnist_cnn");

    // extra="forbid" enforced
    expect(() =>
      EvaluationConfigSchema.parse({
        batch_size: 64,
        max_samples: null,
        num_workers: 0,
        unknown_key: true,
      }),
    ).toThrow();

    expect(
      EvaluationListSchema.parse({ evaluations: [makeEval()], count: 1 }).count,
    ).toBe(1);

    expect(
      EvaluationLogsSchema.parse({
        evaluation_id: "eval_0000000000000001",
        lines: ["[2026-11-24T10:00:00Z] evaluation created"],
        since: 0,
        next_since: 1,
        total_lines: 1,
        complete: true,
      }).complete,
    ).toBe(true);

    const results = EvaluationResultsSchema.parse({
      evaluation_id: "eval_0000000000000001",
      model: "mnist_cnn",
      dataset: "mnist",
      task: "image_classification",
      state: "SUCCEEDED",
      classes: ["0", "1"],
      sample_count: 10,
      evaluation_seconds: 1.2,
      accuracy: 0.9,
      macro_precision: 0.91,
      macro_recall: 0.9,
      macro_f1: 0.9,
      macro: { precision: 0.91, recall: 0.9, f1: 0.9 },
      per_class: {
        "0": { precision: 1.0, recall: 0.8, f1: 0.8889, support: 5 },
        "1": { precision: 0.8333, recall: 1.0, f1: 0.9091, support: 5 },
      },
      confusion_matrix: [
        [4, 1],
        [0, 5],
      ],
      device: "cpu",
      completed_at: "2026-11-24T10:00:05Z",
      artifact_dir: "app/evaluations/eval_0000000000000001",
    });
    expect(getConfusionMatrixMax(results.confusion_matrix)).toBe(5);
  });

  it("summarizes evaluations and computes highest accuracy only from succeeded runs", () => {
    const items: Evaluation[] = [
      makeEval({ evaluation_id: "eval_1", state: "QUEUED", metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null } }),
      makeEval({ evaluation_id: "eval_2", state: "RUNNING", metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null } }),
      makeEval({ evaluation_id: "eval_3", state: "SUCCEEDED", metrics: { accuracy: 0.85, macro_precision: 0.85, macro_recall: 0.85, macro_f1: 0.85 } }),
      makeEval({ evaluation_id: "eval_4", state: "SUCCEEDED", metrics: { accuracy: 0.96, macro_precision: 0.96, macro_recall: 0.96, macro_f1: 0.96 } }),
      makeEval({ evaluation_id: "eval_5", state: "FAILED", metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null } }),
      makeEval({ evaluation_id: "eval_6", state: "CANCELLED", metrics: { accuracy: null, macro_precision: null, macro_recall: null, macro_f1: null } }),
    ];

    expect(summarizeEvaluations(items)).toEqual({
      total: 6,
      queued: 1,
      running: 1,
      active: 2,
      succeeded: 2,
      failed: 1,
      cancelled: 1,
      highestAccuracy: 0.96,
    });
  });

  it("filters evaluations by search, status, model, and dataset", () => {
    const items: Evaluation[] = [
      makeEval({ evaluation_id: "eval_a", model: "mnist_cnn", dataset: "mnist", state: "SUCCEEDED" }),
      makeEval({ evaluation_id: "eval_b", model: "cifar10_custom_cnn", dataset: "cifar10", state: "FAILED" }),
    ];

    expect(filterEvaluations(items, { ...DEFAULT_EVALUATION_FILTERS, search: "cifar" }, PRESETS)).toHaveLength(1);
    expect(filterEvaluations(items, { ...DEFAULT_EVALUATION_FILTERS, status: "SUCCEEDED" }, PRESETS)).toHaveLength(1);
    expect(filterEvaluations(items, { ...DEFAULT_EVALUATION_FILTERS, model: "mnist_cnn" }, PRESETS)).toHaveLength(1);
    expect(filterEvaluations(items, { ...DEFAULT_EVALUATION_FILTERS, dataset: "cifar10" }, PRESETS)).toHaveLength(1);
  });

  it("formats metrics, bytes, states, and evaluation API errors accurately", () => {
    expect(formatMetricScore(null)).toBe("Not reported");
    expect(formatMetricScore(0.9572)).toBe("95.72%");
    expect(formatBytes(null)).toBe("Not reported");
    expect(formatBytes(5070221)).toBe("4.8 MB");
    expect(isActiveEvaluationState("RUNNING")).toBe(true);
    expect(isTerminalEvaluationState("SUCCEEDED")).toBe(true);
    expect(isCancellableEvaluation({ state: "QUEUED" })).toBe(true);
    expect(isCancellableEvaluation({ state: "FAILED" })).toBe(false);

    const modelUnavail = formatEvaluationApiError(
      new ApiError("Missing checkpoint", 409, undefined, {
        code: "MODEL_UNAVAILABLE",
      }),
    );
    expect(modelUnavail.title).toContain("Model checkpoint unavailable");

    const queueFull = formatEvaluationApiError(
      new ApiError("Full", 409, undefined, {
        code: "QUEUE_FULL",
        details: { max_queue: 4 },
      }),
    );
    expect(queueFull.message).toContain("4");
  });
});
