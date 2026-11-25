"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_REGISTRY_FILTERS,
  hasActiveRegistryFilters,
  type RegistryFilterState,
  type RegistryModelSource,
} from "@/lib/registry";

interface RegistryToolbarProps {
  filters: RegistryFilterState;
  onChange: (next: RegistryFilterState) => void;
  architectures: string[];
  tasks: string[];
  totalCount: number;
  filteredCount: number;
}

const selectClasses =
  "h-9 min-w-0 rounded-lg border border-white/10 bg-[#141722] px-3 text-xs text-zinc-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25";

export function RegistryToolbar({
  filters,
  onChange,
  architectures,
  tasks,
  totalCount,
  filteredCount,
}: RegistryToolbarProps) {
  const active = hasActiveRegistryFilters(filters);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.7fr))]">
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={filters.search}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
            placeholder="Search by model ID, name, architecture, or task..."
            aria-label="Search registry models"
            className="h-9 border-white/10 bg-[#141722] pl-9 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>

        <select
          aria-label="Filter by availability"
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as RegistryFilterState["status"],
            })
          }
          className={selectClasses}
        >
          <option value="ALL">All statuses</option>
          <option value="available">Available</option>
          <option value="missing">Missing</option>
          <option value="invalid">Invalid</option>
        </select>

        <select
          aria-label="Filter by architecture"
          value={filters.architecture}
          onChange={(event) =>
            onChange({ ...filters, architecture: event.target.value })
          }
          className={selectClasses}
        >
          <option value="ALL">All architectures</option>
          {architectures.map((arch) => (
            <option key={arch} value={arch}>
              {arch}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by task"
          value={filters.task}
          onChange={(event) =>
            onChange({ ...filters, task: event.target.value })
          }
          className={selectClasses}
        >
          <option value="ALL">All tasks</option>
          {tasks.map((task) => (
            <option key={task} value={task}>
              {task.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by source"
          value={filters.source}
          onChange={(event) =>
            onChange({
              ...filters,
              source: event.target.value as "ALL" | RegistryModelSource,
            })
          }
          className={selectClasses}
        >
          <option value="ALL">All sources</option>
          <option value="catalog">Catalog</option>
          <option value="trained_job">Trained Job</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span role="status" aria-live="polite" className="tabular-nums">
          Showing {filteredCount} of {totalCount} registered{" "}
          {totalCount === 1 ? "model" : "models"}
        </span>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onChange(DEFAULT_REGISTRY_FILTERS)}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Reset filters
          </Button>
        )}
      </div>
    </div>
  );
}
