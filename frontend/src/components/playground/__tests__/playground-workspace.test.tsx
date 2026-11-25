import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaygroundView } from "@/components/playground/playground-view";
import type { ImageInferenceResponse, ImageModelInfo } from "@/lib/api/types";

const LIVE_MODELS: ImageModelInfo[] = [
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
  {
    model_id: "resnet18_finetuned",
    display_name: "ResNet18 Fine-tuned",
    architecture: "ResNet18",
    dataset: "cifar10",
    image_size: 128,
    available: true,
  },
];

const INFERENCE_RESPONSE: ImageInferenceResponse = {
  model_id: "mnist_cnn",
  predicted_class: "7",
  class_index: 7,
  confidence: 0.9642,
  top_k: [
    { class_index: 7, label: "7", probability: 0.9642 },
    { class_index: 1, label: "1", probability: 0.0215 },
    { class_index: 9, label: "9", probability: 0.0081 },
  ],
  inference_ms: 8.4,
  image: { width: 28, height: 28, format: "PNG" },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("PlaygroundView workspace", () => {
  const fetchMock = vi.fn();
  const createObjectURLMock = vi.fn();
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    createObjectURLMock.mockReset().mockReturnValue("blob:preview-1");
    revokeObjectURLMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-selects first available model, enforces validation & unavailable-model disable, revokes object URLs, and records session history", async () => {
    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/inference/image/models")) {
        return Promise.resolve(
          jsonResponse({ models: LIVE_MODELS, count: LIVE_MODELS.length }),
        );
      }
      if (url.endsWith("/inference/image") && init?.method === "POST") {
        return Promise.resolve(jsonResponse(INFERENCE_RESPONSE));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<PlaygroundView />);

    await waitFor(() => {
      expect(screen.getByText("2 / 3 models ready")).toBeInTheDocument();
    });

    // Auto-selects first available model (mnist_cnn), NOT unavailable baseline
    expect(
      screen.getByRole("radio", { name: /MNIST CNN Baseline/i }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: /1 epoch baseline/i }),
    ).toHaveAttribute("aria-checked", "false");

    // Run button disabled when no image is selected
    const runBtn = screen.getByRole("button", { name: /Run Inference/i });
    expect(runBtn).toBeDisabled();

    // Reject invalid file type
    const fileInput = screen.getByLabelText("Upload image file") as HTMLInputElement;
    const badFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(
      await screen.findByText(/Unsupported file format/i),
    ).toBeInTheDocument();
    expect(runBtn).toBeDisabled();

    // Upload valid PNG
    const goodPng = new File([new Uint8Array([137, 80, 78, 71])], "digit7.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [goodPng] } });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText("Selected preview: digit7.png")).toBeInTheDocument();
    expect(runBtn).toBeEnabled();

    // Selecting unavailable model disables inference and warns
    await user.click(screen.getByRole("radio", { name: /1 epoch baseline/i }));
    expect(
      screen.getByText(/Selected model checkpoint is unavailable/i),
    ).toBeInTheDocument();
    expect(runBtn).toBeDisabled();

    // Switch back to MNIST CNN, set Top-K = 5, run inference
    await user.click(screen.getByRole("radio", { name: /MNIST CNN Baseline/i }));
    await user.selectOptions(screen.getByLabelText("Top-K predictions"), "5");
    await user.click(runBtn);

    // Real prediction results appear
    await waitFor(() => {
      expect(screen.getByText("Top Prediction")).toBeInTheDocument();
    });
    expect(screen.getAllByText("96.42%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("28 × 28")).toBeInTheDocument();
    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getAllByText("8.4 ms").length).toBeGreaterThanOrEqual(1);

    // Session history updated with real response
    const historyList = screen.getByRole("list", {
      name: "Session prediction history",
    });
    expect(within(historyList).getByText(/digit7\.png/i)).toBeInTheDocument();

    // Clearing file revokes temporary object URL
    await user.click(screen.getByRole("button", { name: "Clear selected image" }));
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:preview-1");
  });

  it("renders offline state when backend models endpoint is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithQueryClient(<PlaygroundView />);
    await waitFor(() => {
      expect(
        screen.getByText("Backend offline or unreachable"),
      ).toBeInTheDocument();
    });
  });
});
