---
name: core
description: >
  Run @mst/auto-develop: a relay server that receives GitHub webhooks on `POST /webhook` and hands them to runtimes over SSE, an `auto-develop reviewer` runtime that writes a verdict to a commit status, an `auto-develop author` runtime that answers review feedback, CI failures, conflicts and base updates, and `auto-develop build-pr-context` which collects a pull request into a run-context file. Load when starting the relay or a runtime, when wiring `AUTO_DEVELOP_RELAY_ORIGIN` / `GITHUB_WEBHOOK_SECRET` / `GH_TOKEN`, when deciding how a GitHub event should reach a pull-request job, or when a lane drops an event you expected it to queue.
metadata:
  type: core
  library: "@mst/auto-develop"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/auto-develop/src/server.ts"
  - "masseater/mst:packages/auto-develop/src/cli.ts"
  - "masseater/mst:packages/auto-develop/AGENTS.md"
---

# @mst/auto-develop — keep a pull-request loop running

Two runtimes answer pull requests without a human starting them. The **reviewer** reviews a pull request once per request and writes its verdict to a commit status. The **author** answers review feedback, CI failures, merge conflicts, and base updates, then asks for a re-review. A **relay** sits between GitHub and both runtimes, so neither runtime ever accepts an inbound connection.

## requires

- **A GitHub repository with a webhook.** The relay refuses to start unless `GITHUB_REPOSITORY` matches `owner/repo` and `GITHUB_WEBHOOK_SECRET` is non-empty; the schema rejects anything else at parse time, before the listener opens.
- **`GH_TOKEN` or `GITHUB_TOKEN` on both sides.** The relay reads GitHub through it, and each runtime presents it once, to the relay's session endpoint, in exchange for a short-lived relay credential.
- **`AUTO_DEVELOP_RELAY_ORIGIN` on the runtime side.** A runtime started without it writes `AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set` to stderr and exits with the misuse code rather than falling back to a default.
- **`RELAY_PUBLIC_ORIGIN`, whenever `SCHEDULER_SERVICE_ACCOUNT_EMAILS` is set.** The scheduler endpoint validates an ID token against that origin as its audience, so the config refuses to parse when emails are listed without one.
- **`git` and `tmux` on the runtime host.** The engine runner opens a per-PR terminal session inside a per-PR git worktree; neither is bundled.

## Setup

Start the relay. Importing the `./server` subpath starts the listener as a side effect:

```ts
// relay.ts
import "@mst/auto-develop/server";
```

```sh
GITHUB_REPOSITORY=<owner>/<repo> \
GITHUB_WEBHOOK_SECRET=<secret> \
GH_TOKEN=<token> \
AUTO_DEVELOP_LOG_DIR=/var/log/auto-develop \
node relay.ts
```

The relay listens on `PORT` (default `8080`). Point the GitHub webhook at `POST /webhook`; the relay verifies the HMAC-SHA256 signature in `x-hub-signature-256`, stores the event, and fans it out.

Start a runtime against that relay:

```sh
AUTO_DEVELOP_RELAY_ORIGIN=https://relay.example \
GITHUB_REPOSITORY=<owner>/<repo> \
GH_TOKEN=<token> \
auto-develop reviewer --concurrency 3
```

`author` takes the same flags. Add `--dry-run` to skip every write to GitHub, `--pr 41,42` to limit the run, `--exclude-pr 7` to keep numbers out of it, and `--gh-user <login>` to act as a specific login.

## Core Patterns

### Route each caller to the endpoint that authenticates it

```
GET  /health                     open
POST /webhook                    GitHub, proven by the shared secret
POST /auth/session               a runtime, proven by its GitHub token
GET  /events/stream              a runtime, proven by the relay session
GET  /events/poll                a runtime, proven by the relay session
GET  /events/startup-drain       a runtime, proven by the relay session
POST /tasks/check-base-updates   a scheduler, proven by a verified ID token
```

`/auth/session` is the only endpoint that accepts a GitHub token. Every other subscriber endpoint authenticates the short-lived credential that endpoint issued, and an unknown credential comes back `401`.

### Let the verdict describe the input it was computed from

A reviewer run records the base branch name and the head SHA before it starts and writes the final status only when both still match afterwards. If either moved it discards the result and asks for one follow-up review. Base is compared by **branch name** and head by **commit SHA**, so a base branch that merely moved forward is not a change — only a retarget is.

### Give the engine a path, not a payload

```sh
auto-develop build-pr-context --pr 123 --base origin/main --head HEAD
# wrote the context for PR #123
# <repo>/.repo-workflow/review-context/<run-id>/review-carried.json
# <repo>/.repo-workflow/review-context/<run-id>/review-carried.md
```

The engine prompt carries the pull request number, its base and head, and the path to that file. The diff, the comment threads, and the CI logs live in the file the path names.

### Keep one response per pull request in flight

Each pull request owns a lane, one job runs per lane at a time, and `--concurrency` caps how many lanes run at once. A second event for a running lane is dropped rather than queued, because the engine reads the pull request's current state when it starts. The exception is a review-input change, which replaces the single follow-up slot so the newest input wins.

### Split failures by whether waiting helps

Failures that heal — `408`, `429`, `5xx`, a dropped connection — are retried with a capped backoff. Failures that will not heal — a rejected credential, a schema-violating response, an expired agent CLI login — stop the process so an operator takes over. The queue keeps the job when an agent login expires, so nothing is lost while the operator re-authenticates.

