---
name: core
description: >
  Wrap heavy repository commands with @mst/ai-native: throttle caps how many wrapped commands run at once per host and namespace, spool diverts a child's full output to a log file and returns a fixed-size summary, unabridged is a PreToolUse hook that refuses `head` and `tail` in Bash commands. Load when wiring package.json entry points with these wrappers, when a wrapped command waits for a slot or seems to hang, when you need the full log behind a spool summary line, or when a Bash command was denied for slicing its output.
metadata:
  type: core
  library: "@mst/ai-native"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/ai-native/src/throttle/usage.ts"
  - "masseater/mst:packages/ai-native/src/spool/run-spool.ts"
  - "masseater/mst:packages/ai-native/src/unabridged/find-slicing-commands.ts"
  - "masseater/mst:packages/ai-native/AGENTS.md"
---

# @mst/ai-native — throttle, spool, and unabridged

Two command wrappers keep a shared machine usable while several agents and humans run heavy commands in parallel. `throttle` protects the host's CPU, memory, and disk bandwidth by capping simultaneous executions. `spool` protects the caller's context window by keeping command output out of it. Both take their own options first, then `--`, then the command to run, which is passed through untouched. `unabridged` protects the same context window from the other side, by refusing the commands that read a slice instead of the whole record.

## throttle

```
throttle [--timeout <seconds>] -- <command> [args...]
```

- Holds one slot per run. When every slot is held it joins a wait queue, reports its position on stderr, and retries each slot on every poll.
- The operating system releases a slot when its holder exits, including an abrupt termination; nobody has to clean up by hand.
- `--timeout` stops the command's whole process tree. POSIX sends SIGTERM and then SIGKILL after a grace period; Windows uses `taskkill /T /F` immediately. `0` means never.
- `MST_THROTTLE_LIMIT` sets the slot count for the host and namespace. Invalid values fall back to the default of 1.
- Exit codes: `0` success, `1` the wrapped command failed or throttle could not acquire or release its slot, `2` throttle itself was misused. The reason is on stderr.

## spool

```
spool -- <command> [args...]
```

- Streams the child's stdout and stderr, merged in arrival order and with terminal escape sequences stripped, into one log file under the work tree's `.spool/` directory.
- Prints a fixed-size summary: the command line, the log path with its size, and the outcome. On non-zero exit it appends the last 20 log lines.
- Passes the child's exit code through. If recording fails, the run reports failure even when the child succeeded.
- In CI (the `CI` environment variable) it passes output straight through and writes no file — the job log is already the durable record.

## unabridged

```
unabridged      # reads a PreToolUse payload on stdin, writes a decision on stdout
```

- A Claude Code `PreToolUse` hook, not a wrapper. Wire it in `.claude/settings.json` with `matcher` set to `Bash`.
- Denies the tool call when `head` or `tail` stands at a command position of the Bash command line: first word, or the word right after `|`, `||`, `&&`, `|&`, `;`, `;;`, `&`, `(`, `<(`. The leading directories of a path are ignored, so `/usr/bin/tail` counts.
- Words that are not command positions are left alone: `git rev-parse HEAD`, `echo 'tail'`, `cat headers.txt`, and redirect targets such as `vp test > tail` all pass.
- The denial reason names the fix for each way of reading: `spool` plus the Read tool for command output, the Read tool's offset and limit for a file, and re-reading for a record still being written.
- Says nothing and decides nothing when the command line parses to no command position match; a passing call produces no output at all.

## Composition

Compose as `throttle -- spool -- <command>`: throttle outside, spool inside, never the other way. Reversed order sends the wait announcements into the log file, so a queued run looks identical to a hung one.

Never nest `throttle` inside a command it wraps. The inner call counts as an independent competitor and consumes a second slot.

## Boundaries

- Do not wrap interactive commands with `spool`. Prompts go to the log file and the terminal stays silent while the child waits for input.
- Keep the throttle namespace on a host-local file system. Network file systems do not provide this lock contract.
- Do not delete, rename, or replace `slot-*.lock` while a throttle process may be active.
- To watch progress, read the growing log file from another terminal; the record is written as the child writes.
- Open the log file the summary points to instead of re-running the command with filters. Re-running pays the cost twice and misses non-deterministic failures.
- `.spool/` is never cleaned automatically: it grows by one file per run and disappears with the work tree.
- `unabridged` only sees command positions of the command line it is handed. `bash -c '... | tail'` collapses to a single string token and `xargs head` puts `head` in an argument position; both pass.
- `unabridged` does not check that the fix it names is reachable. Where `spool` is not on PATH, `vp exec spool -- <command>` reaches it; without either, the denial leaves no way out.
