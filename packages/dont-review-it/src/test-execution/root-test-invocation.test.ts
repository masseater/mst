import { describe, expect, test } from "vite-plus/test";

import { rootTestInvocationMessagesIn } from "./root-test-invocation.ts";

const ROOT_GUARD = "throttle --timeout 1800 -- spool -- vp run guard:all";

const ROOT_TEST = "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2";

const messagesFor = ({
  guard,
  guardAll,
}: {
  readonly guard?: unknown;
  readonly guardAll?: unknown;
} = {}): readonly string[] =>
  rootTestInvocationMessagesIn({
    guard: guard === undefined ? ROOT_GUARD : guard,
    "guard:all": guardAll === undefined ? ROOT_TEST : guardAll,
  });

describe("rootTestInvocationMessagesIn", () => {
  test("rejects a root manifest that omits both guard entries", () => {
    expect(rootTestInvocationMessagesIn({})).toHaveLength(2);
  });

  test("accepts one canonical recursive test stage inside a static guard chain", () => {
    expect(messagesFor({ guardAll: `vp check && ${ROOT_TEST} && vp run -r build` })).toStrictEqual(
      [],
    );
  });

  test("accepts statically quoted tokens without weakening the canonical command", () => {
    expect(
      messagesFor({
        guard: "'throttle' '--timeout' '1800' '--' 'spool' '--' 'vp' 'run' 'guard:all'",
        guardAll:
          "'vp' 'run' '-r' '--concurrency-limit' '1' 'test' '--coverage' '--maxWorkers' '2'",
      }),
    ).toStrictEqual([]);
  });

  test("does not mistake long options or arguments after double dash for string execution", () => {
    expect(
      messagesFor({
        guardAll: `${ROOT_TEST} && bash --norc --rcfile=config --version && sh -- -c 'vitest run --changed HEAD' && npx -- --call='vitest run --changed HEAD' && npm exec -- --call 'vitest run --changed HEAD'`,
      }),
    ).toStrictEqual([]);
  });

  test.each([
    null,
    false,
    `${ROOT_GUARD} --changed HEAD`,
    `${ROOT_GUARD} && true`,
    `${ROOT_GUARD} > guard.log`,
    "throttle --timeout 1800 -- spool -- vp run verify",
    `${ROOT_GUARD} $OPTION`,
  ])("rejects a root guard that does not delegate exactly once: %s", (guard) => {
    expect(messagesFor({ guard })).toContainEqual(
      expect.stringContaining("Replace its complete value with"),
    );
  });

  test.each([null, false])("rejects a missing or non-string guard:all body: %s", (guardAll) => {
    expect(messagesFor({ guardAll })).toContainEqual(
      expect.stringContaining("must not omit, delegate, duplicate, or alter"),
    );
  });

  test.each([
    "",
    `${ROOT_TEST} || true`,
    `${ROOT_TEST}; true`,
    `${ROOT_TEST} | true`,
    `${ROOT_TEST} & true`,
    `${ROOT_TEST}\ntrue`,
    `${ROOT_TEST} &&`,
    `${ROOT_TEST} && echo $VALUE`,
  ])("rejects a guard:all body whose control flow is not one static && chain: %s", (guardAll) => {
    expect(messagesFor({ guardAll })).toContainEqual(
      expect.stringContaining("join nonempty stages only with `&&`"),
    );
  });

  test.each([
    "vp check && vp run -r build",
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
    "vp run -r --concurrency-limit 1 test --coverage.exclude=src/** --maxWorkers 2",
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
    `${ROOT_TEST} && ${ROOT_TEST}`,
  ])(
    "rejects a missing, delegated, altered, or duplicated recursive test stage: %s",
    (guardAll) => {
      expect(messagesFor({ guardAll })).toContainEqual(
        expect.stringContaining(`Keep exactly one \`${ROOT_TEST}\` stage`),
      );
    },
  );
});
