import { isObjectLike } from "es-toolkit/compat";

const isRecord = (held: unknown): held is Readonly<Record<string, unknown>> =>
  isObjectLike(held) && !Array.isArray(held);

export const asRecord = (held: unknown): Readonly<Record<string, unknown>> | undefined =>
  isRecord(held) ? held : undefined;
