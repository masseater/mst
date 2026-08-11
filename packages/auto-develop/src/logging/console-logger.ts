import type { Logger } from "./logger.ts";

export const createConsoleLogger = (name: string): Logger => {
  const writeLine = (entry: {
    readonly level: string;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly message: string;
  }): void => {
    process.stdout.write(
      `${JSON.stringify({
        level: entry.level,
        name,
        time: new Date().toISOString(),
        ...entry.fields,
        msg: entry.message,
      })}\n`,
    );
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
