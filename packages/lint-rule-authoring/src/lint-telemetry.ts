import { inheritedContext, startTelemetry } from "@mst/ai-native/telemetry";
import { context, metrics, trace, type Context } from "@opentelemetry/api";
import { once } from "es-toolkit";

const SERVICE_NAME = "mst-lint";

const INSTRUMENTATION_NAME = "@mst/lint-rule-authoring";

const MILLISECONDS_PER_SECOND = 1000;

const meter = once(() => metrics.getMeter(INSTRUMENTATION_NAME));

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

const runSpan = once(() =>
  trace
    .getTracer(INSTRUMENTATION_NAME)
    .startSpan("lint", { startTime: performance.timeOrigin }, inheritedContext()),
);

const closeRun = (): void => {
  runDuration().record(process.uptime() * MILLISECONDS_PER_SECOND);
  runSpan().end();
};

const stageContext = (): Context => {
  const active = context.active();
  return trace.getSpan(active) === undefined ? trace.setSpan(active, runSpan()) : active;
};

export const measureStage = <Produced>(stage: string, run: () => Produced): Produced => {
  if (!startLintTelemetry()) return run();
  return context.with(stageContext(), () =>
    trace.getTracer(INSTRUMENTATION_NAME).startActiveSpan(stage, (span) => {
      const startedAt = performance.now();
      const produced = run();
      stageDuration().record(performance.now() - startedAt, { stage });
      span.end();
      return produced;
    }),
  );
};

export const startLintTelemetry = once((): boolean => {
  if (!startTelemetry(SERVICE_NAME).enabled) return false;
  process.on("beforeExit", closeRun);
  return true;
});
