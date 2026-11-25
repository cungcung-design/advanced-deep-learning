import { z } from "zod";

export const TrainingJobStateSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export type TrainingJobState = z.infer<typeof TrainingJobStateSchema>;

export const TrainingConfigSchema = z.object({
  epochs: z.number().int().min(1).max(20),
  batch_size: z.number().int().min(1).max(512),
  learning_rate: z.number().gt(0),
  weight_decay: z.number().min(0),
  val_fraction: z.number().gt(0).lt(0.5),
  seed: z.number().int(),
  num_workers: z.number().int().min(0).max(8),
  image_size: z.number().int().min(28).max(224),
});

export type TrainingConfig = z.infer<typeof TrainingConfigSchema>;

export const TrainingPresetSchema = z.object({
  model: z.string(),
  dataset: z.string(),
  display_name: z.string(),
  architecture: z.string(),
  default_config: TrainingConfigSchema,
});

export type TrainingPreset = z.infer<typeof TrainingPresetSchema>;

export const TrainingPresetListSchema = z.object({
  models: z.array(TrainingPresetSchema),
});

export type TrainingPresetList = z.infer<typeof TrainingPresetListSchema>;

export const TrainingMetricsSchema = z.object({
  train_loss: z.number().nullable().optional().default(null),
  train_acc: z.number().nullable().optional().default(null),
  val_loss: z.number().nullable().optional().default(null),
  val_acc: z.number().nullable().optional().default(null),
});

export type TrainingMetrics = z.infer<typeof TrainingMetricsSchema>;

export const TrainingJobErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type TrainingJobError = z.infer<typeof TrainingJobErrorSchema>;

export const TrainingJobSchema = z.object({
  job_id: z.string(),
  model: z.string(),
  dataset: z.string(),
  state: TrainingJobStateSchema,
  current_epoch: z.number().int().min(0),
  total_epochs: z.number().int().min(0),
  current_batch: z.number().int().min(0),
  total_batches: z.number().int().min(0),
  progress: z.number().min(0).max(1),
  metrics: TrainingMetricsSchema,
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  elapsed_seconds: z.number().nullable(),
  cancel_requested: z.boolean(),
  queue_position: z.number().int().nullable(),
  device: z.string().nullable(),
  artifact_dir: z.string(),
  checkpoint_path: z.string().nullable(),
  history_path: z.string().nullable(),
  metrics_path: z.string().nullable(),
  metadata_path: z.string().nullable(),
  config_path: z.string().nullable(),
  error: TrainingJobErrorSchema.nullable(),
});

export type TrainingJob = z.infer<typeof TrainingJobSchema>;

export const TrainingJobListSchema = z.object({
  jobs: z.array(TrainingJobSchema),
  count: z.number().int().min(0),
});

export type TrainingJobList = z.infer<typeof TrainingJobListSchema>;

export const CreateTrainingJobRequestSchema = z.object({
  model: z.string().min(1),
  dataset: z.string().min(1),
  config: TrainingConfigSchema.partial().optional(),
});

export type CreateTrainingJobRequest = z.infer<
  typeof CreateTrainingJobRequestSchema
>;

export const TrainingLogsSchema = z.object({
  job_id: z.string(),
  lines: z.array(z.string()),
  since: z.number().int().min(0),
  next_since: z.number().int().min(0),
  total_lines: z.number().int().min(0),
  complete: z.boolean(),
});

export type TrainingLogs = z.infer<typeof TrainingLogsSchema>;

export const DatasetSummarySchema = z.object({
  dataset_id: z.string(),
  display_name: z.string(),
  description: z.string().optional(),
  dataset_type: z.string().optional(),
  task: z.string().optional(),
  source: z.string().optional(),
  available: z.boolean(),
  status: z.string(),
  missing_files: z.array(z.string()).default([]),
  local_path: z.string().optional(),
  local_size_bytes: z.number().int().min(0).optional(),
  local_file_count: z.number().int().min(0).optional(),
  train_size: z.number().int().min(0).optional(),
  test_size: z.number().int().min(0).optional(),
  val_fraction: z.number().min(0).max(1).optional(),
  num_classes: z.number().int().min(0).optional(),
  classes: z.array(z.string()).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  preprocessing: z.record(z.string(), z.unknown()).optional(),
  config_path: z.string().optional(),
});

