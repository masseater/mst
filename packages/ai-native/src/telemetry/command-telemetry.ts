import { context, metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import {
  ATTR_PROCESS_COMMAND_ARGS,
  ATTR_PROCESS_EXECUTABLE_NAME,
  ATTR_PROCESS_EXIT_CODE,
} from "@opentelemetry/semantic-conventions/incubating";
import { once } from "es-toolkit";

import { environmentCarryingContext, inheritedContext, startTelemetry } from "./telemetry.ts";

import type { Command } from "../spool/parse-command.ts";

const INSTRUMENTATION_NAME = "@mst/ai-native";

const commandDuration = once(() =>
  metrics.getMeter(INSTRUMENTATION_NAME).createHistogram("command.duration", {
    description: "Time a wrapped command took from spawn to exit",
    unit: "ms",
  }),
);

const SERVICE_NAME = "mst-command";

const instrumented = (): boolean => startTelemetry(SERVICE_NAME).enabled;

export const childEnvironment = (): NodeJS.ProcessEnv =>
  instrumented() ? environmentCarryingContext() : process.env;

export const measureCommand = async (input: {
  readonly command: Command;
  readonly run: () => Promise<number>;
}): Promise<number> => {
  if (!instrumented()) {
    return input.run();
  }
  return context.with(inheritedContext(), async () =>
    trace.getTracer(INSTRUMENTATION_NAME).startActiveSpan(input.command.join(" "), async (span) => {
      const startedAt = performance.now();
      span.setAttributes({
        [ATTR_PROCESS_EXECUTABLE_NAME]: input.command[0],
        [ATTR_PROCESS_COMMAND_ARGS]: [...input.command],
      });
      const exitCode = await input.run();
      commandDuration().record(performance.now() - startedAt, {
        [ATTR_PROCESS_EXECUTABLE_NAME]: input.command[0],
        [ATTR_PROCESS_EXIT_CODE]: exitCode,
      });
      span.setAttribute(ATTR_PROCESS_EXIT_CODE, exitCode);
      if (exitCode !== 0) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
      return exitCode;
    }),
  );
};

export const recordCommandRecord = (input: {
  readonly commandLine: string;
  readonly exitCode: number;
  readonly filePath: string;
  readonly bytes: number;
  readonly lineCount: number;
  readonly excerpt: string;
}): void => {
  if (!instrumented()) {
    return;
  }
  logs.getLogger(INSTRUMENTATION_NAME).emit({
    eventName: "mst.command.record",
    severityNumber: input.exitCode === 0 ? SeverityNumber.INFO : SeverityNumber.ERROR,
    body: input.excerpt,
    attributes: {
      "command.line": input.commandLine,
      "command.record.path": input.filePath,
      "command.record.bytes": input.bytes,
      "command.record.lines": input.lineCount,
      [ATTR_PROCESS_EXIT_CODE]: input.exitCode,
    },
  });
};
