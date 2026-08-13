import { metrics } from "@opentelemetry/api";
import { setGlobalErrorHandler } from "@opentelemetry/core";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { defaultResource, detectResources, envDetector } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { once } from "es-toolkit";

const ENABLE_VARIABLE = "MST_LINT_RULE_DURATION";

const DISABLE_VARIABLE = "OTEL_SDK_DISABLED";

const METER_NAME = "@mst/lint-rule-authoring";

const MILLISECONDS_PER_SECOND = 1000;

const meter = once(() => metrics.getMeter(METER_NAME));

export const ruleDuration = once(() =>
  meter().createHistogram("lint.rule.duration", {
    description: "Time a lint rule spent inside its own visitor callbacks",
    unit: "ms",
  }),
);

const runDuration = once(() =>
  meter().createHistogram("lint.run.duration", {
    description: "Time the whole lint process took, including work outside the authored rules",
    unit: "ms",
  }),
);

const stageDuration = once(() =>
  meter().createHistogram("lint.stage.duration", {
    description: "Time one named stage of the work a lint process does took",
    unit: "ms",
  }),
);

const isEnabled = (): boolean =>
  process.env[ENABLE_VARIABLE] !== undefined && process.env[DISABLE_VARIABLE] !== "true";

const reasonOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : JSON.stringify(thrown);

const failWhateverCannotBeExported = (): void => {
  setGlobalErrorHandler((thrown: unknown) => {
    process.exitCode = 1;
    process.stderr.write(
      `${ENABLE_VARIABLE} asked for lint durations, but they could not be exported: ${reasonOf(thrown)}\n`,
    );
  });
};

const stopOnExit = (provider: MeterProvider): void => {
  const shutdownOnce = once(async (): Promise<void> => {
    runDuration().record(process.uptime() * MILLISECONDS_PER_SECOND);
    await provider.forceFlush();
    await provider.shutdown();
  });
  process.on("beforeExit", () => {
    void shutdownOnce();
  });
};

export const measureStage = <Produced>(stage: string, run: () => Produced): Produced => {
  if (!startLintTelemetry()) return run();
  const startedAt = performance.now();
  const produced = run();
  stageDuration().record(performance.now() - startedAt, { stage });
  return produced;
};

export const startLintTelemetry = once((): boolean => {
  if (!isEnabled()) {
    return false;
  }
  failWhateverCannotBeExported();
  const reader = new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() });
  const provider = new MeterProvider({
    readers: [reader],
    resource: defaultResource().merge(detectResources({ detectors: [envDetector] })),
  });
  metrics.setGlobalMeterProvider(provider);
  stopOnExit(provider);
  return true;
});
