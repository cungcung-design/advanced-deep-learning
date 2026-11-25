"use client";

import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DatasetSummary } from "@/lib/api/types";
import { formatInputSpec, formatSampleCount } from "@/lib/datasets";
import { formatBytes } from "@/lib/evaluation";
import { cn } from "@/lib/utils";
import { DatasetStatusBadge } from "./datasets-table";

interface DatasetsCardProps {
  dataset: DatasetSummary;
  isSelected: boolean;
  onSelect: (dataset: DatasetSummary) => void;
}

export function DatasetsCard({
  dataset,
  isSelected,
  onSelect,
}: DatasetsCardProps) {
  return (
    <Card
      className={cn(
        "min-w-0 border-white/[0.07] bg-[#11131A] shadow-none transition-colors",
        isSelected && "border-indigo-400/35 bg-indigo-500/[0.06]",
      )}
    >
      <CardContent className="space-y-3.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-zinc-100">
              {dataset.display_name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
              {dataset.dataset_id}
            </p>
          </div>
          <DatasetStatusBadge
            available={dataset.available}
            status={dataset.status}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {dataset.dataset_type && (
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-300"
            >
              {dataset.dataset_type}
            </Badge>
          )}
          {dataset.task && (
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-[10px] text-zinc-400"
            >
              {dataset.task.replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-[#141722] p-3 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500">Train / Test</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatSampleCount(dataset.train_size)} /{" "}
              {formatSampleCount(dataset.test_size)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Input Spec</p>
            <p className="mt-0.5 font-mono text-zinc-200">
              {formatInputSpec(dataset.input)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Classes</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-300">
              {dataset.num_classes ?? "Not reported"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Local Storage</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-300">
              {formatBytes(dataset.local_size_bytes ?? null)}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(dataset)}
          className="w-full border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
        >
          <Eye className="size-3.5" aria-hidden="true" />
          Inspect & validate
        </Button>
      </CardContent>
    </Card>
  );
}
