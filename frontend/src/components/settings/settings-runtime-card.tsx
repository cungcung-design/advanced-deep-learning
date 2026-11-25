"use client";

import { Cpu, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemoryInfo, RuntimeInfo } from "@/lib/api/types";
import { formatBytes } from "@/lib/evaluation";
import { computeMemoryUsage } from "@/lib/settings";

interface SettingsRuntimeCardProps {
  runtime: RuntimeInfo | undefined;
  memory: MemoryInfo | undefined;
  isLoading: boolean;
}

export function SettingsRuntimeCard({
  runtime,
  memory,
  isLoading,
}: SettingsRuntimeCardProps) {
  const memoryUsage = memory ? computeMemoryUsage(memory) : null;

  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
            <Cpu className="size-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Runtime & Compute Environment
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Read-only backend interpreter, ML stack, and host memory
            </p>
          </div>
        </div>
        {runtime && (
          <Badge
            variant="outline"
            className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
          >
            {runtime.device}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-24 w-full bg-white/[0.05]" />
            <Skeleton className="h-16 w-full bg-white/[0.05]" />
          </div>
        ) : runtime ? (
          <>
            {!runtime.cuda_available && (
              <Alert variant="info">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <AlertTitle>CPU-only execution active</AlertTitle>
                  <AlertDescription>
                    CUDA is not available in this environment. Training,
                    evaluation, and inference run locally on CPU using{" "}
                    {runtime.threads ?? "default"} PyTorch threads.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <dt className="text-zinc-500">Python Version</dt>
                <dd className="mt-1 font-mono text-zinc-200">
                  {runtime.python_version}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <dt className="text-zinc-500">PyTorch Version</dt>
                <dd className="mt-1 font-mono text-zinc-200">
                  {runtime.torch_version ?? "Not reported"}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <dt className="text-zinc-500">Transformers Version</dt>
                <dd className="mt-1 font-mono text-zinc-200">
                  {runtime.transformers_version ?? "Not installed"}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <dt className="text-zinc-500">CUDA Available</dt>
                <dd className="mt-1 font-mono text-zinc-200">
                  {runtime.cuda_available ? "Yes" : "No"}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <dt className="text-zinc-500">CPU Cores / PyTorch Threads</dt>
                <dd className="mt-1 font-mono tabular-nums text-zinc-200">
                  {runtime.cpu_count ?? "Not reported"} cores ·{" "}
                  {runtime.threads ?? "Not reported"} threads
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                <dt className="text-zinc-500">Host Platform</dt>
                <dd className="mt-1 break-words font-mono text-zinc-200">
                  {runtime.platform}
                </dd>
              </div>
            </dl>

            {/* Host Memory */}
            <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-200">Host Memory</span>
                {memoryUsage ? (
                  <span className="font-mono tabular-nums text-zinc-400">
                    {formatBytes(memoryUsage.usedBytes)} used /{" "}
                    {formatBytes(memoryUsage.totalBytes)} total
                  </span>
                ) : (
                  <span className="text-zinc-500">Not reported</span>
                )}
              </div>
              {memoryUsage ? (
                <>
                  <Progress
                    value={memoryUsage.usedPercent}
                    aria-label="Host memory utilization"
                    className="mt-2.5 h-2 bg-white/[0.06]"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="tabular-nums">
                      {memoryUsage.usedPercent.toFixed(1)}% utilized
                    </span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      {formatBytes(memoryUsage.availableBytes)} available
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  The backend did not report host memory totals on this
                  platform.
                </p>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
