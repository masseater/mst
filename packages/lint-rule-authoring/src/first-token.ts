export const firstToken = (writtenText: string): string =>
  writtenText.trim().split(/\s+/u, 1).join("");
