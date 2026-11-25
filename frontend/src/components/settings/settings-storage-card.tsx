"use client";

import { useState } from "react";
import { Check, Copy, FolderOpen, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { StorageInfo } from "@/lib/api/types";
import { formatBytes } from "@/lib/evaluation";
import { computeDiskUsage } from "@/lib/settings";

interface SettingsStorageCardProps {
  storage: StorageInfo | undefined;
  isLoading: boolean;
}

function CopyableStoragePath({
  label,
  path,
  bytes,
  files,
}: {
  label: string;
  path: string;
  bytes: number;
  files: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!path) {
      return;
    }
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-zinc-200">{label}</p>
            <span className="font-mono text-[11px] tabular-nums text-zinc-400">
              {formatBytes(bytes)} · {files} {files === 1 ? "file" : "files"}
            </span>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-zinc-400">
            {path || "Not reported"}
          </p>
        </div>
        {path && (
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
    </div>
  );
}

export function SettingsStorageCard({
  storage,
  isLoading,
}: SettingsStorageCardProps) {
  const diskUsage = storage ? computeDiskUsage(storage) : null;

  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
            <HardDrive className="size-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Local Storage & Filesystem Paths
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Backend-reported artifact and dataset directories
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-400">
          <FolderOpen
            className="mt-0.5 size-3.5 shrink-0 text-zinc-500"
            aria-hidden="true"
          />
          <p>
            Paths below are local backend filesystem references. No browser
            folder-opening or file deletion endpoints are exposed.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-16 w-full bg-white/[0.05]" />
            <Skeleton className="h-16 w-full bg-white/[0.05]" />
            <Skeleton className="h-16 w-full bg-white/[0.05]" />
          </div>
        ) : storage ? (
          <>
            <div className="space-y-2.5">
              <CopyableStoragePath
                label="Artifact Root Path"
                path={storage.artifact_root}
                bytes={storage.artifact_bytes}
                files={storage.artifact_files}
              />
              <CopyableStoragePath
                label="Data Root Path"
                path={storage.data_root}
                bytes={storage.data_bytes}
                files={storage.data_files}
              />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-200">
                  Host Volume Capacity
                </span>
                {diskUsage ? (
                  <span className="font-mono tabular-nums text-zinc-400">
                    {formatBytes(diskUsage.availableBytes)} free /{" "}
                    {formatBytes(diskUsage.totalBytes)} total
                  </span>
                ) : (
                  <span className="text-zinc-500">Not reported</span>
                )}
              </div>
              {diskUsage ? (
                <>
                  <Progress
                    value={diskUsage.usedPercent}
                    aria-label="Host disk utilization"
                    className="mt-2.5 h-2 bg-white/[0.06]"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="tabular-nums">
                      {diskUsage.usedPercent.toFixed(1)}% volume used
                    </span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      {formatBytes(diskUsage.usedBytes)} used
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Disk usage telemetry was not reported by the backend.
                </p>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
