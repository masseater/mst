export class VerifierUnavailableError extends Error {
  override readonly name = "VerifierUnavailableError";

  readonly code = "RELAY_AUTH_VERIFIER_UNAVAILABLE";

  readonly category = "verifier-unavailable";

  constructor(reason: string, ruleOptions?: { readonly cause?: unknown }) {
    super(reason, ruleOptions);
  }
}
