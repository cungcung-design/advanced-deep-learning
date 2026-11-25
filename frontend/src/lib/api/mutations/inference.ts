"use client";

import { useMutation } from "@tanstack/react-query";
import { inferImage, type ImageInferencePayload } from "../endpoints";
import type { ImageInferenceResponse } from "../types";

export function useImageInference() {
  return useMutation<ImageInferenceResponse, Error, ImageInferencePayload>({
    mutationFn: (payload) => inferImage(payload),
  });
}
