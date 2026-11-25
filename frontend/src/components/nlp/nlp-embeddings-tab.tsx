"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Layers,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { EmbeddingResponse, NlpModelInfo } from "@/lib/api/types";
import { formatLatencyMs } from "@/lib/inference";
import {
  EMBEDDING_EXAMPLE_TEXTS,
  MAX_EMBEDDING_TEXTS,
  computePairwiseCosineMatrix,
  computeVectorNorm,
  formatCosineSimilarity,
  formatNlpApiError,
  parseEmbeddingBatch,
} from "@/lib/nlp";
import { cn } from "@/lib/utils";

interface NlpEmbeddingsTabProps {
  models: readonly NlpModelInfo[];
  result: EmbeddingResponse | null;
  submittedTexts: readonly string[];
  isPending: boolean;
  error: unknown;
  onRun: (texts: string[]) => void;
}

export function NlpEmbeddingsTab({
  models,
  result,
  submittedTexts,
  isPending,
  error,
  onRun,
}: NlpEmbeddingsTabProps) {
  const [rawInput, setRawInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const embeddingModel = useMemo(
    () => models.find((m) => m.task === "embeddings") ?? null,
    [models],
  );
  const available = Boolean(embeddingModel?.available);

  const parsedPreview = useMemo(() => parseEmbeddingBatch(rawInput), [rawInput]);
  const formattedError = error ? formatNlpApiError(error) : null;

  const cosineMatrix = useMemo(() => {
    if (!result || result.embeddings.length < 2) {
      return null;
    }
    return computePairwiseCosineMatrix(result.embeddings);
  }, [result]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!available) {
      return;
    }
    const parsed = parseEmbeddingBatch(rawInput);
    if (!parsed.valid) {
      setValidationError(parsed.error);
      return;
    }
    setValidationError(null);
    onRun(parsed.texts);
  };

  const handleCopyVector = async (index: number, vector: number[]) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(vector));
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1600);
    } catch {
      // Clipboard may be unavailable
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
      {/* Input panel */}
      <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-100">
            Text Embeddings
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Extract mean-pooled DistilBERT vectors for 1–{MAX_EMBEDDING_TEXTS}{" "}
            non-empty lines and compute pairwise cosine similarity.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {embeddingModel && !embeddingModel.available && (
              <Alert variant="warning">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <AlertTitle>Embedding model not cached locally</AlertTitle>
                  <AlertDescription>
                    <code className="font-mono">{embeddingModel.model_id}</code>{" "}
                    is unavailable in the local Hugging Face cache.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="nlp-embeddings-input"
                  className="text-xs text-zinc-300"
                >
                  Batch Texts (one per line)
                </Label>
                <span
                  className={cn(
                    "font-mono text-[11px] tabular-nums",
                    parsedPreview.texts.length > MAX_EMBEDDING_TEXTS
                      ? "text-red-400"
                      : "text-zinc-500",
                  )}
                >
                  {parsedPreview.texts.length} / {MAX_EMBEDDING_TEXTS} lines
                </span>
              </div>
              <Textarea
                id="nlp-embeddings-input"
                rows={7}
                value={rawInput}
                disabled={isPending}
                onChange={(event) => {
                  setRawInput(event.target.value);
                  if (validationError) {
                    setValidationError(null);
                  }
                }}
                placeholder={"Enter one text per line...\nExample: Deep learning models learn visual features."}
                className="border-white/10 bg-[#141722] text-sm text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setRawInput(EMBEDDING_EXAMPLE_TEXTS);
                  setValidationError(null);
                }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white"
              >
                Load 3-sentence example
              </button>

              <Button
                type="submit"
                size="lg"
                disabled={isPending || !available}
                className="bg-indigo-500 text-white hover:bg-indigo-400"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Layers className="size-4" aria-hidden="true" />
                    Extract Embeddings
                  </>
                )}
              </Button>
            </div>

            {validationError && (
              <p className="text-xs text-red-400" role="alert">
                {validationError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Output panel */}
      <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Embedding Vectors & Similarity
              </CardTitle>
              <p className="text-xs text-zinc-500">
                Actual vector dimensions, L2 norms, previews, and cosine
                similarity.
              </p>
            </div>
            {result && (
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
                >
                  {result.count} × {result.dimension}d
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1 border-indigo-400/25 bg-indigo-500/10 font-mono text-[11px] text-indigo-300"
                >
                  <Clock className="size-3" aria-hidden="true" />
                  {formatLatencyMs(result.inference_ms)}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {formattedError && (
            <Alert variant="destructive">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <AlertTitle>{formattedError.title}</AlertTitle>
                <AlertDescription>{formattedError.message}</AlertDescription>
              </div>
            </Alert>
          )}

          {isPending ? (
            <div className="space-y-3" aria-label="Extracting embeddings">
              <Skeleton className="h-24 w-full rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-32 w-full rounded-xl bg-white/[0.05]" />
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141722]/50 px-6 py-14 text-center">
              <Layers className="mb-2 size-5 text-zinc-500" aria-hidden="true" />
              <p className="text-sm font-medium text-zinc-300">
                No embeddings extracted yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                Enter 1 to {MAX_EMBEDDING_TEXTS} lines and click{" "}
                <strong>Extract Embeddings</strong> to inspect real vectors and
                pairwise cosine similarity.
              </p>
            </div>
          ) : (
            <>
              {/* Vector cards */}
              <div className="space-y-2.5">
                {result.embeddings.map((vector, idx) => {
                  const norm = computeVectorNorm(vector);
                  const preview = vector
                    .slice(0, 8)
                    .map((v) => v.toFixed(4))
                    .join(", ");
                  const labelText = submittedTexts[idx] ?? `Text #${idx + 1}`;
                  return (
                    <div
                      key={`vec-${idx}`}
                      className="rounded-xl border border-white/[0.07] bg-[#141722] p-3.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-200">
                            <span className="mr-1.5 font-mono text-indigo-300">
                              T{idx + 1}
                            </span>
                            {labelText}
                          </p>
                          <p className="mt-1 font-mono text-[11px] tabular-nums text-zinc-400">
                            Dim: {vector.length} · L2 Norm: {norm.toFixed(4)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleCopyVector(idx, vector)}
                          aria-label={`Copy vector T${idx + 1} JSON`}
                          className="shrink-0 border-white/10 bg-transparent text-zinc-300"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check
                                className="size-3 text-emerald-400"
                                aria-hidden="true"
                              />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" aria-hidden="true" />
                              Copy JSON
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="mt-2 break-all rounded-lg bg-[#0C0E14] px-2.5 py-1.5 font-mono text-[11px] text-zinc-400">
                        [{preview}
                        {vector.length > 8 ? ", ..." : ""}]
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Pairwise cosine similarity matrix */}
              {cosineMatrix && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Pairwise Cosine Similarity
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      Computed from returned vectors
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#141722] p-3">
                    <table
                      aria-label="Pairwise cosine similarity matrix"
                      className="w-full border-separate border-spacing-1 text-center font-mono text-xs"
                    >
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left text-[10px] text-zinc-500">
                            Pair
                          </th>
                          {cosineMatrix.map((_, colIdx) => (
                            <th
                              key={`col-${colIdx}`}
                              scope="col"
                              className="px-2 py-1 text-[11px] text-zinc-400"
                            >
                              T{colIdx + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cosineMatrix.map((row, rowIdx) => (
                          <tr key={`row-${rowIdx}`}>
                            <th
                              scope="row"
                              className="px-2 py-1 text-left text-[11px] text-zinc-300"
                            >
                              T{rowIdx + 1}
                            </th>
                            {row.map((sim, colIdx) => {
                              const strength =
                                sim !== null ? Math.max(0, sim) : 0;
                              const bg =
                                rowIdx === colIdx
                                  ? "rgba(99, 102, 241, 0.35)"
                                  : `rgba(139, 92, 246, ${(strength * 0.45).toFixed(2)})`;
                              return (
                                <td
                                  key={`sim-${rowIdx}-${colIdx}`}
                                  style={{ backgroundColor: bg }}
                                  className="rounded-md px-2 py-1.5 tabular-nums text-zinc-100"
                                >
                                  {formatCosineSimilarity(sim)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
