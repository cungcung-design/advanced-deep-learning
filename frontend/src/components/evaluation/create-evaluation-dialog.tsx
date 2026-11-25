"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Cpu,
  Gauge,
  Info,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CreateEvaluationRequest,
  DatasetSummary,
  EvaluationPreset,
  RegistryModelSummary,
} from "@/lib/api/types";
import { formatEvaluationApiError } from "@/lib/evaluation";
import { cn } from "@/lib/utils";

const evaluationFormSchema = z.object({
  model: z.string().min(1, "Select a model preset"),
  dataset: z.string().min(1, "Dataset is required"),
  batch_size: z
    .number({ message: "Enter an integer between 1 and 512" })
    .int("Batch size must be an integer")
    .min(1, "Batch size must be at least 1")
    .max(512, "Batch size must be at most 512"),
  max_samples: z
    .union([
      z.literal(""),
      z.string().refine(
        (val) => {
          const parsed = Number(val);
          return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100000;
        },
        { message: "Max samples must be an integer between 1 and 100000" },
      ),
    ]),
  num_workers: z
    .number({ message: "Enter an integer between 0 and 8" })
    .int("Workers must be an integer")
    .min(0, "Workers must be at least 0")
    .max(8, "Workers must be at most 8"),
});

type EvaluationFormValues = z.infer<typeof evaluationFormSchema>;

interface CreateEvaluationDialogProps {
  open: boolean;
  initialModel?: string | null;
  presets: EvaluationPreset[];
  presetsLoading: boolean;
  presetsError: unknown;
  registryModels?: readonly RegistryModelSummary[];
  datasets?: readonly DatasetSummary[];
  isSubmitting: boolean;
  submitError: unknown;
  onOpenChange: (open: boolean) => void;
  onRetryPresets: () => void;
  onSubmit: (payload: CreateEvaluationRequest) => void;
}

