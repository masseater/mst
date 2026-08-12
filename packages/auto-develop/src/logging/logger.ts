export type Logger = {
  readonly info: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly warn: (fields: Readonly<Record<string, unknown>>, message: string) => void;
  readonly error: (fields: Readonly<Record<string, unknown>>, message: string) => void;
};

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
