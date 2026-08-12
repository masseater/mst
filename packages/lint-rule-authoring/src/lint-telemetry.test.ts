import { metrics } from "@opentelemetry/api";
import { globalErrorHandler } from "@opentelemetry/core";
import { DataPointType } from "@opentelemetry/sdk-metrics";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

type ExportedDuration = { readonly name: string; readonly sum: number | undefined };

const EXPORT_FAILURE_PREFIX =
  "MST_LINT_RULE_DURATION asked for lint durations, but they could not be exported: ";

const UPTIME_SECONDS = 2;

const it = test
  .extend("unaskedStartAnswer", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", undefined);
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    return telemetry.startLintTelemetry();
  })
  .extend("disabledStartAnswer", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", "true");
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    return telemetry.startLintTelemetry();
  })
  .extend("askedStartAnswer", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    return telemetry.startLintTelemetry();
  })
  .extend("askedRestartAnswer", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    telemetry.startLintTelemetry();
    return telemetry.startLintTelemetry();
  })
  .extend("startedTelemetry", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    telemetry.startLintTelemetry();
    return telemetry;
  })
  .extend("handedHistogram", ({ startedTelemetry }) => startedTelemetry.ruleDuration())
  .extend("recordedHistogram", ({ startedTelemetry }) => {
    const histogram = startedTelemetry.ruleDuration();
    histogram.record(7);
    return histogram;
  })
  .extend("windDownExports", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    vi.spyOn(process, "uptime").mockReturnValue(UPTIME_SECONDS);
    const exporterModule = await import("@opentelemetry/exporter-metrics-otlp-http");
    const exported = vi.fn<(durations: readonly ExportedDuration[]) => void>();
    vi.spyOn(exporterModule.OTLPMetricExporter.prototype, "export").mockImplementation(
      (batch, resultCallback) => {
        exported(
          batch.scopeMetrics.flatMap((scope) =>
            scope.metrics.flatMap((metric) =>
              metric.dataPointType === DataPointType.HISTOGRAM
                ? metric.dataPoints.map((point) => ({
                    name: metric.descriptor.name,
                    sum: point.value.sum,
                  }))
                : [],
            ),
          ),
        );
        resultCallback({ code: 0 });
      },
    );
    const stopped = vi
      .spyOn(exporterModule.OTLPMetricExporter.prototype, "shutdown")
      .mockResolvedValue();
    const telemetry = await import("./lint-telemetry.ts");
    telemetry.startLintTelemetry();
    telemetry.ruleDuration().record(7);
    process.emit("beforeExit", 0);
    await vi.waitUntil(() => stopped.mock.calls.length > 0);
    return exported;
  })
  .extend("exitCodeCarriedIntoTheReport", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    telemetry.startLintTelemetry();
    const marked = vi.fn<(exitCode: unknown) => void>();
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      marked(process.exitCode);
      return true;
    });
    globalErrorHandler(new Error("the collector refused"));
    return marked;
  })
  .extend("thrownErrorReport", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    telemetry.startLintTelemetry();
    const written = vi.fn<(text: string) => void>();
    vi.spyOn(process.stderr, "write").mockImplementation((text) => {
      written(String(text));
      return true;
    });
    globalErrorHandler(new Error("the collector refused"));
    return written;
  })
  .extend("thrownNonErrorReport", async () => {
    vi.stubEnv("MST_LINT_RULE_DURATION", "1");
    vi.stubEnv("OTEL_SDK_DISABLED", undefined);
    onTestFinished(() => {
      process.exitCode = undefined;
      process.removeAllListeners("beforeExit");
      metrics.disable();
    });
    vi.resetModules();
    const telemetry = await import("./lint-telemetry.ts");
    telemetry.startLintTelemetry();
    const written = vi.fn<(text: string) => void>();
    vi.spyOn(process.stderr, "write").mockImplementation((text) => {
      written(String(text));
      return true;
    });
    globalErrorHandler({ code: "503" });
    return written;
  });

describe("startLintTelemetry", () => {
  it("an environment that never asked for durations starts nothing", ({ unaskedStartAnswer }) => {
    expect(unaskedStartAnswer).toBe(false);
  });

  it("an environment that disabled the sdk starts nothing even when asked", ({
    disabledStartAnswer,
  }) => {
    expect(disabledStartAnswer).toBe(false);
  });

  it("an environment that asked for durations starts", ({ askedStartAnswer }) => {
    expect(askedStartAnswer).toBe(true);
  });

  it("an environment that asked for durations stays started", ({ askedRestartAnswer }) => {
    expect(askedRestartAnswer).toBe(true);
  });

  it("a rule duration is recorded on the histogram the meter hands back", ({
    handedHistogram,
    recordedHistogram,
  }) => {
    expect(recordedHistogram).toBe(handedHistogram);
  });

  it("what was recorded is handed to the exporter as the process winds down", ({
    windDownExports,
  }) => {
    expect(windDownExports).toHaveBeenCalledExactlyOnceWith([
      { name: "lint.rule.duration", sum: 7 },
      { name: "lint.run.duration", sum: 2000 },
    ]);
  });

  it("an export that fails marks the process as failed before it reports", ({
    exitCodeCarriedIntoTheReport,
  }) => {
    expect(exitCodeCarriedIntoTheReport).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("an export that fails names the message of the error it carried", ({ thrownErrorReport }) => {
    expect(thrownErrorReport).toHaveBeenCalledExactlyOnceWith(
      `${EXPORT_FAILURE_PREFIX}the collector refused\n`,
    );
  });

  it("an export that fails names a thrown value that is not an error", ({
    thrownNonErrorReport,
  }) => {
    expect(thrownNonErrorReport).toHaveBeenCalledExactlyOnceWith(
      `${EXPORT_FAILURE_PREFIX}{"code":"503"}\n`,
    );
  });
});