export function CreateEvaluationDialog({
  open,
  initialModel,
  presets,
  presetsLoading,
  presetsError,
  registryModels,
  datasets,
  isSubmitting,
  submitError,
  onOpenChange,
  onRetryPresets,
  onSubmit,
}: CreateEvaluationDialogProps) {
  const defaultPreset = presets[0];

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues: defaultPreset
      ? {
          model: defaultPreset.model,
          dataset: defaultPreset.dataset,
          batch_size: defaultPreset.default_config.batch_size,
          max_samples:
            defaultPreset.default_config.max_samples !== null
              ? String(defaultPreset.default_config.max_samples)
              : "",
          num_workers: defaultPreset.default_config.num_workers,
        }
      : {
          model: "",
          dataset: "",
          batch_size: 64,
          max_samples: "",
          num_workers: 0,
        },
  });

  const selectedModel = useWatch({
    control: form.control,
    name: "model",
  });

  const selectedPreset = useMemo(
    () => presets.find((p) => p.model === selectedModel) ?? presets[0],
    [presets, selectedModel],
  );

  useEffect(() => {
    if (!open || !presets.length) {
      return;
    }
    const target =
      (initialModel && presets.find((p) => p.model === initialModel)) ||
      presets.find((p) => p.model === form.getValues("model")) ||
      presets[0];

    form.reset({
      model: target.model,
      dataset: target.dataset,
      batch_size: target.default_config.batch_size,
      max_samples:
        target.default_config.max_samples !== null
          ? String(target.default_config.max_samples)
          : "",
      num_workers: target.default_config.num_workers,
    });
  }, [open, initialModel, presets, form]);

  const handleSelectPreset = (preset: EvaluationPreset) => {
    form.reset({
      model: preset.model,
      dataset: preset.dataset,
      batch_size: preset.default_config.batch_size,
      max_samples:
        preset.default_config.max_samples !== null
          ? String(preset.default_config.max_samples)
          : "",
      num_workers: preset.default_config.num_workers,
    });
  };

  const matchedRegistry = useMemo(
    () =>
      selectedPreset
        ? registryModels?.find((m) => m.model_id === selectedPreset.model)
        : undefined,
    [registryModels, selectedPreset],
  );

  const matchedDataset = useMemo(
    () =>
      selectedPreset
        ? datasets?.find((d) => d.dataset_id === selectedPreset.dataset)
        : undefined,
    [datasets, selectedPreset],
  );

  const formattedPresetsError = presetsError
    ? formatEvaluationApiError(presetsError)
    : null;
  const formattedSubmitError = submitError
    ? formatEvaluationApiError(submitError)
    : null;

  const handleFormSubmit = form.handleSubmit((values) => {
    const trimmedMax = values.max_samples.trim();
    const maxSamples = trimmedMax === "" ? null : Number(trimmedMax);

    onSubmit({
      model: values.model,
      dataset: values.dataset,
      config: {
        batch_size: values.batch_size,
        max_samples: maxSamples,
        num_workers: values.num_workers,
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/10 bg-[#141722] text-zinc-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <Gauge className="size-4 text-indigo-400" aria-hidden="true" />
            New Evaluation Run
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Evaluate a registered checkpoint against its held-out test split and
            compute real classification metrics and confusion matrix.
          </DialogDescription>
        </DialogHeader>

        {presetsLoading ? (
          <div className="space-y-3 py-4" aria-label="Loading evaluation presets">
            <Skeleton className="h-20 w-full bg-white/[0.06]" />
            <Skeleton className="h-20 w-full bg-white/[0.06]" />
          </div>
        ) : formattedPresetsError ? (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>{formattedPresetsError.title}</AlertTitle>
              <AlertDescription>{formattedPresetsError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onRetryPresets}
            >
              Retry
            </Button>
          </Alert>
        ) : presets.length === 0 ? (
          <Alert variant="warning">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>No evaluation presets returned</AlertTitle>
              <AlertDescription>
                The backend did not expose any evaluation presets.
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
            {/* Preset selection */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                1. Registered Model & Compatible Test Dataset
              </Label>
              <div
                role="radiogroup"
                aria-label="Evaluation presets"
                className="grid gap-2.5 sm:grid-cols-2"
              >
                {presets.map((preset) => {
                  const active = selectedPreset?.model === preset.model;
                  const reg = registryModels?.find(
                    (m) => m.model_id === preset.model,
                  );
                  const unavailable = reg !== undefined && !reg.available;

                  return (
                    <button
                      key={preset.model}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={isSubmitting}
                      onClick={() => handleSelectPreset(preset)}
                      className={cn(
                        "flex flex-col items-start rounded-xl border p-3.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        active
                          ? "border-indigo-400/50 bg-indigo-500/[0.12] text-white"
                          : "border-white/[0.08] bg-[#10121A] text-zinc-300 hover:border-white/20 hover:bg-white/[0.03]",
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {preset.display_name}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-white/10 bg-white/[0.04] font-mono text-[10px] text-zinc-300"
                        >
                          {preset.dataset}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        {preset.model} · {preset.architecture}
                      </p>
                      <div className="mt-2 flex w-full items-center justify-between gap-2 text-[11px]">
                        <span className="text-zinc-400">
                          {preset.task.replace(/_/g, " ")}
                        </span>
                        {unavailable && (
                          <span className="text-amber-300">Checkpoint missing</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notices & warnings */}
            <div className="space-y-2.5">
              <Alert variant="info">
                <Cpu
                  className="mt-0.5 size-4 shrink-0 text-indigo-300"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <AlertTitle>Held-out test split on local CPU</AlertTitle>
                  <AlertDescription>
                    Evaluations always run real inference on the held-out test
                    split (never training data or cached JSON summaries). Set{" "}
                    <code className="font-mono">max_samples</code> for faster CPU
                    checks on ResNet18 or DistilBERT.
                  </AlertDescription>
                </div>
              </Alert>

              {matchedRegistry && !matchedRegistry.available && (
                <Alert variant="warning">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle>Checkpoint unavailable locally</AlertTitle>
                    <AlertDescription>
                      The registry reports{" "}
                      <code className="font-mono">{selectedPreset?.model}</code>{" "}
                      as missing ({matchedRegistry.error ?? "file not found"}).
                      The backend will reject submission with{" "}
                      <code className="font-mono">MODEL_UNAVAILABLE</code>.
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {matchedDataset && !matchedDataset.available && (
                <Alert variant="warning">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle>
                      Dataset &quot;{matchedDataset.display_name}&quot; unavailable
                    </AlertTitle>
                    <AlertDescription>
                      Required local test files are missing; submission will be
                      rejected with{" "}
                      <code className="font-mono">DATASET_UNAVAILABLE</code>.
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>

            {/* Supported configuration */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                2. Supported Evaluation Configuration
              </Label>

              <div className="grid gap-3.5 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="eval-batch-size" className="text-xs text-zinc-300">
                    Batch size (1–512)
                  </Label>
                  <Input
                    id="eval-batch-size"
                    type="number"
                    min={1}
                    max={512}
                    step={1}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.batch_size)}
                    {...form.register("batch_size", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.batch_size && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.batch_size.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eval-max-samples" className="text-xs text-zinc-300">
                    Max samples (optional)
                  </Label>
                  <Input
                    id="eval-max-samples"
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    placeholder="Full test split"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.max_samples)}
                    {...form.register("max_samples")}
                    className="border-white/10 bg-[#10121A] font-mono text-sm placeholder:text-zinc-600"
                  />
                  {form.formState.errors.max_samples && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.max_samples.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eval-num-workers" className="text-xs text-zinc-300">
                    Workers (0–8)
                  </Label>
                  <Input
                    id="eval-num-workers"
                    type="number"
                    min={0}
                    max={8}
                    step={1}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.num_workers)}
                    {...form.register("num_workers", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.num_workers && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.num_workers.message}
                    </p>
                  )}
                </div>
              </div>

              <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Info className="size-3.5 shrink-0" aria-hidden="true" />
                Only <code className="font-mono">batch_size</code>,{" "}
                <code className="font-mono">max_samples</code>, and{" "}
                <code className="font-mono">num_workers</code> are accepted by
                the backend (<code className="font-mono">extra=&quot;forbid&quot;</code>).
              </p>
            </div>

            {formattedSubmitError && (
              <Alert variant="destructive">
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <AlertTitle>{formattedSubmitError.title}</AlertTitle>
                  <AlertDescription>
                    {formattedSubmitError.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            <DialogFooter className="border-white/[0.08] bg-[#10121A]/80">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className="border-white/10 bg-transparent text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedPreset}
                className="bg-indigo-500 text-white hover:bg-indigo-400"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Starting evaluation...
                  </>
                ) : (
                  "Start evaluation"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
