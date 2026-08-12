import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noCittyParentRun } from "./no-citty-parent-run--move-run-into-a-subcommand.ts";

describe("dont-review-it/no-citty-parent-run--move-run-into-a-subcommand", () => {
  testLintRule(noCittyParentRun, {
    valid: [
      {
        name: "a leaf command owns its run handler",
        code: `import { defineCommand } from "citty";
const check = defineCommand({ meta: { name: "check" }, run() {} });`,
      },
      {
        name: "a parent that only dispatches leaves the bare invocation to the framework",
        code: `import { defineCommand } from "citty";
const main = defineCommand({ meta: { name: "cli" }, subCommands: { check } });`,
      },
      {
        name: "a parent names its bare-invocation behavior through default",
        code: `import { defineCommand } from "citty";
const main = defineCommand({ meta: { name: "cli" }, subCommands: { check }, default: "check" });`,
      },
      {
        name: "an object with both keys handed to another library is not a citty command",
        code: `import { defineCommand } from "commander-kit";
const main = defineCommand({ subCommands: { check }, run() {} });`,
      },
      {
        name: "a local function that happens to share the factory name is not a citty command",
        code: `const defineCommand = (definition: object): object => definition;
const main = defineCommand({ subCommands: { check }, run() {} });`,
      },
      {
        name: "a definition handed over as a variable is out of static reach",
        code: `import { defineCommand } from "citty";
const main = defineCommand(definition);`,
      },
      {
        name: "a factory call without a definition declares nothing",
        code: `import { defineCommand } from "citty";
const main = defineCommand();`,
      },
      {
        name: "a computed key is not a static run declaration",
        code: `import { defineCommand } from "citty";
const key = "run";
const main = defineCommand({ subCommands: { check }, [key]() {} });`,
      },
    ],
    invalid: [
      {
        name: "a parent that declares both subCommands and run is reported",
        code: `import { defineCommand } from "citty";
const main = defineCommand({ subCommands: { check }, run() {} });`,
        errors: [{ messageId: "parentRun" }],
      },
      {
        name: "the order of the two properties changes nothing",
        code: `import { defineCommand } from "citty";
const main = defineCommand({ run: () => {}, subCommands: { check } });`,
        errors: [{ messageId: "parentRun" }],
      },
      {
        name: "a renamed factory import is still the citty factory",
        code: `import { defineCommand as makeCommand } from "citty";
const main = makeCommand({ subCommands: { check }, run() {} });`,
        errors: [{ messageId: "parentRun" }],
      },
      {
        name: "a namespace import reaches the same factory",
        code: `import * as citty from "citty";
const main = citty.defineCommand({ subCommands: { check }, run() {} });`,
        errors: [{ messageId: "parentRun" }],
      },
      {
        name: "declaring default does not excuse the parent run",
        code: `import { defineCommand } from "citty";
const main = defineCommand({ subCommands: { check }, default: "check", run() {} });`,
        errors: [{ messageId: "parentRun" }],
      },
      {
        name: "a run key spelled as a string literal is the same declaration",
        code: `import { defineCommand } from "citty";
const main = defineCommand({ subCommands: { check }, "run": () => {} });`,
        errors: [{ messageId: "parentRun" }],
      },
    ],
  });
});
