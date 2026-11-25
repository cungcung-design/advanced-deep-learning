"use client";

import { Activity, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  HealthResponse,
  ReadinessResponse,
  SettingsResponse,
} from "@/lib/api/types";
import { formatBytes } from "@/lib/evaluation";
import {
  computeDiskUsage,
  computeMemoryUsage,
  isReadinessHealthy,
} from "@/lib/settings";

interface SettingsSummaryProps {
  health: HealthResponse | undefined;
  readiness: ReadinessResponse | undefined;
  settings: SettingsResponse | undefined;
  isLoading: boolean;
}

export function SettingsSummary({
  health,
  readiness,
  settings,
  isLoading,
}: SettingsSummaryProps) {
  const ready = isReadinessHealthy(readiness);
  const memoryUsage = settings ? computeMemoryUsage(settings.memory) : null;
  const diskUsage = settings ? computeDiskUsage(settings.storage) : null;
  const totalManagedBytes = settings
    ? settings.storage.artifact_bytes + settings.storage.data_bytes
    : null;

  const cards = [
    {
      label: "API & READINESS",
      value: health
        ? ready
          ? "Ready"
          : readiness
            ? "Degraded"
            : "Online"
        : "Unavailable",
      detail: health
        ? `${health.app} · v${health.version}`
        : "Waiting for backend response",
      icon: Activity,
      accent: ready
        ? "bg-emerald-500/10 text-emerald-400"
        : readiness
          ? "bg-amber-500/10 text-amber-400"
          : "bg-zinc-500/10 text-zinc-400",
    },
    {
      label: "COMPUTE DEVICE",
      value: settings ? settings.runtime.device.toUpperCase() : "—",
      detail: settings
        ? `${settings.runtime.cpu_count ?? "?"} cores · ${settings.runtime.threads ?? "?"} PyTorch threads`
        : "Runtime diagnostics",
      icon: Cpu,
      accent: settings?.runtime.cuda_available
        ? "bg-emerald-500/10 text-emerald-400"
        : "bg-indigo-500/10 text-indigo-300",
    },
    {
      label: "HOST MEMORY",
      value: memoryUsage ? formatBytes(memoryUsage.availableBytes) : "Not reported",
      detail: memoryUsage
        ? `Free of ${formatBytes(memoryUsage.totalBytes)} (${memoryUsage.usedPercent.toFixed(0)}% used)`
        : "Memory telemetry unavailable",
      icon: MemoryStick,
      accent: "bg-violet-500/10 text-violet-300",
    },
    {
      label: "LOCAL WORKSPACE DATA",
      value:
        totalManagedBytes !== null ? formatBytes(totalManagedBytes) : "—",
      detail: diskUsage
        ? `${formatBytes(diskUsage.availableBytes)} disk free`
        : "Artifacts + datasets combined",
      icon: HardDrive,
      accent: "bg-sky-500/10 text-sky-400",
    },
  ];

  return (
    <section
      aria-label="System diagnostics summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none"
          >
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wider text-zinc-400">
                  {card.label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-8 w-24 bg-white/[0.06]" />
                ) : (
                  <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
                    {card.value}
                  </p>
                )}
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {card.detail}
                </p>
              </div>
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.accent}`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
