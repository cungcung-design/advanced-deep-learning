"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  FolderOpen,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
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
import type {
  DatasetStatistics,
  DatasetSummary,
  ValidationResponse,
} from "@/lib/api/types";
import {
  formatDatasetsApiError,
  formatInputSpec,
  formatSampleCount,
  formatValidationCheckLabel,
  getDatasetWorkspaceLinks,
} from "@/lib/datasets";
import { formatBytes } from "@/lib/evaluation";
import { DatasetStatusBadge } from "./datasets-table";

interface DatasetDetailProps {
  open: boolean;
  dataset: DatasetSummary | null;
  statistics: DatasetStatistics | undefined;
  isLoading: boolean;
  isStatsLoading: boolean;
  error: unknown;
  validationResult: ValidationResponse | null;
  validationError: unknown;
  isValidating: boolean;
  onValidate: (datasetId: string) => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

function CopyablePathRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
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

export function DatasetDetail({
  open,
  dataset,
  statistics,
  isLoading,
  isStatsLoading,
  error,
  validationResult,
  validationError,
  isValidating,
  onValidate,
  onOpenChange,
  onRetry,
}: DatasetDetailProps) {
  const formattedError = error ? formatDatasetsApiError(error) : null;
  const formattedValidationError = validationError
    ? formatDatasetsApiError(validationError)
    : null;
  const workspaceLinks = dataset ? getDatasetWorkspaceLinks(dataset) : [];
  const activeValidation =
    validationResult &&
    dataset &&
    validationResult.dataset_id === dataset.dataset_id
      ? validationResult
      : null;

  const classes = statistics?.classes ?? dataset?.classes ?? [];
  const preprocessingEntries = dataset?.preprocessing
    ? Object.entries(dataset.preprocessing)
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
              {dataset ? dataset.display_name : "Dataset Details"}
            </SheetTitle>
            {dataset && (
              <DatasetStatusBadge
                available={dataset.available}
                status={dataset.status}
              />
            )}
          </div>
          <SheetDescription className="font-mono text-xs text-zinc-400">
            {dataset
              ? `${dataset.dataset_id} · ${dataset.dataset_type ?? "dataset"} · ${(dataset.task ?? "task").replace(/_/g, " ")}`
              : "Inspect dataset splits, metadata, statistics, and validation"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {isLoading && !dataset ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-white/[0.06]" />
              <Skeleton className="h-32 w-full bg-white/[0.06]" />
            </div>
          ) : formattedError && !dataset ? (
            <Alert variant="destructive">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <AlertTitle>{formattedError.title}</AlertTitle>
                <AlertDescription>{formattedError.message}</AlertDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onRetry}
              >
                Retry
              </Button>
            </Alert>
          ) : dataset ? (
            <>
              {dataset.description && (
                <p className="text-xs leading-5 text-zinc-300">
                  {dataset.description}
                </p>
              )}

              {!dataset.available && (
                <Alert variant="warning">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle>Dataset files unavailable locally</AlertTitle>
                    <AlertDescription>
                      This dataset is not ready for local training or
                      evaluation.
                      {dataset.missing_files.length > 0 && (
                        <> Missing: {dataset.missing_files.join(", ")}</>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Metadata grid */}
              <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Source</dt>
                  <dd className="mt-1 break-all font-mono text-zinc-200">
                    {dataset.source ?? "Not reported"}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Input Specification</dt>
                  <dd className="mt-1 font-mono text-zinc-200">
                    {formatInputSpec(dataset.input)}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Local Size</dt>
                  <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                    {formatBytes(
                      statistics?.local_size_bytes ??
                        dataset.local_size_bytes ??
                        null,
                    )}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Local Files</dt>
                  <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                    {statistics?.local_file_count ??
                      dataset.local_file_count ??
                      "Not reported"}
                  </dd>
                </div>
              </dl>

              {/* Authoritative statistics */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Split Statistics
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    From /datasets/{dataset.dataset_id}/statistics
                  </span>
                </div>

                {isStatsLoading ? (
                  <Skeleton className="h-24 w-full bg-white/[0.05]" />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.07] bg-[#141722] p-3">
                      <p className="text-[11px] text-zinc-400">Train Samples</p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                        {formatSampleCount(
                          statistics?.train_size ?? dataset.train_size,
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141722] p-3">
                      <p className="text-[11px] text-zinc-400">Test Samples</p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                        {formatSampleCount(
                          statistics?.test_size ?? dataset.test_size,
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141722] p-3">
                      <p className="text-[11px] text-zinc-400">
                        Train After Val Split
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                        {formatSampleCount(
                          statistics?.expected_train_after_split,
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-[#141722] p-3">
                      <p className="text-[11px] text-zinc-400">
                        Expected Val Split
                        {dataset.val_fraction !== undefined
                          ? ` (${(dataset.val_fraction * 100).toFixed(0)}%)`
                          : ""}
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                        {formatSampleCount(statistics?.expected_val_size)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Class labels */}
              {classes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Classes ({statistics?.num_classes ?? dataset.num_classes ?? classes.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-200"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Preprocessing */}
              {preprocessingEntries.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Preprocessing Configuration
                  </h3>
                  <dl className="grid grid-cols-1 gap-2 rounded-xl border border-white/[0.06] bg-[#141722] p-3 text-xs">
                    {preprocessingEntries.map(([key, val]) => (
                      <div
                        key={key}
                        className="flex flex-wrap items-baseline justify-between gap-2"
                      >
                        <dt className="text-zinc-500">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd className="font-mono text-zinc-200">
                          {Array.isArray(val) ? `[${val.join(", ")}]` : String(val)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <Separator className="bg-white/[0.07]" />

              {/* Live 5-check dataset validation */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="size-4 text-indigo-300"
                      aria-hidden="true"
                    />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Live Dataset Validation
                    </h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onValidate(dataset.dataset_id)}
                    disabled={isValidating}
                    className="bg-indigo-500 text-white hover:bg-indigo-400"
                  >
                    {isValidating ? (
                      <>
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        Validating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Validate dataset
                      </>
                    )}
                  </Button>
                </div>

                {formattedValidationError && (
                  <Alert variant="destructive">
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <AlertTitle>
                        Validation request failed ({formattedValidationError.title})
                      </AlertTitle>
                      <AlertDescription>
                        {formattedValidationError.message} This indicates a
                        request or network error, not an invalid dataset.
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                {activeValidation ? (
                  <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#141722] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-100">
                        Result:{" "}
                        {activeValidation.valid
                          ? "Valid dataset"
                          : "Validation failed"}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          activeValidation.valid
                            ? "border-emerald-500/25 bg-emerald-500/10 font-mono text-[11px] text-emerald-300"
                            : "border-red-500/25 bg-red-500/10 font-mono text-[11px] text-red-300"
                        }
                      >
                        {activeValidation.status}
                      </Badge>
                    </div>

                    <ul
                      aria-label="Dataset validation checks"
                      className="space-y-1.5"
                    >
                      {activeValidation.checks.map((check) => (
                        <li
                          key={check.name}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-[#10121A] px-3 py-2 text-xs"
                        >
                          <span className="text-zinc-200">
                            {formatValidationCheckLabel(check.name)}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              check.passed
                                ? "border-emerald-500/25 bg-emerald-500/10 text-[11px] text-emerald-300"
                                : "border-red-500/25 bg-red-500/10 text-[11px] text-red-300"
                            }
                          >
                            {check.passed ? (
                              <CheckCircle2
                                className="mr-1 size-3"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle
                                className="mr-1 size-3"
                                aria-hidden="true"
                              />
                            )}
                            {check.passed ? "Pass" : "Fail"}
                          </Badge>
                        </li>
                      ))}
                    </ul>

                    {activeValidation.missing_files.length > 0 && (
                      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        Missing files:{" "}
                        <span className="font-mono">
                          {activeValidation.missing_files.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Run live validation via{" "}
                    <code className="font-mono text-[11px] text-zinc-400">
                      POST /api/v1/datasets/validate
                    </code>{" "}
                    to verify all five local dataset checks without downloading
                    files.
                  </p>
                )}
              </div>

              <Separator className="bg-white/[0.07]" />

              {/* Copyable local paths */}
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
                  Local paths reported by the backend. Copy-only; no browser
                  folder-opening, deletion, or download actions are exposed.
                </p>
                <div className="space-y-2">
                  <CopyablePathRow
                    label="Dataset Local Path"
                    value={dataset.local_path}
                  />
                  <CopyablePathRow
                    label="Config Path"
                    value={dataset.config_path}
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.07]" />

              {/* Workspace navigation */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Workspace Navigation
                </h3>
                {workspaceLinks.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Training and evaluation navigation is disabled while this
                    dataset is unavailable locally.
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
