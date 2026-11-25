"use client";

import { AlertTriangle, CheckCircle2, Database, HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DatasetSummaryStats } from "@/lib/datasets";
import { formatSampleCount } from "@/lib/datasets";
import { formatBytes } from "@/lib/evaluation";

interface DatasetsSummaryProps {
  stats: DatasetSummaryStats;
  isLoading: boolean;
}

export function DatasetsSummary({ stats, isLoading }: DatasetsSummaryProps) {
  const cards = [
    {
      label: "REGISTERED DATASETS",
      value: String(stats.total),
      detail: `${formatSampleCount(stats.totalSamples)} total train + test samples`,
      icon: Database,
      accent: "bg-indigo-500/10 text-indigo-300",
    },
    {
      label: "AVAILABLE LOCALLY",
      value: String(stats.available),
      detail: "Verified local dataset files",
      icon: CheckCircle2,
      accent: "bg-emerald-500/10 text-emerald-400",
    },
    {
      label: "UNAVAILABLE",
      value: String(stats.unavailable),
      detail:
        stats.unavailable === 0
          ? "All datasets present locally"
          : "Missing local files",
      icon: AlertTriangle,
      accent:
        stats.unavailable > 0
          ? "bg-amber-500/10 text-amber-400"
          : "bg-zinc-500/10 text-zinc-400",
    },
    {
      label: "LOCAL DATASET STORAGE",
      value: stats.totalSizeBytes > 0 ? formatBytes(stats.totalSizeBytes) : "—",
      detail: `${stats.totalFiles} local files reported`,
      icon: HardDrive,
      accent: "bg-sky-500/10 text-sky-400",
    },
  ];

  return (
    <section
      aria-label="Datasets summary"
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
                  <Skeleton className="mt-2 h-8 w-20 bg-white/[0.06]" />
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
