"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Clock, Loader2, Tag } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { NerResponse, NlpModelInfo } from "@/lib/api/types";
import { formatConfidencePercent, formatLatencyMs } from "@/lib/inference";
import {
  MAX_NLP_TEXT_CHARS,
  NER_EXAMPLE_TEXT,
  formatNlpApiError,
  getEntityBadgeTone,
  validateSingleNlpText,
} from "@/lib/nlp";
import { cn } from "@/lib/utils";

interface NlpNerTabProps {
  models: readonly NlpModelInfo[];
  result: NerResponse | null;
  isPending: boolean;
  error: unknown;
  onRun: (text: string) => void;
}

export function NlpNerTab({
  models,
  result,
  isPending,
  error,
  onRun,
}: NlpNerTabProps) {
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const nerModel = useMemo(
    () => models.find((m) => m.task === "ner") ?? null,
    [models],
  );
  const available = Boolean(nerModel?.available);
  const formattedError = error ? formatNlpApiError(error) : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!available) {
      return;
    }
    const check = validateSingleNlpText(text);
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }
    setValidationError(null);
    onRun(check.trimmed);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
      {/* Input panel */}
      <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-zinc-100">
            Named Entity Recognition (NER)
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Extract PER, ORG, LOC, and MISC entities using the local CoNLL-03
            DistilBERT model.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {nerModel && !nerModel.available && (
              <Alert variant="warning">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <AlertTitle>NER model is not cached locally</AlertTitle>
                  <AlertDescription>
                    <code className="font-mono">{nerModel.model_id}</code> is
                    not present in the local Hugging Face cache. Inference is
                    disabled until the model is cached locally.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="nlp-ner-text" className="text-xs text-zinc-300">
                  Input Text
                </Label>
                <span
                  className={cn(
                    "font-mono text-[11px] tabular-nums",
                    text.length > MAX_NLP_TEXT_CHARS
                      ? "text-red-400"
                      : "text-zinc-500",
                  )}
                >
                  {text.length.toLocaleString()} /{" "}
                  {MAX_NLP_TEXT_CHARS.toLocaleString()}
                </span>
              </div>
              <Textarea
                id="nlp-ner-text"
                rows={5}
                value={text}
                disabled={isPending}
                onChange={(event) => {
                  setText(event.target.value);
                  if (validationError) {
                    setValidationError(null);
                  }
                }}
                placeholder="Enter English text containing people, organizations, or locations..."
                className="border-white/10 bg-[#141722] text-sm text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setText(NER_EXAMPLE_TEXT);
                  setValidationError(null);
                }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white"
              >
                Load example sentence
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
                    <Tag className="size-4" aria-hidden="true" />
                    Extract Entities
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Extracted Entities
              </CardTitle>
              <p className="text-xs text-zinc-500">
                Entity labels (PER, ORG, LOC, MISC) with exact confidence
                scores.
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
            <div className="space-y-2.5" aria-label="Extracting entities">
              <Skeleton className="h-14 w-full rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-14 w-full rounded-xl bg-white/[0.05]" />
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141722]/50 px-6 py-14 text-center">
              <Tag className="mb-2 size-5 text-zinc-500" aria-hidden="true" />
              <p className="text-sm font-medium text-zinc-300">
                No NER result yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                {available
                  ? "Enter text and click Extract Entities to inspect detected entities."
                  : "Cache the CoNLL-03 NER model locally to enable entity extraction."}
              </p>
            </div>
          ) : result.entities.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141722]/50 px-6 py-12 text-center">
              <p className="text-sm font-medium text-zinc-300">
                No entities detected
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                The model did not detect any PER, ORG, LOC, or MISC entities in
                the submitted text.
              </p>
            </div>
          ) : (
            <ul
              aria-label="Detected named entities"
              className="flex flex-wrap gap-2"
            >
              {result.entities.map((entity, idx) => (
                <li
                  key={`${entity.label}-${entity.text}-${idx}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs",
                    getEntityBadgeTone(entity.label),
                  )}
                >
                  <span className="font-mono text-[10px] font-semibold">
                    {entity.label}
                  </span>
                  <span className="font-medium text-white">{entity.text}</span>
                  <span className="font-mono text-[10px] tabular-nums opacity-85">
                    {formatConfidencePercent(entity.score)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
