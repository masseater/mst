export class PrClosedError extends Error {
  override readonly name = "PrClosedError";

  constructor(prNumber: number) {
    super(`PR #${prNumber} was closed`);
  }
}
