import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidTestHook } from "./forbid-test-hook--move-setup-into-fixture.ts";

const SPEC_FILENAME = "order.test.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-forbid-test-hook");
rmSync(fixtureDir, { recursive: true, force: true });

mkdirSync(join(fixtureDir, "hooks"), { recursive: true });

writeFileSync(
  join(fixtureDir, "hooks/imported.ts"),
  "import { beforeEach } from 'vitest';\n\nexport const installClock = () => {\n  beforeEach(() => {\n    seed();\n  });\n};\n",
);
writeFileSync(
  join(fixtureDir, "hooks/injected.ts"),
  "export const installStore = () => {\n  afterEach(() => {\n    drop();\n  });\n};\n",
);
writeFileSync(
  join(fixtureDir, "hooks/relay.ts"),
  "import { installClock } from './imported.ts';\n\nexport const installEverything = () => {\n  installClock();\n};\n",
);
writeFileSync(join(fixtureDir, "hooks/plain.ts"), "export const build = () => ({ amount: 3 });\n");
writeFileSync(
  join(fixtureDir, "hooks/harness.ts"),
  "const harness = { beforeEach: (run: () => void) => run() };\n\nexport const installHarness = () => {\n  harness.beforeEach(() => {\n    seed();\n  });\n};\n",
);
writeFileSync(
  join(fixtureDir, "hooks/indexed.ts"),
  "export const installRow = (rows: readonly number[], position: number) => {\n  beforeEach(() => {\n    seed(rows[position]);\n  });\n};\n",
);
writeFileSync(
  join(fixtureDir, "hooks/shadowed.ts"),
  "const beforeEach = (run: () => void): void => {\n  run();\n};\n\nexport const installOwn = () => {\n  beforeEach(() => {\n    seed();\n  });\n};\n",
);

