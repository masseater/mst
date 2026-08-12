---
name: core
description: >
  Wrap heavy repository commands with @mst/ai-native: throttle caps how many
  wrapped commands run at once per host and namespace, spool diverts a child's
  full output to a log file and returns a fixed-size summary. Load when wiring
  package.json entry points with these wrappers, when a wrapped command waits
  for a slot or seems to hang, or when you need the full log behind a spool
  summary line.
metadata:
  type: core
  library: "@mst/ai-native"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/ai-native/src/throttle/usage.ts"
  - "masseater/mst:packages/ai-native/src/spool/run-spool.ts"
  - "masseater/mst:packages/ai-native/AGENTS.md"
---

# @mst/ai-native — throttle and spool

Two command wrappers keep a shared machine usable while several agents and
humans run heavy commands in parallel. `throttle` protects the host's CPU,
memory, and disk bandwidth by capping simultaneous executions. `spool`
protects the caller's context window by keeping command output out of it.
Both take their own options first, then `--`, then the command to run,
which is passed through untouched.

## throttle

```
throttle [--timeout <seconds>] -- <command> [args...]
```

- Holds one slot per run. When every slot is held it joins a wait queue,
  reports its position on stderr, and retries each slot on every poll.
- The operating system releases a holder's slot when that process exits. A
  live holder keeps the slot until its command ends or its timeout stops it.
- `--timeout` kills the command's whole process group (SIGTERM, then
  SIGKILL after a grace period). `0` means never.
- `MST_THROTTLE_LIMIT` sets the slot count for the host and namespace.
  Invalid values fall back to the default of 1.
- Exit codes: `0` success, `1` the wrapped command failed (any reason),
  `2` throttle itself was misused. The reason is on stderr.

## spool

```
spool -- <command> [args...]
```

- Streams the child's stdout and stderr, merged in arrival order and with
  terminal escape sequences stripped, into one log file under the work
  tree's `.spool/` directory.
- Prints a fixed-size summary: the command line, the log path with its size,
  and the outcome. On non-zero exit it appends the last 20 log lines.
- Passes the child's exit code through. If recording fails, the run reports
  failure even when the child succeeded.
- In CI (the `CI` environment variable) it passes output straight through
  and writes no file — the job log is already the durable record.

## Composition

Compose as `throttle -- spool -- <command>`: throttle outside, spool inside,
never the other way. Reversed order sends the wait announcements into the
log file, so a queued run looks identical to a hung one.

Never nest `throttle` inside a command it wraps. The inner call counts as an
independent competitor and consumes a second slot.

## Boundaries

- Do not wrap interactive commands with `spool`. Prompts go to the log file
  and the terminal stays silent while the child waits for input.
- To watch progress, read the growing log file from another terminal; the
  record is written as the child writes.
- Open the log file the summary points to instead of re-running the command
  with filters. Re-running pays the cost twice and misses non-deterministic
  failures.
- `.spool/` is never cleaned automatically: it grows by one file per run and
  disappears with the work tree.
- Keep throttle's temporary slot area on a local filesystem. Its exclusion
  contract does not extend to NFS, SMB, or another network filesystem.
- Do not delete, rename, replace, or clean up `slot-*.lock` while throttle
  processes are active. The operating-system lock belongs to that exact file.
