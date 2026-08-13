import { metrics } from "@opentelemetry/api";
import { globalErrorHandler } from "@opentelemetry/core";
import { DataPointType } from "@opentelemetry/sdk-metrics";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

type ExportedDuration = { readonly name: string; readonly sum: number | undefined };

const EXPORT_FAILURE_PREFIX =
  "MST_LINT_RULE_DURATION asked for lint durations, but they could not be exported: ";

const UPTIME_SECONDS = 2;

describe("startLintTelemetry", () => {
  describe("an environment that never asked for durations", () => {
    const it = test.extend("startAnswer", async () => {
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
    });

    it("starts nothing", ({ startAnswer }) => {
      expect(startAnswer).toBe(false);
    });
  });

  describe("an environment that asked for durations but disabled the sdk", () => {
    const it = test.extend("startAnswer", async () => {
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
    });

    it("starts nothing even though it was asked", ({ startAnswer }) => {
      expect(startAnswer).toBe(false);
    });
  });

  describe("an environment that asked for durations", () => {
    const it = test.extend("startAnswer", async () => {
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
    });

    it("starts", ({ startAnswer }) => {
      expect(startAnswer).toBe(true);
    });
  });

  describe("an environment that asked for durations and started once already", () => {
    const it = test.extend("restartAnswer", async () => {
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
    });

    it("stays started", ({ restartAnswer }) => {
      expect(restartAnswer).toBe(true);
    });
  });

  describe("a process winding down after a rule duration was recorded", () => {
    const it = test.extend("windDownExports", async () => {
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
    });

    it("hands the exporter what was recorded alongside the run it belonged to", ({
      windDownExports,
    }) => {
      expect(windDownExports).toHaveBeenCalledExactlyOnceWith([
        { name: "lint.rule.duration", sum: 7 },
        { name: "lint.run.duration", sum: 2000 },
      ]);
    });
  });

  describe("an export that fails", () => {
    describe("the exit code the process carried when the failure was reported", () => {
      const it = test.extend("exitCodeCarriedIntoTheReport", async () => {
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
      });

      it("marks the process as failed before the report goes out", ({
        exitCodeCarriedIntoTheReport,
      }) => {
        expect(exitCodeCarriedIntoTheReport).toHaveBeenCalledExactlyOnceWith(1);
      });
    });

    describe("a failure carrying an error", () => {
      const it = test.extend("thrownErrorReport", async () => {
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
        const written = vi.fn<(failureReport: string) => void>();
        vi.spyOn(process.stderr, "write").mockImplementation((failureReport) => {
          written(String(failureReport));
          return true;
        });
        globalErrorHandler(new Error("the collector refused"));
        return written;
      });

      it("names the message the error carried", ({ thrownErrorReport }) => {
        expect(thrownErrorReport).toHaveBeenCalledExactlyOnceWith(
          `${EXPORT_FAILURE_PREFIX}the collector refused\n`,
        );
      });
    });

    describe("a failure carrying a value that is not an error", () => {
      const it = test.extend("thrownNonErrorReport", async () => {
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
        const written = vi.fn<(failureReport: string) => void>();
        vi.spyOn(process.stderr, "write").mockImplementation((failureReport) => {
          written(String(failureReport));
          return true;
        });
        globalErrorHandler({ code: "503" });
        return written;
      });

      it("names the value that was thrown", ({ thrownNonErrorReport }) => {
        expect(thrownNonErrorReport).toHaveBeenCalledExactlyOnceWith(
          `${EXPORT_FAILURE_PREFIX}{"code":"503"}\n`,
        );
      });
    });
  });
});

describe("measureStage", () => {
  describe("a stage measured in an environment that never asked for durations", () => {
    describe("what the measured stage produced", () => {
      const it = test.extend("stageProductWithoutDurations", async () => {
        vi.stubEnv("MST_LINT_RULE_DURATION", undefined);
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          metrics.disable();
        });
        vi.resetModules();
        const telemetry = await import("./lint-telemetry.ts");
        return telemetry.measureStage("canonical.scope", () => 41 + 1);
      });

      it("comes back to whoever measured it", ({ stageProductWithoutDurations }) => {
        expect(stageProductWithoutDurations).toBe(42);
      });
    });

    describe("the exporter behind a stage nobody asked to measure", () => {
      const it = test.extend("exportsWithoutDurations", async () => {
        vi.stubEnv("MST_LINT_RULE_DURATION", undefined);
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          metrics.disable();
        });
        vi.resetModules();
        const exporterModule = await import("@opentelemetry/exporter-metrics-otlp-http");
        const exported = vi.spyOn(exporterModule.OTLPMetricExporter.prototype, "export");
        const telemetry = await import("./lint-telemetry.ts");
        telemetry.measureStage("canonical.scope", () => 41 + 1);
        return exported;
      });

      it("is handed nothing at all", ({ exportsWithoutDurations }) => {
        expect(exportsWithoutDurations).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe("a stage measured in an environment that asked for durations", () => {
    describe("what the measured stage produced", () => {
      const it = test.extend("stageProductWithDurations", async () => {
        vi.stubEnv("MST_LINT_RULE_DURATION", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          metrics.disable();
        });
        vi.resetModules();
        const telemetry = await import("./lint-telemetry.ts");
        return telemetry.measureStage("canonical.scope", () => 41 + 1);
      });

      it("comes back to whoever measured it", ({ stageProductWithDurations }) => {
        expect(stageProductWithDurations).toBe(42);
      });
    });

    describe("the metrics the exporter was handed as the process wound down", () => {
      const it = test.extend("windDownStageMetricNames", async () => {
        vi.stubEnv("MST_LINT_RULE_DURATION", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          metrics.disable();
        });
        vi.resetModules();
        const exporterModule = await import("@opentelemetry/exporter-metrics-otlp-http");
        const exported = vi.fn<(metricNames: readonly string[]) => void>();
        vi.spyOn(exporterModule.OTLPMetricExporter.prototype, "export").mockImplementation(
          (batch, resultCallback) => {
            exported(
              batch.scopeMetrics.flatMap((scope) =>
                scope.metrics.map((metric) => metric.descriptor.name),
              ),
            );
            resultCallback({ code: 0 });
          },
        );
        const stopped = vi
          .spyOn(exporterModule.OTLPMetricExporter.prototype, "shutdown")
          .mockResolvedValue();
        const telemetry = await import("./lint-telemetry.ts");
        telemetry.measureStage("canonical.scope", () => 41 + 1);
        process.emit("beforeExit", 0);
        await vi.waitUntil(() => stopped.mock.calls.length > 0);
        return exported;
      });

      it("carry the stage under its own name alongside the run it belonged to", ({
        windDownStageMetricNames,
      }) => {
        expect(windDownStageMetricNames).toHaveBeenCalledExactlyOnceWith([
          "lint.stage.duration",
          "lint.run.duration",
        ]);
      });
    });
  });
});

describe("ruleDuration", () => {
  describe("the histogram behind a second call", () => {
    const it = test
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
      });

    it("is the histogram the meter handed back the first time", ({
      handedHistogram,
      recordedHistogram,
    }) => {
      expect(recordedHistogram).toBe(handedHistogram);
    });
  });
});
