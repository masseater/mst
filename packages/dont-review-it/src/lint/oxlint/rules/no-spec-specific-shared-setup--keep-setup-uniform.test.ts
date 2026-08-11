import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSpecSpecificSharedSetup } from "./no-spec-specific-shared-setup--keep-setup-uniform.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-no-spec-specific-shared-setup");
rmSync(fixtureDir, { recursive: true, force: true });

const writeFixture = (name: string, source: string): string => {
  const path = join(fixtureDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

writeFixture("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
writeFixture("package.json", '{ "name": "@fixture/root" }\n');
writeFixture(
  "vite.config.ts",
  'export default defineConfig({ test: { setupFiles: ["./setup/shared.setup.ts"] } });\n',
);
writeFixture("setup/shared.setup.ts", 'import "./reached.ts";\n');
writeFixture("setup/reached.ts", "export const seeded = 1;\n");
writeFixture("setup/declared.ts", "export const seeded = 2;\n");
writeFixture("src/order.test.ts", "export const asserted = 1;\n");
writeFixture("src/legacy/old.test.ts", "export const asserted = 2;\n");

const SETUP_FILE = join(fixtureDir, "setup/shared.setup.ts");

const REACHED_FILE = join(fixtureDir, "setup/reached.ts");

const DECLARED_FILE = join(fixtureDir, "setup/declared.ts");

const PLAIN_FILE = writeFixture("plain.ts", "export const total = 1;\n");

const RUNNER_CONFIG_FILE = join(fixtureDir, "vite.config.ts");

const configHolding = (block: string): string => `export default defineConfig({ test: ${block} });`;

describe("dont-review-it/no-spec-specific-shared-setup--keep-setup-uniform", () => {
  testLintRule(noSpecSpecificSharedSetup, {
    valid: [
      {
        name: "a module the runner never loads as setup is left to the rules that read it",
        filename: PLAIN_FILE,
        code: `if (task.name === "src/order.test.ts") { seedLegacy(); }`,
      },
      {
        name: "a shared setup handing every spec the same starting state passes",
        filename: SETUP_FILE,
        code: `beforeEach(() => { resetVolume({ "/tmp/held.json": "{}" }); });`,
      },
      {
        name: "a shared setup branching on the run environment keeps every spec uniform",
        filename: SETUP_FILE,
        code: `if (process.env["CI"] === "true") { widenTimeout(); }`,
      },
      {
        name: "a type naming the runner task shape changes no behaviour",
        filename: SETUP_FILE,
        code: `export type RunningTask = { readonly task: string; readonly filepath: string };`,
      },
      {
        name: "a type argument naming a spec directory hands nothing to the binding it widens",
        filename: SETUP_FILE,
        code: `const held = source as Record<"src/legacy", number>;\nif (held === chosen) { seedLegacy(); }`,
      },
      {
        name: "a type argument naming the running task hands nothing to the binding it widens",
        filename: SETUP_FILE,
        code: `const held = source satisfies { at: typeof task };\nif (held === chosen) { seedLegacy(); }`,
      },
      {
        name: "a binding the setup declares under a name of the runner vocabulary passes",
        filename: SETUP_FILE,
        code: `const task = 1;\nexport const held = task + 1;`,
      },
      {
        name: "a destructured binding taking the running task holds no branch",
        filename: SETUP_FILE,
        code: `const { held } = { held: task };\nexport const carried = held;`,
      },
      {
        name: "a write of the running task into a property steers nothing on its own",
        filename: SETUP_FILE,
        code: `held.value = task;`,
      },
      {
        name: "a call on the running task steers nothing through its arguments",
        filename: SETUP_FILE,
        code: `task.run();`,
      },
      {
        name: "a branch reading the running task outside its condition is not a branch on it",
        filename: SETUP_FILE,
        code: `if (ready) { held.value = task; }`,
      },
      {
        name: "an arm of a conditional is not the condition it is chosen by",
        filename: SETUP_FILE,
        code: `const held = ready ? task : fallback;`,
      },
      {
        name: "a member the setup reaches through a computed key names nothing",
        filename: SETUP_FILE,
        options: [{}],
        code: `const held = source[key];`,
      },
      {
        name: "a property key spelling a runner name declares no read of the running spec",
        filename: SETUP_FILE,
        code: `const held = { task: 1, [task]: 2, at: source[task] };`,
      },
      {
        name: "a read of the running task outside a branch and outside a call passes",
        filename: SETUP_FILE,
        code: `const held = { at: ctx.task.suite };`,
      },
      {
        name: "a branch on a single word naming no authored spec passes",
        filename: SETUP_FILE,
        code: `if (mode === "legacy") { widenTimeout(); }`,
      },
      {
        name: "a branch on a path no authored spec sits under passes",
        filename: SETUP_FILE,
        code: `if (dir === "src/other.ts" || dir === "") { widenTimeout(); }`,
      },
      {
        name: "a branch on a pattern covering every spec keeps the setup uniform",
        filename: SETUP_FILE,
        code: `if (files.includes("**/*.test.ts") && /.*\\.test\\.ts/u.test(dir)) { widenTimeout(); }`,
      },
      {
        name: "a branch on a value that is no spelling at all passes",
        filename: SETUP_FILE,
        code: `if (count === 1) { widenTimeout(); }`,
      },
      {
        name: "a branch on a spelling the setup assembles at run time passes",
        filename: SETUP_FILE,
        code: "if (path === `${dir}/order.test.ts`) { seedLegacy(); }",
      },
      {
        name: "a runner configuration handing every spec the same setting passes",
        filename: RUNNER_CONFIG_FILE,
        code: configHolding(`{ include: ["**/*.test.ts"], retry: 2 }`),
      },
      {
        name: "a configuration exporting no runner block holds nothing to read",
        filename: RUNNER_CONFIG_FILE,
        code: `export default { lint: { ignorePatterns: ["src/order.test.ts"] } };`,
      },
      {
        name: "a configuration exporting nothing at all holds nothing to read",
        filename: RUNNER_CONFIG_FILE,
        code: `export const held = { test: { include: ["src/order.test.ts"] } };`,
      },
      {
        name: "a spec path written outside the runner block belongs to another rule",
        filename: RUNNER_CONFIG_FILE,
        code: `export default { test: { retry: 2 }, lint: { ignorePatterns: ["src/order.test.ts"] } };`,
      },
    ],
    invalid: [
      {
        name: "a branch on the path of the running spec is reported where it is read",
        filename: SETUP_FILE,
        code: `if (expect.getState().testPath === chosen) { seedLegacy(); }`,
        errors: [{ messageId: "specIdentifyingBranch", data: { spelled: "testPath" } }],
      },
      {
        name: "a spelled key reaching the running spec path is read as that member",
        filename: SETUP_FILE,
        code: `if (state["testPath"] === chosen) { seedLegacy(); }`,
        errors: [{ messageId: "specIdentifyingBranch" }],
      },
      {
        name: "a member reached through plain properties is reported at the runner name",
        filename: SETUP_FILE,
        code: `if (held.inner.task === chosen) { seedLegacy(); }`,
        errors: [{ messageId: "specIdentifyingBranch", data: { spelled: "task" } }],
      },
      {
        name: "the name of the running test handed to a function is reported",
        filename: SETUP_FILE,
        code: `seedFor(expect.getState().currentTestName);`,
        errors: [{ messageId: "specIdentifyingArgument", data: { spelled: "currentTestName" } }],
      },
      {
        name: "the running task handed to a constructor is reported",
        filename: SETUP_FILE,
        code: `const seeder = new Seeder(task);`,
        errors: [{ messageId: "specIdentifyingArgument", data: { spelled: "task" } }],
      },
      {
        name: "a widened type around the running task leaves the argument standing",
        filename: SETUP_FILE,
        code: `seedFor(task as string);`,
        errors: [{ messageId: "specIdentifyingArgument" }],
      },
      {
        name: "a short-circuit on the running task is a branch on it",
        filename: SETUP_FILE,
        code: `const held = task || fallback;`,
        errors: [{ messageId: "specIdentifyingBranch" }],
      },
      {
        name: "a conditional choosing by the tags of the running test is reported once",
        filename: SETUP_FILE,
        code: `const held = task.tags ? 1 : 2;`,
        errors: [{ messageId: "specIdentifyingBranch", data: { spelled: "task" } }],
      },
      {
        name: "a switch over the running task is a branch on it",
        filename: SETUP_FILE,
        code: `switch (ctx.task) { case "held": break; }`,
        errors: [{ messageId: "specIdentifyingBranch", data: { spelled: "task" } }],
      },
      {
        name: "a case testing the name of the running suite is a branch on it",
        filename: SETUP_FILE,
        code: `switch (mode) { case ctx.suite: break; }`,
        errors: [{ messageId: "specIdentifyingBranch", data: { spelled: "suite" } }],
      },
      {
        name: "a binding carrying the running test name is reported where it steers",
        filename: SETUP_FILE,
        code: `const running = expect.getState().currentTestName;\nif (running === chosen) { seedLegacy(); }`,
        errors: [{ messageId: "specIdentifyingBranch", data: { spelled: "running" } }],
      },
      {
        name: "a branch on the path of an authored spec is reported",
        filename: SETUP_FILE,
        code: `if (path === "src/order.test.ts") { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch", data: { spelled: "src/order.test.ts" } }],
      },
      {
        name: "a branch on the bare name of an authored spec is reported",
        filename: SETUP_FILE,
        code: `if (path === "order.test.ts") { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch", data: { spelled: "order.test.ts" } }],
      },
      {
        name: "a branch on a directory holding authored specs is reported",
        filename: SETUP_FILE,
        code: `if (dir === "./src/legacy/") { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch", data: { spelled: "./src/legacy/" } }],
      },
      {
        name: "a spec path assembled with no substitution is read as that path",
        filename: SETUP_FILE,
        code: "if (path === `src/order.test.ts`) { seedLegacy(); }",
        errors: [{ messageId: "specNamingBranch" }],
      },
      {
        name: "a pattern spelling out an authored spec is reported",
        filename: SETUP_FILE,
        code: `if (/src\\/order\\.test\\.ts$/u.test(path)) { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch" }],
      },
      {
        name: "a spec path handed to a function is reported at the argument",
        filename: SETUP_FILE,
        code: `if (path.startsWith("src/legacy")) { seedLegacy(); }`,
        errors: [{ messageId: "specNamingArgument", data: { spelled: "src/legacy" } }],
      },
      {
        name: "a list of authored specs is reported where the setup consults it",
        filename: SETUP_FILE,
        code: `const SPECS = ["src/order.test.ts"];\nif (SPECS.includes(path)) { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch", data: { spelled: "SPECS" } }],
      },
      {
        name: "a module the setup reaches carries the same prohibition",
        filename: REACHED_FILE,
        code: `if (path === "src/order.test.ts") { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch" }],
      },
      {
        name: "a module named as setup by an option carries the same prohibition",
        filename: DECLARED_FILE,
        options: [{ sharedSetupFiles: ["setup/declared.ts"] }],
        code: `if (path === "src/order.test.ts") { seedLegacy(); }`,
        errors: [{ messageId: "specNamingBranch" }],
      },
      {
        name: "a runner configuration naming one spec file is reported at that entry",
        filename: RUNNER_CONFIG_FILE,
        code: configHolding(
          `{ setupFiles: ["./setup/shared.setup.ts"], environmentMatchGlobs: [["src/order.test.ts", "jsdom"]] }`,
        ),
        errors: [
          { messageId: "specSpecificRunnerSetting", data: { spelled: "src/order.test.ts" } },
        ],
      },
      {
        name: "a runner configuration keying a setting by a spec directory is reported",
        filename: RUNNER_CONFIG_FILE,
        code: `export default { test: { env: { "src/legacy": "held" } } };`,
        errors: [{ messageId: "specSpecificRunnerSetting", data: { spelled: "src/legacy" } }],
      },
    ],
  });
});
