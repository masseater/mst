import { context, metrics, propagation, trace, TraceFlags } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { globalErrorHandler } from "@opentelemetry/core";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { pick } from "es-toolkit";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

const MEASURED_SERVICE = "mst-telemetry-under-test";

const SECOND_MEASURED_SERVICE = "mst-telemetry-asked-again";

const TRACER_NAME = "telemetry-under-test";

const MEASURED_SPAN = "the work being measured";

const EXPORT_FAILURE_PREFIX = "MST_TELEMETRY asked for telemetry, but it could not be exported: ";

const INHERITED_TRACE_ID = "0af7651916cd43dd8448eb211c80319c";

const INHERITED_SPAN_ID = "b7ad6b7169203331";

const INHERITED_TRACEPARENT = `00-${INHERITED_TRACE_ID}-${INHERITED_SPAN_ID}-01`;

const ACTIVE_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

const ACTIVE_SPAN_ID = "00f067aa0ba902b7";

const ACTIVE_TRACEPARENT = `00-${ACTIVE_TRACE_ID}-${ACTIVE_SPAN_ID}-01`;

describe("startTelemetry", () => {
  describe("an environment that never asked for telemetry", () => {
    const it = test.extend("spansExportedWithoutAsking", async () => {
      vi.stubEnv("MST_TELEMETRY", undefined);
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      onTestFinished(() => {
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      vi.resetModules();
      const exporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
      const exported = vi.fn<(spanName: string) => void>();
      vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
        (batch, resultCallback) => {
          for (const span of batch.filter(
            (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
          )) {
            exported(span.name);
          }
          resultCallback({ code: 0 });
        },
      );
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
        span.end();
      });
      process.emit("beforeExit", 0);
      await started.shutdown();
      return exported;
    });

    it("hands the exporter nothing at all", ({ spansExportedWithoutAsking }) => {
      expect(spansExportedWithoutAsking).toHaveBeenCalledTimes(0);
    });
  });

  describe("an environment that asked for telemetry but disabled the sdk", () => {
    const it = test.extend("spansExportedWithADisabledSdk", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", "true");
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      onTestFinished(() => {
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      vi.resetModules();
      const exporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
      const exported = vi.fn<(spanName: string) => void>();
      vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
        (batch, resultCallback) => {
          for (const span of batch.filter(
            (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
          )) {
            exported(span.name);
          }
          resultCallback({ code: 0 });
        },
      );
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
        span.end();
      });
      process.emit("beforeExit", 0);
      await started.shutdown();
      return exported;
    });

    it("hands the exporter nothing even though it was asked", ({
      spansExportedWithADisabledSdk,
    }) => {
      expect(spansExportedWithADisabledSdk).toHaveBeenCalledTimes(0);
    });
  });

  describe("an environment that asked for telemetry", () => {
    const it = test.extend("spansExportedAfterAsking", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const exporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
      const exported = vi.fn<(spanName: string) => void>();
      vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
        (batch, resultCallback) => {
          for (const span of batch.filter(
            (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
          )) {
            exported(span.name);
          }
          resultCallback({ code: 0 });
        },
      );
      const stopped = vi
        .spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown")
        .mockResolvedValue();
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
        span.end();
      });
      process.emit("beforeExit", 0);
      await vi.waitUntil(() => stopped.mock.calls.length > 0);
      return exported;
    });

    it("hands the exporter what was recorded under it", ({ spansExportedAfterAsking }) => {
      expect(spansExportedAfterAsking).toHaveBeenCalledExactlyOnceWith(MEASURED_SPAN);
    });
  });

  describe("a second entry asking for telemetry that already started", () => {
    const it = test.extend("servicesExportedAfterTheSecondEntry", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const exporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
      const exported = vi.fn<(serviceName: unknown) => void>();
      vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
        (batch, resultCallback) => {
          for (const span of batch.filter(
            (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
          )) {
            exported(span.resource.attributes[ATTR_SERVICE_NAME]);
          }
          resultCallback({ code: 0 });
        },
      );
      const stopped = vi
        .spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown")
        .mockResolvedValue();
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      telemetry.startTelemetry(SECOND_MEASURED_SERVICE);
      trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
        span.end();
      });
      process.emit("beforeExit", 0);
      await vi.waitUntil(() => stopped.mock.calls.length > 0);
      return exported;
    });

    it("keeps the service the first entry named", ({ servicesExportedAfterTheSecondEntry }) => {
      expect(servicesExportedAfterTheSecondEntry).toHaveBeenCalledExactlyOnceWith(MEASURED_SERVICE);
    });
  });

  describe("a process winding down after telemetry started", () => {
    const it = test.extend("stoppedExporters", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const stopped = vi.fn<(stoppedSignal: string) => void>();
      const traceExporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
      vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "shutdown").mockImplementation(
        async () => {
          stopped("traces");
        },
      );
      const metricExporterModule = await import("@opentelemetry/exporter-metrics-otlp-http");
      vi.spyOn(metricExporterModule.OTLPMetricExporter.prototype, "shutdown").mockImplementation(
        async () => {
          stopped("metrics");
        },
      );
      const logExporterModule = await import("@opentelemetry/exporter-logs-otlp-http");
      vi.spyOn(logExporterModule.OTLPLogExporter.prototype, "shutdown").mockImplementation(
        async () => {
          stopped("logs");
        },
      );
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      process.emit("beforeExit", 0);
      await started.shutdown();
      return stopped;
    });

    it("stops every exporter it started", ({ stoppedExporters }) => {
      expect(stoppedExporters).toHaveBeenCalledTimes(3);
    });
  });

  describe("an export that fails", () => {
    describe("the exit code the process carried when the failure was reported", () => {
      const it = test.extend("exitCodeCarriedIntoTheReport", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
        vi.resetModules();
        const telemetry = await import("./telemetry.ts");
        const started = telemetry.startTelemetry(MEASURED_SERVICE);
        onTestFinished(async () => {
          await started.shutdown();
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
        });
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
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
        vi.resetModules();
        const telemetry = await import("./telemetry.ts");
        const started = telemetry.startTelemetry(MEASURED_SERVICE);
        onTestFinished(async () => {
          await started.shutdown();
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
        });
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
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
        vi.resetModules();
        const telemetry = await import("./telemetry.ts");
        const started = telemetry.startTelemetry(MEASURED_SERVICE);
        onTestFinished(async () => {
          await started.shutdown();
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
        });
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

    describe("a shutdown that cannot reach the sink", () => {
      const it = test.extend("shutdownFailureReport", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
        });
        vi.resetModules();
        const exporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
        vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown").mockRejectedValue(
          new Error("the collector went away"),
        );
        const telemetry = await import("./telemetry.ts");
        const started = telemetry.startTelemetry(MEASURED_SERVICE);
        const written = vi.fn<(failureReport: string) => void>();
        vi.spyOn(process.stderr, "write").mockImplementation((failureReport) => {
          written(String(failureReport));
          return true;
        });
        await started.shutdown();
        return written;
      });

      it("reports the failure instead of leaving the rejection unhandled", ({
        shutdownFailureReport,
      }) => {
        expect(shutdownFailureReport).toHaveBeenCalledExactlyOnceWith(
          `${EXPORT_FAILURE_PREFIX}the collector went away\n`,
        );
      });
    });
  });
});

