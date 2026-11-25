import { describe, expect, it } from "vitest";
import {
  deriveReadinessDisplay,
  formatTrainingProgressPercent,
  normalizeTrainingProgressPercent,
} from "@/lib/dashboard";

describe("Training progress normalization & formatting", () => {
  it("converts normalized 0..1 progress values to 0..100 percentages", () => {
    expect(normalizeTrainingProgressPercent(0)).toBe(0);
    expect(formatTrainingProgressPercent(0)).toBe("0%");

    expect(normalizeTrainingProgressPercent(0.5)).toBe(50);
    expect(formatTrainingProgressPercent(0.5)).toBe("50%");

    expect(normalizeTrainingProgressPercent(1.0)).toBe(100);
    expect(formatTrainingProgressPercent(1.0)).toBe("100%");

    expect(normalizeTrainingProgressPercent(0.335)).toBeCloseTo(33.5, 4);
    expect(formatTrainingProgressPercent(0.335)).toBe("33.5%");
  });

  it("handles missing, invalid, negative, and out-of-range values safely", () => {
    expect(normalizeTrainingProgressPercent(null)).toBe(0);
    expect(formatTrainingProgressPercent(null)).toBe("0%");

    expect(normalizeTrainingProgressPercent(undefined)).toBe(0);
    expect(formatTrainingProgressPercent(undefined)).toBe("0%");

    expect(normalizeTrainingProgressPercent(Number.NaN)).toBe(0);
    expect(formatTrainingProgressPercent(Number.NaN)).toBe("0%");

    expect(normalizeTrainingProgressPercent(-0.25)).toBe(0);
    expect(formatTrainingProgressPercent(-0.25)).toBe("0%");

    expect(normalizeTrainingProgressPercent(1.5)).toBe(100);
    expect(formatTrainingProgressPercent(1.5)).toBe("100%");
  });
});

describe("deriveReadinessDisplay", () => {
  it("distinguishes loading, unavailable, ready, and degraded readiness states", () => {
    expect(
      deriveReadinessDisplay({
        readiness: undefined,
        isLoading: true,
        isError: false,
      }),
    ).toEqual({
      label: "Checking",
      tone: "neutral",
      detail: "Checking database and artifact storage probes",
    });

    expect(
      deriveReadinessDisplay({
        readiness: undefined,
        isLoading: false,
        isError: true,
      }),
    ).toEqual({
      label: "Unavailable",
      tone: "error",
      detail: "Readiness endpoint could not be reached",
    });

    expect(
      deriveReadinessDisplay({
        readiness: {
          status: "ready",
          database: true,
          artifact_root: true,
          artifact_root_writable: true,
        },
        isLoading: false,
        isError: false,
      }),
    ).toEqual({
      label: "Ready",
      tone: "ok",
      detail: "Database and artifact storage verified",
    });

    const degraded = deriveReadinessDisplay({
      readiness: {
        status: "not_ready",
        database: true,
        artifact_root: true,
        artifact_root_writable: false,
      },
      isLoading: false,
      isError: false,
    });
    expect(degraded.label).toBe("Not ready");
    expect(degraded.tone).toBe("warning");
    expect(degraded.detail).toContain("Artifact Root Writable");
  });
});
