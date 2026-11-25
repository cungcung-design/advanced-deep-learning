"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getTrainingJob,
  getTrainingLogs,
  getTrainingPresets,
  listDatasets,
  listTrainingJobs,
} from "../endpoints";
import { queryKeys } from "../query-keys";
import type { TrainingJobState } from "../types";
import { isActiveJobState, isTerminalJobState } from "../../training";

export const JOB_LIST_POLL_INTERVAL_MS = 4_000;
export const JOB_DETAIL_POLL_INTERVAL_MS = 2_000;
export const JOB_LOGS_POLL_INTERVAL_MS = 2_000;

export function useTrainingPresets() {
  return useQuery({
    queryKey: queryKeys.training.presets(),
    queryFn: getTrainingPresets,
    staleTime: Infinity,
    retry: false,
  });
}

export function useTrainingJobs(options?: { limit?: number }) {
  const limit = options?.limit ?? 50;

  return useQuery({
    queryKey: queryKeys.training.jobs(limit),
    queryFn: () => listTrainingJobs(limit),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs;
      if (!jobs) {
        return false;
      }
      const hasActive = jobs.some((job) => isActiveJobState(job.state));
      return hasActive ? JOB_LIST_POLL_INTERVAL_MS : false;
    },
  });
}

export function useTrainingJob(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? queryKeys.training.job(jobId) : ["training", "job", null],
    queryFn: () => getTrainingJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) {
        return false;
      }
      return isActiveJobState(job.state) ? JOB_DETAIL_POLL_INTERVAL_MS : false;
    },
  });
}

export interface UseTrainingJobLogsResult {
  lines: string[];
  totalLines: number;
  nextSince: number;
  complete: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

interface LogsState {
  jobId: string | null;
  lines: string[];
  totalLines: number;
  nextSince: number;
  complete: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}

type LogsAction =
  | { type: "FETCH_START"; jobId: string; isInitial: boolean }
  | {
      type: "FETCH_SUCCESS";
      jobId: string;
      lines: string[];
      since: number;
      nextSince: number;
      totalLines: number;
      complete: boolean;
    }
  | { type: "FETCH_ERROR"; jobId: string; error: unknown };

const INITIAL_LOGS_STATE: LogsState = {
  jobId: null,
  lines: [],
  totalLines: 0,
  nextSince: 0,
  complete: false,
  isLoading: false,
  isFetching: false,
  error: null,
};

function logsReducer(state: LogsState, action: LogsAction): LogsState {
  switch (action.type) {
    case "FETCH_START": {
      const sameJob = state.jobId === action.jobId;
      return {
        jobId: action.jobId,
        lines: sameJob ? state.lines : [],
        totalLines: sameJob ? state.totalLines : 0,
        nextSince: sameJob ? state.nextSince : 0,
        complete: sameJob ? state.complete : false,
        isLoading: action.isInitial || !sameJob,
        isFetching: true,
        error: sameJob ? state.error : null,
      };
    }
    case "FETCH_SUCCESS": {
      const sameJob = state.jobId === action.jobId;
      const prevLines = sameJob ? state.lines : [];
      const mergedLines =
        action.since === 0
          ? action.lines
          : action.lines.length > 0
            ? [...prevLines, ...action.lines]
            : prevLines;
      return {
        jobId: action.jobId,
        lines: mergedLines,
        totalLines: action.totalLines,
        nextSince: action.nextSince,
        complete: action.complete,
        isLoading: false,
        isFetching: false,
        error: null,
      };
    }
    case "FETCH_ERROR": {
      const sameJob = state.jobId === action.jobId;
      return {
        jobId: action.jobId,
        lines: sameJob ? state.lines : [],
        totalLines: sameJob ? state.totalLines : 0,
        nextSince: sameJob ? state.nextSince : 0,
        complete: sameJob ? state.complete : false,
        isLoading: false,
        isFetching: false,
        error: action.error,
      };
    }
  }
}

export function useTrainingJobLogs(
  jobId: string | null,
  jobState?: TrainingJobState,
): UseTrainingJobLogsResult {
  const [state, dispatch] = useReducer(logsReducer, INITIAL_LOGS_STATE);

  const nextSinceRef = useRef(0);
  const completeRef = useRef(false);
  const inFlightRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);

  const fetchIncremental = useCallback(
    async (targetJobId: string, isInitial: boolean) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const requestedSince = nextSinceRef.current;

      await Promise.resolve();
      if (activeJobIdRef.current !== targetJobId) {
        inFlightRef.current = false;
        return;
      }

      dispatch({ type: "FETCH_START", jobId: targetJobId, isInitial });

      try {
        const response = await getTrainingLogs(targetJobId, requestedSince, 500);
        if (activeJobIdRef.current !== targetJobId) {
          return;
        }
        nextSinceRef.current = response.next_since;
        completeRef.current = response.complete;
        dispatch({
          type: "FETCH_SUCCESS",
          jobId: targetJobId,
          lines: response.lines,
          since: requestedSince,
          nextSince: response.next_since,
          totalLines: response.total_lines,
          complete: response.complete,
        });
      } catch (err) {
        if (activeJobIdRef.current === targetJobId) {
          dispatch({ type: "FETCH_ERROR", jobId: targetJobId, error: err });
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    activeJobIdRef.current = jobId;
    nextSinceRef.current = 0;
    completeRef.current = false;
    inFlightRef.current = false;

    if (!jobId) {
      return;
    }

    void fetchIncremental(jobId, true);
  }, [jobId, fetchIncremental]);

  const currentForJob = state.jobId === jobId ? state : INITIAL_LOGS_STATE;

  useEffect(() => {
    if (!jobId || currentForJob.complete) {
      return;
    }

    const timer = window.setInterval(() => {
      if (activeJobIdRef.current === jobId && !completeRef.current) {
        void fetchIncremental(jobId, false);
      }
    }, JOB_LOGS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [jobId, currentForJob.complete, fetchIncremental]);

  useEffect(() => {
    if (
      jobId &&
      jobState &&
      isTerminalJobState(jobState) &&
      !completeRef.current
    ) {
      void fetchIncremental(jobId, false);
    }
  }, [jobId, jobState, fetchIncremental]);

  const refetch = useCallback(async () => {
    if (!jobId) {
      return;
    }
    await fetchIncremental(jobId, currentForJob.lines.length === 0);
  }, [jobId, fetchIncremental, currentForJob.lines.length]);

  return {
    lines: currentForJob.lines,
    totalLines: currentForJob.totalLines,
    nextSince: currentForJob.nextSince,
    complete: currentForJob.complete,
    isLoading: jobId ? currentForJob.isLoading : false,
    isFetching: jobId ? currentForJob.isFetching : false,
    error: currentForJob.error,
    refetch,
  };
}

export function useDatasets() {
  return useQuery({
    queryKey: queryKeys.datasets.all,
    queryFn: listDatasets,
    staleTime: 60_000,
    retry: false,
  });
}
