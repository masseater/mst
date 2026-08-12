import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noViMockFactoryBehavior } from "./no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts";

const GROUNDED_EXEMPTION =
  "// mock-factory-exemption no-vi-mock-factory-behavior--use-spy-true-and-fixture -- this unit test replaces the child module boundary on purpose";

const GROUNDLESS_EXEMPTION =
  "// mock-factory-exemption no-vi-mock-factory-behavior--use-spy-true-and-fixture";

const OTHER_RULE_EXEMPTION =
  "// mock-factory-exemption no-local-file-system-mock--use-shared-fs -- the shared abstraction is not in place here";

describe("dont-review-it/no-vi-mock-factory-behavior--use-spy-true-and-fixture", () => {
  testLintRule(noViMockFactoryBehavior, {
    valid: [
      {
        name: "a declaration that names only the module passes",
        code: 'vi.mock("./module.ts");',
      },
      {
        name: "handing the wrapping option over passes",
        code: 'vi.mock("./module.ts", { spy: true });',
      },
      {
        name: "a factory that returns an empty object passes",
        code: 'vi.mock("./module.ts", () => ({}));',
      },
      {
        name: "a block body that returns an empty object passes",
        code: 'vi.mock("./module.ts", () => {\n  return {};\n});',
      },
      {
        name: "a shim for a builtin module keeps its container factory",
        code: 'vi.mock("node:crypto", () => ({ randomUUID: vi.fn() }));',
      },
      {
        name: "a prefix named in the options exempts the shape as well",
        code: 'vi.mock("bun:sqlite", () => ({ open: vi.fn() }));',
        options: [{ builtinModulePrefixes: ["bun:"] }],
      },
      {
        name: "options that name no prefix leave the default prefix in place",
        code: 'vi.mock("node:crypto", () => ({ randomUUID: vi.fn() }));',
        options: [{}],
      },
      {
        name: "an empty prefix list leaves the default prefix in place",
        code: 'vi.mock("node:crypto", () => ({ randomUUID: vi.fn() }));',
        options: [{ builtinModulePrefixes: [] }],
      },
      {
        name: "an exemption comment carrying grounds passes the shape",
        code: `${GROUNDED_EXEMPTION}\nvi.mock("./child.ts", () => ({ read: vi.fn() }));`,
      },
      {
        name: "another directive stacked over the exemption changes nothing",
        code: `${GROUNDED_EXEMPTION}\n// oxlint-disable-next-line no-console -- the CLI writes its result here\nvi.mock("./child.ts", () => ({ read: vi.fn() }));`,
      },
      {
        name: "a member chosen at run time is not read as the replacement declaration",
        code: 'vi[chosen]("./module.ts", () => 1);',
      },
      {
        name: "a receiver that is no mock namespace is left alone",
        code: 'helpers.mock("./module.ts", () => 1);',
      },
      {
        name: "a member taken out of the namespace is no longer the namespace",
        code: 'const { mock } = vi;\nmock("./module.ts", () => 1);',
      },
      {
        name: "a binding declared without an initializer is no namespace",
        code: 'let runner;\nrunner.mock("./module.ts", () => 1);',
      },
      {
        name: "bindings that name each other are no namespace",
        code: 'const first = second;\nconst second = first;\nfirst.mock("./module.ts", () => 1);',
      },
      {
        name: "a named import that is no namespace import carries no namespace",
        code: 'import { api } from "vitest";\napi.vi.mock("./module.ts", () => 1);',
      },
      {
        name: "an imported binding under another name is no namespace",
        code: 'import { runner } from "vitest";\nrunner.mock("./module.ts", () => 1);',
      },
      {
        name: "a binding taken apart from another object is no namespace",
        code: 'const { runner } = api;\nrunner.mock("./module.ts", () => 1);',
      },
      {
        name: "a function declared in the spec is no namespace",
        code: 'function runner() {}\nrunner.mock("./module.ts", () => 1);',
      },
      {
        name: "a receiver handed back by a call is no namespace",
        code: 'openRunner().mock("./module.ts", () => 1);',
      },
      {
        name: "a namespace spelled behind a property chain is not resolved",
        code: 'runners.api.vi.mock("./module.ts", () => 1);',
      },
      {
        name: "another member of the namespace carrier is not the namespace",
        code: 'import * as api from "vitest";\napi.runner.mock("./module.ts", () => 1);',
      },
      {
        name: "the non-hoisted replacement call belongs to the rule on placement",
        code: 'vi.doMock("./module.ts", () => 1);',
      },
      {
        name: "a declaration without arguments is left alone",
        code: "vi.mock();",
      },
      {
        name: "a spread argument list hides the declaration from this reading",
        code: "vi.mock(...declared);",
      },
      {
        name: "setting behaviour outside a factory belongs to the rule on placement",
        code: "vi.fn().mockReturnValue(1);",
      },
    ],
    invalid: [
      {
        name: "a factory that returns a container is reported",
        code: 'vi.mock("./module.ts", () => ({ read: vi.fn() }));',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a factory that returns nothing is reported",
        code: 'vi.mock("./module.ts", function () {});',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "settling what a mock hands back is reported beside the shape",
        code: 'vi.mock("./module.ts", () => ({ read: vi.fn().mockReturnValue(1) }));',
        errors: [{ messageId: "factoryShape" }, { messageId: "factoryBehaviour" }],
      },
      {
        name: "two settings in one factory are reported once",
        code: 'vi.mock("./module.ts", () => ({\n  read: vi.fn().mockReturnValue(1),\n  write: vi.fn().withImplementation(() => 1),\n}));',
        errors: [{ messageId: "factoryShape" }, { messageId: "factoryBehaviour" }],
      },
      {
        name: "a builtin shim carrying an implementation is reported for the body alone",
        code: 'vi.mock("node:fs", () => ({ readFileSync: vi.fn(() => "") }));',
        errors: [{ messageId: "factoryBehaviour" }],
      },
      {
        name: "settling behaviour before returning an empty object is reported",
        code: 'vi.mock("./module.ts", () => {\n  const read = vi.fn();\n  read.mockReturnValue(1);\n  return {};\n});',
        errors: [{ messageId: "factoryBehaviour" }],
      },
      {
        name: "an exempted declaration carrying behaviour is reported for the body alone",
        code: `${GROUNDED_EXEMPTION}\nvi.mock("./child.ts", () => ({ read: vi.fn().mockResolvedValue(1) }));`,
        errors: [{ messageId: "factoryBehaviour" }],
      },
      {
        name: "an exemption comment without grounds exempts nothing",
        code: `${GROUNDLESS_EXEMPTION}\nvi.mock("./child.ts", () => ({ read: vi.fn() }));`,
        errors: [{ messageId: "unreasonedExemption" }, { messageId: "factoryShape" }],
      },
      {
        name: "an exemption comment naming another rule exempts nothing",
        code: `${OTHER_RULE_EXEMPTION}\nvi.mock("./child.ts", () => ({ read: vi.fn() }));`,
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "an exemption comment away from the declaration exempts nothing",
        code: `${GROUNDED_EXEMPTION}\n\nvi.mock("./child.ts", () => ({ read: vi.fn() }));`,
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a renamed import of the namespace declares the replacement just the same",
        code: 'import { vi as runner } from "vitest";\nrunner.mock("./module.ts", () => 1);',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a quoted import name spells the namespace just the same",
        code: 'import { "vi" as runner } from "vitest";\nrunner.mock("./module.ts", () => 1);',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a namespace taken into another binding declares the replacement just the same",
        code: 'import { vi } from "vitest";\nconst runner = vi;\nrunner.mock("./module.ts", () => 1);',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a namespace import reaches the namespace just the same",
        code: 'import * as api from "vitest";\napi.vi.mock("./module.ts", () => 1);',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a quoted member names the replacement declaration just the same",
        code: 'vi["mock"]("./module.ts", () => 1);',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a specifier chosen at run time is exempted by no prefix",
        code: "vi.mock(chosen, () => ({ read: vi.fn() }));",
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "calling a binding imported into the spec is reported",
        code: 'import { buildDouble } from "./doubles.ts";\nvi.mock("./module.ts", () => buildDouble());',
        errors: [{ messageId: "factoryShape" }, { messageId: "factoryBehaviour" }],
      },
      {
        name: "returning a binding imported into the spec is reported",
        code: 'import { double } from "./doubles.ts";\nvi.mock("./module.ts", () => double);',
        errors: [{ messageId: "factoryBehaviour" }, { messageId: "factoryShape" }],
      },
      {
        name: "calling a binding declared in the spec is reported for the shape alone",
        code: 'const build = () => ({ read: 1 });\nvi.mock("./module.ts", () => build());',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a member chosen at run time is reported for the shape alone",
        code: 'vi.mock("./module.ts", () => ({ read: helpers[chosen]() }));',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a callee that is declared nowhere is reported for the shape alone",
        code: 'vi.mock("./module.ts", () => ({ read: helper() }));',
        errors: [{ messageId: "factoryShape" }],
      },
      {
        name: "a creation call on another receiver is reported for the shape alone",
        code: 'vi.mock("./module.ts", () => ({ read: helpers.fn(() => 1) }));',
        errors: [{ messageId: "factoryShape" }],
      },
    ],
  });
});
