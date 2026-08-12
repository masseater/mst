---
name: core
description: >
  Run and wire @mst/auto-develop: the relay server that receives GitHub
  webhooks and hands them to reviewer and author runtimes over SSE, the
  lane-exclusive job queue that keeps one response per PR, and the tmux
  engine runner that launches an agent CLI in a per-PR git worktree. Load
  when starting the relay or a runtime, when wiring the credential and
  startup-drain path, or when deciding how a GitHub event should reach a PR
  job.
metadata:
  type: core
  library: "@mst/auto-develop"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/auto-develop/src/server.ts"
  - "masseater/mst:packages/auto-develop/src/cli.ts"
  - "masseater/mst:packages/auto-develop/AGENTS.md"
---

# @mst/auto-develop — keep a PR review loop running

Two runtimes answer pull requests without a human starting them. The
**reviewer** reviews a PR once per request and writes its verdict to a commit
status. The **author** answers review feedback, CI failures, merge conflicts,
and base updates, then asks for a re-review. A **relay** server sits between
GitHub and both runtimes so the runtimes never take an inbound connection.

## Run the relay

```sh
PORT=8080 \
GITHUB_REPOSITORY=<owner>/<repo> \
GITHUB_WEBHOOK_SECRET=<secret> \
GH_TOKEN=<token> \
node packages/auto-develop/src/server.ts
```

Point the GitHub webhook at `POST /webhook`. The relay verifies the
HMAC-SHA256 signature, stores the event, and fans it out to connected
subscribers.

| Path                        | Who may call it                        |
| --------------------------- | -------------------------------------- |
| `POST /webhook`             | GitHub, proven by the shared secret    |
| `POST /auth/session`        | a runtime, proven by its GitHub token  |
| `GET /events/stream`        | a runtime, proven by the relay session |
| `GET /events/startup-drain` | a runtime, proven by the relay session |

Set `AUTO_DEVELOP_LOG_DIR` to a writable mount in a container. Logs go to
stdout and to a daily file under that directory.

## Run a runtime

```sh
node packages/auto-develop/src/cli.ts reviewer --concurrency 3
node packages/auto-develop/src/cli.ts author --dry-run
```

`--dry-run` skips every write to GitHub, so a wiring change can be checked
against a live repository without leaving a mark on it.

## Core Patterns

### The commit status always describes the current input

A reviewer run records the base branch name and head SHA before it starts.
It writes the final status only when both still match afterwards. If either
moved, it discards the result and asks for one follow-up review instead, so a
verdict never lands on code that was not reviewed.

Base is compared by **branch name** and head by **commit SHA**. A base branch
that merely moved forward is not a change; only a retarget is.

### Failures split into two kinds

Wait-and-it-heals failures (408, 429, 5xx, a dropped connection) are retried
with a capped backoff. Failures that will not heal (a rejected credential, a
schema-violating response, an expired agent CLI login) stop the process so an
operator takes over. The queue keeps the job when an agent login expires, so
nothing is lost while the operator re-authenticates.

### One response per PR

Each PR owns a lane. One job runs per lane at a time, and the concurrency
limit caps how many lanes run at once. A second event for a running lane is
dropped rather than queued — the engine reads the current state when it
starts, so a queued duplicate would only redo the same work. The exception is
a review-input change, which replaces the single follow-up slot so the newest
input wins.

### Disk state is written, never read back

The queue snapshot exists for humans and audits. A restarted process starts
from an empty in-memory queue and re-derives the work from GitHub through the
startup drain. Reading the snapshot back would double the recovery path.

## Anti-patterns

**Do not send the GitHub token anywhere but the relay's session endpoint.**
Subscriptions carry the short-lived relay credential. The credential provider
refuses to present it to any origin but the one it was configured with.

**Do not put a PR's diff or the review guidelines in the engine prompt.** The
prompt carries the PR number, the base and head, and the path to a run
context JSON in the worktree. A large diff would otherwise hit the argument
length limit at process spawn.

**Do not log the GitHub login.** Logs carry how the identity was resolved and
where the token came from, never who it is.
