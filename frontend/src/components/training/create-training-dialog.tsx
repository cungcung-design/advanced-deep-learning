"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Cpu,
  DownloadCloud,
  FlaskConical,
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
  CreateTrainingJobRequest,
  DatasetSummary,
  TrainingPreset,
} from "@/lib/api/types";
import {
  clonePresetConfig,
  formatTrainingApiError,
  getFixedImageSize,
  usesPretrainedWeights,
} from "@/lib/training";
import { cn } from "@/lib/utils";

const trainingFormSchema = z
  .object({
    model: z.string().min(1, "Select a training preset"),
    dataset: z.string().min(1, "Dataset is required"),
    epochs: z
      .number({ message: "Enter an integer between 1 and 20" })
      .int("Epochs must be an integer")
      .min(1, "Epochs must be at least 1")
      .max(20, "Epochs must be at most 20"),
    batch_size: z
      .number({ message: "Enter an integer between 1 and 512" })
      .int("Batch size must be an integer")
      .min(1, "Batch size must be at least 1")
      .max(512, "Batch size must be at most 512"),
    learning_rate: z
      .number({ message: "Enter a number greater than 0" })
      .gt(0, "Learning rate must be greater than 0"),
    weight_decay: z
      .number({ message: "Enter a number >= 0" })
      .min(0, "Weight decay must be 0 or greater"),
    val_fraction: z
      .number({ message: "Enter a value between 0 and 0.5" })
      .gt(0, "Validation fraction must be greater than 0")
      .lt(0.5, "Validation fraction must be less than 0.5"),
    seed: z
      .number({ message: "Enter an integer seed" })
      .int("Seed must be an integer"),
    num_workers: z
      .number({ message: "Enter an integer between 0 and 8" })
      .int("Workers must be an integer")
      .min(0, "Workers must be at least 0")
      .max(8, "Workers must be at most 8"),
    image_size: z
      .number({ message: "Enter an integer between 28 and 224" })
      .int("Image size must be an integer")
      .min(28, "Image size must be at least 28")
      .max(224, "Image size must be at most 224"),
  })
  .superRefine((values, ctx) => {
    const fixedSize = getFixedImageSize(values.model);
    if (fixedSize !== null && values.image_size !== fixedSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["image_size"],
        message: `${values.model} requires image_size=${fixedSize}`,
      });
    }
  });

type TrainingFormValues = z.infer<typeof trainingFormSchema>;

interface CreateTrainingDialogProps {
  open: boolean;
  presets: TrainingPreset[];
  presetsLoading: boolean;
  presetsError: unknown;
  datasets?: readonly DatasetSummary[];
  isSubmitting: boolean;
  submitError: unknown;
  onOpenChange: (open: boolean) => void;
  onRetryPresets: () => void;
  onSubmit: (payload: CreateTrainingJobRequest) => void;
}

