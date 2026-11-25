import { api, ApiError, apiPaths } from "./client";
import {
  CreateEvaluationRequestSchema,
  CreateTrainingJobRequestSchema,
  DatasetListSchema,
  DatasetStatisticsSchema,
  DatasetSummarySchema,
  EmbeddingRequestSchema,
  EmbeddingResponseSchema,
  EvaluationListSchema,
  EvaluationLogsSchema,
  EvaluationPresetListSchema,
  EvaluationResultsSchema,
  EvaluationSchema,
  HealthResponseSchema,
  ImageInferenceResponseSchema,
  ImageModelListSchema,
  NerRequestSchema,
  NerResponseSchema,
  NlpModelListSchema,
  ReadinessResponseSchema,
  RegistryModelListSchema,
  RegistryModelSummarySchema,
  SentimentRequestSchema,
  SentimentResponseSchema,
  SettingsResponseSchema,
  TrainingJobListSchema,
  TrainingJobSchema,
  TrainingLogsSchema,
  TrainingPresetListSchema,
  ValidateDatasetRequestSchema,
  ValidationResponseSchema,
  type CreateEvaluationRequest,
  type CreateTrainingJobRequest,
  type DatasetList,
  type DatasetStatistics,
  type DatasetSummary,
  type EmbeddingRequest,
  type EmbeddingResponse,
  type Evaluation,
  type EvaluationList,
  type EvaluationLogs,
  type EvaluationPresetList,
  type EvaluationResults,
  type HealthResponse,
  type ImageInferenceResponse,
  type ImageModelList,
  type NerRequest,
  type NerResponse,
  type NlpModelList,
  type ReadinessResponse,
  type RegistryModelList,
  type RegistryModelSummary,
  type SentimentRequest,
  type SentimentResponse,
  type SettingsResponse,
  type TrainingJob,
  type TrainingJobList,
  type TrainingLogs,
  type TrainingPresetList,
  type ValidateDatasetRequest,
  type ValidationResponse,
} from "./types";

export async function getTrainingPresets(): Promise<TrainingPresetList> {
  const data = await api<unknown>(apiPaths.trainingPresets);
  return TrainingPresetListSchema.parse(data);
}

export async function listTrainingJobs(limit = 50): Promise<TrainingJobList> {
  const data = await api<unknown>(`${apiPaths.trainingJobs}?limit=${limit}`);
  return TrainingJobListSchema.parse(data);
}

export async function createTrainingJob(
  payload: CreateTrainingJobRequest,
): Promise<TrainingJob> {
  const validated = CreateTrainingJobRequestSchema.parse(payload);
  const data = await api<unknown>(apiPaths.trainingJobs, {
    method: "POST",
    body: JSON.stringify(validated),
  });
  return TrainingJobSchema.parse(data);
}

export async function getTrainingJob(jobId: string): Promise<TrainingJob> {
  const data = await api<unknown>(
    `${apiPaths.trainingJobs}/${encodeURIComponent(jobId)}`,
  );
  return TrainingJobSchema.parse(data);
}

export async function cancelTrainingJob(jobId: string): Promise<TrainingJob> {
  const data = await api<unknown>(
    `${apiPaths.trainingJobs}/${encodeURIComponent(jobId)}/cancel`,
    { method: "POST" },
  );
  return TrainingJobSchema.parse(data);
}

export async function getTrainingLogs(
  jobId: string,
  since = 0,
  limit = 500,
): Promise<TrainingLogs> {
  const params = new URLSearchParams({
    since: String(since),
    limit: String(limit),
  });
  const data = await api<unknown>(
    `${apiPaths.trainingJobs}/${encodeURIComponent(jobId)}/logs?${params.toString()}`,
  );
  return TrainingLogsSchema.parse(data);
}

export async function listDatasets(): Promise<DatasetList> {
  const data = await api<unknown>(apiPaths.datasets);
  return DatasetListSchema.parse(data);
}

export async function getDataset(datasetId: string): Promise<DatasetSummary> {
  const data = await api<unknown>(
    `${apiPaths.datasets}/${encodeURIComponent(datasetId)}`,
  );
  return DatasetSummarySchema.parse(data);
}

export async function getDatasetStatistics(
  datasetId: string,
): Promise<DatasetStatistics> {
  const data = await api<unknown>(
    `${apiPaths.datasets}/${encodeURIComponent(datasetId)}/statistics`,
  );
  return DatasetStatisticsSchema.parse(data);
}

export async function validateDataset(
  payload: ValidateDatasetRequest,
): Promise<ValidationResponse> {
  const validated = ValidateDatasetRequestSchema.parse(payload);
  const data = await api<unknown>(`${apiPaths.datasets}/validate`, {
    method: "POST",
    body: JSON.stringify(validated),
  });
  return ValidationResponseSchema.parse(data);
}

export async function listRegistryModels(): Promise<RegistryModelList> {
  const data = await api<unknown>(apiPaths.models);
  return RegistryModelListSchema.parse(data);
}