describe("dont-review-it/forbid-test-hook--move-setup-into-fixture", () => {
  testLintRule(forbidTestHook, {
    valid: [
      {
        name: "a spec that leaves preparation to its fixture names no hook",
        code: "const check = test.extend({ order: async ({}, use) => { await use(build()); } });\ncheck('totals the lines', ({ order }) => {\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "the runner names a spec file takes for its blocks are not hooks",
        code: "import { describe, expect, it } from 'vitest';\ndescribe('order', () => {\n  it('totals the lines', () => {\n    expect(total).toBe(3);\n  });\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a file outside the spec range is left alone",
        code: "beforeEach(() => {\n  seed();\n});",
        filename: "order.ts",
      },
      {
        name: "a name the spec declares itself is not the runner hook it shadows",
        code: "const beforeEach = (run) => {\n  run();\n};\nbeforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a member spelled like a hook on a receiver that is not the runner namespace is left alone",
        code: "const harness = { beforeEach: (run) => run() };\nharness.beforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a hook name the options leave out is not a hook",
        code: "afterEach(() => {\n  drop();\n});",
        filename: SPEC_FILENAME,
        options: [{ hookNames: ["beforeEach"] }],
      },
      {
        name: "a call into a module that names no hook is left alone",
        code: "import { build } from './hooks/plain.ts';\nconst order = build();",
        filename: join(fixtureDir, "caller.test.ts"),
      },
      {
        name: "a module that declares the hook spelling itself reaches no runner hook",
        code: "import { installOwn } from './hooks/shadowed.ts';\ninstallOwn();",
        filename: join(fixtureDir, "caller.test.ts"),
      },
      {
        name: "a module that carries the hook spelling as a member of its own receiver reaches no runner hook",
        code: "import { installHarness } from './hooks/harness.ts';\ninstallHarness();",
        filename: join(fixtureDir, "caller.test.ts"),
      },
      {
        name: "a member spelled like a hook on a receiver that is no name at all is left alone",
        code: "build().beforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a binding declared without an initialiser names no hook",
        code: "let pending;\nit('totals the lines', () => {\n  expect(pending).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
    ],
    invalid: [
      {
        name: "a hook the runner injects is reported where it is named",
        code: "beforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "every hook the runner injects is reported",
        code: "beforeAll(() => {\n  connect();\n});\nbeforeEach(() => {\n  seed();\n});\nafterEach(() => {\n  drop();\n});\nafterAll(() => {\n  close();\n});",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "testHook" },
          { messageId: "testHook" },
          { messageId: "testHook" },
          { messageId: "testHook" },
        ],
      },
      {
        name: "a hook taken from the runner module is reported where it is bound and where it is named",
        code: "import { beforeEach } from 'vitest';\nbeforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }, { messageId: "testHook" }],
      },
      {
        name: "a hook imported under another name is reported under that name",
        code: "import { beforeEach as before } from 'vitest';\nbefore(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }, { messageId: "testHook" }],
      },
      {
        name: "a hook imported and left unused is still named by the spec",
        code: "import { afterAll } from 'vitest';\nconst total = 3;",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a hook bound to another name is reported at the binding and at the call",
        code: "const before = beforeEach;\nbefore(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "aliasedTestHook" },
          { messageId: "testHook" },
          { messageId: "aliasedTestHook" },
        ],
      },
      {
        name: "a hook bound through a chain of names is reported at every name in the chain",
        code: "const before = beforeEach;\nconst prepare = before;\nprepare(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "aliasedTestHook" },
          { messageId: "testHook" },
          { messageId: "aliasedTestHook" },
          { messageId: "aliasedTestHook" },
          { messageId: "aliasedTestHook" },
        ],
      },
      {
        name: "a hook reached through the runner namespace is reported",
        code: "import * as runner from 'vitest';\nrunner.beforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "namespaceTestHook" }],
      },
      {
        name: "a hook reached through the runner namespace under a spelled out key is reported",
        code: "import * as runner from 'vitest';\nrunner['beforeEach'](() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "namespaceTestHook" }],
      },
      {
        name: "a hook reached through a runner namespace bound to another name is reported",
        code: "import * as runner from 'vitest';\nconst hooks = runner;\nhooks.beforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "namespaceTestHook" }],
      },
      {
        name: "a hook reached through a runner namespace bound along a chain of names is reported",
        code: "import * as runner from 'vitest';\nconst hooks = runner;\nconst staged = hooks;\nstaged.beforeEach(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "namespaceTestHook" }],
      },
      {
        name: "a hook standing inside a group is reported like any other",
        code: "describe('order', () => {\n  beforeEach(() => {\n    seed();\n  });\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a hook standing inside a nested group is reported like any other",
        code: "describe('order', () => {\n  describe('paid', () => {\n    beforeEach(() => {\n      seed();\n    });\n  });\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a hook named without being called is reported",
        code: "const staged = [beforeEach];\nfor (const hook of staged) hook(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a hook called behind a condition is reported",
        code: "if (ready) {\n  beforeEach(() => {\n    seed();\n  });\n}",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a hook hidden in a helper declared in this spec is reported inside that helper",
        code: "const install = () => {\n  beforeEach(() => {\n    seed();\n  });\n};\ninstall();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a call into a module that names a hook is reported at the call",
        code: "import { installClock } from './hooks/imported.ts';\ninstallClock();",
        filename: join(fixtureDir, "caller.test.ts"),
        errors: [{ messageId: "testHookThroughCallee" }],
      },
      {
        name: "a call into a module that leans on an injected hook is reported at the call",
        code: "import { installStore } from './hooks/injected.ts';\ninstallStore();",
        filename: join(fixtureDir, "caller.test.ts"),
        errors: [{ messageId: "testHookThroughCallee" }],
      },
      {
        name: "a call into a module that reaches a hook through another module is reported at the call",
        code: "import { installEverything } from './hooks/relay.ts';\ninstallEverything();",
        filename: join(fixtureDir, "caller.test.ts"),
        errors: [{ messageId: "testHookThroughCallee" }],
      },
      {
        name: "a module that reads a row by a key decided at run time is still read for the hook it names",
        code: "import { installRow } from './hooks/indexed.ts';\ninstallRow(rows, 1);",
        filename: join(fixtureDir, "caller.test.ts"),
        errors: [{ messageId: "testHookThroughCallee" }],
      },
      {
        name: "every call into a module that reaches a hook is reported",
        code: "import { installClock } from './hooks/imported.ts';\ninstallClock();\ninstallClock();",
        filename: join(fixtureDir, "caller.test.ts"),
        errors: [{ messageId: "testHookThroughCallee" }, { messageId: "testHookThroughCallee" }],
      },
      {
        name: "a name the options add to the hook set is a hook",
        code: "setUp(() => {\n  seed();\n});",
        filename: SPEC_FILENAME,
        options: [{ hookNames: ["setUp"] }],
        errors: [{ messageId: "testHook" }],
      },
      {
        name: "a repository that spells its specs differently brings its own files into range",
        code: "beforeEach(() => {\n  seed();\n});",
        filename: "order.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "testHook" }],
      },
    ],
  });
});
