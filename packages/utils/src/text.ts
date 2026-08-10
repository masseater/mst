export const toLines = (entries: readonly string[]): string =>
  entries.map((entry) => `${entry}\n`).join("");

export const lineAtOffset = (source: string, offset: number): number =>
  source.slice(0, offset).split("\n").length;
