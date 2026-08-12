export class ReviewInputChangedError extends Error {
  override readonly name = "ReviewInputChangedError";

  constructor(prNumber: number) {
    super(`the review input for PR #${prNumber} changed`);
  }
}

export const isReviewInputChanged = (failure: unknown): boolean =>
  failure instanceof ReviewInputChangedError;
