import { ApiError } from "./api/client";
import type {
  EmbeddingResponse,
  NerResponse,
  NlpModelInfo,
  SentimentModelKind,
  SentimentResponse,
} from "./api/types";
import { formatTrainingApiError, type FormattedApiError } from "./training";

export const MAX_NLP_TEXT_CHARS = 10_000;
export const MAX_EMBEDDING_TEXTS = 16;

export const SENTIMENT_EXAMPLES: readonly string[] = [
  "This movie was wonderfully directed with brilliant performances throughout.",
  "The plot felt slow, predictable, and completely failed to engage me.",
  "A visually impressive film, though the second half dragged a bit.",
];

export const EMBEDDING_EXAMPLE_TEXTS = [
  "Deep learning models learn hierarchical visual features.",
  "Convolutional neural networks classify images accurately.",
  "The weather forecast predicts light rain tomorrow afternoon.",
].join("\n");

export const NER_EXAMPLE_TEXT =
  "Barack Obama met Angela Merkel in Paris to discuss the European Union initiative.";

export interface TextValidationResult {
  valid: boolean;
  trimmed: string;
  error: string | null;
}

export function validateSingleNlpText(raw: string): TextValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      trimmed: "",
      error: "Enter non-empty text before running inference.",
    };
  }
  if (trimmed.length > MAX_NLP_TEXT_CHARS) {
    return {
      valid: false,
      trimmed,
      error: `Text exceeds the ${MAX_NLP_TEXT_CHARS.toLocaleString()}-character limit.`,
    };
  }
  return { valid: true, trimmed, error: null };
}

export interface BatchEmbeddingParseResult {
  valid: boolean;
  texts: string[];
  error: string | null;
}

export function parseEmbeddingBatch(raw: string): BatchEmbeddingParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      valid: false,
      texts: [],
      error: "Enter at least one non-empty line of text.",
    };
  }

  if (lines.length > MAX_EMBEDDING_TEXTS) {
    return {
      valid: false,
      texts: lines,
      error: `Maximum ${MAX_EMBEDDING_TEXTS} non-empty texts allowed per request (found ${lines.length}).`,
    };
  }

  const tooLongIndex = lines.findIndex((line) => line.length > MAX_NLP_TEXT_CHARS);
  if (tooLongIndex !== -1) {
    return {
      valid: false,
      texts: lines,
      error: `Line ${tooLongIndex + 1} exceeds the ${MAX_NLP_TEXT_CHARS.toLocaleString()}-character limit.`,
    };
  }

  return { valid: true, texts: lines, error: null };
}

export function selectDefaultSentimentKind(
  models: readonly NlpModelInfo[],
): SentimentModelKind | null {
  const finetuned = models.find(
    (m) => m.task === "sentiment" && m.kind === "finetuned" && m.available,
  );
  if (finetuned) {
    return "finetuned";
  }
  const pretrained = models.find(
    (m) => m.task === "sentiment" && m.kind === "pretrained" && m.available,
  );
  if (pretrained) {
    return "pretrained";
  }
  return null;
}

export function computeVectorNorm(vector: readonly number[]): number {
  if (vector.length === 0) {
    return 0;
  }
  let sumSq = 0;
  for (const val of vector) {
    sumSq += val * val;
  }
  return Math.sqrt(sumSq);
}

export function computeCosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number | null {
  if (a.length === 0 || a.length !== b.length) {
    return null;
  }
  let dot = 0;
  let normSqA = 0;
  let normSqB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normSqA += va * va;
    normSqB += vb * vb;
  }
  const denom = Math.sqrt(normSqA) * Math.sqrt(normSqB);
  if (denom === 0 || !Number.isFinite(denom)) {
    return null;
  }
  const sim = dot / denom;
  return Math.max(-1, Math.min(1, sim));
}

export function computePairwiseCosineMatrix(
  vectors: readonly (readonly number[])[],
): (number | null)[][] {
  return vectors.map((row) =>
    vectors.map((col) => computeCosineSimilarity(row, col)),
  );
}

export function formatCosineSimilarity(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }
  return value.toFixed(4);
}

export function getEntityBadgeTone(label: string): string {
  const upper = label.toUpperCase();
  if (upper.includes("PER")) {
    return "border-indigo-400/30 bg-indigo-500/15 text-indigo-200";
  }
  if (upper.includes("ORG")) {
    return "border-violet-400/30 bg-violet-500/15 text-violet-200";
  }
  if (upper.includes("LOC")) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }
  return "border-amber-400/30 bg-amber-500/15 text-amber-200";
}

export type NlpSessionEntry =
  | {
      id: string;
      timestamp: string;
      task: "sentiment";
      preview: string;
      result: SentimentResponse;
    }
  | {
      id: string;
      timestamp: string;
      task: "embeddings";
      preview: string;
      result: EmbeddingResponse;
    }
  | {
      id: string;
      timestamp: string;
      task: "ner";
      preview: string;
      result: NerResponse;
    };

export function formatNlpApiError(error: unknown): FormattedApiError {
  if (error instanceof ApiError) {
    if (error.code === "MODEL_UNAVAILABLE" || error.status === 503) {
      return {
        title: "NLP model unavailable in local cache",
        message:
          error.message ||
          "This NLP model is not present in the local Hugging Face cache (local_files_only=True).",
        code: error.code ?? "MODEL_UNAVAILABLE",
        isOffline: false,
      };
    }

    if (error.code === "MODEL_LOAD_ERROR") {
      return {
        title: "Failed to load NLP model",
        message:
          error.message ||
          "The backend could not load or execute the requested NLP model.",
        code: error.code,
        isOffline: false,
      };
    }

    if (error.code === "INFERENCE_FAILED") {
      return {
        title: "NLP inference failed",
        message: error.message || "The NLP model returned an invalid result.",
        code: error.code,
        isOffline: false,
      };
    }
  }

  return formatTrainingApiError(error);
}
