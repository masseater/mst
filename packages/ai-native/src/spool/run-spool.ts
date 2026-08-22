import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import { STREAM_EVENT } from "../node-event-names.ts";
import {
  exitCodeOf,
  startFailureSummary,
  waitClose,
  waitSpawn,
  type ChildEnd,
} from "./child-outcome.ts";
import { formatElapsed } from "./format-elapsed.ts";
import { commandIdOf, defaultSpoolRoot, timestampOf } from "./log-destination.ts";
import { parseCommand, type Command } from "./parse-command.ts";
import { isPassthroughSignalled, runPassthrough } from "./run-passthrough.ts";
import { createEscapeStripper } from "./strip-escapes.ts";

import type { Duplex, Readable, Writable } from "node:stream";

export type SpoolDeps = {
  stdout: Writable;
  stderr: Writable;
  now?: () => Date;
  monotonicNow?: () => number;
  uniqueSuffix?: () => string;
  isPassthrough?: () => boolean;
  spoolRoot?: () => string;
};

type ResolvedDeps = {
  stdout: Writable;
  stderr: Writable;
  now: () => Date;
  monotonicNow: () => number;
  uniqueSuffix: () => string;
  spoolRoot: () => string;
};

const defaultIsPassthrough = (): boolean => isPassthroughSignalled(process.env.CI);

const resolveDeps = (deps: SpoolDeps): ResolvedDeps => ({
  stdout: deps.stdout,
  stderr: deps.stderr,
  now: deps.now ?? (() => new Date()),
  monotonicNow: deps.monotonicNow ?? (() => performance.now()),
  uniqueSuffix: deps.uniqueSuffix ?? (() => randomBytes(4).toString("hex")),
  spoolRoot: deps.spoolRoot ?? defaultSpoolRoot,
});

const recordFailureSummary = (
  commandLine: string,
  written: { filePath: string; reason: unknown },
): string =>
  `spool: command: ${commandLine}\nspool: error: cannot record to ${written.filePath}: ${String(written.reason)}\n`;

const openRecordFile = async (rootDir: string, filePath: string): Promise<WriteStream | Error> => {
  try {
    await mkdir(rootDir, { recursive: true });
    const stream = createWriteStream(filePath, { flags: "w" });
    await once(stream, "open");
    return stream;
  } catch (caught) {
    return caught as Error;
  }
};

const excerptOf = (tail: Buffer): string => {
  const lines = tail.toString().split("\n");
  const closedLines = lines.at(-1) === "" ? lines.slice(0, -1) : lines;
  return closedLines
    .slice(-20)
    .map((line) => `${line}\n`)
    .join("");
};

const tailLimit = 32768;

class SpoolRecording {
  private readonly fileStream: WriteStream;
  private readonly strippers: readonly [Duplex, Duplex];
  private failure: Error | undefined = undefined;
  private bytes = 0;
  private newlines = 0;
  private endsWithNewline = true;
  private tailParts: readonly Buffer[] = [];
  private tailLength = 0;

  constructor(fileStream: WriteStream) {
    this.fileStream = fileStream;
    this.strippers = [createEscapeStripper(), createEscapeStripper()];
    fileStream.on(STREAM_EVENT.failure, (streamError: Error) => {
      this.abort(streamError);
    });
    for (const stripper of this.strippers) {
      stripper.on(STREAM_EVENT.data, (part: Buffer) => {
        this.observe(part);
      });
    }
  }

  private abort(streamError: Error): void {
    this.failure = streamError;
    for (const stripper of this.strippers) {
      stripper.unpipe(this.fileStream);
      stripper.resume();
    }
  }

  private observe(part: Buffer): void {
    this.bytes += part.length;
    this.newlines += part.reduce((counted, byte) => (byte === 0x0a ? counted + 1 : counted), 0);
    this.endsWithNewline = part.at(-1) === 0x0a;
    this.tailParts = [...this.tailParts, part];
    this.tailLength += part.length;
    this.trimTail();
  }

  private trimTail(): void {
    while (
      this.tailParts.length > 1 &&
      this.tailLength - (this.tailParts[0] as Buffer).length >= tailLimit
    ) {
      this.tailLength -= (this.tailParts[0] as Buffer).length;
      this.tailParts = this.tailParts.slice(1);
    }
  }

  async capture(input: { child: ChildProcess; closed: Promise<ChildEnd> }): Promise<ChildEnd> {
    (input.child.stdout as Readable).pipe(this.strippers[0]).pipe(this.fileStream, { end: false });
    (input.child.stderr as Readable).pipe(this.strippers[1]).pipe(this.fileStream, { end: false });
    const [end] = await Promise.all([
      input.closed,
      once(this.strippers[0], "end"),
      once(this.strippers[1], "end"),
    ]);
    await this.finish();
    return end;
  }

