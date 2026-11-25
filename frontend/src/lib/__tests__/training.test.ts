import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  CreateTrainingJobRequestSchema,
  TrainingJobListSchema,
  TrainingLogsSchema,
  TrainingPresetListSchema,
  type TrainingJob,
  type TrainingPreset,
} from "@/lib/api/types";
import {
  DEFAULT_TRAINING_FILTERS,
  classifyLogLine,
  clonePresetConfig,
  filterTrainingJobs,
  formatAccuracy,
  formatDuration,
  formatLoss,
  formatProgressPercent,
  formatTimestamp,
  formatTrainingApiError,
  getFixedImageSize,
  isActiveJobState,
  isCancellableJob,
  isTerminalJobState,
  parseLogLine,
  summarizeTrainingJobs,
  usesPretrainedWeights,
} from "@/lib/training";

const PRESETS: TrainingPreset[] = [
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

function makeJob(overrides: Partial<TrainingJob> = {}): TrainingJob {
  return {
    job_id: "job_0000000000000001",
    model: "mnist_cnn",
    dataset: "mnist",
    state: "RUNNING",
    current_epoch: 1,
    total_epochs: 1,
    current_batch: 100,
    total_batches: 400,
    progress: 0.25,
    metrics: {
      train_loss: null,
      train_acc: null,
      val_loss: null,
      val_acc: null,
    },
    created_at: "2026-11-23T10:00:00Z",
    started_at: "2026-11-23T10:00:01Z",
    completed_at: null,
    elapsed_seconds: 12.4,
    cancel_requested: false,
    queue_position: null,
    device: null,
    artifact_dir: "artifacts/app/job_0000000000000001",
    checkpoint_path: "artifacts/app/job_0000000000000001/checkpoint.pt",
    history_path: "artifacts/app/job_0000000000000001/history.json",
    metrics_path: "artifacts/app/job_0000000000000001/metrics.json",
    metadata_path: "artifacts/app/job_0000000000000001/job.json",
    config_path: "artifacts/app/job_0000000000000001/config.json",
    error: null,
    ...overrides,
  };
}

describe("training schemas and pure helpers", () => {
  it("parses backend preset, job list, create request, and log payloads", () => {
    expect(TrainingPresetListSchema.parse({ models: PRESETS }).models).toHaveLength(4);
    expect(
      CreateTrainingJobRequestSchema.parse({
        model: "mnist_cnn",
        dataset: "mnist",
        config: { epochs: 1, batch_size: 64 },
      }).model,
    ).toBe("mnist_cnn");

    const jobList = TrainingJobListSchema.parse({
      jobs: [makeJob()],
      count: 1,
    });
    expect(jobList.count).toBe(1);

    const logs = TrainingLogsSchema.parse({
      job_id: "job_0000000000000001",
      lines: ["[2026-11-23T10:00:00Z] job created"],
      since: 0,
      next_since: 1,
      total_lines: 1,
      complete: false,
    });
    expect(logs.next_since).toBe(1);
  });

  it("aggregates summary stats accurately from real jobs", () => {
    const jobs: TrainingJob[] = [
      makeJob({ job_id: "job_1", state: "QUEUED", queue_position: 1 }),
      makeJob({ job_id: "job_2", state: "RUNNING" }),
      makeJob({ job_id: "job_3", state: "SUCCEEDED", progress: 1 }),
      makeJob({ job_id: "job_4", state: "FAILED" }),
      makeJob({ job_id: "job_5", state: "CANCELLED" }),
    ];

    expect(summarizeTrainingJobs(jobs)).toEqual({
      total: 5,
      queued: 1,
      running: 1,
      succeeded: 1,
      failed: 1,
      cancelled: 1,
      completedOrFailed: 2,
    });
  });

  it("filters jobs by search query, status, model, and dataset", () => {
    const jobs: TrainingJob[] = [
      makeJob({ job_id: "job_alpha", model: "mnist_cnn", dataset: "mnist", state: "SUCCEEDED" }),
      makeJob({ job_id: "job_beta", model: "cifar_cnn", dataset: "cifar10", state: "FAILED" }),
      makeJob({ job_id: "job_gamma", model: "resnet18_finetuning", dataset: "cifar10", state: "QUEUED" }),
    ];

    expect(
      filterTrainingJobs(jobs, { ...DEFAULT_TRAINING_FILTERS, search: "beta" }, PRESETS),
    ).toHaveLength(1);
    expect(
      filterTrainingJobs(jobs, { ...DEFAULT_TRAINING_FILTERS, status: "QUEUED" }, PRESETS),
    ).toHaveLength(1);
    expect(
      filterTrainingJobs(jobs, { ...DEFAULT_TRAINING_FILTERS, model: "cifar_cnn" }, PRESETS),
    ).toHaveLength(1);
    expect(
      filterTrainingJobs(jobs, { ...DEFAULT_TRAINING_FILTERS, dataset: "cifar10" }, PRESETS),
    ).toHaveLength(2);
    expect(
      filterTrainingJobs(
        jobs,
        { ...DEFAULT_TRAINING_FILTERS, search: "ResNet18 Fine-tuning" },
        PRESETS,
      ),
    ).toHaveLength(1);
  });

  it("formats nullable metrics, timestamps, durations, and progress without fabricating values", () => {
    expect(formatLoss(null)).toBe("Not reported");
    expect(formatLoss(0.34567)).toBe("0.3457");
    expect(formatAccuracy(null)).toBe("Not reported");
    expect(formatAccuracy(0.9234)).toBe("92.34%");
    expect(formatDuration(null)).toBe("Not reported");
    expect(formatDuration(18.2)).toBe("18.2s");
    expect(formatDuration(125)).toBe("2m 05s");
    expect(formatTimestamp(null)).toBe("Not reported");
    expect(formatProgressPercent(0.474)).toBe("47.4%");
    expect(formatProgressPercent(1)).toBe("100.0%");
  });

  it("identifies active, terminal, cancellable, fixed image size, and pretrained models", () => {
    expect(isActiveJobState("QUEUED")).toBe(true);
    expect(isActiveJobState("RUNNING")).toBe(true);
    expect(isTerminalJobState("SUCCEEDED")).toBe(true);
    expect(isTerminalJobState("FAILED")).toBe(true);
    expect(isTerminalJobState("CANCELLED")).toBe(true);
    expect(isCancellableJob({ state: "RUNNING" })).toBe(true);
    expect(isCancellableJob({ state: "SUCCEEDED" })).toBe(false);

    expect(getFixedImageSize("cifar_cnn")).toBe(32);
    expect(getFixedImageSize("mnist_cnn")).toBe(28);
    expect(getFixedImageSize("resnet18_finetuning")).toBeNull();
    expect(usesPretrainedWeights("resnet18_feature_extraction")).toBe(true);
    expect(usesPretrainedWeights("resnet18_finetuning")).toBe(true);
    expect(usesPretrainedWeights("mnist_cnn")).toBe(false);

    expect(clonePresetConfig(PRESETS[0]).image_size).toBe(32);
  });

  it("classifies and parses log lines accurately", () => {
    expect(classifyLogLine("[2026-11-23T10:00:00Z] epoch 1/1 started")).toBe("info");
    expect(classifyLogLine("[2026-11-23T10:00:05Z] cancel requested by user")).toBe("warning");
    expect(classifyLogLine("[2026-11-23T10:00:06Z] training failed: RuntimeError")).toBe("error");

    const parsed = parseLogLine("[2026-11-23T10:00:01Z] job started device=cpu");
    expect(parsed.timestamp).toBe("2026-11-23T10:00:01Z");
    expect(parsed.message).toBe("job started device=cpu");
    expect(parsed.severity).toBe("info");
  });

  it("formats QUEUE_FULL and network errors cleanly", () => {
    const queueFull = formatTrainingApiError(
      new ApiError("Queue is full", 409, undefined, {
        code: "QUEUE_FULL",
        details: { max_queue: 4 },
      }),
    );
    expect(queueFull.title).toContain("queue is full");
    expect(queueFull.message).toContain("4");
    expect(queueFull.isOffline).toBe(false);

    const offline = formatTrainingApiError(
      new ApiError("Failed to fetch", 0, undefined, {
        code: "NETWORK_ERROR",
        isNetworkError: true,
      }),
    );
    expect(offline.isOffline).toBe(true);
  });
});
