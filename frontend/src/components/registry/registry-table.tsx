"use client";

import { AlertTriangle, CheckCircle2, Eye, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RegistryModelSummary } from "@/lib/api/types";
import { formatBytes, formatMetricScore } from "@/lib/evaluation";
import { getRegistryModelSource } from "@/lib/registry";
import { cn } from "@/lib/utils";

interface RegistryTableProps {
  models: RegistryModelSummary[];
  selectedModelId: string | null;
  onSelect: (model: RegistryModelSummary) => void;
}

export function RegistryStatusBadge({
  available,
  status,
}: {
  available: boolean;
  status: string;
}) {
  if (available && status === "available") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/25 bg-emerald-500/10 font-mono text-[11px] text-emerald-300"
      >
        <CheckCircle2 className="size-3" aria-hidden="true" />
        available
      </Badge>
    );
  }
  if (status === "invalid") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-red-500/25 bg-red-500/10 font-mono text-[11px] text-red-300"
      >
        <AlertTriangle className="size-3" aria-hidden="true" />
        invalid
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-500/25 bg-amber-500/10 font-mono text-[11px] text-amber-300"
    >
      <XCircle className="size-3" aria-hidden="true" />
      missing
    </Badge>
  );
}

export function RegistryTable({
  models,
  selectedModelId,
  onSelect,
}: RegistryTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11131A] lg:block">
      <Table aria-label="Registered models">
        <TableHeader>
          <TableRow className="border-white/[0.07] hover:bg-transparent">
            <TableHead className="px-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Model / ID
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Source
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Architecture / Task
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Status
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Size
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Accuracy
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Macro F1
            </TableHead>
            <TableHead className="px-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => {
            const isSelected = model.model_id === selectedModelId;
            const source = getRegistryModelSource(model);

            return (
              <TableRow
                key={model.model_id}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => onSelect(model)}
                className={cn(
                  "cursor-pointer border-white/[0.06] transition-colors hover:bg-white/[0.03]",
                  isSelected && "bg-indigo-500/[0.08]",
                )}
              >
                <TableCell className="max-w-[260px] px-3.5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">
                      {model.display_name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                      {model.model_id}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <Badge
                    variant="outline"
                    className={
                      source === "trained_job"
                        ? "border-indigo-400/25 bg-indigo-500/10 text-[11px] text-indigo-300"
                        : "border-white/10 bg-white/[0.04] text-[11px] text-zinc-300"
                    }
                  >
                    {source === "trained_job" ? "Trained Job" : "Catalog"}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-zinc-200">
                      {model.architecture}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {model.task.replace(/_/g, " ")}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <RegistryStatusBadge
                    available={model.available}
                    status={model.status}
                  />
                </TableCell>
                <TableCell className="px-3 py-3.5 font-mono text-xs tabular-nums text-zinc-300">
                  {formatBytes(model.checkpoint_size_bytes)}
                </TableCell>
                <TableCell className="px-3 py-3.5 font-mono text-xs tabular-nums text-zinc-200">
                  {formatMetricScore(model.metrics?.accuracy ?? null)}
                </TableCell>
                <TableCell className="px-3 py-3.5 font-mono text-xs tabular-nums text-zinc-300">
                  {formatMetricScore(model.metrics?.macro_f1 ?? null)}
                </TableCell>
                <TableCell
                  className="px-3.5 py-3.5 text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onSelect(model)}
                    aria-label={`Inspect model ${model.model_id}`}
                    className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
                  >
                    <Eye className="size-3" aria-hidden="true" />
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
