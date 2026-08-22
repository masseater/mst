import { describe, expect, test } from "vite-plus/test";

import { rootTestInvocationMessagesIn } from "./root-test-invocation.ts";

const ROOT_GUARD = "throttle --timeout 1800 -- spool -- vp run guard:all";

const ROOT_TEST = "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2";

const ROOT_CHECK = "vp check";

const DONT_REVIEW_IT_CHECK = "vp exec dont-review-it check";

const CANONICAL_GUARD_ALL = `${ROOT_CHECK} && ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`;

const ROOT_GUARD_MESSAGE =
  "The root `guard` script must not append commands or arguments to, wrap differently, or bypass the designated `guard:all` entry. Replace its complete value with `throttle --timeout 1800 -- spool -- vp run guard:all`, so the wrapper encloses every gate exactly once.";

const GUARD_ALL_CHAIN_MESSAGE =
  "The root `guard:all` script must not use expansion or shell control flow that can skip, background, pipe, or hide a gate. Keep every command statically inspectable, join nonempty stages only with `&&`, and leave no trailing operator.";

const ROOT_TEST_COMMAND_MESSAGE =
  "The root `guard:all` script must not omit, delegate, duplicate, or alter the recursive test gate. Keep exactly one `vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` stage; only `--coverage` and `--maxWorkers 2` may be forwarded to each package test script.";

const ROOT_CHECK_COMMAND_MESSAGE =
  "The root `guard:all` script must start with exactly one direct `vp check` stage. Do not wrap it, redirect it, move it later, add arguments that can narrow its reach, or invoke another check through an opaque command.";

const DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE =
  "The root `guard:all` script must contain exactly one direct `vp exec dont-review-it check` stage without wrappers, redirection, or additional arguments, so `vp check` and the repository check keep each other reachable.";

