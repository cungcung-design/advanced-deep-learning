import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  EmbeddingRequestSchema,
  EmbeddingResponseSchema,
  NerRequestSchema,
  NerResponseSchema,
  NlpModelListSchema,
  SentimentRequestSchema,
  SentimentResponseSchema,
  type NlpModelInfo,
} from "@/lib/api/types";
import {
  MAX_EMBEDDING_TEXTS,
  MAX_NLP_TEXT_CHARS,
  computeCosineSimilarity,
  computePairwiseCosineMatrix,
  computeVectorNorm,
  formatCosineSimilarity,
  formatNlpApiError,
  parseEmbeddingBatch,
  selectDefaultSentimentKind,
  validateSingleNlpText,
} from "@/lib/nlp";

const NLP_MODELS: NlpModelInfo[] = [
  {
    model_id: "distilbert_imdb_finetuned",
    display_name: "Fine-tuned DistilBERT IMDb sentiment",
    task: "sentiment",
    kind: "finetuned",
    available: true,
  },
  {
    model_id: "distilbert-base-uncased-finetuned-sst-2-english",
    display_name: "Pretrained DistilBERT SST-2 sentiment",
    task: "sentiment",
    kind: "pretrained",
    available: false,
  },
  {
    model_id: "distilbert-base-uncased",
    display_name: "DistilBERT mean-pooled embeddings",
    task: "embeddings",
    kind: "pretrained",
    available: true,
  },
  {
    model_id: "elastic/distilbert-base-uncased-finetuned-conll03-english",
    display_name: "DistilBERT CoNLL-03 named entity recognition",
    task: "ner",
    kind: "pretrained",
    available: false,
  },
];

describe("NLP schemas and pure helpers", () => {
  it("parses NLP model list, sentiment, embeddings, and NER schemas", () => {
    expect(NlpModelListSchema.parse({ models: NLP_MODELS, count: 4 }).count).toBe(4);
    expect(
      SentimentRequestSchema.parse({ text: "Great film", model: "finetuned" }).model,
    ).toBe("finetuned");
    expect(
      SentimentResponseSchema.parse({
        task: "sentiment",
        model_id: "distilbert_imdb_finetuned",
        label: "POSITIVE",
        score: 0.91,
        inference_ms: 42.5,
      }).label,
    ).toBe("POSITIVE");

    expect(
      EmbeddingRequestSchema.parse({ texts: ["hello", "world"] }).texts,
    ).toHaveLength(2);
    expect(
      EmbeddingResponseSchema.parse({
        task: "embeddings",
        model_id: "distilbert-base-uncased",
        count: 2,
        dimension: 3,
        embeddings: [
          [1, 0, 0],
          [0, 1, 0],
        ],
        inference_ms: 35.1,
      }).dimension,
    ).toBe(3);

    expect(NerRequestSchema.parse({ text: "Paris" }).text).toBe("Paris");
    expect(
      NerResponseSchema.parse({
        task: "ner",
        model_id: "elastic/distilbert-base-uncased-finetuned-conll03-english",
        entities: [{ text: "Paris", label: "LOC", score: 0.99 }],
        inference_ms: 21.0,
      }).entities,
    ).toHaveLength(1);
  });

  it("validates single text and batch embedding line limits", () => {
    expect(validateSingleNlpText("   ").valid).toBe(false);
    expect(validateSingleNlpText("a".repeat(MAX_NLP_TEXT_CHARS + 1)).valid).toBe(false);
    expect(validateSingleNlpText("  hello  ")).toEqual({
      valid: true,
      trimmed: "hello",
      error: null,
    });

    expect(parseEmbeddingBatch("\n  \n").valid).toBe(false);
    const seventeen = Array.from({ length: MAX_EMBEDDING_TEXTS + 1 }, (_, i) => `line ${i}`).join("\n");
    expect(parseEmbeddingBatch(seventeen).valid).toBe(false);

    const parsed = parseEmbeddingBatch("first line\n\n  second line  \n");
    expect(parsed).toEqual({
      valid: true,
      texts: ["first line", "second line"],
      error: null,
    });
  });

  it("computes vector norms and cosine similarity safely including zero-length and zero-norm vectors", () => {
    expect(computeVectorNorm([3, 4])).toBeCloseTo(5, 6);
    expect(computeVectorNorm([])).toBe(0);

    expect(computeCosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6);
    expect(computeCosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(computeCosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
    expect(computeCosineSimilarity([], [])).toBeNull();
    expect(computeCosineSimilarity([0, 0], [1, 2])).toBeNull();
    expect(formatCosineSimilarity(null)).toBe("N/A");
    expect(formatCosineSimilarity(0.87654)).toBe("0.8765");

    const matrix = computePairwiseCosineMatrix([
      [1, 0],
      [0, 1],
    ]);
    expect(matrix[0][0]).toBeCloseTo(1, 6);
    expect(matrix[0][1]).toBeCloseTo(0, 6);
  });

  it("auto-selects available fine-tuned sentiment model and formats NLP API errors", () => {
    expect(selectDefaultSentimentKind(NLP_MODELS)).toBe("finetuned");
    expect(
      selectDefaultSentimentKind(NLP_MODELS.map((m) => ({ ...m, available: false }))),
    ).toBeNull();

    const unavail = formatNlpApiError(
      new ApiError("Not cached", 503, undefined, { code: "MODEL_UNAVAILABLE" }),
    );
    expect(unavail.title).toContain("unavailable");
  });
});
