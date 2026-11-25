export const queryKeys = {
  training: {
    all: ["training"] as const,
    presets: () => ["training", "presets"] as const,
    jobs: (limit = 50) => ["training", "jobs", { limit }] as const,
    job: (jobId: string) => ["training", "job", jobId] as const,
    logs: (jobId: string, since = 0) =>
      ["training", "logs", jobId, { since }] as const,
  },
  datasets: {
    all: ["datasets"] as const,
    list: () => ["datasets"] as const,
    detail: (datasetId: string) => ["datasets", "detail", datasetId] as const,
    statistics: (datasetId: string) =>
      ["datasets", "statistics", datasetId] as const,
  },
  registry: {
    all: ["registry"] as const,
    models: () => ["registry", "models"] as const,
    detail: (modelId: string) => ["registry", "detail", modelId] as const,
  },
  evaluations: {
    all: ["evaluations"] as const,
    presets: () => ["evaluations", "presets"] as const,
    list: (state?: string, limit = 50) =>
      ["evaluations", "list", { state: state ?? "ALL", limit }] as const,
    detail: (evaluationId: string) =>
      ["evaluations", "detail", evaluationId] as const,
    results: (evaluationId: string) =>
      ["evaluations", "results", evaluationId] as const,
    logs: (evaluationId: string, since = 0) =>
      ["evaluations", "logs", evaluationId, { since }] as const,
  },
  inference: {
    all: ["inference"] as const,
    imageModels: () => ["inference", "image", "models"] as const,
    nlpModels: () => ["inference", "nlp", "models"] as const,
  },
  system: {
    all: ["system"] as const,
    health: () => ["system", "health"] as const,
    readiness: () => ["system", "readiness"] as const,
    settings: () => ["system", "settings"] as const,
  },
} as const;