const ROOT_INVOCATION_SCENARIOS = [
  {
    title: "a root manifest that omits both guard entries",
    guard: undefined,
    guardAll: undefined,
    expectedMessages: [
      ROOT_GUARD_MESSAGE,
      ROOT_CHECK_COMMAND_MESSAGE,
      DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE,
      ROOT_TEST_COMMAND_MESSAGE,
    ],
  },
  {
    title: "one canonical recursive test stage inside a static guard chain",
    guard: ROOT_GUARD,
    guardAll: `${ROOT_CHECK} && vp run -r build && ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    expectedMessages: [],
  },
  {
    title: "statically quoted canonical tokens",
    guard: "'throttle' '--timeout' '1800' '--' 'spool' '--' 'vp' 'run' 'guard:all'",
    guardAll:
      "'vp' 'check' && 'vp' 'exec' 'dont-review-it' 'check' && 'vp' 'run' '-r' '--concurrency-limit' '1' 'test' '--coverage' '--maxWorkers' '2'",
    expectedMessages: [],
  },
  {
    title: "long options and post-double-dash arguments unrelated to test execution",
    guard: ROOT_GUARD,
    guardAll: `${CANONICAL_GUARD_ALL} && bash --norc --rcfile=config --version && sh -- -c 'vitest run --changed HEAD' && npx -- --call='vitest run --changed HEAD' && npm exec -- --call 'vitest run --changed HEAD'`,
    expectedMessages: [],
  },
  ...[
    null,
    false,
    `${ROOT_GUARD} --changed HEAD`,
    `${ROOT_GUARD} && true`,
    `${ROOT_GUARD} > guard.log`,
    "throttle --timeout 1800 -- spool -- vp run verify",
    `${ROOT_GUARD} $OPTION`,
  ].map((guard) => ({
    title: `noncanonical root guard: ${String(guard)}`,
    guard,
    guardAll: CANONICAL_GUARD_ALL,
    expectedMessages: [ROOT_GUARD_MESSAGE],
  })),
  ...[null, false].map((guardAll) => ({
    title: `missing or non-string guard:all body: ${String(guardAll)}`,
    guard: ROOT_GUARD,
    guardAll,
    expectedMessages: [
      ROOT_CHECK_COMMAND_MESSAGE,
      DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE,
      ROOT_TEST_COMMAND_MESSAGE,
    ],
  })),
  {
    title: "an empty guard:all body",
    guard: ROOT_GUARD,
    guardAll: "",
    expectedMessages: [
      GUARD_ALL_CHAIN_MESSAGE,
      ROOT_CHECK_COMMAND_MESSAGE,
      DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE,
      ROOT_TEST_COMMAND_MESSAGE,
    ],
  },
  ...[
    `${ROOT_CHECK} || ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK}; ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK} | ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK} & ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK}\n${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${CANONICAL_GUARD_ALL} &&`,
    `${CANONICAL_GUARD_ALL} && echo $VALUE`,
  ].map((guardAll) => ({
    title: `non-static guard:all chain: ${guardAll}`,
    guard: ROOT_GUARD,
    guardAll,
    expectedMessages: [GUARD_ALL_CHAIN_MESSAGE],
  })),
  ...[
    "vp run -r build",
    "vp run test:coverage",
    "vp run app#test:coverage",
    "vp run app#test --coverage --maxWorkers 2",
    "vp test --coverage --maxWorkers 2",
    "vitest run --coverage --maxWorkers 2",
    "./node_modules/.bin/vitest run --coverage --maxWorkers 2",
    `spool -- ${ROOT_TEST}`,
    `${ROOT_TEST} > test.log`,
    "vp run -r --concurrency-limit 1 test --changed HEAD --coverage --maxWorkers 2",
    "vp run -r --concurrency-limit 1 test --config alternate.ts --coverage --maxWorkers 2",
    "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 4",
    "vp run -r --concurrency-limit 1 test --coverage",
    "vp run -r --concurrency-limit 1 test --maxWorkers 2",
    `vp run build test && ${ROOT_TEST}`,
    `${ROOT_TEST} && vp run test:coverage`,
    `${ROOT_TEST} && npm test`,
    `${ROOT_TEST} && pnpm run test:coverage`,
    `${ROOT_TEST} && yarn run app#test`,
    `${ROOT_TEST} && bun test`,
    `${ROOT_TEST} && npx vitest@4 run`,
    `${ROOT_TEST} && /tmp/vitest run`,
    `${ROOT_TEST} && /tmp/vp test --changed HEAD`,
    `${ROOT_TEST} && pnpm@10 test`,
    `${ROOT_TEST} && ${ROOT_TEST}`,
  ].map((guardAll) => ({
    title: `missing, delegated, altered, or duplicated recursive test stage: ${guardAll}`,
    guard: ROOT_GUARD,
    guardAll: `${ROOT_CHECK} && ${DONT_REVIEW_IT_CHECK} && ${guardAll}`,
    expectedMessages: [ROOT_TEST_COMMAND_MESSAGE],
  })),
  ...[
    `${ROOT_TEST} && sh -c 'vitest run --changed HEAD'`,
    `${ROOT_TEST} && /bin/bash -c='vp test --config alternate.ts'`,
    `${ROOT_TEST} && bash -lc 'vitest run --changed HEAD'`,
    `${ROOT_TEST} && sh -ec 'vp test --config alternate.ts'`,
    `${ROOT_TEST} && zsh -fc 'vp test src/one.test.ts'`,
    `${ROOT_TEST} && fish -c 'vp test src/one.test.ts'`,
    `${ROOT_TEST} && npx -c 'vitest run --changed HEAD'`,
    `${ROOT_TEST} && npx --call='vitest run --changed HEAD'`,
    `${ROOT_TEST} && npm exec --call 'vitest run --changed HEAD'`,
    `${ROOT_TEST} && npm x -c='vitest run --changed HEAD'`,
    `${ROOT_TEST} && npm --silent exec -c 'vitest run --changed HEAD'`,
    `${ROOT_TEST} && npm -s x --call='vp test --config alternate.ts'`,
    `${ROOT_TEST} && npm --unknown exec -c 'vitest run --changed HEAD'`,
  ].map((guardAll) => ({
    title: `opaque command that could hide any mandatory gate: ${guardAll}`,
    guard: ROOT_GUARD,
    guardAll: `${CANONICAL_GUARD_ALL} && ${guardAll}`,
    expectedMessages: [
      ROOT_CHECK_COMMAND_MESSAGE,
      DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE,
      ROOT_TEST_COMMAND_MESSAGE,
    ],
  })),
  {
    title: "a recursive test stage with an expanded coverage exclusion",
    guard: ROOT_GUARD,
    guardAll: `${ROOT_CHECK} && ${DONT_REVIEW_IT_CHECK} && vp run -r --concurrency-limit 1 test --coverage.exclude=src/** --maxWorkers 2`,
    expectedMessages: [GUARD_ALL_CHAIN_MESSAGE, ROOT_TEST_COMMAND_MESSAGE],
  },
  ...[
    `${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${DONT_REVIEW_IT_CHECK} && ${ROOT_CHECK} && ${ROOT_TEST}`,
    `spool -- ${ROOT_CHECK} && ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK} --ignore-pattern '**' && ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK} > check.log && ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${CANONICAL_GUARD_ALL} && ${ROOT_CHECK}`,
  ].map((guardAll) => ({
    title: `missing, moved, wrapped, narrowed, redirected, or duplicated vp check stage: ${guardAll}`,
    guard: ROOT_GUARD,
    guardAll,
    expectedMessages: [ROOT_CHECK_COMMAND_MESSAGE],
  })),
  ...[
    `${ROOT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK} && spool -- ${DONT_REVIEW_IT_CHECK} && ${ROOT_TEST}`,
    `${ROOT_CHECK} && ${DONT_REVIEW_IT_CHECK} --write && ${ROOT_TEST}`,
    `${ROOT_CHECK} && ${DONT_REVIEW_IT_CHECK} > check.log && ${ROOT_TEST}`,
    `${CANONICAL_GUARD_ALL} && ${DONT_REVIEW_IT_CHECK}`,
    `${CANONICAL_GUARD_ALL} && dont-review-it check`,
  ].map((guardAll) => ({
    title: `missing, wrapped, altered, redirected, or duplicated repository check stage: ${guardAll}`,
    guard: ROOT_GUARD,
    guardAll,
    expectedMessages: [DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE],
  })),
] as const;

describe("rootTestInvocationMessagesIn", () => {
  describe.each(ROOT_INVOCATION_SCENARIOS)("$title", (rootInvocationScenario) => {
    const it = test.extend("rootInvocationMessages", () =>
      rootTestInvocationMessagesIn({
        guard: rootInvocationScenario.guard,
        "guard:all": rootInvocationScenario.guardAll,
      }));

    it("returns the exact diagnostics", ({ rootInvocationMessages }) => {
      expect(rootInvocationMessages).toStrictEqual(rootInvocationScenario.expectedMessages);
    });
  });
});
