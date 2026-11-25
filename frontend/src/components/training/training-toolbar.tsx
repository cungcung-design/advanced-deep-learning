"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrainingJobState, TrainingPreset } from "@/lib/api/types";
import {
  ALL_JOB_STATES,
  DEFAULT_TRAINING_FILTERS,
  getPresetDisplayName,
  hasActiveTrainingFilters,
  type TrainingFilterState,
} from "@/lib/training";

interface TrainingToolbarProps {
  filters: TrainingFilterState;
  onChange: (next: TrainingFilterState) => void;
  models: string[];
  datasets: string[];
  presets?: readonly TrainingPreset[];
  totalCount: number;
  filteredCount: number;
}

const selectClasses =
  "h-9 rounded-lg border border-white/10 bg-[#141722] px-3 text-xs text-zinc-200 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25";

export function TrainingToolbar({
  filters,
  onChange,
  models,
  datasets,
  presets,
  totalCount,
  filteredCount,
}: TrainingToolbarProps) {
  const active = hasActiveTrainingFilters(filters);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.75fr))]">
        <div className="relative">
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
            placeholder="Search by job ID, model, or dataset..."
            aria-label="Search training jobs"
            className="h-9 border-white/10 bg-[#141722] pl-9 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>

        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as "ALL" | TrainingJobState,
            })
          }
          className={selectClasses}
        >
          <option value="ALL">All statuses</option>
          {ALL_JOB_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by model"
          value={filters.model}
          onChange={(event) =>
            onChange({ ...filters, model: event.target.value })
          }
          className={selectClasses}
        >
          <option value="ALL">All models</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {getPresetDisplayName(model, presets)}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by dataset"
          value={filters.dataset}
          onChange={(event) =>
            onChange({ ...filters, dataset: event.target.value })
          }
          className={selectClasses}
        >
          <option value="ALL">All datasets</option>
          {datasets.map((dataset) => (
            <option key={dataset} value={dataset}>
              {dataset}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span role="status" aria-live="polite" className="tabular-nums">
          Showing {filteredCount} of {totalCount} loaded{" "}
          {totalCount === 1 ? "job" : "jobs"}
        </span>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onChange(DEFAULT_TRAINING_FILTERS)}
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
