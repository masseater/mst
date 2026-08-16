export const isRecord = (held: unknown): held is Readonly<Record<string, unknown>> =>
  held instanceof Object;
