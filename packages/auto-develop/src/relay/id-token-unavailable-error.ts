export class IdTokenUnavailableError extends Error {
  override readonly name = "IdTokenUnavailableError";

  constructor(reason: string) {
    super(reason);
  }
}
