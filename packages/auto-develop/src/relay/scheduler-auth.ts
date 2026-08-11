import { IdTokenRejectionError } from "./id-token-rejection-error.ts";
import { IdTokenUnavailableError } from "./id-token-unavailable-error.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

export type VerifiedIdToken = {
  readonly email: string | undefined;
  readonly emailVerified: boolean;
};

export type IdTokenVerifier = (verification: {
  readonly idToken: string;
  readonly audience: string;
}) => Promise<VerifiedIdToken>;

const verifyIdToken = async (verification: {
  readonly verify: IdTokenVerifier;
  readonly idToken: string;
  readonly audience: string;
}): Promise<VerifiedIdToken> => {
  try {
    return await verification.verify({
      idToken: verification.idToken,
      audience: verification.audience,
    });
  } catch (failure) {
    if (failure instanceof IdTokenRejectionError) {
      throw new UnauthenticatedError("id token was rejected");
    }
    if (failure instanceof IdTokenUnavailableError) {
      throw new VerifierUnavailableError("id token could not be verified");
    }
    throw new Error("id token verification failed for an unclassified reason");
  }
};

export const authenticateScheduler = async (auth: {
  readonly idToken: string | undefined;
  readonly audience: string | undefined;
  readonly allowedEmails: readonly string[];
  readonly verify: IdTokenVerifier;
}): Promise<{ readonly email: string }> => {
  if (auth.allowedEmails.length === 0) {
    throw new UnauthenticatedError("no scheduler service account is allowed by configuration");
  }
  if (auth.idToken === undefined) throw new UnauthenticatedError("scheduler credential missing");
  if (auth.audience === undefined) {
    throw new UnauthenticatedError("public origin for audience verification is not configured");
  }
  const verified = await verifyIdToken({
    verify: auth.verify,
    idToken: auth.idToken,
    audience: auth.audience,
  });
  return { email: admittedEmail({ verified, allowedEmails: auth.allowedEmails }) };
};

const admittedEmail = (admission: {
  readonly verified: VerifiedIdToken;
  readonly allowedEmails: readonly string[];
}): string => {
  if (!admission.verified.emailVerified) {
    throw new UnauthenticatedError("email claim is not verified");
  }
  if (admission.verified.email === undefined) {
    throw new UnauthenticatedError("email claim missing");
  }
  if (!admission.allowedEmails.includes(admission.verified.email)) {
    throw new UnauthenticatedError("service account is not in the allowlist");
  }
  return admission.verified.email;
};
