import { context, metrics, propagation, trace, type Context } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  CompositePropagator,
  setGlobalErrorHandler,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { EnvironmentGetter, EnvironmentSetter } from "@opentelemetry/propagator-env-carrier";
import {
  defaultResource,
  detectResources,
  envDetector,
  resourceFromAttributes,
  type Resource,
} from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { attemptAsync, once } from "es-toolkit";

const ENABLE_VARIABLE = "MST_TELEMETRY";

const DISABLE_VARIABLE = "OTEL_SDK_DISABLED";

const isEnabled = (): boolean =>
  process.env[ENABLE_VARIABLE] !== undefined && process.env[DISABLE_VARIABLE] !== "true";

const reasonOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : JSON.stringify(thrown);

const reportExportFailure = (thrown: unknown): void => {
  process.exitCode = 1;
  process.stderr.write(
    `${ENABLE_VARIABLE} asked for telemetry, but it could not be exported: ${reasonOf(thrown)}\n`,
  );
};

const failWhateverCannotBeExported = (): void => {
  setGlobalErrorHandler(reportExportFailure);
};

const registerPropagation = (): void => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager());
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  );
};

const resourceNamed = (serviceName: string): Resource =>
  defaultResource()
    .merge(resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }))
    .merge(detectResources({ detectors: [envDetector] }));

const registerTracing = (resource: Resource): TracerProvider => {
  const provider = new TracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })],
  });
  trace.setGlobalTracerProvider(provider);
  return provider;
};

const registerMetering = (resource: Resource): MeterProvider => {
  const provider = new MeterProvider({
    resource,
    readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
  });
  metrics.setGlobalMeterProvider(provider);
  return provider;
};

const registerLogging = (resource: Resource): LoggerProvider => {
  const provider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
  });
  logs.setGlobalLoggerProvider(provider);
  return provider;
};

const registerProviders = (resource: Resource): (() => Promise<void>) => {
  const tracerProvider = registerTracing(resource);
  const meterProvider = registerMetering(resource);
  const loggerProvider = registerLogging(resource);
  return async (): Promise<void> => {
    const [failure] = await attemptAsync(async () => {
      await Promise.all([
        tracerProvider.shutdown(),
        meterProvider.shutdown(),
        loggerProvider.shutdown(),
      ]);
    });
    if (failure !== null) reportExportFailure(failure);
  };
};

const stopAfterEveryOtherExitHandler = (stop: () => Promise<void>): (() => Promise<void>) => {
  const shutdownOnce = once(stop);
  process.on("beforeExit", () => {
    queueMicrotask(() => {
      void shutdownOnce();
    });
  });
  return shutdownOnce;
};

export type Telemetry = {
  readonly enabled: boolean;
  readonly shutdown: () => Promise<void>;
};

const notMeasuring: Telemetry = {
  enabled: false,
  shutdown: (): Promise<void> => Promise.resolve(),
};

export const startTelemetry = once((serviceName: string): Telemetry => {
  if (!isEnabled()) {
    return notMeasuring;
  }
  failWhateverCannotBeExported();
  registerPropagation();
  const shutdown = stopAfterEveryOtherExitHandler(registerProviders(resourceNamed(serviceName)));
  return { enabled: true, shutdown };
});

export const inheritedContext = (): Context =>
  propagation.extract(context.active(), undefined, new EnvironmentGetter());

const definedEnvironment = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).flatMap(([variable, setting]) =>
      setting === undefined ? [] : [[variable, setting] as const],
    ),
  );

export const environmentCarryingContext = (): Record<string, string> => {
  const carrier = definedEnvironment();
  propagation.inject(context.active(), undefined, new EnvironmentSetter(carrier));
  return carrier;
};
