import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

export const authFailureStatus = (failure: unknown): 401 | 503 => {
  if (failure instanceof UnauthenticatedError) return 401;
  if (failure instanceof VerifierUnavailableError) return 503;
  throw failure;
};
