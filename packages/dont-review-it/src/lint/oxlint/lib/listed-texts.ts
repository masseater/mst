export const listedTexts = (held: unknown): readonly string[] =>
  Array.isArray(held) ? held.filter((entry): entry is string => typeof entry === "string") : [];