describe("inheritedContext", () => {
  describe("an environment carrying a trace context", () => {
    const it = test.extend("inheritedSpanContext", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      vi.stubEnv("TRACEPARENT", INHERITED_TRACEPARENT);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      return trace.getSpanContext(telemetry.inheritedContext());
    });

    it("names the span the caller was started from", ({ inheritedSpanContext }) => {
      expect(inheritedSpanContext).toStrictEqual({
        traceId: INHERITED_TRACE_ID,
        spanId: INHERITED_SPAN_ID,
        traceFlags: TraceFlags.SAMPLED,
        isRemote: true,
      });
    });
  });

  describe("an environment carrying no trace context", () => {
    const it = test.extend("spanContextInheritedFromNothing", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      vi.stubEnv("TRACEPARENT", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      return trace.getSpanContext(telemetry.inheritedContext());
    });

    it("names no span at all", ({ spanContextInheritedFromNothing }) => {
      expect(spanContextInheritedFromNothing).toBe(undefined);
    });
  });
});

describe("environmentCarryingContext", () => {
  describe("an environment carried out of an active trace", () => {
    const it = test.extend("traceCarriedToAChild", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      vi.stubEnv("TRACEPARENT", INHERITED_TRACEPARENT);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      return context.with(
        trace.setSpanContext(context.active(), {
          traceId: ACTIVE_TRACE_ID,
          spanId: ACTIVE_SPAN_ID,
          traceFlags: TraceFlags.SAMPLED,
        }),
        () => pick(telemetry.environmentCarryingContext(), ["TRACEPARENT"]),
      );
    });

    it("overwrites the trace the wrapper itself was handed", ({ traceCarriedToAChild }) => {
      expect(traceCarriedToAChild).toStrictEqual({ TRACEPARENT: ACTIVE_TRACEPARENT });
    });
  });

  describe("an environment carried out of no trace at all", () => {
    const it = test.extend("traceCarriedToAChildOfNoSpan", async () => {
      vi.stubEnv("MST_TELEMETRY", "1");
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      vi.stubEnv("TRACEPARENT", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      vi.resetModules();
      const telemetry = await import("./telemetry.ts");
      const started = telemetry.startTelemetry(MEASURED_SERVICE);
      onTestFinished(async () => {
        await started.shutdown();
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      return pick(telemetry.environmentCarryingContext(), ["TRACEPARENT"]);
    });

    it("hands the child no trace at all", ({ traceCarriedToAChildOfNoSpan }) => {
      expect(traceCarriedToAChildOfNoSpan).toStrictEqual({});
    });
  });

  describe("an environment holding a name with no value", () => {
    const it = test.extend("environmentCarriedToAChild", async () => {
      vi.stubEnv("MST_TELEMETRY", undefined);
      vi.stubEnv("OTEL_SDK_DISABLED", undefined);
      process.removeAllListeners("beforeExit");
      context.disable();
      propagation.disable();
      trace.disable();
      metrics.disable();
      logs.disable();
      onTestFinished(() => {
        process.exitCode = undefined;
        process.removeAllListeners("beforeExit");
        context.disable();
        propagation.disable();
        trace.disable();
        metrics.disable();
        logs.disable();
      });
      vi.resetModules();
      const telemetry = await import("./telemetry.ts");
      vi.stubGlobal(
        "process",
        Object.create(process, {
          env: {
            value: { MST_TELEMETRY_KEPT: "kept", MST_TELEMETRY_UNSET: undefined },
            enumerable: true,
          },
        }),
      );
      return telemetry.environmentCarryingContext();
    });

    it("leaves out the name that had no value", ({ environmentCarriedToAChild }) => {
      expect(environmentCarriedToAChild).toStrictEqual({ MST_TELEMETRY_KEPT: "kept" });
    });
  });
});
