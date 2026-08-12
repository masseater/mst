import type { LogFileSink } from "./daily-log-file.ts";
import type { Logger } from "./logger.ts";

const readableFailure = (_fieldName: string, field: unknown): unknown =>
  field instanceof Error
    ? {
        name: field.name,
        message: field.message,
        stack: field.stack,
        ...(field.cause === undefined ? {} : { cause: field.cause }),
      }
    : field;

export const createConsoleLogger = (
  spelled: string,
  ruleOptions: { readonly fileSink?: LogFileSink; readonly out?: NodeJS.WritableStream } = {},
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
      writeLine({ level: "info", fields, message: complaint });
    },
    warn: (fields, complaint) => {
      writeLine({ level: "warn", fields, message: complaint });
    },
    error: (fields, complaint) => {
      writeLine({ level: "error", fields, message: complaint });
    },
  };
};
