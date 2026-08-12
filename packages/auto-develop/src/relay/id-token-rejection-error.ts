export class IdTokenRejectionError extends Error {
  override readonly name = "IdTokenRejectionError";

  constructor(reason: string) {
    super(reason);
  }
}
