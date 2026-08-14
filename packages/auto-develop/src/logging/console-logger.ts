import type { LogFileSink } from "./daily-log-file.ts";
import type { Logger } from "./logger.ts";

export type TextOutput = {
  readonly write: (text: string) => unknown;
};

const readableFailure = (_key: string, field: unknown): unknown =>
  field instanceof Error
    ? {
        name: field.name,
        message: field.message,
        stack: field.stack,
        ...(field.cause === undefined ? {} : { cause: field.cause }),
      }
    : field;

export const createConsoleLogger = (
  name: string,
  options: { readonly fileSink?: LogFileSink; readonly out?: TextOutput } = {},
): Logger => {
  const out = options.out ?? process.stdout;
  const writeLine = (entry: {
    readonly level: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly message: string;
  }): void => {
    const line = `${JSON.stringify(
      {
        level: entry.level,
        name,
        time: new Date().toISOString(),
        ...entry.fields,
        msg: entry.message,
      },
      readableFailure,
    )}\n`;
    out.write(line);
    options.fileSink?.append(line);
  };
  return {
    info: (fields, message) => {
      writeLine({ level: "info", fields, message });
    },
    warn: (fields, message) => {
      writeLine({ level: "warn", fields, message });
    },
    error: (fields, message) => {
      writeLine({ level: "error", fields, message });
    },
  };
};
