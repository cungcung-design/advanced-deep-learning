import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatasetsView } from "@/components/datasets/datasets-view";
import type {
  DatasetStatistics,
  DatasetSummary,
  ValidationResponse,
} from "@/lib/api/types";

const MOCK_DATASETS: DatasetSummary[] = [
  {
    dataset_id: "mnist",
    display_name: "MNIST",
    description: "Handwritten digit classification dataset.",
    dataset_type: "image",
    task: "image_classification",
    source: "torchvision",
    available: true,
    status: "available",
    missing_files: [],
    local_path: "D:\\Developer\\Projects\\advanced-deep-learning\\data\\raw\\MNIST",
    local_size_bytes: 66_544_770,
    local_file_count: 8,
    train_size: 60000,
    test_size: 10000,
    val_fraction: 0.1,
    num_classes: 10,
    classes: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    input: { channels: 1, height: 28, width: 28 },
    preprocessing: { normalize_mean: [0.1307], normalize_std: [0.3081] },
    config_path: "D:\\Developer\\Projects\\advanced-deep-learning\\configs\\mnist_cpu.json",
  },
  {
    dataset_id: "cifar10",
    display_name: "CIFAR-10",
    description: "10-class 32x32 color image classification dataset.",
    dataset_type: "image",
    task: "image_classification",
    source: "torchvision",
    available: false,
    status: "missing",
    missing_files: ["data_batch_1"],
    local_path: "D:\\Developer\\Projects\\advanced-deep-learning\\data\\raw\\cifar-10-batches-py",
    local_size_bytes: 0,
    local_file_count: 0,
    train_size: 50000,
    test_size: 10000,
    val_fraction: 0.1,
    num_classes: 10,
    classes: ["airplane", "automobile"],
    input: { channels: 3, height: 32, width: 32 },
    preprocessing: {},
    config_path: "D:\\Developer\\Projects\\advanced-deep-learning\\configs\\cifar10_5epoch.json",
  },
];

const MOCK_MNIST_STATS: DatasetStatistics = {
  dataset_id: "mnist",
  available: true,
  local_size_bytes: 66_544_770,
  local_file_count: 8,
  train_size: 60000,
  test_size: 10000,
  expected_val_size: 6000,
  expected_train_after_split: 54000,
  num_classes: 10,
  classes: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
};

const MOCK_VALID_RESPONSE: ValidationResponse = {
  dataset_id: "mnist",
  valid: true,
  status: "valid",
  checks: [
    { name: "supported_id", passed: true },
    { name: "local_files", passed: true },
    { name: "split_totals", passed: true },
    { name: "class_metadata", passed: true },
    { name: "input_spec", passed: true },
  ],
  missing_files: [],
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

describe("DatasetsView workspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders datasets, filtering, detail statistics, copyable paths, 5-check validation, duplicate-submit guard, and workspace links", async () => {
    let validateCalls = 0;
    let resolveValidate: ((res: Response) => void) | null = null;

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/datasets")) {
        return Promise.resolve(
          jsonResponse({ datasets: MOCK_DATASETS, count: MOCK_DATASETS.length }),
        );
      }
      if (url.endsWith("/datasets/mnist")) {
        return Promise.resolve(jsonResponse(MOCK_DATASETS[0]));
      }
      if (url.endsWith("/datasets/mnist/statistics")) {
        return Promise.resolve(jsonResponse(MOCK_MNIST_STATS));
      }
      if (url.endsWith("/datasets/cifar10")) {
        return Promise.resolve(jsonResponse(MOCK_DATASETS[1]));
      }
      if (url.endsWith("/datasets/cifar10/statistics")) {
        return Promise.resolve(
          jsonResponse({
            ...MOCK_MNIST_STATS,
            dataset_id: "cifar10",
            available: false,
            local_size_bytes: 0,
            local_file_count: 0,
          }),
        );
      }
      if (url.endsWith("/datasets/validate") && init?.method === "POST") {
        validateCalls += 1;
        return new Promise<Response>((resolve) => {
          resolveValidate = resolve;
        });
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<DatasetsView />);

    await waitFor(() => {
      expect(screen.getByText("1 / 2 available")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Showing 2 of 2 registered datasets"),
    ).toBeInTheDocument();

    // Filter to unavailable
    await user.selectOptions(
      screen.getByLabelText("Filter by availability"),
      "unavailable",
    );
    expect(
      screen.getByText("Showing 1 of 2 registered datasets"),
    ).toBeInTheDocument();

    // Reset filters
    await user.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(
      screen.getByText("Showing 2 of 2 registered datasets"),
    ).toBeInTheDocument();

    // Open MNIST detail sheet
    await user.click(
      screen.getByRole("button", { name: "Inspect dataset mnist" }),
    );
    const dialog = await screen.findByRole("dialog");

    // Statistics & copyable paths
    await waitFor(() => {
      expect(within(dialog).getByText("54,000")).toBeInTheDocument();
      expect(within(dialog).getByText("6,000")).toBeInTheDocument();
    });
    expect(
      within(dialog).getByRole("button", { name: "Copy Dataset Local Path" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy Config Path" }),
    ).toBeInTheDocument();

    // Workspace links
    expect(
      within(dialog).getByRole("link", { name: /Model Training/i }),
    ).toHaveAttribute("href", "/training");
    expect(
      within(dialog).getByRole("link", { name: /Model Evaluation/i }),
    ).toHaveAttribute("href", "/evaluation");

    // Trigger validation and verify duplicate submission is prevented while pending
    const validateBtn = within(dialog).getByRole("button", {
      name: /Validate dataset/i,
    });
    await user.click(validateBtn);
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: /Validating/i }),
      ).toBeDisabled();
    });
    expect(validateCalls).toBe(1);

    resolveValidate!(jsonResponse(MOCK_VALID_RESPONSE));

    await waitFor(() => {
      expect(
        within(dialog).getByText("Result: Valid dataset"),
      ).toBeInTheDocument();
    });
    const checksList = within(dialog).getByRole("list", {
      name: "Dataset validation checks",
    });
    expect(within(checksList).getAllByRole("listitem")).toHaveLength(5);
  });

  it("separates validation network errors from invalid dataset responses", async () => {
    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/datasets")) {
        return Promise.resolve(
          jsonResponse({ datasets: [MOCK_DATASETS[0]], count: 1 }),
        );
      }
      if (url.endsWith("/datasets/mnist")) {
        return Promise.resolve(jsonResponse(MOCK_DATASETS[0]));
      }
      if (url.endsWith("/datasets/mnist/statistics")) {
        return Promise.resolve(jsonResponse(MOCK_MNIST_STATS));
      }
      if (url.endsWith("/datasets/validate") && init?.method === "POST") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<DatasetsView />);

    await waitFor(() => {
      expect(screen.getByText("1 / 1 available")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Inspect dataset mnist" }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: /Validate dataset/i }),
    );

    await waitFor(() => {
      expect(
        within(dialog).getByText(/This indicates a request or network error, not an invalid dataset/i),
      ).toBeInTheDocument();
    });
    expect(
      within(dialog).queryByText("Result: Validation failed"),
    ).not.toBeInTheDocument();
  });

  it("renders empty and offline states cleanly", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithQueryClient(<DatasetsView />);

    await waitFor(() => {
      expect(
        screen.getByText("Backend offline or unreachable"),
      ).toBeInTheDocument();
    });
  });
});
