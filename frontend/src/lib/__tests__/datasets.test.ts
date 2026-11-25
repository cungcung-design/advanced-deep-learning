import { describe, expect, it } from "vitest";
import {
  DatasetListSchema,
  DatasetStatisticsSchema,
  DatasetSummarySchema,
  ValidateDatasetRequestSchema,
  ValidationResponseSchema,
  type DatasetSummary,
} from "@/lib/api/types";
import {
  DEFAULT_DATASET_FILTERS,
  filterDatasets,
  formatInputSpec,
  formatSampleCount,
  formatValidationCheckLabel,
  getDatasetWorkspaceLinks,
  getUniqueDatasetTasks,
  getUniqueDatasetTypes,
  hasActiveDatasetFilters,
  summarizeDatasets,
} from "@/lib/datasets";

const SAMPLE_DATASETS: DatasetSummary[] = [
  {
    dataset_id: "mnist",
    display_name: "MNIST",
    description: "Handwritten digit classification dataset.",
    dataset_type: "image",
    task: "image_classification",
    source: "torchvision",
    available: true,
    status: "available",
    missing_files: [],
    local_path: "D:\\data\\raw\\MNIST",
    local_size_bytes: 66_544_770,
    local_file_count: 8,
    train_size: 60000,
    test_size: 10000,
    val_fraction: 0.1,
    num_classes: 10,
    classes: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    input: { channels: 1, height: 28, width: 28 },
    preprocessing: { normalize_mean: [0.1307], normalize_std: [0.3081] },
    config_path: "D:\\configs\\mnist_cpu.json",
  },
  {
    dataset_id: "cifar10",
    display_name: "CIFAR-10",
    description: "10-class color image dataset.",
    dataset_type: "image",
    task: "image_classification",
    source: "torchvision",
    available: false,
    status: "missing",
    missing_files: ["data_batch_1"],
    local_path: "D:\\data\\raw\\cifar-10-batches-py",
    local_size_bytes: 0,
    local_file_count: 0,
    train_size: 50000,
    test_size: 10000,
    val_fraction: 0.1,
    num_classes: 10,
    classes: ["airplane", "automobile"],
    input: { channels: 3, height: 32, width: 32 },
    preprocessing: {},
    config_path: "D:\\configs\\cifar10_5epoch.json",
  },
  {
    dataset_id: "imdb",
    display_name: "IMDb Movie Reviews",
    description: "Binary sentiment movie-review dataset.",
    dataset_type: "text",
    task: "sentiment_analysis",
    source: "huggingface:stanfordnlp/imdb",
    available: true,
    status: "available",
    missing_files: [],
    local_path: "C:\\cache\\imdb",
    local_size_bytes: 166_909_338,
    local_file_count: 12,
    train_size: 25000,
    test_size: 25000,
    val_fraction: 0.1,
    num_classes: 2,
    classes: ["NEGATIVE", "POSITIVE"],
    input: { text: true, max_length: 128 },
    preprocessing: { tokenizer: "distilbert-base-uncased" },
    config_path: "D:\\configs\\distilbert_imdb.json",
  },
];

