import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NlpView } from "@/components/nlp/nlp-view";
import type {
  EmbeddingResponse,
  NerResponse,
  NlpModelInfo,
  SentimentResponse,
} from "@/lib/api/types";

const REAL_NLP_MODELS: NlpModelInfo[] = [
  {
    model_id: "distilbert_imdb_finetuned",
    display_name: "Fine-tuned DistilBERT IMDb sentiment",
    task: "sentiment",
    kind: "finetuned",
    available: true,
  },
  {
    model_id: "distilbert-base-uncased-finetuned-sst-2-english",
    display_name: "Pretrained DistilBERT SST-2 sentiment",
    task: "sentiment",
    kind: "pretrained",
    available: false,
  },
  {
    model_id: "distilbert-base-uncased",
    display_name: "DistilBERT mean-pooled embeddings",
    task: "embeddings",
    kind: "pretrained",
    available: true,
  },
  {
    model_id: "elastic/distilbert-base-uncased-finetuned-conll03-english",
    display_name: "DistilBERT CoNLL-03 named entity recognition",
    task: "ner",
    kind: "pretrained",
    available: false,
  },
];

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

describe("NlpView workspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("displays accurate availability, runs sentiment and embeddings with cosine similarity, disables unavailable NER, and records session history", async () => {
    const sentimentResp: SentimentResponse = {
      task: "sentiment",
      model_id: "distilbert_imdb_finetuned",
      label: "POSITIVE",
      score: 0.9345,
      inference_ms: 41.2,
    };

    const embeddingResp: EmbeddingResponse = {
      task: "embeddings",
      model_id: "distilbert-base-uncased",
      count: 2,
      dimension: 4,
      embeddings: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ],
      inference_ms: 52.8,
    };

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/inference/nlp/models")) {
        return Promise.resolve(
          jsonResponse({ models: REAL_NLP_MODELS, count: REAL_NLP_MODELS.length }),
        );
      }
      if (url.endsWith("/inference/nlp/sentiment") && init?.method === "POST") {
        return Promise.resolve(jsonResponse(sentimentResp));
      }
      if (url.endsWith("/inference/nlp/embeddings") && init?.method === "POST") {
        return Promise.resolve(jsonResponse(embeddingResp));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<NlpView />);

    await waitFor(() => {
      expect(screen.getByText("2 / 4 models ready")).toBeInTheDocument();
    });

    // Sentiment tab: auto-selected finetuned, pretrained shows Not Cached and disables button
    const sentimentRadioGroup = screen.getByRole("radiogroup", {
      name: "Sentiment model selection",
    });
    expect(
      within(sentimentRadioGroup).getByRole("radio", {
        name: /distilbert_imdb_finetuned/i,
      }),
    ).toHaveAttribute("aria-checked", "true");

    await user.click(
      within(sentimentRadioGroup).getByRole("radio", { name: /pretrained/i }),
    );
    expect(
      screen.getByText(/Selected sentiment model is not cached/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Analyze Sentiment/i }),
    ).toBeDisabled();

    // Switch back to finetuned, use example prompt, and run
    await user.click(
      within(sentimentRadioGroup).getByRole("radio", {
        name: /distilbert_imdb_finetuned/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Example 1" }));
    await user.click(screen.getByRole("button", { name: /Analyze Sentiment/i }));

    await waitFor(() => {
      expect(screen.getByText("POSITIVE")).toBeInTheDocument();
    });
    expect(screen.getByText("93.45%")).toBeInTheDocument();

    // Embeddings tab: batch input -> vectors + cosine similarity matrix
    await user.click(screen.getByRole("tab", { name: "Embeddings" }));
    await user.type(
      screen.getByLabelText(/Batch Texts/i),
      "First sentence\nSecond sentence",
    );
    await user.click(screen.getByRole("button", { name: /Extract Embeddings/i }));

    const matrix = await screen.findByRole("table", {
      name: "Pairwise cosine similarity matrix",
    });
    expect(within(matrix).getAllByText("1.0000")).toHaveLength(2);
    expect(within(matrix).getAllByText("0.0000")).toHaveLength(2);

    // NER tab: unavailable CoNLL-03 disables button
    await user.click(screen.getByRole("tab", { name: "NER" }));
    expect(
      screen.getByText(/NER model is not cached locally/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Extract Entities/i }),
    ).toBeDisabled();

    // Session history contains 2 entries and clears cleanly
    const historyList = screen.getByRole("list", {
      name: "NLP session history",
    });
    expect(within(historyList).getAllByRole("listitem")).toHaveLength(2);
    await user.click(
      screen.getByRole("button", { name: "Clear NLP session history" }),
    );
    expect(
      screen.getByText(/Completed NLP predictions from this session will appear here/i),
    ).toBeInTheDocument();
  });

  it("renders NER entities and empty-entities state when NER model is available", async () => {
    const allReady = REAL_NLP_MODELS.map((m) => ({ ...m, available: true }));
    const nerResp: NerResponse = {
      task: "ner",
      model_id: "elastic/distilbert-base-uncased-finetuned-conll03-english",
      entities: [
        { text: "Barack Obama", label: "PER", score: 0.9873 },
        { text: "Paris", label: "LOC", score: 0.9987 },
      ],
      inference_ms: 28.4,
    };

    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/inference/nlp/models")) {
        return Promise.resolve(jsonResponse({ models: allReady, count: 4 }));
      }
      if (url.endsWith("/inference/nlp/ner") && init?.method === "POST") {
        return Promise.resolve(jsonResponse(nerResp));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderWithQueryClient(<NlpView />);

    await waitFor(() => {
      expect(screen.getByText("4 / 4 models ready")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "NER" }));
    await user.click(screen.getByRole("button", { name: /Load example sentence/i }));
    await user.click(screen.getByRole("button", { name: /Extract Entities/i }));

    const list = await screen.findByRole("list", {
      name: "Detected named entities",
    });
    expect(within(list).getByText("Barack Obama")).toBeInTheDocument();
    expect(within(list).getByText("Paris")).toBeInTheDocument();
    expect(within(list).getByText("98.73%")).toBeInTheDocument();
  });

  it("renders offline state when backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithQueryClient(<NlpView />);
    await waitFor(() => {
      expect(
        screen.getByText("Backend offline or unreachable"),
      ).toBeInTheDocument();
    });
  });
});
