export const failureMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);
