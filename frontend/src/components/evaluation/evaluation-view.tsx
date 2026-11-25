"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Gauge,
  GitCompare,
  Plus,
  RefreshCw,
  SearchX,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelEvaluation,
  useCreateEvaluation,
} from "@/lib/api/mutations/evaluations";
import {
  useEvaluation,
  useEvaluationLogs,
  useEvaluationPresets,
  useEvaluationResults,
  useEvaluations,
  useRegistryModels,
} from "@/lib/api/queries/evaluations";
import { useDatasets } from "@/lib/api/queries/training";
import type {
  CreateEvaluationRequest,
  Evaluation,
  EvaluationPreset,
} from "@/lib/api/types";
import {
  DEFAULT_EVALUATION_FILTERS,
  filterEvaluations,
  formatEvaluationApiError,
  getUniqueEvaluationDatasets,
  getUniqueEvaluationModels,
  summarizeEvaluations,
  type EvaluationFilterState,
} from "@/lib/evaluation";
import { cn } from "@/lib/utils";
import { CancelEvaluationDialog } from "./cancel-evaluation-dialog";
import { CreateEvaluationDialog } from "./create-evaluation-dialog";
import { EvaluationCard } from "./evaluation-card";
import { EvaluationCompareDialog } from "./evaluation-compare-dialog";
import { EvaluationDetail } from "./evaluation-detail";
import { EvaluationModelsStrip } from "./evaluation-models-strip";
import { EvaluationSummary } from "./evaluation-summary";
import { EvaluationTable } from "./evaluation-table";
import { EvaluationToolbar } from "./evaluation-toolbar";