## Common Mistakes

### [CRITICAL] the GitHub token presented to a subscriber endpoint

Wrong:

```sh
curl -H "authorization: Bearer $GH_TOKEN" "$RELAY_ORIGIN/events/stream?mode=reviewer"
```

Correct:

```sh
SESSION=$(curl -sX POST -H "authorization: Bearer $GH_TOKEN" "$RELAY_ORIGIN/auth/session" | jq -r .token)
curl -H "authorization: Bearer $SESSION" "$RELAY_ORIGIN/events/stream?mode=reviewer"
```

The stream resolves its bearer against the session store, so a GitHub token there is simply an unknown credential and comes back `401` — by which point the token has already been sent to whatever origin the caller named, and the `401` reads as a wiring problem rather than a leak.

Source: masseater/mst:packages/auto-develop/specs/relay-credential.spec.ts

### [HIGH] the pull request diff put into the engine prompt

Wrong:

```
Review this pull request. Here is the diff:
<the whole unified diff>
```

Correct:

```
Review PR #123. The run context is at .repo-workflow/review-context/<run-id>/review-carried.json.
```

The prompt is handed to the agent CLI as process arguments, so a diff large enough to exceed the argument length limit fails at spawn — which means the loop works on small pull requests and breaks on exactly the ones worth reviewing.

Source: masseater/mst:packages/auto-develop/specs/engine-session.spec.ts

### [HIGH] a wiring change tried against a live repository without --dry-run

Wrong:

```sh
auto-develop reviewer --pr 123
```

Correct:

```sh
auto-develop reviewer --pr 123 --dry-run
```

Every write to GitHub is real, so a run started to confirm the relay connection leaves commit statuses and review comments on a pull request people are reading, and nothing distinguishes them from a verdict the loop meant to publish.

Source: masseater/mst:packages/auto-develop/src/cli/runtime-command.ts

### [HIGH] the queue snapshot read back after a restart

Wrong: recovering the in-flight work by loading the snapshot the previous process wrote to disk.

Correct: starting from an empty in-memory queue and letting `GET /events/startup-drain` re-derive the work from GitHub.

The snapshot exists for humans and audits; reading it back adds a second recovery path that disagrees with the drain whenever GitHub moved while the process was down, and the disagreement surfaces as a job that runs against a state that no longer exists.

Source: masseater/mst:packages/auto-develop/specs/job-lane.spec.ts

### [MEDIUM] a connection address written as a constant

Wrong:

```ts
const repository = "masseater/mst";
```

Correct:

```ts
const repository = readEnvVar("GITHUB_REPOSITORY");
```

An endpoint, credential, or repository baked into the implementation cannot be changed by configuration, so the package runs correctly in exactly one environment and silently targets the wrong one everywhere else.

Source: masseater/mst:packages/auto-develop/AGENTS.md

### [HIGH] a pull-request filter that parses to nothing

Wrong:

```sh
auto-develop reviewer --pr "#123"
```

Correct:

```sh
auto-develop reviewer --pr 123
```

`--pr` keeps only the positive integers it can parse and drops the rest without a word, and an empty target list means "every lane" — so one unparseable entry turns a run scoped to a single pull request into a run over all of them.

Source: masseater/mst:packages/auto-develop/src/cli/runtime-command.ts

### [MEDIUM] the same number given to both filters

Wrong:

```sh
auto-develop author --pr 41,42 --exclude-pr 42
```

Correct:

```sh
auto-develop author --pr 41
```

Exclusion is applied after selection, so #42 is named on both lists and never runs; the command starts, reports nothing about the contradiction, and the missing pull request looks like a lane that never received an event.

Source: masseater/mst:packages/auto-develop/specs/job-lane.spec.ts

## Reference

```
relay environment
GITHUB_REPOSITORY                  required, owner/repo
GITHUB_WEBHOOK_SECRET              required, non-empty
GH_TOKEN | GITHUB_TOKEN            required, GitHub API access
PORT                               default 8080
RELAY_PUBLIC_ORIGIN                ID token audience; required with scheduler emails
SCHEDULER_SERVICE_ACCOUNT_EMAILS   comma separated; empty disables the scheduler route
GITHUB_API_ORIGIN                  default https://api.github.com
CI_SUPPRESSION_LABEL               label that keeps CI events out of the drain
AUTO_DEVELOP_LOG_DIR               default <repo>/logs; logs also go to stdout

runtime environment
AUTO_DEVELOP_RELAY_ORIGIN          required, where the relay listens
GITHUB_REPOSITORY                  required, owner/repo
GH_TOKEN | GITHUB_TOKEN            required, exchanged at /auth/session

runtime flags
--concurrency <count>              lanes running at once; default 3
--dry-run                          skip every write to GitHub
--pr <numbers>                     comma separated allow list
--exclude-pr <numbers>             comma separated deny list; wins over --pr
--gh-user <login>                  act as this login
--dangerously-skip-permissions     let the agent CLI run every tool unattended
```

Event stores, cursor stores, and session stores default to in-memory implementations, so a restart keeps nothing and the startup drain is the only recovery path.

## See also

- `packages/ai-native/skills/core` — the wrappers that bound a long agent run's output and the host it shares.