describe("Dataset Zod schemas", () => {
  it("parses full 20-field dataset summary, statistics, and validation payloads", () => {
    const list = DatasetListSchema.parse({
      datasets: SAMPLE_DATASETS,
      count: SAMPLE_DATASETS.length,
    });
    expect(list.count).toBe(3);
    expect(list.datasets[0].train_size).toBe(60000);

    const stats = DatasetStatisticsSchema.parse({
      dataset_id: "mnist",
      available: true,
      local_size_bytes: 66_544_770,
      local_file_count: 8,
      train_size: 60000,
      test_size: 10000,
      expected_val_size: 6000,
      expected_train_after_split: 54000,
      num_classes: 10,
      classes: ["0", "1"],
    });
    expect(stats.expected_val_size).toBe(6000);

    const req = ValidateDatasetRequestSchema.parse({ dataset_id: "mnist" });
    expect(req.dataset_id).toBe("mnist");

    const val = ValidationResponseSchema.parse({
      dataset_id: "mnist",
      valid: true,
      status: "valid",
      checks: [
        { name: "supported_id", passed: true },
        { name: "local_files", passed: true },
      ],
      missing_files: [],
    });
    expect(val.valid).toBe(true);
    expect(val.checks).toHaveLength(2);
  });

  it("remains backwards-compatible with minimal 5-field Training consumer fixtures", () => {
    const minimal = DatasetSummarySchema.parse({
      dataset_id: "mnist",
      display_name: "MNIST",
      available: true,
      status: "available",
      missing_files: [],
    });
    expect(minimal.dataset_id).toBe("mnist");
    expect(minimal.local_size_bytes).toBeUndefined();
    expect(minimal.train_size).toBeUndefined();
  });
});

describe("Dataset domain helpers", () => {
  it("summarizes dataset availability, storage, file counts, and sample totals safely", () => {
    const summary = summarizeDatasets(SAMPLE_DATASETS);
    expect(summary).toEqual({
      total: 3,
      available: 2,
      unavailable: 1,
      totalSizeBytes: 66_544_770 + 166_909_338,
      totalFiles: 20,
      totalSamples: 70000 + 60000 + 50000,
    });
  });

  it("filters datasets by search, status, type, and task", () => {
    expect(
      filterDatasets(SAMPLE_DATASETS, DEFAULT_DATASET_FILTERS),
    ).toHaveLength(3);
    expect(hasActiveDatasetFilters(DEFAULT_DATASET_FILTERS)).toBe(false);

    expect(
      filterDatasets(SAMPLE_DATASETS, {
        ...DEFAULT_DATASET_FILTERS,
        status: "unavailable",
      }).map((d) => d.dataset_id),
    ).toEqual(["cifar10"]);

    expect(
      filterDatasets(SAMPLE_DATASETS, {
        ...DEFAULT_DATASET_FILTERS,
        type: "text",
      }).map((d) => d.dataset_id),
    ).toEqual(["imdb"]);

    expect(
      filterDatasets(SAMPLE_DATASETS, {
        ...DEFAULT_DATASET_FILTERS,
        search: "handwritten",
      }).map((d) => d.dataset_id),
    ).toEqual(["mnist"]);

    expect(getUniqueDatasetTypes(SAMPLE_DATASETS)).toEqual(["image", "text"]);
    expect(getUniqueDatasetTasks(SAMPLE_DATASETS)).toEqual([
      "image_classification",
      "sentiment_analysis",
    ]);
  });

  it("formats sample counts, input specs, validation labels, and workspace links safely", () => {
    expect(formatSampleCount(null)).toBe("Not reported");
    expect(formatSampleCount(-1)).toBe("Not reported");
    expect(formatSampleCount(0)).toBe("0");
    expect(formatSampleCount(60000)).toBe("60,000");

    expect(formatInputSpec({ channels: 3, height: 32, width: 32 })).toBe(
      "3 × 32 × 32",
    );
    expect(formatInputSpec({ text: true, max_length: 128 })).toBe(
      "Text · max 128 tokens",
    );
    expect(formatInputSpec(undefined)).toBe("Not reported");

    expect(formatValidationCheckLabel("local_files")).toBe(
      "Required Local Files Present",
    );

    // Available MNIST -> Training + Evaluation
    expect(
      getDatasetWorkspaceLinks(SAMPLE_DATASETS[0]).map((l) => l.href),
    ).toEqual(["/training", "/evaluation"]);

    // Unavailable CIFAR-10 -> No links
    expect(getDatasetWorkspaceLinks(SAMPLE_DATASETS[1])).toEqual([]);

    // Available IMDb -> Evaluation only
    expect(
      getDatasetWorkspaceLinks(SAMPLE_DATASETS[2]).map((l) => l.href),
    ).toEqual(["/evaluation"]);
  });
});
