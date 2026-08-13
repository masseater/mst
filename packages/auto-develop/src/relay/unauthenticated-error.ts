export class UnauthenticatedError extends Error {
  override readonly name = "UnauthenticatedError";

  readonly code = "RELAY_UNAUTHENTICATED";

  readonly category = "unauthenticated";

  constructor(reason: string, ruleOptions?: { readonly cause?: unknown }) {
    super(reason, ruleOptions);
  }
}