export function EvaluationView() {
  const [filters, setFilters] = useState<EvaluationFilterState>(
    DEFAULT_EVALUATION_FILTERS,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialModel, setCreateInitialModel] = useState<string | null>(
    null,
  );
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [evaluationToCancel, setEvaluationToCancel] =
    useState<Evaluation | null>(null);

  const presetsQuery = useEvaluationPresets();
  const registryQuery = useRegistryModels();
  const datasetsQuery = useDatasets();
  const evaluationsQuery = useEvaluations({ limit: 50 });
  const selectedQuery = useEvaluation(selectedId);

  const createMutation = useCreateEvaluation();
  const cancelMutation = useCancelEvaluation();

  const presets = useMemo(
    () => presetsQuery.data?.models ?? [],
    [presetsQuery.data],
  );
  const evaluations = useMemo(
    () => evaluationsQuery.data?.evaluations ?? [],
    [evaluationsQuery.data],
  );

  const selectedEvaluation = useMemo(() => {
    if (!selectedId) {
      return null;
    }
    return (
      selectedQuery.data ??
      evaluations.find((item) => item.evaluation_id === selectedId) ??
      null
    );
  }, [selectedId, selectedQuery.data, evaluations]);

  const resultsQuery = useEvaluationResults(
    selectedId,
    selectedEvaluation?.state,
  );
  const logsState = useEvaluationLogs(selectedId, selectedEvaluation?.state);

  const summary = useMemo(
    () => summarizeEvaluations(evaluations),
    [evaluations],
  );
  const modelOptions = useMemo(
    () => getUniqueEvaluationModels(evaluations, presets),
    [evaluations, presets],
  );
  const datasetOptions = useMemo(
    () => getUniqueEvaluationDatasets(evaluations, presets),
    [evaluations, presets],
  );
  const filteredEvaluations = useMemo(
    () => filterEvaluations(evaluations, filters, presets),
    [evaluations, filters, presets],
  );

  const listError = evaluationsQuery.error
    ? formatEvaluationApiError(evaluationsQuery.error)
    : null;

  const handleOpenCreate = (preset?: EvaluationPreset) => {
    createMutation.reset();
    setCreateInitialModel(preset?.model ?? null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = (payload: CreateEvaluationRequest) => {
    createMutation.mutate(payload, {
      onSuccess: (created) => {
        setCreateOpen(false);
        setHighlightedId(created.evaluation_id);
        setSelectedId(created.evaluation_id);
      },
    });
  };

  const handleRequestCancel = (item: Evaluation) => {
    cancelMutation.reset();
    setEvaluationToCancel(item);
  };

  const handleConfirmCancel = (evaluationId: string) => {
    cancelMutation.mutate(evaluationId, {
      onSuccess: () => {
        setEvaluationToCancel(null);
      },
    });
  };

  const cancellingId = cancelMutation.isPending
    ? (cancelMutation.variables ?? null)
    : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Model Evaluation
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Evaluate registered checkpoints on held-out test splits and inspect
            per-class metrics, confusion matrices, and logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={summary.succeeded < 2}
            onClick={() => setCompareOpen(true)}
            className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
          >
            <GitCompare className="size-4" aria-hidden="true" />
            Compare Runs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              void evaluationsQuery.refetch();
              void registryQuery.refetch();
              if (presetsQuery.isError) {
                void presetsQuery.refetch();
              }
            }}
            disabled={evaluationsQuery.isFetching}
            className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
          >
            <RefreshCw
              className={cn(
                "size-4",
                evaluationsQuery.isFetching && "animate-spin",
              )}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => handleOpenCreate()}
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Evaluation
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <EvaluationSummary stats={summary} isLoading={evaluationsQuery.isLoading} />

      {/* Available models/checkpoints */}
      <EvaluationModelsStrip
        presets={presets}
        registryModels={registryQuery.data?.models}
        isLoading={presetsQuery.isLoading}
        onQuickEvaluate={(preset) => handleOpenCreate(preset)}
      />

      {/* Search & filters */}
      <EvaluationToolbar
        filters={filters}
        onChange={setFilters}
        models={modelOptions}
        datasets={datasetOptions}
        presets={presets}
        totalCount={evaluations.length}
        filteredCount={filteredEvaluations.length}
      />

      {/* Evaluation history states */}
      {evaluationsQuery.isLoading ? (
        <div
          className="space-y-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-5"
          aria-label="Loading evaluations"
        >
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-14 w-full bg-white/[0.05]" />
          ))}
        </div>
      ) : listError ? (
        listError.isOffline ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#11131A] px-6 py-14 text-center"
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <WifiOff className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              {listError.title}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
              {listError.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void evaluationsQuery.refetch()}
              className="mt-5 border-white/10 bg-transparent text-zinc-200"
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>{listError.title}</AlertTitle>
              <AlertDescription>{listError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void evaluationsQuery.refetch()}
            >
              Retry
            </Button>
          </Alert>
        )
      ) : evaluations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
            <Gauge className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No evaluation runs yet
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            Run a real held-out test evaluation on any available checkpoint to
            inspect accuracy, per-class metrics, and confusion matrices.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenCreate()}
            className="mt-5 bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Evaluation
          </Button>
        </div>
      ) : filteredEvaluations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-400">
            <SearchX className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No matching evaluations
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            Adjust or reset your search query and status, model, or dataset
            filters to view loaded evaluation history.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_EVALUATION_FILTERS)}
            className="mt-5 border-white/10 bg-transparent text-zinc-200"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <EvaluationTable
            evaluations={filteredEvaluations}
            presets={presets}
            selectedId={selectedId}
            highlightedId={highlightedId}
            cancellingId={cancellingId}
            onSelect={(item) => setSelectedId(item.evaluation_id)}
            onRequestCancel={handleRequestCancel}
          />

          <div
            className="grid gap-3 lg:hidden"
            aria-label="Evaluation history cards"
          >
            {filteredEvaluations.map((item) => (
              <EvaluationCard
                key={item.evaluation_id}
                evaluation={item}
                presets={presets}
                isSelected={item.evaluation_id === selectedId}
                isHighlighted={item.evaluation_id === highlightedId}
                isCancelling={cancellingId === item.evaluation_id}
                onSelect={(selected) => setSelectedId(selected.evaluation_id)}
                onRequestCancel={handleRequestCancel}
              />
            ))}
          </div>
        </>
      )}

      {/* Create Evaluation dialog */}
      <CreateEvaluationDialog
        open={createOpen}
        initialModel={createInitialModel}
        presets={presets}
        presetsLoading={presetsQuery.isLoading}
        presetsError={presetsQuery.error}
        registryModels={registryQuery.data?.models}
        datasets={datasetsQuery.data?.datasets}
        isSubmitting={createMutation.isPending}
        submitError={createMutation.error}
        onOpenChange={(nextOpen) => {
          if (!createMutation.isPending) {
            setCreateOpen(nextOpen);
          }
        }}
        onRetryPresets={() => {
          void presetsQuery.refetch();
        }}
        onSubmit={handleCreateSubmit}
      />

      {/* Evaluation Detail Sheet */}
      <EvaluationDetail
        open={Boolean(selectedId)}
        evaluation={selectedEvaluation}
        isLoading={selectedQuery.isLoading}
        error={selectedQuery.error}
        results={resultsQuery.data}
        resultsLoading={resultsQuery.isLoading}
        resultsError={resultsQuery.error}
        presets={presets}
        logs={logsState}
        isCancelling={
          Boolean(selectedEvaluation) &&
          cancellingId === selectedEvaluation?.evaluation_id
        }
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedId(null);
          }
        }}
        onRetryEvaluation={() => {
          void selectedQuery.refetch();
        }}
        onRetryResults={() => {
          void resultsQuery.refetch();
        }}
        onRequestCancel={handleRequestCancel}
      />

      {/* Compare Runs Dialog */}
      <EvaluationCompareDialog
        open={compareOpen}
        evaluations={evaluations}
        presets={presets}
        onOpenChange={setCompareOpen}
      />

      {/* Cancel confirmation dialog */}
      <CancelEvaluationDialog
        evaluation={evaluationToCancel}
        open={Boolean(evaluationToCancel)}
        isPending={cancelMutation.isPending}
        error={cancelMutation.error}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !cancelMutation.isPending) {
            setEvaluationToCancel(null);
          }
        }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
