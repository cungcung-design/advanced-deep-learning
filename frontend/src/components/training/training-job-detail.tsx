"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  FolderOpen,
  Square,
} from "lucide-react";
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
import type { TrainingJob, TrainingPreset } from "@/lib/api/types";
import type { UseTrainingJobLogsResult } from "@/lib/api/queries/training";
import {
  formatDuration,
  formatTimestamp,
  formatTrainingApiError,
  getPresetByModel,
  isCancellableJob,
} from "@/lib/training";
import { TrainingLogs } from "./training-logs";
import { TrainingMetricsPanel } from "./training-metrics";
import { TrainingProgress } from "./training-progress";
import { TrainingStatusBadge } from "./training-status-badge";

interface TrainingJobDetailProps {
  open: boolean;
  job: TrainingJob | null;
  isLoading: boolean;
  error: unknown;
  presets?: readonly TrainingPreset[];
  logs: UseTrainingJobLogsResult;
  isCancelling: boolean;
  onOpenChange: (open: boolean) => void;
  onRetryJob: () => void;
  onRequestCancel: (job: TrainingJob) => void;
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

export function TrainingJobDetail({
  open,
  job,
  isLoading,
  error,
  presets,
  logs,
  isCancelling,
  onOpenChange,
  onRetryJob,
  onRequestCancel,
}: TrainingJobDetailProps) {
  const preset = job ? getPresetByModel(job.model, presets) : undefined;
  const formattedError = error ? formatTrainingApiError(error) : null;
  const cancellable = job ? isCancellableJob(job) : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/10 bg-[#11131A] p-0 text-zinc-100 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/[0.07] px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-white">
              {job ? (preset?.display_name ?? job.model) : "Training Job Detail"}
            </SheetTitle>
            {job && (
              <TrainingStatusBadge
                state={job.state}
                cancelRequested={job.cancel_requested}
              />
            )}
          </div>
          <SheetDescription className="font-mono text-xs text-zinc-400">
            {job ? `${job.job_id} · ${job.dataset}` : "Inspect job metadata and logs"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {isLoading && !job ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-white/[0.06]" />
              <Skeleton className="h-32 w-full bg-white/[0.06]" />
            </div>
          ) : formattedError && !job ? (
            <Alert variant="destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <AlertTitle>{formattedError.title}</AlertTitle>
                <AlertDescription>{formattedError.message}</AlertDescription>
              </div>
              <Button type="button" variant="outline" size="xs" onClick={onRetryJob}>
                Retry
              </Button>
            </Alert>
          ) : job ? (
            <>
              {cancellable && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                  <p className="text-xs text-amber-200">
                    {job.cancel_requested
                      ? "Cancellation has been requested for this job."
                      : "This job is active and supports cancellation."}
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    disabled={isCancelling || job.cancel_requested}
                    onClick={() => onRequestCancel(job)}
                  >
                    <Square className="size-3" aria-hidden="true" />
                    {isCancelling ? "Cancelling..." : "Cancel job"}
                  </Button>
                </div>
              )}

              {job.error && (
                <Alert variant="destructive">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle className="font-mono text-xs">
                      {job.error.code}
                    </AlertTitle>
                    <AlertDescription>{job.error.message}</AlertDescription>
                  </div>
                </Alert>
              )}

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full bg-[#171A24]">
                  <TabsTrigger value="overview" className="flex-1">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="flex-1">
                    Logs ({logs.lines.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-5">
                  <TrainingProgress job={job} />

                  <TrainingMetricsPanel metrics={job.metrics} />

                  <Separator className="bg-white/[0.07]" />

                  {/* Run metadata */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Run Metadata
                    </h3>
                    <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Job ID</dt>
                        <dd className="mt-1 break-all font-mono text-zinc-200">
                          {job.job_id}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Model & Architecture</dt>
                        <dd className="mt-1 font-mono text-zinc-200">
                          {job.model}
                          {preset ? ` (${preset.architecture})` : ""}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Dataset</dt>
                        <dd className="mt-1 font-mono text-zinc-200">
                          {job.dataset}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Execution Device</dt>
                        <dd className="mt-1 font-mono text-zinc-200">
                          {job.device ?? "Not reported"}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Elapsed Time</dt>
                        <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                          {formatDuration(job.elapsed_seconds)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Queue Position</dt>
                        <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                          {job.queue_position !== null
                            ? `#${job.queue_position}`
                            : "Not queued"}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Created At</dt>
                        <dd className="mt-1 text-zinc-200">
                          {formatTimestamp(job.created_at)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                        <dt className="text-zinc-500">Started At</dt>
                        <dd className="mt-1 text-zinc-200">
                          {formatTimestamp(job.started_at)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3 sm:col-span-2">
                        <dt className="text-zinc-500">Completed At</dt>
                        <dd className="mt-1 text-zinc-200">
                          {formatTimestamp(job.completed_at)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Preset / configuration summary */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Preset & Configuration
                    </h3>
                    <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3.5 text-xs text-zinc-300">
                      <p>
                        Preset:{" "}
                        <span className="font-medium text-zinc-100">
                          {preset?.display_name ?? job.model}
                        </span>{" "}
                        · Configured epochs:{" "}
                        <span className="font-mono text-zinc-100">
                          {job.total_epochs}
                        </span>
                      </p>
                      <p className="mt-1 text-zinc-500">
                        Resolved hyperparameters are persisted by the backend in{" "}
                        <span className="font-mono text-zinc-400">
                          config.json
                        </span>
                        .
                      </p>
                    </div>
                  </div>

                  {/* Artifact paths */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FolderOpen
                        className="size-3.5 text-zinc-400"
                        aria-hidden="true"
                      />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Assigned Local Paths
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Paths are assigned when a job is created. An assigned
                      checkpoint path does not guarantee the file exists on disk
                      until the job succeeds.
                    </p>
                    <div className="space-y-2">
                      <CopyablePathRow
                        label="Artifact Directory"
                        value={job.artifact_dir}
                      />
                      <CopyablePathRow
                        label="Checkpoint Path"
                        value={job.checkpoint_path}
                      />
                      <CopyablePathRow
                        label="Config Path"
                        value={job.config_path}
                      />
                      <CopyablePathRow
                        label="Metrics Path"
                        value={job.metrics_path}
                      />
                      <CopyablePathRow
                        label="History Path"
                        value={job.history_path}
                      />
                      <CopyablePathRow
                        label="Metadata Path"
                        value={job.metadata_path}
                      />
                    </div>
                  </div>
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
