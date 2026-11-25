"use client";

import { useMutation } from "@tanstack/react-query";
import { inferEmbeddings, inferNer, inferSentiment } from "../endpoints";
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  NerRequest,
  NerResponse,
  SentimentRequest,
  SentimentResponse,
} from "../types";

export function useSentimentInference() {
  return useMutation<SentimentResponse, Error, SentimentRequest>({
    mutationFn: (payload) => inferSentiment(payload),
  });
}

export function useEmbeddingsInference() {
  return useMutation<EmbeddingResponse, Error, EmbeddingRequest>({
    mutationFn: (payload) => inferEmbeddings(payload),
  });
}

export function useNerInference() {
  return useMutation<NerResponse, Error, NerRequest>({
    mutationFn: (payload) => inferNer(payload),
  });
}
