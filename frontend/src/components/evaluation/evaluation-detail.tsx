"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, FolderOpen, Square } from "lucide-react";
import { TrainingLogs } from "@/components/training/training-logs";
import { TrainingStatusBadge } from "@/components/training/training-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Evaluation,
  EvaluationPreset,
  EvaluationResults,
} from "@/lib/api/types";
import type { UseEvaluationLogsResult } from "@/lib/api/queries/evaluations";
import {
  formatEvaluationApiError,
  formatMetricScore,
  getEvaluationDisplayName,
  isCancellableEvaluation,
} from "@/lib/evaluation";
import { formatDuration, formatTimestamp } from "@/lib/training";
import { EvaluationConfusionMatrix } from "./evaluation-confusion-matrix";
import { EvaluationPerClassTable } from "./evaluation-per-class-table";
import { EvaluationProgress } from "./evaluation-progress";

interface EvaluationDetailProps {
  open: boolean;
  evaluation: Evaluation | null;
  isLoading: boolean;
  error: unknown;
  results: EvaluationResults | undefined;
  resultsLoading: boolean;
  resultsError: unknown;
  presets?: readonly EvaluationPreset[];
  logs: UseEvaluationLogsResult;
  isCancelling: boolean;
  onOpenChange: (open: boolean) => void;
  onRetryEvaluation: () => void;
  onRetryResults: () => void;
  onRequestCancel: (evaluation: Evaluation) => void;
}

function CopyablePathRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable
    }
  };

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#10121A] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-zinc-400">{label}</p>
        <p className="mt-0.5 break-all font-mono text-xs text-zinc-200">
          {value ?? "Not reported"}
        </p>
      </div>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className="shrink-0 text-zinc-400 hover:text-zinc-100"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
}

