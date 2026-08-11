import { randomBytes } from "node:crypto";

import { serializeAuthSession, type AuthSessionResponse } from "../contract/auth-session.ts";
import { credentialDigest } from "./digest.ts";
import { SESSION_TTL_MS } from "./durations.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

import type { GithubReader } from "./github-reader.ts";
import type { SessionStore } from "./store.ts";

const classifyGithubFailure = (failure: unknown): never => {
  if (failure instanceof GithubRejectionError) {
    throw new UnauthenticatedError("github rejected the presented token");
  }
  if (failure instanceof GithubUnavailableError) {
    throw new VerifierUnavailableError("github could not be reached to verify the token");
  }
  throw failure;
};

const verifyOperatorMembership = async (verification: {
  readonly github: GithubReader;
  readonly githubToken: string;
}): Promise<string> => {
  try {
    const login = await verification.github.resolveTokenLogin(verification.githubToken);
    const isPrivate = await verification.github.readRepositoryPrivacy(verification.githubToken);
    if (!isPrivate) {
      throw new UnauthenticatedError(
        "repository read does not prove membership on a public repository",
      );
    }
    return login;
  } catch (failure) {
    return classifyGithubFailure(failure);
  }
};

export const issueSession = async (issuance: {
  readonly githubToken: string | undefined;
  readonly github: GithubReader;
  readonly sessions: SessionStore;
  readonly now?: () => number;
  readonly generateCredential?: () => string;
}): Promise<AuthSessionResponse> => {
  if (issuance.githubToken === undefined) {
    throw new UnauthenticatedError("github token missing");
  }
  const login = await verifyOperatorMembership({
    github: issuance.github,
    githubToken: issuance.githubToken,
  });
  const generateCredential =
    issuance.generateCredential ?? ((): string => randomBytes(32).toString("base64url"));
  const credential = generateCredential();
  const now = issuance.now ?? Date.now;
  const expiresAtMs = now() + SESSION_TTL_MS;
  await issuance.sessions.save({
    digest: credentialDigest(credential),
    login,
    expiresAtMs,
  });
  return serializeAuthSession(credential, new Date(expiresAtMs));
};
