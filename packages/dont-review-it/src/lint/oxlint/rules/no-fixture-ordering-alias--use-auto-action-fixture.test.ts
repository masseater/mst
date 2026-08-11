import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noFixtureOrderingAlias } from "./no-fixture-ordering-alias--use-auto-action-fixture.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/no-fixture-ordering-alias--use-auto-action-fixture", () => {
  testLintRule(noFixtureOrderingAlias, {
    valid: [
      {
        name: "a dependency taken apart under its own name and read in the body is the flow it declares",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => summarise(port));`,
      },
      {
        name: "a renamed dependency read in the body is a dependency the fixture uses",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port: chosen }) => summarise(chosen));`,
      },
      {
        name: "a dependency read through one of its properties is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ store }) => summarise(store.id));`,
      },
      {
        name: "a dependency handed back inside the returned value is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => ({ port }));`,
      },
      {
        name: "a dependency read under an operator other than void is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => summarise(!port));`,
      },
      {
        name: "a dependency read inside a callback the fixture registers is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ store }, { onCleanup }) => {\n  onCleanup(() => store.close());\n  return summarise();\n});`,
      },
      {
        name: "a dependency handed on to a binding the body reads is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  const chosen = port;\n  return summarise(chosen);\n});`,
      },
      {
        name: "a dependency taken apart by the binding it is handed to is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ store }) => {\n  const { id } = store;\n  return summarise(id);\n});`,
      },
      {
        name: "a dependency written into a property of another value is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  settings.port = port;\n  return summarise();\n});`,
      },
      {
        name: "a dependency the body reads and writes back is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  port += 1;\n  return summarise();\n});`,
      },
      {
        name: "a dependency handed to a binding that was never declared here is consumed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  chosenPort = port;\n  return summarise();\n});`,
      },
      {
        name: "the older form declaring a dependency it hands to the runner consumes it",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  report: async ({ port }, use) => {\n    await use(summarise(port));\n  },\n});`,
      },
      {
        name: "a builder carrying options between the name and the factory reads the same way",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", { auto: true }, ({ port }) => summarise(port));`,
      },
      {
        name: "a key chosen at run time names no dependency this reading can follow",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ [chosen]: _picked }) => summarise());`,
      },
      {
        name: "a numeric key names no dependency this reading can follow",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ 0: _first }) => summarise());`,
      },
      {
        name: "a dependency taken apart into a nested pattern binds no single name",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ store: { id } }) => summarise());`,
      },
      {
        name: "a dependency given a fallback in the pattern binds no bare name",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ store: warehouse = openStore() }) => summarise());`,
      },
      {
        name: "the rest of the context names no dependency this reading can follow",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port, ...others }) => summarise(port));`,
      },
      {
        name: "a callback that is not a fixture factory declares no dependency",
        filename: SPEC_FILE,
        code: `register(({ port: _port }) => summarise());`,
      },
      {
        name: "registering a custom matcher shares the member name but declares no fixture",
        filename: SPEC_FILE,
        code: `expect.extend({ toBeReport: ({ port: _port }) => ({ pass: true }) });`,
      },
      {
        name: "a factory taking the context whole takes no dependency apart",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", (context) => summarise(context));`,
      },
      {
        name: "a factory taking no parameter takes no dependency apart",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => summarise());`,
      },
      {
        name: "a builder handed a value instead of a factory offers no body to read",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("port", 3000);`,
      },
      {
        name: "a file that is not a spec is left alone",
        filename: "report.ts",
        code: `const test = baseTest.extend("report", ({ port: _port }) => summarise());`,
      },
      {
        name: "the prefix list left empty drops the naming signal",
        filename: SPEC_FILE,
        options: [{ orderingAliasPrefixes: [] }],
        code: `const test = baseTest.extend("report", ({ port: _port }) => summarise(_port));`,
      },
      {
        name: "a spelling the configuration does not name carries no signal",
        filename: SPEC_FILE,
        options: [{ orderingAliasPrefixes: ["unused"] }],
        code: `const test = baseTest.extend("report", ({ port: _port }) => summarise(_port));`,
      },
      {
        name: "a spec spelled the way the configuration names is read the same way",
        filename: "report.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: `const test = baseTest.extend("report", ({ port }) => summarise(port));`,
      },
    ],
    invalid: [
      {
        name: "a name marked as unused confesses a dependency declared for order alone",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port: _port }) => summarise(_port));`,
        errors: [{ messageId: "orderingAlias" }],
      },
      {
        name: "a name marked as unused and never read is named for the signal it carries",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port: _port }) => summarise());`,
        errors: [{ messageId: "orderingAlias" }],
      },
      {
        name: "a dependency taken apart under its own name and never read declares an order",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => summarise());`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "an alias carrying no signal leaves the unread dependency standing",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port: chosen }) => summarise());`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "naming the binding on a line of its own drops the value",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  port;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "handing the binding to void drops the value",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  void port;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "awaiting the binding on a line of its own drops the value as well",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", async ({ port }) => {\n  await port;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "a binding the body drops the same way does not consume what it was handed",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  const chosen = port;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "assigning the value to a binding nothing reads drops it as well",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  let held;\n  held = port;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "a chain of bindings that all drop the value drops it",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  const chosen = port;\n  const held = chosen;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "bindings that hand the value back and forth between themselves consume nothing",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  let held = port;\n  let other = held;\n  held = other;\n  return summarise();\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "the older form declaring a dependency it never reads declares an order",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  report: async ({ port }, use) => {\n    await use(summarise());\n  },\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "the older form marking a dependency as unused carries the same signal",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  report: async ({ port: _port }, use) => {\n    await use(summarise(_port));\n  },\n});`,
        errors: [{ messageId: "orderingAlias" }],
      },
      {
        name: "a builder carrying options declares the same dependency",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", { auto: true }, ({ port }) => summarise());`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "each dependency declared for order alone is named on its own",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port, store: _store }) => summarise());`,
        errors: [{ messageId: "unconsumedDependency" }, { messageId: "orderingAlias" }],
      },
      {
        name: "a fixture built on top of another is read once, at the builder that declares it",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("port", () => 3000).extend("report", ({ port: _port }) => summarise());`,
        errors: [{ messageId: "orderingAlias" }],
      },
      {
        name: "the prefix list left empty leaves the unread dependency reported",
        filename: SPEC_FILE,
        options: [{ orderingAliasPrefixes: [] }],
        code: `const test = baseTest.extend("report", ({ port: _port }) => summarise());`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "a spelling the configuration names is a naming signal",
        filename: SPEC_FILE,
        options: [{ orderingAliasPrefixes: ["unused"] }],
        code: `const test = baseTest.extend("report", ({ port: unusedPort }) => summarise(unusedPort));`,
        errors: [{ messageId: "orderingAlias" }],
      },
      {
        name: "the older form naming no handoff still declares a dependency to consume",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  report: async ({ port }) => summarise(),\n});`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
      {
        name: "a spec spelled the way the configuration names is examined",
        filename: "report.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: `const test = baseTest.extend("report", ({ port }) => summarise());`,
        errors: [{ messageId: "unconsumedDependency" }],
      },
    ],
  });
});
