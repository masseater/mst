import { metrics } from "@opentelemetry/api";
import { globalErrorHandler } from "@opentelemetry/core";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

const exports_ = new Set<string>();

vi.mock(import("@opentelemetry/exporter-metrics-otlp-http"), async (importOriginal) => {
  const real = await importOriginal();
  class SilentExporter extends real.OTLPMetricExporter {
    override export(
      ...call: Parameters<InstanceType<typeof real.OTLPMetricExporter>["export"]>
    ): void {
      const [, resultCallback] = call;
      exports_.add("export");
      resultCallback({ code: 0 });
    }
  }
  return { ...real, OTLPMetricExporter: SilentExporter };
});

const freshTelemetry = async (asked: {
  readonly durations: boolean;
  readonly disabled: boolean;
}) => {
  vi.stubEnv("MST_LINT_RULE_DURATION", asked.durations ? "1" : undefined);
  vi.stubEnv("OTEL_SDK_DISABLED", asked.disabled ? "true" : undefined);
  onTestFinished(() => {
    vi.unstubAllEnvs();
    process.exitCode = undefined;
    process.removeAllListeners("beforeExit");
    metrics.disable();
    exports_.clear();
  });
  vi.resetModules();
  return import("./lint-telemetry.ts");
};

const started = async () => {
  const telemetry = await freshTelemetry({ durations: true, disabled: false });
  telemetry.startLintTelemetry();
  return telemetry;
};

describe("startLintTelemetry", () => {
  test("an environment that never asked for durations starts nothing", async () => {
    const telemetry = await freshTelemetry({ durations: false, disabled: false });

    expect(telemetry.startLintTelemetry()).toBe(false);
  });

  test("an environment that disabled the sdk starts nothing even when asked", async () => {
    const telemetry = await freshTelemetry({ durations: true, disabled: true });

    expect(telemetry.startLintTelemetry()).toBe(false);
  });

  test("an environment that asked for durations starts once and stays started", async () => {
    const telemetry = await freshTelemetry({ durations: true, disabled: false });

    expect(telemetry.startLintTelemetry()).toBe(true);
    expect(telemetry.startLintTelemetry()).toBe(true);
  });

  test("a rule duration is recorded on the histogram the meter hands back", async () => {
    const telemetry = await started();

    expect(() => {
      telemetry.ruleDuration().record(7);
    }).not.toThrow();
  });

  test("what was recorded is handed to the exporter as the process winds down", async () => {
    await started();

    process.emit("beforeExit", 0);

    await vi.waitFor(() => {
      expect(exports_.size).toBe(1);
    });
  });

  test("an export that fails names what it carried, whatever was thrown", async () => {
    await started();
    const written = new Map<number, string>();
    const write = vi.spyOn(process.stderr, "write").mockImplementation((text) => {
      written.set(written.size, String(text));
      return true;
    });

    globalErrorHandler(new Error("the collector refused"));
    globalErrorHandler({ code: "503" });
    write.mockRestore();

    expect(process.exitCode).toBe(1);
    expect(written.get(0)).toContain("the collector refused");
    expect(written.get(1)).toContain('{"code":"503"}');
  });
});
