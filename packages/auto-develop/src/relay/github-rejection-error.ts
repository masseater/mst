export class GithubRejectionError extends Error {
  override readonly name = "GithubRejectionError";

  constructor(reason: string) {
    super(reason);
  }
}
