import { asRecord } from "./unknown-record.ts";

export type AuthSessionResponse = {
  readonly token: string;
  readonly expiresAt: string;
};

export const serializeAuthSession = (token: string, expiresAt: Date): AuthSessionResponse => ({
  token,
  expiresAt: expiresAt.toISOString(),
});

class InvalidAuthSessionError extends Error {
  override readonly name = "InvalidAuthSessionError";

  constructor() {
    super("the auth session response does not match the contract shape");
  }
}

export const parseAuthSession = (candidate: unknown): AuthSessionResponse => {
  const session = asRecord(candidate);
  const token = session?.token;
  const expiresAt = session?.expiresAt;
  if (
    typeof token !== "string" ||
    token === "" ||
    typeof expiresAt !== "string" ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    throw new InvalidAuthSessionError();
  }
  return { token, expiresAt };
};
