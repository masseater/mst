import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDryTestSetup } from "./no-dry-test-setup--inline-owned-setup.ts";

const workspaceDir = join(realpathSync(tmpdir()), "dont-review-it-no-dry-test-setup");

rmSync(workspaceDir, { recursive: true, force: true });

const widgetDir = join(workspaceDir, "packages/widget");
const entrylessDir = join(workspaceDir, "packages/entryless");
const sharedFixturesDir = join(workspaceDir, "packages/shared-fixtures");
const toolkitDir = join(workspaceDir, "packages/toolkit");
const appDir = join(workspaceDir, "packages/app");

mkdirSync(join(widgetDir, "src"), { recursive: true });
mkdirSync(join(entrylessDir, "src"), { recursive: true });
mkdirSync(join(sharedFixturesDir, "src"), { recursive: true });
mkdirSync(join(toolkitDir, "src"), { recursive: true });
mkdirSync(join(appDir, "src"), { recursive: true });
mkdirSync(join(workspaceDir, "node_modules/@fixture"), { recursive: true });

writeFileSync(join(workspaceDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

writeFileSync(
  join(widgetDir, "package.json"),
  JSON.stringify({ name: "@fixture/widget", exports: { ".": "./src/index.ts" } }),
);
writeFileSync(
  join(widgetDir, "src/index.ts"),
  'export * from "./widget.ts";\nexport * from "./widget-helper.ts";\n',
);
writeFileSync(join(widgetDir, "src/widget.ts"), "export const widget = 1;\n");
writeFileSync(join(widgetDir, "src/widget-helper.ts"), "export const shaped = 2;\n");
writeFileSync(join(widgetDir, "src/helpers.ts"), "export const build = () => 3;\n");
writeFileSync(join(widgetDir, "src/prepared.ts"), "export const prepared = () => 4;\n");
writeFileSync(join(widgetDir, "src/relay.ts"), 'export * from "./prepared.ts";\n');
writeFileSync(join(widgetDir, "src/shapes.ts"), "export type Shape = { readonly size: number };\n");
writeFileSync(join(widgetDir, "src/widget.assets.ts"), "export const rows = [1, 2];\n");
writeFileSync(join(widgetDir, "src/widget.rows.ts"), "export const counted = [3, 4];\n");
writeFileSync(join(widgetDir, "src/other.test.ts"), "export const other = 5;\n");
writeFileSync(join(widgetDir, "src/declared.ts"), "declare const configured: number;\n");
writeFileSync(
  join(widgetDir, "src/typed-view.ts"),
  'import type { Shape } from "./shapes.ts";\n\nexport type Sized = Shape;\n',
);

writeFileSync(join(entrylessDir, "package.json"), JSON.stringify({ name: "@fixture/entryless" }));
writeFileSync(join(entrylessDir, "src/helpers.ts"), "export const build = () => 6;\n");
writeFileSync(join(entrylessDir, "src/neutral.ts"), "export const neutral = () => 7;\n");
writeFileSync(join(entrylessDir, "src/relay.ts"), 'export * from "./helpers.ts";\n');
writeFileSync(join(entrylessDir, "src/ring-one.ts"), 'export * from "./ring-two.ts";\n');
writeFileSync(join(entrylessDir, "src/ring-two.ts"), 'export * from "./ring-one.ts";\n');
writeFileSync(join(entrylessDir, "src/chain-one.ts"), 'export * from "./chain-two.ts";\n');
writeFileSync(join(entrylessDir, "src/chain-two.ts"), 'export * from "./chain-three.ts";\n');
writeFileSync(join(entrylessDir, "src/chain-three.ts"), 'export * from "./chain-four.ts";\n');
writeFileSync(join(entrylessDir, "src/chain-four.ts"), 'export * from "./chain-five.ts";\n');
writeFileSync(join(entrylessDir, "src/chain-five.ts"), 'export * from "./helpers.ts";\n');

writeFileSync(
  join(sharedFixturesDir, "package.json"),
  JSON.stringify({ name: "@fixture/shared-fixtures", exports: { ".": "./src/index.ts" } }),
);
writeFileSync(join(sharedFixturesDir, "src/index.ts"), "export const shared = 8;\n");

writeFileSync(
  join(toolkitDir, "package.json"),
  JSON.stringify({ name: "@fixture/toolkit", exports: { ".": "./src/index.ts" } }),
);
writeFileSync(join(toolkitDir, "src/index.ts"), "export const tool = 9;\n");

writeFileSync(
  join(appDir, "package.json"),
  JSON.stringify({ name: "@fixture/app", main: "./src/main.ts" }),
);
writeFileSync(
  join(appDir, "src/main.ts"),
  'import { tool } from "@fixture/toolkit";\n\nexport const started = tool;\n',
);

const fixtureModules = join(workspaceDir, "node_modules/@fixture");
symlinkSync(sharedFixturesDir, join(fixtureModules, "shared-fixtures"), "dir");
symlinkSync(toolkitDir, join(fixtureModules, "toolkit"), "dir");

const widgetSpec = join(widgetDir, "src/widget.test.ts");

const entrylessSpec = join(entrylessDir, "src/thing.test.ts");

const COUPLED_TO_WIDGET_HELPERS = [
  { messageId: "setupModuleCoupling", data: { path: "packages/widget/src/helpers.ts" } },
];

describe("dont-review-it/no-dry-test-setup--inline-owned-setup", () => {
  testLintRule(noDryTestSetup, {
    valid: [
      {
        name: "a file that is not a spec is never inspected",
        code: 'import { build } from "./helpers.ts";\n\nexport const used = build;\n',
        filename: join(widgetDir, "src/plain.ts"),
      },
      {
        name: "the module a spec tests is reachable from the public entry, so it is the subject",
        code: 'import { widget } from "./widget.ts";\n\nexport const under = widget;\n',
        filename: widgetSpec,
      },
      {
        name: "a subject the public entry reaches keeps its name even when the name is forbidden",
        code: 'import { shaped } from "./widget-helper.ts";\n\nexport const under = shaped;\n',
        filename: widgetSpec,
      },
      {
        name: "a type-only import carries no setup",
        code: 'import type { Shape } from "./shapes.ts";\n\nexport const size = (shape: Shape) => shape.size;\n',
        filename: widgetSpec,
      },
      {
        name: "a module declaring only types carries no setup even when imported for its values",
        code: 'import { Shape } from "./shapes.ts";\n\nexport const named = Shape;\n',
        filename: widgetSpec,
      },
      {
        name: "an assets file is left to the rules that own assets",
        code: 'import { rows } from "./widget.assets.ts";\n\nexport const data = rows;\n',
        filename: widgetSpec,
      },
      {
        name: "a module holding one declare statement carries no value to set anything up",
        code: 'import { configured } from "./declared.ts";\n\nexport const used = configured;\n',
        filename: widgetSpec,
      },
      {
        name: "a module built only from type imports and type exports carries no setup",
        code: 'import { Sized } from "./typed-view.ts";\n\nexport const named = Sized;\n',
        filename: widgetSpec,
      },
      {
        name: "a package installed from outside the workspace is not a setup module",
        code: 'import { describe } from "vitest";\n\nexport const suite = describe;\n',
        filename: widgetSpec,
      },
      {
        name: "a workspace package that running code also reaches is production",
        code: 'import { tool } from "@fixture/toolkit";\n\nexport const used = tool;\n',
        filename: widgetSpec,
      },
      {
        name: "the one fixture package the deployment allows is not a setup module",
        code: 'import { shared } from "@fixture/shared-fixtures";\n\nexport const used = shared;\n',
        filename: widgetSpec,
        options: [{ allowedFixturePackages: ["@fixture/shared-fixtures"] }],
      },
      {
        name: "a subpath of the allowed fixture package is allowed with it",
        code: 'import { extra } from "@fixture/shared-fixtures/extra";\n\nexport const used = extra;\n',
        filename: widgetSpec,
        options: [{ allowedFixturePackages: ["@fixture/shared-fixtures"] }],
      },
      {
        name: "an allowed fixture package that is not installed here is taken at its word",
        code: "export const total = 1;\n",
        filename: widgetSpec,
        options: [{ allowedFixturePackages: ["@vendor/spec-fixtures"] }],
      },
      {
        name: "a file inside another package that its own public entry reaches is production",
        code: 'import { shared } from "@fixture/shared-fixtures/src/index.ts";\n\nexport const used = shared;\n',
        filename: widgetSpec,
      },
      {
        name: "a module another package's main field reaches is production",
        code: 'import { started } from "../../app/src/main.ts";\n\nexport const used = started;\n',
        filename: widgetSpec,
      },
      {
        name: "a chain of relays longer than the walk allows ends before the setup module",
        code: 'import { build } from "./chain-one.ts";\n\nexport const used = build;\n',
        filename: entrylessSpec,
      },
      {
        name: "relays that forward to each other end the walk instead of repeating it",
        code: 'import { round } from "./ring-one.ts";\n\nexport const used = round;\n',
        filename: entrylessSpec,
      },
      {
        name: "a require call carrying no argument couples to nothing",
        code: "export const nothing = require();\n",
        filename: widgetSpec,
      },
      {
        name: "a require reached through an object is not the require of this module",
        code: 'export const nothing = shelf.require("./helpers.ts");\n',
        filename: widgetSpec,
      },
      {
        name: "a constant that binds no name of its own is not a specifier",
        code: "const { picked } = globalThis;\n\nexport const used = picked;\n",
        filename: widgetSpec,
      },
      {
        name: "a template holding a value known only at run time cannot be followed",
        code: "export const load = async (stem: string) => import(`./${stem}.ts`);\n",
        filename: widgetSpec,
      },
      {
        name: "a specifier that resolves to nothing leaves no module to judge",
        code: 'import { missing } from "./not-written.ts";\n\nexport const used = missing;\n',
        filename: widgetSpec,
      },
      {
        name: "a subpath import specifier is not resolved to a module",
        code: 'import { aliased } from "#internal";\n\nexport const used = aliased;\n',
        filename: widgetSpec,
      },
      {
        name: "a dynamic import whose specifier is only known at run time cannot be followed",
        code: "export const load = async (chosen: string) => import(chosen);\n",
        filename: widgetSpec,
      },
      {
        name: "a call that is not require leaves the argument alone",
        code: 'export const named = String("./helpers.ts");\n',
        filename: widgetSpec,
      },
      {
        name: "a neutral module in a package that declares no public entry is left undecided",
        code: 'import { neutral } from "./neutral.ts";\n\nexport const used = neutral;\n',
        filename: entrylessSpec,
      },
      {
        name: "an empty pattern list silences the judgment that reads names",
        code: 'import { build } from "./helpers.ts";\n\nexport const used = build;\n',
        filename: entrylessSpec,
        options: [{ setupModuleNamePatterns: [] }],
      },
      {
        name: "a spec suffix the deployment configures decides which files are inspected",
        code: 'import { build } from "./helpers.ts";\n\nexport const used = build;\n',
        filename: widgetSpec,
        options: [{ specFileSuffixes: [".spec.ts"] }],
      },
      {
        name: "an assets marker the deployment configures moves the delegation with it",
        code: 'import { counted } from "./widget.rows.ts";\n\nexport const data = counted;\n',
        filename: widgetSpec,
        options: [{ assetsNameMarkers: ["rows"] }],
      },
    ],
    invalid: [
      {
        name: "a static import of a module named as shared setup is reported",
        code: 'import { build } from "./helpers.ts";\n\nexport const used = build;\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "an import that binds nothing still couples to the module",
        code: 'import "./helpers.ts";\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a named re-export couples to the module it forwards",
        code: 'export { build } from "./helpers.ts";\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a whole re-export couples to the module it forwards",
        code: 'export * from "./helpers.ts";\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a dynamic import written with a literal is the same coupling as a static one",
        code: 'export const load = async () => import("./helpers.ts");\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a dynamic import through a constant of this file resolves to the same module",
        code: 'const SETUP = "./helpers.ts";\n\nexport const load = async () => import(SETUP);\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a template assembled only from static parts resolves to the same module",
        code: 'const STEM = "helpers";\n\nexport const load = async () => import(`./${STEM}.ts`);\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a require call is the same coupling as an import",
        code: 'export const setup = require("./helpers.ts");\n',
        filename: widgetSpec,
        errors: COUPLED_TO_WIDGET_HELPERS,
      },
      {
        name: "a file the assets vocabulary does not name is judged like every other module",
        code: 'import { counted } from "./widget.rows.ts";\n\nexport const data = counted;\n',
        filename: widgetSpec,
        errors: [
          {
            messageId: "setupModuleCoupling",
            data: { path: "packages/widget/src/widget.rows.ts" },
          },
        ],
      },
      {
        name: "a module the public entry cannot reach is setup whatever it is named",
        code: 'import { prepared } from "./prepared.ts";\n\nexport const used = prepared;\n',
        filename: widgetSpec,
        errors: [
          { messageId: "setupModuleCoupling", data: { path: "packages/widget/src/prepared.ts" } },
        ],
      },
      {
        name: "a relay in the same package is itself out of reach of the public entry",
        code: 'import { prepared } from "./relay.ts";\n\nexport const used = prepared;\n',
        filename: widgetSpec,
        errors: [
          { messageId: "setupModuleCoupling", data: { path: "packages/widget/src/relay.ts" } },
        ],
      },
      {
        name: "another spec read as setup is a setup module",
        code: 'import { other } from "./other.test.ts";\n\nexport const used = other;\n',
        filename: widgetSpec,
        errors: [
          { messageId: "setupModuleCoupling", data: { path: "packages/widget/src/other.test.ts" } },
        ],
      },
      {
        name: "a module named as shared setup is reported where no public entry is declared",
        code: 'import { build } from "./helpers.ts";\n\nexport const used = build;\n',
        filename: entrylessSpec,
        errors: [
          { messageId: "setupModuleCoupling", data: { path: "packages/entryless/src/helpers.ts" } },
        ],
      },
      {
        name: "a relay is followed to the setup module behind it",
        code: 'import { build } from "./relay.ts";\n\nexport const used = build;\n',
        filename: entrylessSpec,
        errors: [
          {
            messageId: "relayedSetupModuleCoupling",
            data: {
              path: "packages/entryless/src/helpers.ts",
              relays: "packages/entryless/src/relay.ts",
            },
          },
        ],
      },
      {
        name: "a package nothing but specs reaches is a setup module",
        code: 'import { shared } from "@fixture/shared-fixtures";\n\nexport const used = shared;\n',
        filename: widgetSpec,
        errors: [{ messageId: "setupModuleCoupling", data: { path: "packages/shared-fixtures" } }],
      },
      {
        name: "an allowed fixture package written as a path in this repository is reported",
        code: "export const total = 1;\n",
        filename: widgetSpec,
        options: [{ allowedFixturePackages: ["./helpers.ts"] }],
        errors: [{ messageId: "misplacedFixturePackage", data: { entry: "./helpers.ts" } }],
      },
      {
        name: "an allowed fixture package written as a file inside a package is reported",
        code: "export const total = 1;\n",
        filename: widgetSpec,
        options: [{ allowedFixturePackages: ["@fixture/shared-fixtures/src/index.ts"] }],
        errors: [
          {
            messageId: "misplacedFixturePackage",
            data: { entry: "@fixture/shared-fixtures/src/index.ts" },
          },
        ],
      },
      {
        name: "an allowed fixture package written as a subpath the package does not export is reported",
        code: "export const total = 1;\n",
        filename: widgetSpec,
        options: [{ allowedFixturePackages: ["@fixture/shared-fixtures/internal"] }],
        errors: [
          {
            messageId: "misplacedFixturePackage",
            data: { entry: "@fixture/shared-fixtures/internal" },
          },
        ],
      },
    ],
  });
});
