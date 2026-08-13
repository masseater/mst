export const failedWithCode = (failure: unknown, codes: ReadonlySet<string>): boolean =>
  failure instanceof Error &&
  "code" in failure &&
  typeof failure.code === "string" &&
  codes.has(failure.code);

export const failureSpelling = (failure: unknown): string =>
  failure instanceof Error && "code" in failure && typeof failure.code === "string"
    ? failure.code
    : String(failure);
