import type { LogFileSink } from "./daily-log-file.ts";
import type { Logger } from "./logger.ts";

export const createConsoleLogger = (
  name: string,
  options: { readonly fileSink?: LogFileSink; readonly out?: NodeJS.WritableStream } = {},
): Logger => {
  const out = options.out ?? process.stdout;
  const writeLine = (entry: {
    readonly level: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly message: string;
  }): void => {
    const line = `${JSON.stringify({
      level: entry.level,
      name,
      time: new Date().toISOString(),
      ...entry.fields,
      msg: entry.message,
    })}\n`;
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
