"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useImageInference } from "@/lib/api/mutations/inference";
import { useImageModels } from "@/lib/api/queries/inference";
import type { ImageInferenceResponse } from "@/lib/api/types";
import {
  DEFAULT_TOP_K,
  clampTopK,
  formatInferenceApiError,
  selectFirstAvailableModel,
  validateImageFile,
  type SessionInferenceEntry,
} from "@/lib/inference";
import { cn } from "@/lib/utils";
import { ImageDropzone } from "./image-dropzone";
import { ImageModelSelector } from "./image-model-selector";
import { InferenceResultPanel } from "./inference-result-panel";
import { SessionHistoryPanel } from "./session-history-panel";

export function PlaygroundView() {
  const modelsQuery = useImageModels();
  const inferenceMutation = useImageInference();

  const models = useMemo(
    () => modelsQuery.data?.models ?? [],
    [modelsQuery.data],
  );

  const [userSelectedModelId, setUserSelectedModelId] = useState<string | null>(
    null,
  );
  const [topK, setTopK] = useState<number>(DEFAULT_TOP_K);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [activeResult, setActiveResult] =
    useState<ImageInferenceResponse | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionInferenceEntry[]>([]);

  const previewUrlRef = useRef<string | null>(null);

  // Revoke any temporary object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  // Derive effective selected model without auto-selecting unavailable models
  const selectedModelId = useMemo(() => {
    if (
      userSelectedModelId &&
      models.some((m) => m.model_id === userSelectedModelId)
    ) {
      return userSelectedModelId;
    }
    return selectFirstAvailableModel(models)?.model_id ?? null;
  }, [userSelectedModelId, models]);

  const selectedModel = useMemo(
    () => models.find((m) => m.model_id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const availableCount = useMemo(
    () => models.filter((m) => m.available).length,
    [models],
  );

  const revokeCurrentPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const handleSelectFile = (picked: File) => {
    const check = validateImageFile(picked);
    if (!check.valid) {
      setFileError(check.error);
      return;
    }
    revokeCurrentPreview();
    const nextUrl = URL.createObjectURL(picked);
    previewUrlRef.current = nextUrl;
    setFile(picked);
    setPreviewUrl(nextUrl);
    setFileError(null);
    inferenceMutation.reset();
  };

  const handleClearFile = () => {
    revokeCurrentPreview();
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
    inferenceMutation.reset();
  };

  const canRunInference = Boolean(
    file &&
      !fileError &&
      selectedModel &&
      selectedModel.available &&
      !inferenceMutation.isPending,
  );

  const handleRunInference = () => {
    if (!file || !selectedModel || !selectedModel.available) {
      return;
    }

    const effectiveTopK = clampTopK(topK);
    inferenceMutation.mutate(
      {
        file,
        model_id: selectedModel.model_id,
        top_k: effectiveTopK,
      },
      {
        onSuccess: (response) => {
          const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const entry: SessionInferenceEntry = {
            id: entryId,
            timestamp: new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(new Date()),
            fileName: file.name,
            modelDisplayName: selectedModel.display_name,
            result: response,
          };
          setActiveResult(response);
          setActiveHistoryId(entryId);
          setHistory((prev) => [entry, ...prev]);
        },
      },
    );
  };

  const modelsError = modelsQuery.error
    ? formatInferenceApiError(modelsQuery.error)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              AI Playground
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
            Upload a local image and run real CPU classification inference with
            Top-K probability scores and latency metrics.
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

      {/* Models error / offline state */}
      {modelsError &&
        (modelsError.isOffline ? (
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
        ))}

      {/* Main 2-column workspace */}
      {!modelsError && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          {/* Left column: model selector + upload + run button */}
          <div className="min-w-0 space-y-5">
            <ImageModelSelector
              models={models}
              selectedModelId={selectedModelId}
              topK={topK}
              isLoading={modelsQuery.isLoading}
              disabled={inferenceMutation.isPending}
              onSelectModel={(modelId) => {
                setUserSelectedModelId(modelId);
                inferenceMutation.reset();
              }}
              onChangeTopK={(value) => setTopK(clampTopK(value))}
            />

            <ImageDropzone
              file={file}
              previewUrl={previewUrl}
              validationError={fileError}
              disabled={inferenceMutation.isPending}
              onSelectFile={handleSelectFile}
              onClearFile={handleClearFile}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-4">
              <p className="text-xs text-zinc-400">
                {!selectedModel
                  ? "Select an available model to enable inference."
                  : !selectedModel.available
                    ? "Selected model checkpoint is missing."
                    : !file
                      ? "Upload a valid PNG, JPEG, or WebP image."
                      : `Ready to classify with ${selectedModel.display_name} (Top-${topK}).`}
              </p>
              <Button
                type="button"
                size="lg"
                disabled={!canRunInference}
                onClick={handleRunInference}
                className="bg-indigo-500 text-white hover:bg-indigo-400"
              >
                {inferenceMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Running inference...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Run Inference
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right column: prediction results + session history */}
          <div className="min-w-0 space-y-5">
            <InferenceResultPanel
              result={activeResult}
              models={models}
              isPending={inferenceMutation.isPending}
              error={inferenceMutation.error}
            />

            <SessionHistoryPanel
              entries={history}
              activeEntryId={activeHistoryId}
              onSelectEntry={(entry) => {
                setActiveResult(entry.result);
                setActiveHistoryId(entry.id);
              }}
              onClearHistory={() => {
                setHistory([]);
                setActiveHistoryId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
