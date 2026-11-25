import { describe, expect, it } from "vitest";
import {
  RegistryModelListSchema,
  RegistryModelSummarySchema,
  type Evaluation,
  type RegistryModelSummary,
} from "@/lib/api/types";
import {
  DEFAULT_REGISTRY_FILTERS,
  filterRegistryModels,
  getCompatibleWorkspaceLinks,
  getRegistryModelSource,
  getRelatedEvaluations,
  getUniqueRegistryArchitectures,
  getUniqueRegistryTasks,
  hasActiveRegistryFilters,
  summarizeRegistryModels,
} from "@/lib/registry";

const SAMPLE_MODELS: RegistryModelSummary[] = [
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
    evaluation_path: "results/nlp/distilbert_imdb_eval.json",
    metrics: {
      accuracy: 0.912,
      macro_f1: 0.911,
      macro_precision: 0.913,
      macro_recall: 0.912,
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
  {
    model_id: "corrupted_checkpoint",
    display_name: "Corrupted Model",
    architecture: "CIFAR10CNN",
    task: "image_classification",
    artifact_path: "models/checkpoints/corrupted.pt",
    checkpoint_size_bytes: 128,
    config_path: null,
    evaluation_path: null,
    metrics: {
      accuracy: null,
      macro_f1: null,
      macro_precision: null,
      macro_recall: null,
    },
    available: false,
    status: "invalid",
    error: "Unreadable checkpoint header",
  },
];

describe("RegistryModelSummarySchema", () => {
  it("parses full 12-field backend response", () => {
    const parsed = RegistryModelListSchema.parse({
      models: SAMPLE_MODELS,
      count: SAMPLE_MODELS.length,
    });
    expect(parsed.count).toBe(5);
    expect(parsed.models[0].metrics?.accuracy).toBe(0.8644);
    expect(parsed.models[0].artifact_path).toBe(
      "models/checkpoints/resnet18_finetuned.pt",
    );
    expect(parsed.models[1].checkpoint_size_bytes).toBeNull();
    expect(parsed.models[1].error).toBe("Checkpoint file not found");
  });

  it("remains backwards-compatible with minimal evaluation consumer payloads", () => {
    const parsed = RegistryModelSummarySchema.parse({
      model_id: "mnist_cnn",
      display_name: "MNIST CNN",
      architecture: "MNISTCNN",
      task: "image_classification",
      available: true,
      status: "available",
    });
    expect(parsed.model_id).toBe("mnist_cnn");
    expect(parsed.artifact_path).toBeUndefined();
    expect(parsed.checkpoint_size_bytes).toBeNull();
    expect(parsed.config_path).toBeUndefined();
    expect(parsed.evaluation_path).toBeUndefined();
    expect(parsed.metrics).toBeUndefined();
    expect(parsed.error).toBeNull();
  });

  it("rejects malformed required fields", () => {
    expect(() =>
      RegistryModelSummarySchema.parse({
        model_id: "bad_model",
        display_name: "Bad",
        architecture: "CNN",
        task: "image_classification",
        available: "yes",
        status: "available",
      }),
    ).toThrow();
  });
});

describe("Registry domain helpers", () => {
  it("classifies catalog vs trained_job sources by model_id prefix", () => {
    expect(getRegistryModelSource(SAMPLE_MODELS[0])).toBe("catalog");
    expect(getRegistryModelSource(SAMPLE_MODELS[3])).toBe("trained_job");
  });

  it("summarizes model availability, sources, and total checkpoint storage", () => {
    const stats = summarizeRegistryModels(SAMPLE_MODELS);
    expect(stats).toEqual({
      total: 5,
      available: 3,
      missing: 1,
      invalid: 1,
      unavailable: 2,
      catalogCount: 4,
      trainedJobCount: 1,
      totalCheckpointBytes: 117_440_512 + 280_900_000 + 5_316_000 + 128,
    });
  });

  it("filters models by search, status, architecture, task, and source", () => {
    expect(
      filterRegistryModels(SAMPLE_MODELS, DEFAULT_REGISTRY_FILTERS),
    ).toHaveLength(5);
    expect(hasActiveRegistryFilters(DEFAULT_REGISTRY_FILTERS)).toBe(false);

    const missingOnly = filterRegistryModels(SAMPLE_MODELS, {
      ...DEFAULT_REGISTRY_FILTERS,
      status: "missing",
    });
    expect(missingOnly.map((m) => m.model_id)).toEqual([
      "cifar10_custom_cnn_baseline",
    ]);

    const nlpOnly = filterRegistryModels(SAMPLE_MODELS, {
      ...DEFAULT_REGISTRY_FILTERS,
      task: "sentiment_analysis",
    });
    expect(nlpOnly.map((m) => m.model_id)).toEqual([
      "distilbert_imdb_finetuned",
    ]);

    const trainedOnly = filterRegistryModels(SAMPLE_MODELS, {
      ...DEFAULT_REGISTRY_FILTERS,
      source: "trained_job",
    });
    expect(trainedOnly.map((m) => m.model_id)).toEqual([
      "job_a6fba186c0a34ff0",
    ]);

    const searchResnet = filterRegistryModels(SAMPLE_MODELS, {
      ...DEFAULT_REGISTRY_FILTERS,
      search: "resnet18",
    });
    expect(searchResnet.map((m) => m.model_id)).toEqual(["resnet18_finetuned"]);
    expect(
      hasActiveRegistryFilters({
        ...DEFAULT_REGISTRY_FILTERS,
        search: "resnet18",
      }),
    ).toBe(true);
  });

  it("extracts unique architectures and tasks in stable order", () => {
    expect(getUniqueRegistryArchitectures(SAMPLE_MODELS)).toEqual([
      "ResNet18",
      "CIFAR10CNN",
      "DistilBERT",
      "MNISTCNN",
    ]);
    expect(getUniqueRegistryTasks(SAMPLE_MODELS)).toEqual([
      "image_classification",
      "sentiment_analysis",
    ]);
  });

  it("returns accurate compatible workspace links without exposing missing models for inference", () => {
    // Available image catalog model -> evaluation + playground
    expect(
      getCompatibleWorkspaceLinks(SAMPLE_MODELS[0]).map((l) => l.href),
    ).toEqual(["/evaluation", "/playground"]);

    // Missing catalog model -> no links
    expect(getCompatibleWorkspaceLinks(SAMPLE_MODELS[1])).toEqual([]);

    // Available NLP catalog model -> evaluation + nlp
    expect(
      getCompatibleWorkspaceLinks(SAMPLE_MODELS[2]).map((l) => l.href),
    ).toEqual(["/evaluation", "/nlp"]);

    // Trained job artifact -> training workspace only
    expect(
      getCompatibleWorkspaceLinks(SAMPLE_MODELS[3]).map((l) => l.href),
    ).toEqual(["/training"]);

    // Invalid catalog model -> no links
    expect(getCompatibleWorkspaceLinks(SAMPLE_MODELS[4])).toEqual([]);
  });

  it("matches related evaluations strictly by model_id", () => {
    const evaluations: Evaluation[] = [
      {
        evaluation_id: "eval_1",
        model: "resnet18_finetuned",
        dataset: "cifar10",
        architecture: "ResNet18",
        task: "image_classification",
        state: "SUCCEEDED",
        progress: 1,
        samples_evaluated: 10000,
        total_samples: 10000,
        created_at: "2026-11-24T05:00:00Z",
        started_at: "2026-11-24T05:00:01Z",
        completed_at: "2026-11-24T05:01:00Z",
        elapsed_seconds: 59,
        cancel_requested: false,
        queue_position: null,
        device: "cpu",
        artifact_dir: "results/evaluations/eval_1",
        source_checkpoint: "models/checkpoints/resnet18_finetuned.pt",
        results_path: "results/evaluations/eval_1/results.json",
        metrics_path: "results/evaluations/eval_1/metrics.json",
        metadata_path: "results/evaluations/eval_1/metadata.json",
        metrics: {
          accuracy: 0.8644,
          macro_precision: 0.865,
          macro_recall: 0.8644,
          macro_f1: 0.8621,
        },
        error: null,
      },
      {
        evaluation_id: "eval_2",
        model: "mnist_cnn",
        dataset: "mnist",
        architecture: "MNISTCNN",
        task: "image_classification",
        state: "SUCCEEDED",
        progress: 1,
        samples_evaluated: 10000,
        total_samples: 10000,
        created_at: "2026-11-24T05:05:00Z",
        started_at: "2026-11-24T05:05:01Z",
        completed_at: "2026-11-24T05:05:30Z",
        elapsed_seconds: 29,
        cancel_requested: false,
        queue_position: null,
        device: "cpu",
        artifact_dir: "results/evaluations/eval_2",
        source_checkpoint: "models/checkpoints/mnist_baseline.pt",
        results_path: "results/evaluations/eval_2/results.json",
        metrics_path: "results/evaluations/eval_2/metrics.json",
        metadata_path: "results/evaluations/eval_2/metadata.json",
        metrics: {
          accuracy: 0.991,
          macro_precision: 0.991,
          macro_recall: 0.991,
          macro_f1: 0.991,
        },
        error: null,
      },
    ];

    expect(
      getRelatedEvaluations(evaluations, "resnet18_finetuned").map(
        (e) => e.evaluation_id,
      ),
    ).toEqual(["eval_1"]);
    expect(getRelatedEvaluations(evaluations, "job_a6fba186c0a34ff0")).toEqual(
      [],
    );
  });
});
