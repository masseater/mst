import type { LogFileSink } from "./daily-log-file.ts";
import type { Logger } from "./logger.ts";

export type TextOutput = {
  readonly write: (writtenText: string) => unknown;
};

const readableFailure = (_fieldName: string, field: unknown): unknown =>
  field instanceof Error
    ? {
        name: field.name,
        message: field.message,
        stack: field.stack,
        ...(field.cause === undefined ? {} : { cause: field.cause }),
      }
    : field;

/** @canonical-values auto-develop.log-level */
const LOG_LEVELS = ["info", "warn", "error"] as const;

const LOG_LEVEL = {
  info: LOG_LEVELS[0],
  warn: LOG_LEVELS[1],
  error: LOG_LEVELS[2],
} as const;

export const createConsoleLogger = (
  spelled: string,
  ruleOptions: { readonly fileSink?: LogFileSink; readonly out?: TextOutput } = {},
): Logger => {
  const out = ruleOptions.out ?? process.stdout;
  const writeLine = (listed: {
    readonly level: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly message: string;
  }): void => {
    const line = `${JSON.stringify(
      {
        level: listed.level,
        name: spelled,
        time: new Date().toISOString(),
        ...listed.fields,
        msg: listed.message,
      },
      readableFailure,
    )}\n`;
    out.write(line);
    ruleOptions.fileSink?.append(line);
  };
  return {
    info: (fields, complaint) => {
      writeLine({ level: LOG_LEVEL.info, fields, message: complaint });
    },
    warn: (fields, complaint) => {
      writeLine({ level: LOG_LEVEL.warn, fields, message: complaint });
    },
    error: (fields, complaint) => {
      writeLine({ level: LOG_LEVEL.error, fields, message: complaint });
    },
  };
};