export function CreateTrainingDialog({
  open,
  presets,
  presetsLoading,
  presetsError,
  datasets,
  isSubmitting,
  submitError,
  onOpenChange,
  onRetryPresets,
  onSubmit,
}: CreateTrainingDialogProps) {
  const defaultPreset = presets[0];

  const form = useForm<TrainingFormValues>({
    resolver: zodResolver(trainingFormSchema),
    defaultValues: defaultPreset
      ? {
          model: defaultPreset.model,
          dataset: defaultPreset.dataset,
          ...clonePresetConfig(defaultPreset),
        }
      : {
          model: "",
          dataset: "",
          epochs: 1,
          batch_size: 32,
          learning_rate: 0.001,
          weight_decay: 0.0005,
          val_fraction: 0.1,
          seed: 42,
          num_workers: 0,
          image_size: 128,
        },
  });

  const selectedModel = useWatch({
    control: form.control,
    name: "model",
  });

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.model === selectedModel) ?? presets[0],
    [presets, selectedModel],
  );

  // Initialize form when dialog opens or presets finish loading
  useEffect(() => {
    if (!open || !presets.length) {
      return;
    }
    const currentModel = form.getValues("model");
    const target =
      presets.find((preset) => preset.model === currentModel) ?? presets[0];
    form.reset({
      model: target.model,
      dataset: target.dataset,
      ...clonePresetConfig(target),
    });
  }, [open, presets, form]);

  const handleSelectPreset = (preset: TrainingPreset) => {
    form.reset({
      model: preset.model,
      dataset: preset.dataset,
      ...clonePresetConfig(preset),
    });
  };

  const fixedImageSize = selectedPreset
    ? getFixedImageSize(selectedPreset.model)
    : null;
  const needsPretrainedWeights = selectedPreset
    ? usesPretrainedWeights(selectedPreset.model)
    : false;

  const matchedDataset = useMemo(
    () =>
      selectedPreset
        ? datasets?.find((d) => d.dataset_id === selectedPreset.dataset)
        : undefined,
    [datasets, selectedPreset],
  );

  const formattedPresetsError = presetsError
    ? formatTrainingApiError(presetsError)
    : null;
  const formattedSubmitError = submitError
    ? formatTrainingApiError(submitError)
    : null;

  const handleFormSubmit = form.handleSubmit((values) => {
    onSubmit({
      model: values.model,
      dataset: values.dataset,
      config: {
        epochs: values.epochs,
        batch_size: values.batch_size,
        learning_rate: values.learning_rate,
        weight_decay: values.weight_decay,
        val_fraction: values.val_fraction,
        seed: values.seed,
        num_workers: values.num_workers,
        image_size: values.image_size,
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/10 bg-[#141722] text-zinc-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <FlaskConical
              className="size-4 text-indigo-400"
              aria-hidden="true"
            />
            New Training Run
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Select a backend-supported training preset and optionally adjust
            supported hyperparameters.
          </DialogDescription>
        </DialogHeader>

        {presetsLoading ? (
          <div className="space-y-3 py-4" aria-label="Loading presets">
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
              <AlertTitle>No training presets returned</AlertTitle>
              <AlertDescription>
                The backend did not expose any training presets. Verify the
                training service configuration.
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
            {/* Preset selection */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                1. Model Preset & Compatible Dataset
              </Label>
              <div
                role="radiogroup"
                aria-label="Training presets"
                className="grid gap-2.5 sm:grid-cols-2"
              >
                {presets.map((preset) => {
                  const active = selectedPreset?.model === preset.model;
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
                        <span className="text-sm font-medium">
                          {preset.display_name}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/[0.04] font-mono text-[10px] text-zinc-300"
                        >
                          {preset.dataset}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        {preset.model} · {preset.architecture}
                      </p>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        Defaults: {preset.default_config.epochs} ep · batch{" "}
                        {preset.default_config.batch_size} · lr{" "}
                        {preset.default_config.learning_rate} ·{" "}
                        {preset.default_config.image_size}px
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Execution & compatibility notices */}
            <div className="space-y-2.5">
              <Alert variant="info">
                <Cpu className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <AlertTitle>Local CPU-compatible execution</AlertTitle>
                  <AlertDescription>
                    Jobs execute sequentially in the local FastAPI background
                    worker. CPU execution is supported without a GPU; larger
                    epochs or image sizes will take longer on CPU.
                  </AlertDescription>
                </div>
              </Alert>

              {needsPretrainedWeights && (
                <Alert variant="warning">
                  <DownloadCloud
                    className="mt-0.5 size-4 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <AlertTitle>Pretrained ResNet18 weights notice</AlertTitle>
                    <AlertDescription>
                      This preset loads torchvision pretrained ResNet18 weights.
                      If weights are not already in your local cache, PyTorch
                      may require a network download to fetch them.
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
                      Dataset &quot;{matchedDataset.display_name}&quot; appears
                      missing locally
                    </AlertTitle>
                    <AlertDescription>
                      The backend currently reports this dataset as unavailable
                      locally and will reject submission with{" "}
                      <code className="font-mono">DATASET_UNAVAILABLE</code>{" "}
                      until its local files are present.
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </div>

            {/* Supported configuration overrides */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  2. Supported Configuration
                </Label>
                {selectedPreset && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={isSubmitting}
                    onClick={() => handleSelectPreset(selectedPreset)}
                    className="text-zinc-400 hover:text-zinc-100"
                  >
                    Restore preset defaults
                  </Button>
                )}
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="training-epochs" className="text-xs text-zinc-300">
                    Epochs (1–20)
                  </Label>
                  <Input
                    id="training-epochs"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.epochs)}
                    {...form.register("epochs", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.epochs && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.epochs.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="training-batch-size" className="text-xs text-zinc-300">
                    Batch size (1–512)
                  </Label>
                  <Input
                    id="training-batch-size"
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
                  <Label htmlFor="training-lr" className="text-xs text-zinc-300">
                    Learning rate (&gt; 0)
                  </Label>
                  <Input
                    id="training-lr"
                    type="number"
                    step="any"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.learning_rate)}
                    {...form.register("learning_rate", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.learning_rate && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.learning_rate.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="training-weight-decay" className="text-xs text-zinc-300">
                    Weight decay (&ge; 0)
                  </Label>
                  <Input
                    id="training-weight-decay"
                    type="number"
                    step="any"
                    min={0}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.weight_decay)}
                    {...form.register("weight_decay", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.weight_decay && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.weight_decay.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="training-val-fraction" className="text-xs text-zinc-300">
                    Validation fraction (0 &lt; v &lt; 0.5)
                  </Label>
                  <Input
                    id="training-val-fraction"
                    type="number"
                    step="0.05"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.val_fraction)}
                    {...form.register("val_fraction", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.val_fraction && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.val_fraction.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="training-seed" className="text-xs text-zinc-300">
                    Seed (integer)
                  </Label>
                  <Input
                    id="training-seed"
                    type="number"
                    step={1}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(form.formState.errors.seed)}
                    {...form.register("seed", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm"
                  />
                  {form.formState.errors.seed && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.seed.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="training-num-workers" className="text-xs text-zinc-300">
                    DataLoader workers (0–8)
                  </Label>
                  <Input
                    id="training-num-workers"
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

                <div className="space-y-1.5">
                  <Label htmlFor="training-image-size" className="text-xs text-zinc-300">
                    Image size (28–224)
                    {fixedImageSize !== null && (
                      <span className="ml-1.5 text-[11px] text-zinc-500">
                        Fixed at {fixedImageSize}px
                      </span>
                    )}
                  </Label>
                  <Input
                    id="training-image-size"
                    type="number"
                    min={28}
                    max={224}
                    step={1}
                    disabled={isSubmitting || fixedImageSize !== null}
                    aria-invalid={Boolean(form.formState.errors.image_size)}
                    {...form.register("image_size", { valueAsNumber: true })}
                    className="border-white/10 bg-[#10121A] font-mono text-sm disabled:opacity-60"
                  />
                  {form.formState.errors.image_size && (
                    <p className="text-xs text-red-400" role="alert">
                      {form.formState.errors.image_size.message}
                    </p>
                  )}
                </div>
              </div>

              <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Info className="size-3.5 shrink-0" aria-hidden="true" />
                Only the eight backend-accepted configuration fields are
                submitted.
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
                    Starting run...
                  </>
                ) : (
                  "Start training run"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