export function EvaluationDetail({
  open,
  evaluation,
  isLoading,
  error,
  results,
  resultsLoading,
  resultsError,
  presets,
  logs,
  isCancelling,
  onOpenChange,
  onRetryEvaluation,
  onRetryResults,
  onRequestCancel,
}: EvaluationDetailProps) {
  const formattedError = error ? formatEvaluationApiError(error) : null;
  const formattedResultsError = resultsError
    ? formatEvaluationApiError(resultsError)
    : null;
  const cancellable = evaluation ? isCancellableEvaluation(evaluation) : false;

  const summaryMetrics = evaluation
    ? [
        { label: "Accuracy", value: formatMetricScore(evaluation.metrics.accuracy), hasValue: evaluation.metrics.accuracy !== null },
        { label: "Macro Precision", value: formatMetricScore(evaluation.metrics.macro_precision), hasValue: evaluation.metrics.macro_precision !== null },
        { label: "Macro Recall", value: formatMetricScore(evaluation.metrics.macro_recall), hasValue: evaluation.metrics.macro_recall !== null },
        { label: "Macro F1", value: formatMetricScore(evaluation.metrics.macro_f1), hasValue: evaluation.metrics.macro_f1 !== null },
      ]
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/10 bg-[#11131A] p-0 text-zinc-100 sm:max-w-3xl"
      >
        <SheetHeader className="border-b border-white/[0.07] px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-white">
              {evaluation
                ? getEvaluationDisplayName(evaluation.model, presets)
                : "Evaluation Detail"}
            </SheetTitle>
            {evaluation && (
              <TrainingStatusBadge
                state={evaluation.state}
                cancelRequested={evaluation.cancel_requested}
              />
            )}
          </div>
          <SheetDescription className="font-mono text-xs text-zinc-400">
            {evaluation
              ? `${evaluation.evaluation_id} · ${evaluation.dataset} · ${evaluation.architecture}`
              : "Inspect evaluation progress, metrics, confusion matrix, and logs"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {isLoading && !evaluation ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-white/[0.06]" />
              <Skeleton className="h-32 w-full bg-white/[0.06]" />
            </div>
          ) : formattedError && !evaluation ? (
            <Alert variant="destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <AlertTitle>{formattedError.title}</AlertTitle>
                <AlertDescription>{formattedError.message}</AlertDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onRetryEvaluation}
              >
                Retry
              </Button>
            </Alert>
          ) : evaluation ? (
            <>
              {cancellable && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                  <p className="text-xs text-amber-200">
                    {evaluation.cancel_requested
                      ? "Cancellation has been requested for this evaluation."
                      : "This evaluation is active and supports cancellation."}
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    disabled={isCancelling || evaluation.cancel_requested}
                    onClick={() => onRequestCancel(evaluation)}
                  >
                    <Square className="size-3" aria-hidden="true" />
                    {isCancelling ? "Cancelling..." : "Cancel evaluation"}
                  </Button>
                </div>
              )}

              {evaluation.error && (
                <Alert variant="destructive">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle className="font-mono text-xs">
                      {evaluation.error.code}
                    </AlertTitle>
                    <AlertDescription>{evaluation.error.message}</AlertDescription>
                  </div>
                </Alert>
              )}

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-[#171A24]">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="metrics">Per-Class</TabsTrigger>
                  <TabsTrigger value="matrix">Matrix</TabsTrigger>
                  <TabsTrigger value="logs">
                    Logs ({logs.lines.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-5">
                  <EvaluationProgress evaluation={evaluation} />

                  {/* Summary metrics */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Evaluation Summary Metrics
                      </h3>
                      <span className="text-[11px] text-zinc-500">
                        Held-out test split
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {summaryMetrics.map((metric) => (
                        <div
                          key={metric.label}
                          className="rounded-xl border border-white/[0.07] bg-[#141722] p-3.5"
                        >
                          <p className="text-[11px] text-zinc-400">
                            {metric.label}
                          </p>
                          <p
                            className={`mt-1.5 font-mono text-base font-semibold tabular-nums ${
                              metric.hasValue
                                ? "text-zinc-100"
                                : "text-xs font-normal text-zinc-500"
                            }`}
                          >
                            {metric.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-white/[0.07]" />

                  {/* Run metadata */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Run Metadata
                    </h3>
                    <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Evaluation ID</dt>
                        <dd className="mt-1 break-all font-mono text-zinc-200">
                          {evaluation.evaluation_id}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Model & Architecture</dt>
                        <dd className="mt-1 font-mono text-zinc-200">
                          {evaluation.model} ({evaluation.architecture})
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Dataset & Task</dt>
                        <dd className="mt-1 font-mono text-zinc-200">
                          {evaluation.dataset} · {evaluation.task}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Execution Device</dt>
                        <dd className="mt-1 font-mono text-zinc-200">
                          {evaluation.device ?? "Not reported"}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Elapsed Time</dt>
                        <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                          {formatDuration(evaluation.elapsed_seconds)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Created At</dt>
                        <dd className="mt-1 text-zinc-200">
                          {formatTimestamp(evaluation.created_at)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Started At</dt>
                        <dd className="mt-1 text-zinc-200">
                          {formatTimestamp(evaluation.started_at)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Completed At</dt>
                        <dd className="mt-1 text-zinc-200">
                          {formatTimestamp(evaluation.completed_at)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Relative artifact paths */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FolderOpen
                        className="size-3.5 text-zinc-400"
                        aria-hidden="true"
                      />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Source Checkpoint & Relative Artifact Paths
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <CopyablePathRow
                        label="Source Checkpoint"
                        value={evaluation.source_checkpoint}
                      />
                      <CopyablePathRow
                        label="Artifact Directory"
                        value={evaluation.artifact_dir}
                      />
                      <CopyablePathRow
                        label="Results Path"
                        value={evaluation.results_path}
                      />
                      <CopyablePathRow
                        label="Metrics Path"
                        value={evaluation.metrics_path}
                      />
                      <CopyablePathRow
                        label="Metadata Path"
                        value={evaluation.metadata_path}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="metrics" className="mt-4">
                  {evaluation.state !== "SUCCEEDED" ? (
                    <Alert>
                      <AlertTitle>Classification metrics not available</AlertTitle>
                      <AlertDescription>
                        Per-class precision, recall, F1, and support are reported
                        only after an evaluation reaches SUCCEEDED.
                      </AlertDescription>
                    </Alert>
                  ) : resultsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full bg-white/[0.06]" />
                      <Skeleton className="h-40 w-full bg-white/[0.06]" />
                    </div>
                  ) : formattedResultsError ? (
                    <Alert variant="destructive">
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <AlertTitle>{formattedResultsError.title}</AlertTitle>
                        <AlertDescription>
                          {formattedResultsError.message}
                        </AlertDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={onRetryResults}
                      >
                        Retry
                      </Button>
                    </Alert>
                  ) : results ? (
                    <EvaluationPerClassTable results={results} />
                  ) : null}
                </TabsContent>

                <TabsContent value="matrix" className="mt-4">
                  {evaluation.state !== "SUCCEEDED" ? (
                    <Alert>
                      <AlertTitle>Confusion matrix not available</AlertTitle>
                      <AlertDescription>
                        The confusion matrix is available only after an
                        evaluation reaches SUCCEEDED.
                      </AlertDescription>
                    </Alert>
                  ) : resultsLoading ? (
                    <Skeleton className="h-64 w-full bg-white/[0.06]" />
                  ) : formattedResultsError ? (
                    <Alert variant="destructive">
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <AlertTitle>{formattedResultsError.title}</AlertTitle>
                        <AlertDescription>
                          {formattedResultsError.message}
                        </AlertDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={onRetryResults}
                      >
                        Retry
                      </Button>
                    </Alert>
                  ) : results ? (
                    <EvaluationConfusionMatrix results={results} />
                  ) : null}
                </TabsContent>

                <TabsContent value="logs" className="mt-4">
                  <TrainingLogs
                    lines={logs.lines}
                    totalLines={logs.totalLines}
                    complete={logs.complete}
                    isLoading={logs.isLoading}
                    isFetching={logs.isFetching}
                    error={logs.error}
                    onRefresh={() => {
                      void logs.refetch();
                    }}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
