"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  FlaskConical,
  Plus,
  RefreshCw,
  SearchX,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelTrainingJob,
  useCreateTrainingJob,
} from "@/lib/api/mutations/training";
import {
  useDatasets,
  useTrainingJob,
  useTrainingJobLogs,
  useTrainingJobs,
  useTrainingPresets,
} from "@/lib/api/queries/training";
import type { CreateTrainingJobRequest, TrainingJob } from "@/lib/api/types";
import {
  DEFAULT_TRAINING_FILTERS,
  filterTrainingJobs,
  formatTrainingApiError,
  getUniqueJobDatasets,
  getUniqueJobModels,
  summarizeTrainingJobs,
  type TrainingFilterState,
} from "@/lib/training";
import { cn } from "@/lib/utils";
import { CancelTrainingDialog } from "./cancel-training-dialog";
import { CreateTrainingDialog } from "./create-training-dialog";
import { TrainingJobCard } from "./training-job-card";
import { TrainingJobDetail } from "./training-job-detail";
import { TrainingJobTable } from "./training-job-table";
import { TrainingSummary } from "./training-summary";
import { TrainingToolbar } from "./training-toolbar";

export function TrainingView() {
  const [filters, setFilters] = useState<TrainingFilterState>(
    DEFAULT_TRAINING_FILTERS,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [jobToCancel, setJobToCancel] = useState<TrainingJob | null>(null);

  const presetsQuery = useTrainingPresets();
  const jobsQuery = useTrainingJobs({ limit: 50 });
  const datasetsQuery = useDatasets();
  const selectedJobQuery = useTrainingJob(selectedJobId);

  const createMutation = useCreateTrainingJob();
  const cancelMutation = useCancelTrainingJob();

  const presets = useMemo(
    () => presetsQuery.data?.models ?? [],
    [presetsQuery.data],
  );
  const jobs = useMemo(() => jobsQuery.data?.jobs ?? [], [jobsQuery.data]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) {
      return null;
    }
    return (
      selectedJobQuery.data ??
      jobs.find((job) => job.job_id === selectedJobId) ??
      null
    );
  }, [selectedJobId, selectedJobQuery.data, jobs]);

  const logsState = useTrainingJobLogs(selectedJobId, selectedJob?.state);

  const summary = useMemo(() => summarizeTrainingJobs(jobs), [jobs]);
  const modelOptions = useMemo(
    () => getUniqueJobModels(jobs, presets),
    [jobs, presets],
  );
  const datasetOptions = useMemo(
    () => getUniqueJobDatasets(jobs, presets),
    [jobs, presets],
  );
  const filteredJobs = useMemo(
    () => filterTrainingJobs(jobs, filters, presets),
    [jobs, filters, presets],
  );

  const jobsError = jobsQuery.error
    ? formatTrainingApiError(jobsQuery.error)
    : null;

  const handleCreateSubmit = (payload: CreateTrainingJobRequest) => {
    createMutation.mutate(payload, {
      onSuccess: (createdJob) => {
        setCreateOpen(false);
        setHighlightedJobId(createdJob.job_id);
        setSelectedJobId(createdJob.job_id);
      },
    });
  };

  const handleConfirmCancel = (jobId: string) => {
    cancelMutation.mutate(jobId, {
      onSuccess: () => {
        setJobToCancel(null);
      },
    });
  };

  const handleOpenCreate = () => {
    createMutation.reset();
    setCreateOpen(true);
  };

  const handleRequestCancel = (job: TrainingJob) => {
    cancelMutation.reset();
    setJobToCancel(job);
  };

  const cancellingJobId = cancelMutation.isPending
    ? (cancelMutation.variables ?? null)
    : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Model Training
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Launch CPU-compatible local training runs, monitor live progress,
            and inspect incremental logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              void jobsQuery.refetch();
              if (presetsQuery.isError) {
                void presetsQuery.refetch();
              }
            }}
            disabled={jobsQuery.isFetching}
            className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
          >
            <RefreshCw
              className={cn("size-4", jobsQuery.isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleOpenCreate}
            className="bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Training Run
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <TrainingSummary stats={summary} isLoading={jobsQuery.isLoading} />

      {/* Search & filters */}
      <TrainingToolbar
        filters={filters}
        onChange={setFilters}
        models={modelOptions}
        datasets={datasetOptions}
        presets={presets}
        totalCount={jobs.length}
        filteredCount={filteredJobs.length}
      />

      {/* Main job list states */}
      {jobsQuery.isLoading ? (
        <div
          className="space-y-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-5"
          aria-label="Loading training jobs"
        >
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-14 w-full bg-white/[0.05]" />
          ))}
        </div>
      ) : jobsError ? (
        jobsError.isOffline ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#11131A] px-6 py-14 text-center"
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <WifiOff className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              {jobsError.title}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
              {jobsError.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void jobsQuery.refetch()}
              className="mt-5 border-white/10 bg-transparent text-zinc-200"
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>{jobsError.title}</AlertTitle>
              <AlertDescription>{jobsError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void jobsQuery.refetch()}
            >
              Retry
            </Button>
          </Alert>
        )
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
            <FlaskConical className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No training runs yet
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            Start a local training run from one of the backend presets to track
            progress, latest metrics, and logs here.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreate}
            className="mt-5 bg-indigo-500 text-white hover:bg-indigo-400"
          >
            <Plus className="size-4" aria-hidden="true" />
            New Training Run
          </Button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-400">
            <SearchX className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No matching training jobs
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            Adjust or reset your search query and status, model, or dataset
            filters to view loaded training runs.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_TRAINING_FILTERS)}
            className="mt-5 border-white/10 bg-transparent text-zinc-200"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <TrainingJobTable
            jobs={filteredJobs}
            presets={presets}
            selectedJobId={selectedJobId}
            highlightedJobId={highlightedJobId}
            cancellingJobId={cancellingJobId}
            onSelectJob={(job) => setSelectedJobId(job.job_id)}
            onRequestCancel={handleRequestCancel}
          />

          <div
            className="grid gap-3 lg:hidden"
            aria-label="Training job cards"
          >
            {filteredJobs.map((job) => (
              <TrainingJobCard
                key={job.job_id}
                job={job}
                presets={presets}
                isSelected={job.job_id === selectedJobId}
                isHighlighted={job.job_id === highlightedJobId}
                isCancelling={cancellingJobId === job.job_id}
                onSelect={(item) => setSelectedJobId(item.job_id)}
                onRequestCancel={handleRequestCancel}
              />
            ))}
          </div>
        </>
      )}

      {/* Create Training Run dialog */}
      <CreateTrainingDialog
        open={createOpen}
        presets={presets}
        presetsLoading={presetsQuery.isLoading}
        presetsError={presetsQuery.error}
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

      {/* Job Detail Sheet */}
      <TrainingJobDetail
        open={Boolean(selectedJobId)}
        job={selectedJob}
        isLoading={selectedJobQuery.isLoading}
        error={selectedJobQuery.error}
        presets={presets}
        logs={logsState}
        isCancelling={
          Boolean(selectedJob) && cancellingJobId === selectedJob?.job_id
        }
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedJobId(null);
          }
        }}
        onRetryJob={() => {
          void selectedJobQuery.refetch();
        }}
        onRequestCancel={handleRequestCancel}
      />

      {/* Cancel confirmation dialog */}
      <CancelTrainingDialog
        job={jobToCancel}
        open={Boolean(jobToCancel)}
        isPending={cancelMutation.isPending}
        error={cancelMutation.error}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !cancelMutation.isPending) {
            setJobToCancel(null);
          }
        }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
