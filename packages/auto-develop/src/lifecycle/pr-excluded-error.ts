export class PrExcludedError extends Error {
  override readonly name = "PrExcludedError";

  constructor(prNumber: number) {
    super(`PR #${prNumber} was excluded from auto-develop`);
  }
}
