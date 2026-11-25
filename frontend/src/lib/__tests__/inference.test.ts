import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  ImageInferenceResponseSchema,
  ImageModelListSchema,
  type ImageModelInfo,
} from "@/lib/api/types";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  clampTopK,
  formatConfidencePercent,
  formatInferenceApiError,
  formatLatencyMs,
  selectFirstAvailableModel,
  validateImageFile,
} from "@/lib/inference";

const MODELS: ImageModelInfo[] = [
  {
    model_id: "cifar10_custom_cnn_baseline",
    display_name: "CIFAR-10 Custom CNN (1 epoch baseline)",
    architecture: "CifarCNN",
    dataset: "cifar10",
    image_size: 32,
    available: false,
  },
  {
    model_id: "mnist_cnn",
    display_name: "MNIST CNN Baseline",
    architecture: "MNISTCNN",
    dataset: "mnist",
    image_size: 28,
    available: true,
  },
];

describe("image inference schemas and helpers", () => {
  it("parses image model list and inference response schemas", () => {
    expect(
      ImageModelListSchema.parse({ models: MODELS, count: 2 }).count,
    ).toBe(2);

    const parsed = ImageInferenceResponseSchema.parse({
      model_id: "mnist_cnn",
      predicted_class: "7",
      class_index: 7,
      confidence: 0.9812,
      top_k: [
        { class_index: 7, label: "7", probability: 0.9812 },
        { class_index: 1, label: "1", probability: 0.0112 },
      ],
      inference_ms: 6.4,
      image: { width: 28, height: 28, format: "PNG" },
    });
    expect(parsed.predicted_class).toBe("7");
    expect(parsed.top_k).toHaveLength(2);
  });

  it("never auto-selects unavailable models", () => {
    expect(selectFirstAvailableModel(MODELS)?.model_id).toBe("mnist_cnn");
    expect(selectFirstAvailableModel([MODELS[0]])).toBeNull();
  });

  it("validates image format, empty files, and 5 MB size limit", () => {
    const validPng = new File([new Uint8Array(64)], "digit.png", {
      type: "image/png",
    });
    expect(validateImageFile(validPng)).toEqual({ valid: true, error: null });

    const emptyPng = new File([], "empty.png", { type: "image/png" });
    expect(validateImageFile(emptyPng).valid).toBe(false);

    const invalidType = new File([new Uint8Array(32)], "notes.txt", {
      type: "text/plain",
    });
    expect(validateImageFile(invalidType).valid).toBe(false);

    const oversized = new File(
      [new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)],
      "huge.png",
      { type: "image/png" },
    );
    expect(validateImageFile(oversized).valid).toBe(false);
  });

  it("formats confidence, latency, Top-K bounds, and API errors", () => {
    expect(formatConfidencePercent(0.9531)).toBe("95.31%");
    expect(formatLatencyMs(14.23)).toBe("14.2 ms");
    expect(formatLatencyMs(1250)).toBe("1.25 s");
    expect(clampTopK(0)).toBe(1);
    expect(clampTopK(99)).toBe(10);
    expect(clampTopK(5)).toBe(5);

    expect(
      formatInferenceApiError(
        new ApiError("Too big", 413, undefined, { code: "FILE_TOO_LARGE" }),
      ).title,
    ).toBe("Image too large");

    expect(
      formatInferenceApiError(new ApiError("Bad media", 415)).title,
    ).toBe("Unsupported image format");

    expect(
      formatInferenceApiError(
        new ApiError("Missing", 409, undefined, { code: "MODEL_UNAVAILABLE" }),
      ).title,
    ).toBe("Selected model unavailable");
  });
});
