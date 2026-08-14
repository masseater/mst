import { context, metrics, propagation, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

const INSTRUMENTATION_NAME = "@mst/repository-checks";

describe("measureCheck", () => {
  describe("a check measured in an environment that never asked for telemetry", () => {
    describe("what the measured check produced", () => {
      const it = test.extend("checkProductWithoutTelemetry", async () => {
        vi.stubEnv("MST_TELEMETRY", undefined);
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        const telemetry = await import("./check-telemetry.ts");
        return telemetry.measureCheck(() => 41 + 1);
      });

      it("comes back to whoever measured it", ({ checkProductWithoutTelemetry }) => {
        expect(checkProductWithoutTelemetry).toBe(42);
      });
    });

    describe("the span the check ran under", () => {
      const it = test.extend("spanWithoutTelemetry", async () => {
        vi.stubEnv("MST_TELEMETRY", undefined);
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        const telemetry = await import("./check-telemetry.ts");
        return telemetry.measureCheck(() => trace.getSpan(context.active()));
      });

      it("was never opened", ({ spanWithoutTelemetry }) => {
        expect(spanWithoutTelemetry).toBe(undefined);
      });
    });
  });

  describe("a check measured in an environment that asked for telemetry", () => {
    describe("what the measured check produced", () => {
      const it = test.extend("checkProductWithTelemetry", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        vi.stubEnv("TRACEPARENT", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        const telemetry = await import("./check-telemetry.ts");
        return telemetry.measureCheck(() => 41 + 1);
      });

      it("comes back to whoever measured it", ({ checkProductWithTelemetry }) => {
        expect(checkProductWithTelemetry).toBe(42);
      });
    });

    describe("the span opened for an invocation carrying an entry point", () => {
      const it = test.extend("spanOpenedForEntryPoint", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        vi.stubEnv("TRACEPARENT", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        vi.spyOn(process, "argv", "get").mockReturnValue([
          "/usr/local/bin/node",
          "/repository/packages/dont-review-it/src/cli.ts",
          "check",
        ]);
        const started = await import("@mst/ai-native/telemetry");
        started.startTelemetry("mst-check");
        const opened = vi.spyOn(trace.getTracer(INSTRUMENTATION_NAME), "startSpan");
        const telemetry = await import("./check-telemetry.ts");
        await telemetry.measureCheck(() => 41 + 1);
        return opened;
      });

      it("is named after the command that invoked the check", ({ spanOpenedForEntryPoint }) => {
        expect(spanOpenedForEntryPoint).toHaveBeenCalledExactlyOnceWith(
          "cli.ts check",
          undefined,
          ROOT_CONTEXT,
        );
      });
    });

    describe("the span opened for an invocation carrying no entry point", () => {
      const it = test.extend("spanOpenedWithoutEntryPoint", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        vi.stubEnv("TRACEPARENT", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        vi.spyOn(process, "argv", "get").mockReturnValue(["/usr/local/bin/node"]);
        const started = await import("@mst/ai-native/telemetry");
        started.startTelemetry("mst-check");
        const opened = vi.spyOn(trace.getTracer(INSTRUMENTATION_NAME), "startSpan");
        const telemetry = await import("./check-telemetry.ts");
        await telemetry.measureCheck(() => 41 + 1);
        return opened;
      });

      it("falls back to the name the checks answer to", ({ spanOpenedWithoutEntryPoint }) => {
        expect(spanOpenedWithoutEntryPoint).toHaveBeenCalledExactlyOnceWith(
          "mst-check",
          undefined,
          ROOT_CONTEXT,
        );
      });
    });
  });
});
