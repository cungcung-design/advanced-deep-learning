"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelEvaluation, createEvaluation } from "../endpoints";
import { queryKeys } from "../query-keys";
import type { CreateEvaluationRequest, Evaluation } from "../types";

export function useCreateEvaluation() {
  const queryClient = useQueryClient();

  return useMutation<Evaluation, Error, CreateEvaluationRequest>({
    mutationFn: (payload) => createEvaluation(payload),
    onSuccess: (created) => {
      queryClient.setQueryData(
        queryKeys.evaluations.detail(created.evaluation_id),
        created,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.all,
      });
    },
  });
}

export function useCancelEvaluation() {
  const queryClient = useQueryClient();

  return useMutation<Evaluation, Error, string>({
    mutationFn: (evaluationId) => cancelEvaluation(evaluationId),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.evaluations.detail(updated.evaluation_id),
        updated,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.all,
      });
    },
  });
}
