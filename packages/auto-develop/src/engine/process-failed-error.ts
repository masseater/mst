export class ProcessFailedError extends Error {
  override readonly name = "ProcessFailedError";

  readonly command: string;

  readonly exitCode: number;

  readonly produced: string;

  constructor(details: {
    readonly command: string;
    readonly exitCode: number;
    readonly output: string;
  }) {
    super(`${details.command} exited with code ${details.exitCode}`);
    this.command = details.command;
    this.exitCode = details.exitCode;
    this.produced = details.output;
  }
}
