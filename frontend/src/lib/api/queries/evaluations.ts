"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getEvaluation,
  getEvaluationLogs,
  getEvaluationPresets,
  getEvaluationResults,
  listEvaluations,
  listRegistryModels,
} from "../endpoints";
import { queryKeys } from "../query-keys";
import type { EvaluationState } from "../types";
import {
  isActiveEvaluationState,
  isTerminalEvaluationState,
} from "../../evaluation";

export const EVALUATION_LIST_POLL_INTERVAL_MS = 4_000;
export const EVALUATION_DETAIL_POLL_INTERVAL_MS = 2_000;
export const EVALUATION_LOGS_POLL_INTERVAL_MS = 2_000;

export function useEvaluationPresets() {
  return useQuery({
    queryKey: queryKeys.evaluations.presets(),
    queryFn: getEvaluationPresets,
    staleTime: Infinity,
    retry: false,
  });
}

export function useRegistryModels() {
  return useQuery({
    queryKey: queryKeys.registry.models(),
    queryFn: listRegistryModels,
    staleTime: 30_000,
    retry: false,
  });
}

export function useEvaluations(options?: { state?: string; limit?: number }) {
  const state = options?.state;
  const limit = options?.limit ?? 50;

  return useQuery({
    queryKey: queryKeys.evaluations.list(state, limit),
    queryFn: () => listEvaluations({ state, limit }),
    refetchInterval: (query) => {
      const items = query.state.data?.evaluations;
      if (!items) {
        return false;
      }
      const hasActive = items.some((item) =>
        isActiveEvaluationState(item.state),
      );
      return hasActive ? EVALUATION_LIST_POLL_INTERVAL_MS : false;
    },
  });
}

export function useEvaluation(evaluationId: string | null) {
  return useQuery({
    queryKey: evaluationId
      ? queryKeys.evaluations.detail(evaluationId)
      : ["evaluations", "detail", null],
    queryFn: () => getEvaluation(evaluationId!),
    enabled: Boolean(evaluationId),
    refetchInterval: (query) => {
      const item = query.state.data;
      if (!item) {
        return false;
      }
      return isActiveEvaluationState(item.state)
        ? EVALUATION_DETAIL_POLL_INTERVAL_MS
        : false;
    },
  });
}

export function useEvaluationResults(
  evaluationId: string | null,
  state?: EvaluationState,
) {
  const enabled = Boolean(evaluationId) && state === "SUCCEEDED";
  return useQuery({
    queryKey: evaluationId
      ? queryKeys.evaluations.results(evaluationId)
      : ["evaluations", "results", null],
    queryFn: () => getEvaluationResults(evaluationId!),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export interface UseEvaluationLogsResult {
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
  evaluationId: string | null;
  lines: string[];
  totalLines: number;
  nextSince: number;
  complete: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}

type LogsAction =
  | { type: "FETCH_START"; evaluationId: string; isInitial: boolean }
  | {
      type: "FETCH_SUCCESS";
      evaluationId: string;
      lines: string[];
      since: number;
      nextSince: number;
      totalLines: number;
      complete: boolean;
    }
  | { type: "FETCH_ERROR"; evaluationId: string; error: unknown };

const INITIAL_LOGS_STATE: LogsState = {
  evaluationId: null,
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
      const same = state.evaluationId === action.evaluationId;
      return {
        evaluationId: action.evaluationId,
        lines: same ? state.lines : [],
        totalLines: same ? state.totalLines : 0,
        nextSince: same ? state.nextSince : 0,
        complete: same ? state.complete : false,
        isLoading: action.isInitial || !same,
        isFetching: true,
        error: same ? state.error : null,
      };
    }
    case "FETCH_SUCCESS": {
      const same = state.evaluationId === action.evaluationId;
      const prevLines = same ? state.lines : [];
      const mergedLines =
        action.since === 0
          ? action.lines
          : action.lines.length > 0
            ? [...prevLines, ...action.lines]
            : prevLines;
      return {
        evaluationId: action.evaluationId,
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
      const same = state.evaluationId === action.evaluationId;
      return {
        evaluationId: action.evaluationId,
        lines: same ? state.lines : [],
        totalLines: same ? state.totalLines : 0,
        nextSince: same ? state.nextSince : 0,
        complete: same ? state.complete : false,
        isLoading: false,
        isFetching: false,
        error: action.error,
      };
    }
  }
}

export function useEvaluationLogs(
  evaluationId: string | null,
  state?: EvaluationState,
): UseEvaluationLogsResult {
  const [logState, dispatch] = useReducer(logsReducer, INITIAL_LOGS_STATE);

  const nextSinceRef = useRef(0);
  const completeRef = useRef(false);
  const inFlightRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  const fetchIncremental = useCallback(
    async (targetId: string, isInitial: boolean) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const requestedSince = nextSinceRef.current;

      await Promise.resolve();
      if (activeIdRef.current !== targetId) {
        inFlightRef.current = false;
        return;
      }

      dispatch({ type: "FETCH_START", evaluationId: targetId, isInitial });

      try {
        const response = await getEvaluationLogs(targetId, requestedSince, 500);
        if (activeIdRef.current !== targetId) {
          return;
        }
        nextSinceRef.current = response.next_since;
        completeRef.current = response.complete;
        dispatch({
          type: "FETCH_SUCCESS",
          evaluationId: targetId,
          lines: response.lines,
          since: requestedSince,
          nextSince: response.next_since,
          totalLines: response.total_lines,
          complete: response.complete,
        });
      } catch (err) {
        if (activeIdRef.current === targetId) {
          dispatch({ type: "FETCH_ERROR", evaluationId: targetId, error: err });
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    activeIdRef.current = evaluationId;
    nextSinceRef.current = 0;
    completeRef.current = false;
    inFlightRef.current = false;

    if (!evaluationId) {
      return;
    }

    void fetchIncremental(evaluationId, true);
  }, [evaluationId, fetchIncremental]);

  const current =
    logState.evaluationId === evaluationId ? logState : INITIAL_LOGS_STATE;

  useEffect(() => {
    if (!evaluationId || current.complete) {
      return;
    }

    const timer = window.setInterval(() => {
      if (activeIdRef.current === evaluationId && !completeRef.current) {
        void fetchIncremental(evaluationId, false);
      }
    }, EVALUATION_LOGS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [evaluationId, current.complete, fetchIncremental]);

  useEffect(() => {
    if (
      evaluationId &&
      state &&
      isTerminalEvaluationState(state) &&
      !completeRef.current
    ) {
      void fetchIncremental(evaluationId, false);
    }
  }, [evaluationId, state, fetchIncremental]);

  const refetch = useCallback(async () => {
    if (!evaluationId) {
      return;
    }
    await fetchIncremental(evaluationId, current.lines.length === 0);
  }, [evaluationId, fetchIncremental, current.lines.length]);

  return {
    lines: current.lines,
    totalLines: current.totalLines,
    nextSince: current.nextSince,
    complete: current.complete,
    isLoading: evaluationId ? current.isLoading : false,
    isFetching: evaluationId ? current.isFetching : false,
    error: current.error,
    refetch,
  };
}
