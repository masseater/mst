export type CredentialProvider = {
  readonly authorizationFor: (request: {
    readonly url: string;
    readonly signal?: AbortSignal;
  }) => Promise<string>;
  readonly invalidate: () => void;
};

export class CredentialTerminalError extends Error {
  override readonly name: string = "CredentialTerminalError";
}
