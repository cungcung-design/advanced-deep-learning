"use client";

import { AlertCircle, Clock, Image as ImageIcon, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImageInferenceResponse, ImageModelInfo } from "@/lib/api/types";
import {
  formatConfidencePercent,
  formatInferenceApiError,
  formatLatencyMs,
} from "@/lib/inference";

interface InferenceResultPanelProps {
  result: ImageInferenceResponse | null;
  models: readonly ImageModelInfo[];
  isPending: boolean;
  error: unknown;
}

export function InferenceResultPanel({
  result,
  models,
  isPending,
  error,
}: InferenceResultPanelProps) {
  const formattedError = error ? formatInferenceApiError(error) : null;
  const matchedModel = result
    ? models.find((m) => m.model_id === result.model_id)
    : undefined;

  return (
    <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Prediction Results
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              Top-K class probabilities and latency from the local FastAPI
              inference service.
            </p>
          </div>
          {result && (
            <Badge
              variant="outline"
              className="gap-1 border-indigo-400/25 bg-indigo-500/10 font-mono text-[11px] text-indigo-300"
            >
              <Clock className="size-3" aria-hidden="true" />
              {formatLatencyMs(result.inference_ms)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {formattedError && (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>{formattedError.title}</AlertTitle>
              <AlertDescription>{formattedError.message}</AlertDescription>
            </div>
          </Alert>
        )}

        {isPending ? (
          <div className="space-y-4" aria-label="Running image inference">
            <Skeleton className="h-24 w-full rounded-xl bg-white/[0.05]" />
            <div className="space-y-2.5">
              <Skeleton className="h-9 w-full rounded-lg bg-white/[0.05]" />
              <Skeleton className="h-9 w-full rounded-lg bg-white/[0.05]" />
              <Skeleton className="h-9 w-full rounded-lg bg-white/[0.05]" />
            </div>
          </div>
        ) : !result ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141722]/50 px-6 py-14 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-500">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-zinc-300">
              No prediction yet
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Select an available vision model, upload a PNG, JPEG, or WebP
              image, and click <strong>Run Inference</strong> to inspect real
              Top-K class probabilities.
            </p>
          </div>
        ) : (
          <>
            {/* Top prediction callout */}
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/[0.08] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                    Top Prediction
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    {result.predicted_class}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    {matchedModel?.display_name ?? result.model_id} · class #
                    {result.class_index}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-zinc-400">Confidence</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-indigo-200">
                    {formatConfidencePercent(result.confidence)}
                  </p>
                </div>
              </div>
            </div>

            {/* Decoded image & runtime metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <ImageIcon className="size-3" aria-hidden="true" />
                  Dimensions
                </p>
                <p className="mt-1 font-mono tabular-nums text-zinc-200">
                  {result.image.width} × {result.image.height}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <p className="text-[11px] text-zinc-500">Decoded Format</p>
                <p className="mt-1 font-mono text-zinc-200">
                  {result.image.format}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/[0.06] bg-[#141722] p-3 sm:col-span-1">
                <p className="text-[11px] text-zinc-500">Inference Latency</p>
                <p className="mt-1 font-mono tabular-nums text-zinc-200">
                  {formatLatencyMs(result.inference_ms)}
                </p>
              </div>
            </div>

            {/* Ranked Top-K bars */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Top-{result.top_k.length} Probabilities
                </h3>
                <span className="text-[11px] text-zinc-500">
                  Ranked by probability
                </span>
              </div>

              <ol
                aria-label="Top-K class probabilities"
                className="space-y-2.5"
              >
                {result.top_k.map((pred, index) => {
                  const pct = Math.max(0, Math.min(100, pred.probability * 100));
                  return (
                    <li
                      key={`${pred.class_index}-${pred.label}`}
                      className="space-y-1.5 rounded-xl border border-white/[0.06] bg-[#141722] p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 font-medium text-zinc-200">
                          <span className="font-mono text-[11px] text-zinc-500">
                            #{index + 1}
                          </span>
                          <span>{pred.label}</span>
                        </span>
                        <span className="font-mono tabular-nums text-zinc-200">
                          {formatConfidencePercent(pred.probability)}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        aria-label={`${pred.label} probability ${formatConfidencePercent(pred.probability)}`}
                        className="h-1.5"
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
