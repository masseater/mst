export const isNamedFields = (held: unknown): held is Readonly<Record<string, unknown>> =>
  typeof held === "object" && held !== null && !Array.isArray(held);

export const namedFieldsOf = (held: unknown): Readonly<Record<string, unknown>> | null =>
  isNamedFields(held) ? held : null;
