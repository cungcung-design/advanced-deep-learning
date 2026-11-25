"use client";

import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
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
import type { DatasetSummary } from "@/lib/api/types";
import { formatInputSpec, formatSampleCount } from "@/lib/datasets";
import { formatBytes } from "@/lib/evaluation";
import { cn } from "@/lib/utils";

interface DatasetsTableProps {
  datasets: readonly DatasetSummary[];
  selectedDatasetId: string | null;
  onSelect: (dataset: DatasetSummary) => void;
}

export function DatasetStatusBadge({
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
        className="border-emerald-500/25 bg-emerald-500/10 text-[11px] text-emerald-300"
      >
        <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
        available
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300"
    >
      <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
      {status || "unavailable"}
    </Badge>
  );
}

export function DatasetsTable({
  datasets,
  selectedDatasetId,
  onSelect,
}: DatasetsTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11131A] lg:block">
      <Table aria-label="Registered datasets">
        <TableHeader>
          <TableRow className="border-white/[0.07] hover:bg-transparent">
            <TableHead className="px-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Dataset / ID
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Type / Task
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Status
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Splits (Train / Test)
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Classes / Input
            </TableHead>
            <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Local Storage
            </TableHead>
            <TableHead className="px-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datasets.map((ds) => {
            const isSelected = ds.dataset_id === selectedDatasetId;
            return (
              <TableRow
                key={ds.dataset_id}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => onSelect(ds)}
                className={cn(
                  "cursor-pointer border-white/[0.06] transition-colors hover:bg-white/[0.03]",
                  isSelected && "bg-indigo-500/[0.08]",
                )}
              >
                <TableCell className="max-w-[260px] px-3.5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">
                      {ds.display_name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                      {ds.dataset_id}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <div className="min-w-0">
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.04] text-[11px] text-zinc-300"
                    >
                      {ds.dataset_type ?? "unknown"}
                    </Badge>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {(ds.task ?? "unknown").replace(/_/g, " ")}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <DatasetStatusBadge
                    available={ds.available}
                    status={ds.status}
                  />
                </TableCell>
                <TableCell className="px-3 py-3.5 font-mono text-xs tabular-nums text-zinc-200">
                  {formatSampleCount(ds.train_size)} /{" "}
                  {formatSampleCount(ds.test_size)}
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <p className="font-mono text-xs tabular-nums text-zinc-200">
                    {ds.num_classes !== undefined
                      ? `${ds.num_classes} classes`
                      : "Not reported"}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    {formatInputSpec(ds.input)}
                  </p>
                </TableCell>
                <TableCell className="px-3 py-3.5">
                  <p className="font-mono text-xs tabular-nums text-zinc-200">
                    {formatBytes(ds.local_size_bytes ?? null)}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                    {ds.local_file_count !== undefined
                      ? `${ds.local_file_count} files`
                      : "Not reported"}
                  </p>
                </TableCell>
                <TableCell
                  className="px-3.5 py-3.5 text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onSelect(ds)}
                    aria-label={`Inspect dataset ${ds.dataset_id}`}
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
