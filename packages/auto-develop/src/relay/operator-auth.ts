import { credentialDigest } from "./digest.ts";
import { TransientStoreError, type SessionStore, type StoredSession } from "./store.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

const resolveSession = async (resolution: {
  readonly sessions: SessionStore;
  readonly digest: string;
}): Promise<StoredSession | null> => {
  try {
    return await resolution.sessions.resolve(resolution.digest);
  } catch (failure) {
    if (failure instanceof TransientStoreError) {
      throw new VerifierUnavailableError("session store could not be read");
    }
    throw failure;
  }
};

export const authenticateOperator = async (auth: {
  readonly credential: string | undefined;
  readonly sessions: SessionStore;
  readonly now?: () => number;
}): Promise<{ readonly login: string }> => {
  if (auth.credential === undefined) {
    throw new UnauthenticatedError("connection credential missing");
  }
  const session = await resolveSession({
    sessions: auth.sessions,
    digest: credentialDigest(auth.credential),
  });
  const stampedNow = auth.now ?? Date.now;
  if (session === null || session.expiresAtMs <= stampedNow()) {
    throw new UnauthenticatedError("connection credential is not recognized");
  }
  return { login: session.login };
};