export type DatasetSummary = z.infer<typeof DatasetSummarySchema>;

export const DatasetListSchema = z.object({
  datasets: z.array(DatasetSummarySchema),
  count: z.number().int().min(0),
});

export type DatasetList = z.infer<typeof DatasetListSchema>;

export const DatasetStatisticsSchema = z.object({
  dataset_id: z.string(),
  available: z.boolean(),
  local_size_bytes: z.number().int().min(0),
  local_file_count: z.number().int().min(0),
  train_size: z.number().int().min(0),
  test_size: z.number().int().min(0),
  expected_val_size: z.number().int().min(0),
  expected_train_after_split: z.number().int().min(0),
  num_classes: z.number().int().min(0),
  classes: z.array(z.string()),
});

export type DatasetStatistics = z.infer<typeof DatasetStatisticsSchema>;

export const ValidateDatasetRequestSchema = z
  .object({
    dataset_id: z.string().trim().min(1),
  })
  .strict();

export type ValidateDatasetRequest = z.infer<
  typeof ValidateDatasetRequestSchema
>;

export const ValidationCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
});

export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

export const ValidationResponseSchema = z.object({
  dataset_id: z.string(),
  valid: z.boolean(),
  status: z.string(),
  checks: z.array(ValidationCheckSchema),
  missing_files: z.array(z.string()).default([]),
});

export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;

// ---------------------------------------------------------------------------
// Registry & Evaluation schemas
// ---------------------------------------------------------------------------

export const RegistryMetricsSchema = z.object({
  accuracy: z.number().nullable().optional().default(null),
  macro_f1: z.number().nullable().optional().default(null),
  macro_precision: z.number().nullable().optional().default(null),
  macro_recall: z.number().nullable().optional().default(null),
});

export type RegistryMetrics = z.infer<typeof RegistryMetricsSchema>;

export const RegistryModelSummarySchema = z.object({
  model_id: z.string(),
  display_name: z.string(),
  architecture: z.string(),
  task: z.string(),
  artifact_path: z.string().nullable().optional(),
  checkpoint_size_bytes: z.number().int().nullable().optional().default(null),
  config_path: z.string().nullable().optional(),
  evaluation_path: z.string().nullable().optional(),
  metrics: RegistryMetricsSchema.optional(),
  available: z.boolean(),
  status: z.string(),
  error: z.string().nullable().optional().default(null),
});

export type RegistryModelSummary = z.infer<typeof RegistryModelSummarySchema>;

export const RegistryModelListSchema = z.object({
  models: z.array(RegistryModelSummarySchema),
  count: z.number().int().min(0),
});

export type RegistryModelList = z.infer<typeof RegistryModelListSchema>;

export const EvaluationStateSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export type EvaluationState = z.infer<typeof EvaluationStateSchema>;

export const EvaluationConfigSchema = z
  .object({
    batch_size: z.number().int().min(1).max(512),
    max_samples: z.number().int().min(1).max(100000).nullable(),
    num_workers: z.number().int().min(0).max(8),
  })
  .strict();

export type EvaluationConfig = z.infer<typeof EvaluationConfigSchema>;

export const EvaluationPresetSchema = z.object({
  model: z.string(),
  dataset: z.string(),
  display_name: z.string(),
  architecture: z.string(),
  task: z.string(),
  default_config: EvaluationConfigSchema,
});

export type EvaluationPreset = z.infer<typeof EvaluationPresetSchema>;

export const EvaluationPresetListSchema = z.object({
  models: z.array(EvaluationPresetSchema),
});

export type EvaluationPresetList = z.infer<typeof EvaluationPresetListSchema>;

export const EvaluationSummaryMetricsSchema = z.object({
  accuracy: z.number().nullable().optional().default(null),
  macro_precision: z.number().nullable().optional().default(null),
  macro_recall: z.number().nullable().optional().default(null),
  macro_f1: z.number().nullable().optional().default(null),
});

export type EvaluationSummaryMetrics = z.infer<
  typeof EvaluationSummaryMetricsSchema
>;