export async function getRegistryModel(
  modelId: string,
): Promise<RegistryModelSummary> {
  const data = await api<unknown>(
    `${apiPaths.models}/${encodeURIComponent(modelId)}`,
  );
  return RegistryModelSummarySchema.parse(data);
}

export async function getEvaluationPresets(): Promise<EvaluationPresetList> {
  const data = await api<unknown>(apiPaths.evaluationPresets);
  return EvaluationPresetListSchema.parse(data);
}

export async function listEvaluations(options?: {
  state?: string;
  limit?: number;
}): Promise<EvaluationList> {
  const params = new URLSearchParams();
  if (options?.state) {
    params.set("state", options.state);
  }
  params.set("limit", String(options?.limit ?? 50));
  const data = await api<unknown>(`${apiPaths.evaluations}?${params.toString()}`);
  return EvaluationListSchema.parse(data);
}

export async function createEvaluation(
  payload: CreateEvaluationRequest,
): Promise<Evaluation> {
  const validated = CreateEvaluationRequestSchema.parse(payload);
  const data = await api<unknown>(apiPaths.evaluations, {
    method: "POST",
    body: JSON.stringify(validated),
  });
  return EvaluationSchema.parse(data);
}

export async function getEvaluation(evaluationId: string): Promise<Evaluation> {
  const data = await api<unknown>(
    `${apiPaths.evaluations}/${encodeURIComponent(evaluationId)}`,
  );
  return EvaluationSchema.parse(data);
}

export async function getEvaluationResults(
  evaluationId: string,
): Promise<EvaluationResults> {
  const data = await api<unknown>(
    `${apiPaths.evaluations}/${encodeURIComponent(evaluationId)}/results`,
  );
  return EvaluationResultsSchema.parse(data);
}

export async function cancelEvaluation(
  evaluationId: string,
): Promise<Evaluation> {
  const data = await api<unknown>(
    `${apiPaths.evaluations}/${encodeURIComponent(evaluationId)}/cancel`,
    { method: "POST" },
  );
  return EvaluationSchema.parse(data);
}

export async function getEvaluationLogs(
  evaluationId: string,
  since = 0,
  limit = 500,
): Promise<EvaluationLogs> {
  const params = new URLSearchParams({
    since: String(since),
    limit: String(limit),
  });
  const data = await api<unknown>(
    `${apiPaths.evaluations}/${encodeURIComponent(evaluationId)}/logs?${params.toString()}`,
  );
  return EvaluationLogsSchema.parse(data);
}

export async function listImageModels(): Promise<ImageModelList> {
  const data = await api<unknown>(apiPaths.imageModels);
  return ImageModelListSchema.parse(data);
}

export interface ImageInferencePayload {
  file: File;
  model_id: string;
  top_k: number;
}

export async function inferImage(
  payload: ImageInferencePayload,
): Promise<ImageInferenceResponse> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("model_id", payload.model_id);
  formData.append("top_k", String(payload.top_k));

  const data = await api<unknown>("/inference/image", {
    method: "POST",
    body: formData,
  });
  return ImageInferenceResponseSchema.parse(data);
}

export async function listNlpModels(): Promise<NlpModelList> {
  const data = await api<unknown>(apiPaths.nlpModels);
  return NlpModelListSchema.parse(data);
}

export async function inferSentiment(
  payload: SentimentRequest,
): Promise<SentimentResponse> {
  const validated = SentimentRequestSchema.parse(payload);
  const data = await api<unknown>("/inference/nlp/sentiment", {
    method: "POST",
    body: JSON.stringify(validated),
  });
  return SentimentResponseSchema.parse(data);
}

export async function inferEmbeddings(
  payload: EmbeddingRequest,
): Promise<EmbeddingResponse> {
  const validated = EmbeddingRequestSchema.parse(payload);
  const data = await api<unknown>("/inference/nlp/embeddings", {
    method: "POST",
    body: JSON.stringify(validated),
  });
  return EmbeddingResponseSchema.parse(data);
}

export async function inferNer(payload: NerRequest): Promise<NerResponse> {
  const validated = NerRequestSchema.parse(payload);
  const data = await api<unknown>("/inference/nlp/ner", {
    method: "POST",
    body: JSON.stringify(validated),
  });
  return NerResponseSchema.parse(data);
}

export async function getHealth(): Promise<HealthResponse> {
  const data = await api<unknown>(apiPaths.health);
  return HealthResponseSchema.parse(data);
}

export async function getReadiness(): Promise<ReadinessResponse> {
  try {
    const data = await api<unknown>(apiPaths.readiness);
    return ReadinessResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      const parsed = ReadinessResponseSchema.safeParse(error.detail);
      if (parsed.success) {
        return parsed.data;
      }
    }
    throw error;
  }
}

export async function getSettings(): Promise<SettingsResponse> {
  const data = await api<unknown>(apiPaths.settings);
  return SettingsResponseSchema.parse(data);
}
