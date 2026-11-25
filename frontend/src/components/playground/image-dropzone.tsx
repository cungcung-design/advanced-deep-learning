"use client";

import { useRef, useState } from "react";
import { AlertCircle, ImagePlus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/evaluation";
import { cn } from "@/lib/utils";

interface ImageDropzoneProps {
  file: File | null;
  previewUrl: string | null;
  validationError: string | null;
  disabled?: boolean;
  onSelectFile: (file: File) => void;
  onClearFile: () => void;
}

export function ImageDropzone({
  file,
  previewUrl,
  validationError,
  disabled = false,
  onSelectFile,
  onClearFile,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (picked) {
      onSelectFile(picked);
    }
    // Reset input value so re-selecting the same file still fires onChange
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) {
      return;
    }
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      onSelectFile(dropped);
    }
  };

  const openFilePicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              2. Input Image
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              Upload a PNG, JPEG, or WebP image (maximum 5 MB).
            </p>
          </div>
          {file && (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={disabled}
                onClick={openFilePicker}
                className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={disabled}
                onClick={onClearFile}
                aria-label="Clear selected image"
                className="text-zinc-400 hover:text-red-300"
              >
                <Trash2 className="size-3" aria-hidden="true" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          aria-label="Upload image file"
          disabled={disabled}
          onChange={handleFileChange}
          className="sr-only"
        />

        {file && previewUrl ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#0B0D13] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`Selected preview: ${file.name}`}
                className="max-h-64 w-auto rounded-lg object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#141722] px-3.5 py-2.5 text-xs">
              <span className="truncate font-mono text-zinc-200">
                {file.name}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-zinc-400">
                {file.type || "image"} · {formatBytes(file.size)}
              </span>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={openFilePicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFilePicker();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) {
                setIsDragging(true);
              }
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              isDragging
                ? "border-indigo-400 bg-indigo-500/10"
                : "border-white/15 bg-[#141722]/70 hover:border-indigo-400/40 hover:bg-[#141722]",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
              {isDragging ? (
                <UploadCloud className="size-5" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-5" aria-hidden="true" />
              )}
            </div>
            <p className="text-sm font-medium text-zinc-200">
              Drop an image here or click to browse
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              PNG, JPEG, or WebP · up to 5 MB
            </p>
          </div>
        )}

        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>Invalid image file</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