export const EvaluationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type EvaluationError = z.infer<typeof EvaluationErrorSchema>;

export const EvaluationSchema = z.object({
  evaluation_id: z.string(),
  model: z.string(),
  dataset: z.string(),
  architecture: z.string(),
  task: z.string(),
  state: EvaluationStateSchema,
  progress: z.number().min(0).max(1),
  samples_evaluated: z.number().int().min(0),
  total_samples: z.number().int().min(0),
  metrics: EvaluationSummaryMetricsSchema,
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  elapsed_seconds: z.number().nullable(),
  cancel_requested: z.boolean(),
  queue_position: z.number().int().nullable(),
  device: z.string().nullable(),
  artifact_dir: z.string(),
  source_checkpoint: z.string(),
  results_path: z.string().nullable(),
  metrics_path: z.string().nullable(),
  metadata_path: z.string().nullable(),
  error: EvaluationErrorSchema.nullable(),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export const EvaluationListSchema = z.object({
  evaluations: z.array(EvaluationSchema),
  count: z.number().int().min(0),
});

export type EvaluationList = z.infer<typeof EvaluationListSchema>;

export const CreateEvaluationRequestSchema = z.object({
  model: z.string().min(1).max(128),
  dataset: z.string().min(1).max(64),
  config: EvaluationConfigSchema.partial().optional(),
});

export type CreateEvaluationRequest = z.infer<
  typeof CreateEvaluationRequestSchema
>;

export const EvaluationLogsSchema = z.object({
  evaluation_id: z.string(),
  lines: z.array(z.string()),
  since: z.number().int().min(0),
  next_since: z.number().int().min(0),
  total_lines: z.number().int().min(0),
  complete: z.boolean(),
});

export type EvaluationLogs = z.infer<typeof EvaluationLogsSchema>;

export const ClassMetricsSchema = z.object({
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  support: z.number().int().min(0),
});

export type ClassMetrics = z.infer<typeof ClassMetricsSchema>;

export const MacroMetricsSchema = z.object({
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
});

export type MacroMetrics = z.infer<typeof MacroMetricsSchema>;

export const EvaluationResultsSchema = z.object({
  evaluation_id: z.string(),
  model: z.string(),
  dataset: z.string(),
  task: z.string(),
  state: z.string(),
  classes: z.array(z.string()),
  sample_count: z.number().int().min(0),
  evaluation_seconds: z.number(),
  accuracy: z.number(),
  macro_precision: z.number(),
  macro_recall: z.number(),
  macro_f1: z.number(),
  macro: MacroMetricsSchema,
  per_class: z.record(z.string(), ClassMetricsSchema),
  confusion_matrix: z.array(z.array(z.number().int().min(0))),
  device: z.string().nullable(),
  completed_at: z.string().nullable(),
  artifact_dir: z.string(),
});

export type EvaluationResults = z.infer<typeof EvaluationResultsSchema>;

// ---------------------------------------------------------------------------
// Image Inference (AI Playground) schemas
// ---------------------------------------------------------------------------

export const ImageModelInfoSchema = z.object({
  model_id: z.string(),
  display_name: z.string(),
  architecture: z.string(),
  dataset: z.string(),
  image_size: z.number().int().nullable(),
  available: z.boolean(),
});

export type ImageModelInfo = z.infer<typeof ImageModelInfoSchema>;

export const ImageModelListSchema = z.object({
  models: z.array(ImageModelInfoSchema),
  count: z.number().int().min(0),
});

export type ImageModelList = z.infer<typeof ImageModelListSchema>;

export const ImageInputInfoSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  format: z.string(),
});

export type ImageInputInfo = z.infer<typeof ImageInputInfoSchema>;

export const ImageTopKPredictionSchema = z.object({
  class_index: z.number().int().min(0),
  label: z.string(),
  probability: z.number().min(0).max(1),
});

export type ImageTopKPrediction = z.infer<typeof ImageTopKPredictionSchema>;

export const ImageInferenceResponseSchema = z.object({
  model_id: z.string(),
  predicted_class: z.string(),
  class_index: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  top_k: z.array(ImageTopKPredictionSchema),
  inference_ms: z.number().min(0),
  image: ImageInputInfoSchema,
});

