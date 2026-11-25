"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelTrainingJob, createTrainingJob } from "../endpoints";
import { queryKeys } from "../query-keys";
import type { CreateTrainingJobRequest, TrainingJob } from "../types";

export function useCreateTrainingJob() {
  const queryClient = useQueryClient();

  return useMutation<TrainingJob, Error, CreateTrainingJobRequest>({
    mutationFn: (payload) => createTrainingJob(payload),
    onSuccess: (createdJob) => {
      queryClient.setQueryData(
        queryKeys.training.job(createdJob.job_id),
        createdJob,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.training.all,
      });
    },
  });
}

export function useCancelTrainingJob() {
  const queryClient = useQueryClient();

  return useMutation<TrainingJob, Error, string>({
    mutationFn: (jobId) => cancelTrainingJob(jobId),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(
        queryKeys.training.job(updatedJob.job_id),
        updatedJob,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.training.all,
      });
    },
  });
}
