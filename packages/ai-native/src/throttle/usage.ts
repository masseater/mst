import { parseArgs } from "node:util";

const USAGE = `Usage: throttle [--timeout <seconds>] -- <command> [args...]

Runs the command while keeping the number of simultaneous executions that
share this host and namespace at or below the limit. When every slot is held
the wrapper joins a wait queue, reports its position on stderr, and retries
every slot on each poll, for at most the wait budget. A slot whose holder
died without releasing is reclaimed once the holder's liveness mark goes
stale. Do not nest throttle inside a command it wraps: the inner call counts
as one more competitor and consumes a second slot.

Options:
  --timeout <seconds>  Send SIGTERM to the command's process group after this
                       many seconds, then SIGKILL after a short grace period.
                       0 never interrupts the command. Defaults to 0.

Environment:
  MST_THROTTLE_LIMIT   Number of slots shared by every throttle on this host
                       and namespace. Invalid values (non-integer, zero or
                       less) fall back to the default of 1.

Exit codes:
  0  the wrapped command succeeded
  1  the wrapped command failed, was killed, could not be started, ran past
     the timeout, or the wrapper could not get a slot
  2  throttle itself was called incorrectly`;

export type Invocation = {
  timeoutSec: number;
  executable: string;
  args: readonly string[];
  commandLine: string;
};

const parsedTimeoutSeconds = (head: readonly string[]): { seconds: number } | string => {
  const raw = ((): string | undefined | Error => {
    try {
      return parseArgs({
        args: [...head],
        options: { timeout: { type: "string" } },
        allowPositionals: false,
      }).values.timeout;
    } catch (failure) {
      return failure as Error;
    }
  })();
  if (raw instanceof Error) return `throttle: ${raw.message}\n\n${USAGE}`;
  if (raw !== undefined && !/^[0-9]+$/.test(raw)) {
    return `throttle: --timeout expects a whole number of seconds, got "${raw}"\n\n${USAGE}`;
  }
  return { seconds: raw === undefined ? 0 : Number(raw) };
};

export const parseInvocation = (argv: readonly string[]): Invocation | string => {
  const split = argv.indexOf("--");
  if (split === -1) return USAGE;
  const timeout = parsedTimeoutSeconds(argv.slice(0, split));
  if (typeof timeout === "string") return timeout;
  const [executable, ...handedArgs] = argv.slice(split + 1);
  if (executable === undefined) return USAGE;
  return {
    timeoutSec: timeout.seconds,
    executable,
    args: handedArgs,
    commandLine: [executable, ...handedArgs].join(" "),
  };
};