export type ImageInferenceResponse = z.infer<
  typeof ImageInferenceResponseSchema
>;

// ---------------------------------------------------------------------------
// NLP Inference (NLP Playground) schemas
// ---------------------------------------------------------------------------

export const NlpModelInfoSchema = z.object({
  model_id: z.string(),
  display_name: z.string(),
  task: z.string(),
  kind: z.string(),
  available: z.boolean(),
});

export type NlpModelInfo = z.infer<typeof NlpModelInfoSchema>;

export const NlpModelListSchema = z.object({
  models: z.array(NlpModelInfoSchema),
  count: z.number().int().min(0),
});

export type NlpModelList = z.infer<typeof NlpModelListSchema>;

export const SentimentModelKindSchema = z.enum(["finetuned", "pretrained"]);
export type SentimentModelKind = z.infer<typeof SentimentModelKindSchema>;

export const SentimentRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(10000),
    model: SentimentModelKindSchema.default("finetuned"),
  })
  .strict();

export type SentimentRequest = z.infer<typeof SentimentRequestSchema>;

export const SentimentResponseSchema = z.object({
  task: z.string(),
  model_id: z.string(),
  label: z.string(),
  score: z.number(),
  inference_ms: z.number().min(0),
});

export type SentimentResponse = z.infer<typeof SentimentResponseSchema>;

export const EmbeddingRequestSchema = z
  .object({
    texts: z.array(z.string().trim().min(1).max(10000)).min(1).max(16),
  })
  .strict();

export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

export const EmbeddingResponseSchema = z.object({
  task: z.string(),
  model_id: z.string(),
  count: z.number().int().min(0),
  dimension: z.number().int().min(0),
  embeddings: z.array(z.array(z.number())),
  inference_ms: z.number().min(0),
});

export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;

export const NerRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(10000),
  })
  .strict();

export type NerRequest = z.infer<typeof NerRequestSchema>;

export const NerEntitySchema = z.object({
  text: z.string(),
  label: z.string(),
  score: z.number(),
});

export type NerEntity = z.infer<typeof NerEntitySchema>;

export const NerResponseSchema = z.object({
  task: z.string(),
  model_id: z.string(),
  entities: z.array(NerEntitySchema),
  inference_ms: z.number().min(0),
});

export type NerResponse = z.infer<typeof NerResponseSchema>;

// ---------------------------------------------------------------------------
// System Health, Readiness & Settings schemas
// ---------------------------------------------------------------------------

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  app: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessResponseSchema = z.object({
  status: z.string(),
  database: z.boolean(),
  artifact_root: z.boolean(),
  artifact_root_writable: z.boolean(),
});

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const RuntimeInfoSchema = z.object({
  app_version: z.string(),
  python_version: z.string(),
  torch_version: z.string().nullable(),
  transformers_version: z.string().nullable(),
  device: z.string(),
  cuda_available: z.boolean(),
  cpu_count: z.number().int().nullable(),
  threads: z.number().int().nullable(),
  platform: z.string(),
});

export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;

export const MemoryInfoSchema = z.object({
  total_bytes: z.number().int().nullable().optional().default(null),
  available_bytes: z.number().int().nullable().optional().default(null),
});

export type MemoryInfo = z.infer<typeof MemoryInfoSchema>;

export const StorageInfoSchema = z.object({
  artifact_root: z.string(),
  artifact_bytes: z.number().int().min(0),
  artifact_files: z.number().int().min(0),
  data_root: z.string(),
  data_bytes: z.number().int().min(0),
  data_files: z.number().int().min(0),
  disk_total_bytes: z.number().int().nullable(),
  disk_free_bytes: z.number().int().nullable(),
});

export type StorageInfo = z.infer<typeof StorageInfoSchema>;

export const ModelCapabilitySchema = z.object({
  model_id: z.string(),
  display_name: z.string(),
  task: z.string(),
  capabilities: z.array(z.string()),
});

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const SettingsResponseSchema = z.object({
  runtime: RuntimeInfoSchema,
  memory: MemoryInfoSchema,
  storage: StorageInfoSchema,
  models: z.array(ModelCapabilitySchema),
});

export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;
