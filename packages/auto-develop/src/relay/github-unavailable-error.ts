export class GithubUnavailableError extends Error {
  override readonly name = "GithubUnavailableError";

  constructor(reason: string) {
    super(reason);
  }
}
