"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Copy,
  FolderOpen,
} from "lucide-react";
import { TrainingStatusBadge } from "@/components/training/training-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { Evaluation, RegistryModelSummary } from "@/lib/api/types";
import { formatBytes, formatMetricScore } from "@/lib/evaluation";
import {
  formatRegistryApiError,
  getCompatibleWorkspaceLinks,
  getRegistryModelSource,
  getRelatedEvaluations,
} from "@/lib/registry";
import { formatTimestamp } from "@/lib/training";
import { RegistryStatusBadge } from "./registry-table";

interface RegistryDetailProps {
  open: boolean;
  model: RegistryModelSummary | null;
  isLoading: boolean;
  error: unknown;
  evaluations: readonly Evaluation[];
  evaluationsLimit: number;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
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
          {value && value.length > 0 ? value : "Not reported"}
        </p>
      </div>
      {value && value.length > 0 && (
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

export function RegistryDetail({
  open,
  model,
  isLoading,
  error,
  evaluations,
  evaluationsLimit,
  onOpenChange,
  onRetry,
}: RegistryDetailProps) {
  const formattedError = error ? formatRegistryApiError(error) : null;
  const source = model ? getRegistryModelSource(model) : null;
  const workspaceLinks = model ? getCompatibleWorkspaceLinks(model) : [];
  const relatedEvaluations = model
    ? getRelatedEvaluations(evaluations, model.model_id)
    : [];

  const metricsRows = model
    ? [
        {
          label: "Accuracy",
          value: formatMetricScore(model.metrics?.accuracy ?? null),
          hasValue: (model.metrics?.accuracy ?? null) !== null,
        },
        {
          label: "Macro F1",
          value: formatMetricScore(model.metrics?.macro_f1 ?? null),
          hasValue: (model.metrics?.macro_f1 ?? null) !== null,
        },
        {
          label: "Macro Precision",
          value: formatMetricScore(model.metrics?.macro_precision ?? null),
          hasValue: (model.metrics?.macro_precision ?? null) !== null,
        },
        {
          label: "Macro Recall",
          value: formatMetricScore(model.metrics?.macro_recall ?? null),
          hasValue: (model.metrics?.macro_recall ?? null) !== null,
        },
      ]
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/10 bg-[#11131A] p-0 text-zinc-100 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/[0.07] px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-white">
              {model ? model.display_name : "Model Registry Detail"}
            </SheetTitle>
            {model && (
              <RegistryStatusBadge
                available={model.available}
                status={model.status}
              />
            )}
          </div>
          <SheetDescription className="font-mono text-xs text-zinc-400">
            {model
              ? `${model.model_id} · ${model.architecture} · ${model.task}`
              : "Inspect checkpoint metadata, metrics, and local paths"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {isLoading && !model ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-white/[0.06]" />
              <Skeleton className="h-32 w-full bg-white/[0.06]" />
            </div>
          ) : formattedError && !model ? (
            <Alert variant="destructive">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <AlertTitle>{formattedError.title}</AlertTitle>
                <AlertDescription>{formattedError.message}</AlertDescription>
              </div>
              <Button type="button" variant="outline" size="xs" onClick={onRetry}>
                Retry
              </Button>
            </Alert>
          ) : model ? (
            <>
              {!model.available && (
                <Alert variant={model.status === "invalid" ? "destructive" : "warning"}>
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle>
                      Checkpoint {model.status === "invalid" ? "invalid" : "missing"}
                    </AlertTitle>
                    <AlertDescription>
                      {model.error ??
                        "This model's local checkpoint file is not available. It cannot be used for inference or evaluation until restored."}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Metadata summary */}
              <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Model ID</dt>
                  <dd className="mt-1 break-all font-mono text-zinc-200">
                    {model.model_id}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Source</dt>
                  <dd className="mt-1">
                    <Badge
                      variant="outline"
                      className={
                        source === "trained_job"
                          ? "border-indigo-400/25 bg-indigo-500/10 text-[11px] text-indigo-300"
                          : "border-white/10 bg-white/[0.04] text-[11px] text-zinc-300"
                      }
                    >
                      {source === "trained_job"
                        ? "Trained Job Artifact"
                        : "Fixed Catalog"}
                    </Badge>
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Architecture</dt>
                  <dd className="mt-1 font-mono text-zinc-200">
                    {model.architecture}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Checkpoint Size</dt>
                  <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                    {formatBytes(model.checkpoint_size_bytes)}
                  </dd>
                </div>
              </dl>

              {/* Registry metrics */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Registry Reported Metrics
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    From registry metadata
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {metricsRows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-white/[0.07] bg-[#141722] p-3.5"
                    >
                      <p className="text-[11px] text-zinc-400">{row.label}</p>
                      <p
                        className={`mt-1.5 font-mono text-base font-semibold tabular-nums ${
                          row.hasValue
                            ? "text-zinc-100"
                            : "text-xs font-normal text-zinc-500"
                        }`}
                      >
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-white/[0.07]" />

              {/* Artifact paths */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <FolderOpen
                    className="size-3.5 text-zinc-400"
                    aria-hidden="true"
                  />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Local Filesystem References
                  </h3>
                </div>
                <p className="text-xs text-zinc-500">
                  These are local filesystem paths reported by the backend
                  registry. No browser download or filesystem-open endpoint is
                  exposed.
                </p>
                <div className="space-y-2">
                  <CopyablePathRow
                    label="Checkpoint Path"
                    value={model.artifact_path ?? null}
                  />
                  <CopyablePathRow
                    label="Config Path"
                    value={model.config_path ?? null}
                  />
                  <CopyablePathRow
                    label="Evaluation / Metrics Path"
                    value={model.evaluation_path ?? null}
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.07]" />

              {/* Related evaluations */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Related Evaluation Records ({relatedEvaluations.length})
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    Scoped to latest {evaluationsLimit} loaded evaluations
                  </span>
                </div>

                {relatedEvaluations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 bg-[#141722]/50 px-4 py-5 text-center text-xs text-zinc-500">
                    No matching evaluation runs found in the latest{" "}
                    {evaluationsLimit} loaded evaluation records.
                  </p>
                ) : (
                  <ul
                    aria-label="Related evaluation records"
                    className="space-y-2"
                  >
                    {relatedEvaluations.map((ev) => (
                      <li
                        key={ev.evaluation_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#141722] px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-zinc-200">
                            {ev.evaluation_id}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {ev.dataset} · {formatTimestamp(ev.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-zinc-200">
                            {formatMetricScore(ev.metrics.accuracy)}
                          </span>
                          <TrainingStatusBadge state={ev.state} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator className="bg-white/[0.07]" />

              {/* Compatible workspaces */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Workspace Navigation
                </h3>
                {workspaceLinks.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No inference or evaluation actions are available while this
                    model&apos;s checkpoint is unavailable locally.
                  </p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {workspaceLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#141722] p-3.5 transition hover:border-indigo-400/35 hover:bg-indigo-500/[0.08]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-100 group-hover:text-white">
                            {link.label}
                          </span>
                          <ArrowUpRight
                            className="size-3.5 text-zinc-400 group-hover:text-indigo-300"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                          {link.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
