"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type {
  NlpModelInfo,
  SentimentModelKind,
  SentimentResponse,
} from "@/lib/api/types";
import { formatConfidencePercent, formatLatencyMs } from "@/lib/inference";
import {
  MAX_NLP_TEXT_CHARS,
  SENTIMENT_EXAMPLES,
  formatNlpApiError,
  selectDefaultSentimentKind,
  validateSingleNlpText,
} from "@/lib/nlp";
import { cn } from "@/lib/utils";

interface NlpSentimentTabProps {
  models: readonly NlpModelInfo[];
  result: SentimentResponse | null;
  isPending: boolean;
  error: unknown;
  onRun: (text: string, model: SentimentModelKind) => void;
}

export function NlpSentimentTab({
  models,
  result,
  isPending,
  error,
  onRun,
}: NlpSentimentTabProps) {
  const [text, setText] = useState("");
  const [userSelectedKind, setUserSelectedKind] =
    useState<SentimentModelKind | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const sentimentModels = useMemo(
    () => models.filter((m) => m.task === "sentiment"),
    [models],
  );

  const effectiveKind = useMemo<SentimentModelKind | null>(() => {
    if (userSelectedKind) {
      return userSelectedKind;
    }
    return selectDefaultSentimentKind(models);
  }, [userSelectedKind, models]);

  const selectedModelInfo = useMemo(
    () => sentimentModels.find((m) => m.kind === effectiveKind) ?? null,
    [sentimentModels, effectiveKind],
  );

  const isSelectedAvailable = Boolean(selectedModelInfo?.available);
  const charCount = text.length;
  const formattedError = error ? formatNlpApiError(error) : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!effectiveKind || !isSelectedAvailable) {
      return;
    }
    const check = validateSingleNlpText(text);
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }
    setValidationError(null);
    onRun(check.trimmed, effectiveKind);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
      {/* Input panel */}
      <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-100">
            Sentiment Analysis
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Classify English text polarity using the local DistilBERT sentiment
            model.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Model kind selector */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-300">Sentiment Model</Label>
              <div
                role="radiogroup"
                aria-label="Sentiment model selection"
                className="grid gap-2.5 sm:grid-cols-2"
              >
                {sentimentModels.map((model) => {
                  const kind = model.kind as SentimentModelKind;
                  const active = effectiveKind === kind;
                  return (
                    <button
                      key={model.model_id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={isPending}
                      onClick={() => setUserSelectedKind(kind)}
                      className={cn(
                        "flex min-w-0 flex-col items-start rounded-xl border p-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        active
                          ? "border-indigo-400/50 bg-indigo-500/[0.12] text-white"
                          : "border-white/[0.08] bg-[#141722] text-zinc-300 hover:border-white/20",
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold capitalize">
                          {model.kind}
                        </span>
                        {model.available ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 gap-1 border-emerald-500/25 bg-emerald-500/10 text-[10px] text-emerald-300"
                          >
                            <CheckCircle2 className="size-2.5" aria-hidden="true" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="shrink-0 gap-1 border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-300"
                          >
                            <XCircle className="size-2.5" aria-hidden="true" />
                            Not Cached
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">
                        {model.model_id}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedModelInfo && !selectedModelInfo.available && (
              <Alert variant="warning">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <AlertTitle>Selected sentiment model is not cached</AlertTitle>
                  <AlertDescription>
                    <code className="font-mono">{selectedModelInfo.model_id}</code>{" "}
                    is unavailable offline. Select a model marked{" "}
                    <strong>Ready</strong> to run inference.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="nlp-sentiment-text" className="text-xs text-zinc-300">
                  Input Text
                </Label>
                <span
                  className={cn(
                    "font-mono text-[11px] tabular-nums",
                    charCount > MAX_NLP_TEXT_CHARS
                      ? "text-red-400"
                      : "text-zinc-500",
                  )}
                >
                  {charCount.toLocaleString()} /{" "}
                  {MAX_NLP_TEXT_CHARS.toLocaleString()}
                </span>
              </div>
              <Textarea
                id="nlp-sentiment-text"
                rows={5}
                value={text}
                disabled={isPending}
                onChange={(event) => {
                  setText(event.target.value);
                  if (validationError) {
                    setValidationError(null);
                  }
                }}
                placeholder="Enter a movie review or sentence to analyze sentiment..."
                className="border-white/10 bg-[#141722] text-sm text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            {/* Example prompts */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-zinc-500">Example prompts:</p>
              <div className="flex flex-wrap gap-1.5">
                {SENTIMENT_EXAMPLES.map((example, idx) => (
                  <button
                    key={example}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setText(example);
                      setValidationError(null);
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white"
                  >
                    Example {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {validationError && (
              <p className="text-xs text-red-400" role="alert">
                {validationError}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isPending || !isSelectedAvailable}
                className="bg-indigo-500 text-white hover:bg-indigo-400"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Analyze Sentiment
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Output panel */}
      <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Sentiment Result
              </CardTitle>
              <p className="text-xs text-zinc-500">
                Real classification output and CPU latency.
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

        <CardContent className="space-y-4">
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
            <div className="space-y-3" aria-label="Running sentiment analysis">
              <Skeleton className="h-28 w-full rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-14 w-full rounded-xl bg-white/[0.05]" />
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141722]/50 px-6 py-14 text-center">
              <Sparkles
                className="mb-2 size-5 text-zinc-500"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-zinc-300">
                No sentiment result yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                Enter text or pick an example prompt and click{" "}
                <strong>Analyze Sentiment</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={cn(
                  "rounded-xl border p-4",
                  result.label.toUpperCase() === "POSITIVE"
                    ? "border-emerald-500/25 bg-emerald-500/[0.08]"
                    : "border-red-500/25 bg-red-500/[0.08]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Predicted Sentiment
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-2xl font-semibold tracking-tight",
                        result.label.toUpperCase() === "POSITIVE"
                          ? "text-emerald-300"
                          : "text-red-300",
                      )}
                    >
                      {result.label}
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-400">
                      {result.model_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-zinc-400">Confidence</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
                      {formatConfidencePercent(result.score)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Progress
                    value={Math.max(0, Math.min(100, result.score * 100))}
                    aria-label={`Sentiment confidence ${formatConfidencePercent(result.score)}`}
                    className="h-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <p className="text-[11px] text-zinc-500">Model ID</p>
                  <p className="mt-1 truncate font-mono text-zinc-200">
                    {result.model_id}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <p className="text-[11px] text-zinc-500">Inference Latency</p>
                  <p className="mt-1 font-mono tabular-nums text-zinc-200">
                    {formatLatencyMs(result.inference_ms)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
