export class UnresponsiveError extends Error {
  override readonly name = "UnresponsiveError";

  readonly command: string;

  readonly idleMs: number;

  constructor(details: { readonly command: string; readonly idleMs: number }) {
    super(`${details.command} produced no output for ${details.idleMs}ms`);
    this.command = details.command;
    this.idleMs = details.idleMs;
  }
}
