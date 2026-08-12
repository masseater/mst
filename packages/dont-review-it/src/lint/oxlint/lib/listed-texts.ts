export const listedTexts = (held: unknown): readonly string[] =>
  Array.isArray(held)
    ? held.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