  private async finish(): Promise<void> {
    if (this.failure !== undefined) {
      return;
    }
    await new Promise<void>((resolvePromise) => {
      this.fileStream.end(() => {
        resolvePromise();
      });
    });
  }

  get failed(): boolean {
    return this.failure !== undefined;
  }

  get reason(): unknown {
    return this.failure;
  }

  get sizeSummary(): { bytes: number; lineCount: number } {
    return { bytes: this.bytes, lineCount: this.newlines + (this.endsWithNewline ? 0 : 1) };
  }

  excerpt(): string {
    return excerptOf(Buffer.concat(this.tailParts));
  }
}

const discardRecord = async (input: {
  deps: ResolvedDeps;
  commandLine: string;
  filePath: string;
  fileStream: WriteStream;
  closed: Promise<ChildEnd>;
  spawnError: Error;
}): Promise<number> => {
  await input.closed;
  input.fileStream.destroy();
  await unlink(input.filePath);
  input.deps.stderr.write(startFailureSummary(input.commandLine, input.spawnError));
  return 127;
};

const reportCompletion = (input: {
  deps: ResolvedDeps;
  commandLine: string;
  filePath: string;
  recording: SpoolRecording;
  end: ChildEnd;
  elapsed: string;
}): number => {
  if (input.recording.failed) {
    input.deps.stderr.write(
      recordFailureSummary(input.commandLine, {
        filePath: input.filePath,
        reason: input.recording.reason,
      }),
    );
    return 1;
  }
  const exitCode = exitCodeOf(input.end);
  const { bytes, lineCount } = input.recording.sizeSummary;
  input.deps.stdout.write(
    `spool: command: ${input.commandLine}\nspool: log: ${input.filePath} (${bytes} bytes, ${lineCount} lines)\nspool: exit: ${exitCode} (${input.elapsed})\n`,
  );
  if (exitCode !== 0) {
    input.deps.stdout.write(input.recording.excerpt());
  }
  return exitCode;
};

const recordRun = async (input: {
  command: Command;
  deps: ResolvedDeps;
  filePath: string;
  fileStream: WriteStream;
}): Promise<number> => {
  const recording = new SpoolRecording(input.fileStream);
  input.fileStream.write(`${input.command.join(" ")}\n\n`);
  const startedAt = input.deps.monotonicNow();
  const child = spawn(input.command[0], input.command.slice(1), {
    stdio: ["inherit", "pipe", "pipe"],
  });
  const closed = waitClose(child);
  const spawnError = await waitSpawn(child);
  if (spawnError !== undefined) {
    return discardRecord({
      deps: input.deps,
      commandLine: input.command.join(" "),
      filePath: input.filePath,
      fileStream: input.fileStream,
      closed,
      spawnError,
    });
  }
  const end = await recording.capture({ child, closed });
  return reportCompletion({
    deps: input.deps,
    commandLine: input.command.join(" "),
    filePath: input.filePath,
    recording,
    end,
    elapsed: formatElapsed(input.deps.monotonicNow() - startedAt),
  });
};

const runEscaped = async (command: Command, deps: ResolvedDeps): Promise<number> => {
  const rootDir = deps.spoolRoot();
  const filePath = join(
    rootDir,
    `${timestampOf(deps.now())}-${commandIdOf(command)}-${deps.uniqueSuffix()}.log`,
  );
  const opened = await openRecordFile(rootDir, filePath);
  if (opened instanceof Error) {
    deps.stderr.write(recordFailureSummary(command.join(" "), { filePath, reason: opened }));
    return 1;
  }
  return recordRun({ command, deps, filePath, fileStream: opened });
};

const usageText = [
  "usage: spool -- <command> [args...]",
  "",
  "Runs the command with its stdout and stderr recorded to a single log file",
  "under the repository's .spool directory, and prints a fixed-size summary",
  "instead of the output. Terminal escape sequences are removed from the record.",
  "On a non-zero exit the summary is followed by the last 20 recorded lines.",
  'When the CI environment variable is set to a non-empty value other than "false",',
  "the command's stdio passes through untouched and no log file is created.",
  "",
  "exit codes: the command's own code (128+signal when killed by a signal),",
  "127 when the command cannot start, 1 when recording fails, 2 on usage errors",
].join("\n");

export const runSpool = async (argv: string[], deps: SpoolDeps): Promise<number> => {
  const command = parseCommand(argv);
  if (command === undefined) {
    deps.stderr.write(`${usageText}\n`);
    return 2;
  }
  const resolved = resolveDeps(deps);
  return (deps.isPassthrough ?? defaultIsPassthrough)()
    ? runPassthrough(command, resolved)
    : runEscaped(command, resolved);
};
