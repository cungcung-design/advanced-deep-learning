"use client";

import { useMemo, useState } from "react";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEmbeddingsInference,
  useNerInference,
  useSentimentInference,
} from "@/lib/api/mutations/nlp";
import { useNlpModels } from "@/lib/api/queries/nlp";
import type {
  EmbeddingResponse,
  NerResponse,
  SentimentModelKind,
  SentimentResponse,
} from "@/lib/api/types";
import { formatNlpApiError, type NlpSessionEntry } from "@/lib/nlp";
import { cn } from "@/lib/utils";
import { NlpEmbeddingsTab } from "./nlp-embeddings-tab";
import { NlpModelsStrip } from "./nlp-models-strip";
import { NlpNerTab } from "./nlp-ner-tab";
import { NlpSentimentTab } from "./nlp-sentiment-tab";
import { NlpSessionHistory } from "./nlp-session-history";

function formatNow(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

export function NlpView() {
  const modelsQuery = useNlpModels();
  const sentimentMutation = useSentimentInference();
  const embeddingsMutation = useEmbeddingsInference();
  const nerMutation = useNerInference();

  const models = useMemo(
    () => modelsQuery.data?.models ?? [],
    [modelsQuery.data],
  );
  const availableCount = useMemo(
    () => models.filter((m) => m.available).length,
    [models],
  );

  const [sentimentResult, setSentimentResult] =
    useState<SentimentResponse | null>(null);
  const [embeddingResult, setEmbeddingResult] =
    useState<EmbeddingResponse | null>(null);
  const [embeddingTexts, setEmbeddingTexts] = useState<string[]>([]);
  const [nerResult, setNerResult] = useState<NerResponse | null>(null);
  const [history, setHistory] = useState<NlpSessionEntry[]>([]);

  const modelsError = modelsQuery.error
    ? formatNlpApiError(modelsQuery.error)
    : null;

  const handleRunSentiment = (text: string, model: SentimentModelKind) => {
    sentimentMutation.mutate(
      { text, model },
      {
        onSuccess: (response) => {
          setSentimentResult(response);
          setHistory((prev) => [
            {
              id: `sent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: formatNow(),
              task: "sentiment",
              preview: text.slice(0, 90),
              result: response,
            },
            ...prev,
          ]);
        },
      },
    );
  };

  const handleRunEmbeddings = (texts: string[]) => {
    embeddingsMutation.mutate(
      { texts },
      {
        onSuccess: (response) => {
          setEmbeddingResult(response);
          setEmbeddingTexts(texts);
          setHistory((prev) => [
            {
              id: `emb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: formatNow(),
              task: "embeddings",
              preview: texts.join(" | ").slice(0, 90),
              result: response,
            },
            ...prev,
          ]);
        },
      },
    );
  };

  const handleRunNer = (text: string) => {
    nerMutation.mutate(
      { text },
      {
        onSuccess: (response) => {
          setNerResult(response);
          setHistory((prev) => [
            {
              id: `ner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: formatNow(),
              task: "ner",
              preview: text.slice(0, 90),
              result: response,
            },
            ...prev,
          ]);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              NLP Playground
            </h1>
            {!modelsQuery.isLoading && !modelsError && (
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
              >
                {availableCount} / {models.length} models ready
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Run local CPU sentiment analysis, batch text embeddings with cosine
            similarity, and named entity recognition.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void modelsQuery.refetch()}
          disabled={modelsQuery.isFetching}
          className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
        >
          <RefreshCw
            className={cn("size-4", modelsQuery.isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh Models
        </Button>
      </header>

      {/* Offline / Error state */}
      {modelsError ? (
        modelsError.isOffline ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#11131A] px-6 py-12 text-center"
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <WifiOff className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              {modelsError.title}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
              {modelsError.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void modelsQuery.refetch()}
              className="mt-5 border-white/10 bg-transparent text-zinc-200"
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>{modelsError.title}</AlertTitle>
              <AlertDescription>{modelsError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void modelsQuery.refetch()}
            >
              Retry
            </Button>
          </Alert>
        )
      ) : (
        <>
          <NlpModelsStrip models={models} isLoading={modelsQuery.isLoading} />

          <Tabs defaultValue="sentiment" className="w-full space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-[#171A24]">
              <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
              <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
              <TabsTrigger value="ner">NER</TabsTrigger>
            </TabsList>

            <TabsContent value="sentiment" className="mt-0">
              <NlpSentimentTab
                models={models}
                result={sentimentResult}
                isPending={sentimentMutation.isPending}
                error={sentimentMutation.error}
                onRun={handleRunSentiment}
              />
            </TabsContent>

            <TabsContent value="embeddings" className="mt-0">
              <NlpEmbeddingsTab
                models={models}
                result={embeddingResult}
                submittedTexts={embeddingTexts}
                isPending={embeddingsMutation.isPending}
                error={embeddingsMutation.error}
                onRun={handleRunEmbeddings}
              />
            </TabsContent>

            <TabsContent value="ner" className="mt-0">
              <NlpNerTab
                models={models}
                result={nerResult}
                isPending={nerMutation.isPending}
                error={nerMutation.error}
                onRun={handleRunNer}
              />
            </TabsContent>
          </Tabs>

          <NlpSessionHistory
            entries={history}
            onClear={() => setHistory([])}
          />
        </>
      )}
    </div>
  );
}
