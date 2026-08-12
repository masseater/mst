export const asRecord = (held: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof held === "object" && held !== null && !Array.isArray(held)
    ? (held as Record<string, unknown>)
    : undefined;
