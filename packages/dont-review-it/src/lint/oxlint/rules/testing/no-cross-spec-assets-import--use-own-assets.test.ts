import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, it } from "vite-plus/test";

import { noCrossSpecAssetsImport } from "./no-cross-spec-assets-import--use-own-assets.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-no-cross-spec-assets-import");
rmSync(fixtureDir, { recursive: true, force: true });

const optionsSchema = noCrossSpecAssetsImport.meta.schema;

mkdirSync(join(fixtureDir, "owner"), { recursive: true });
mkdirSync(join(fixtureDir, "other"), { recursive: true });
mkdirSync(join(fixtureDir, "packages/shared/src"), { recursive: true });
mkdirSync(join(fixtureDir, "node_modules/@fixture"), { recursive: true });
mkdirSync(join(fixtureDir, "node_modules/outside-pkg"), { recursive: true });
mkdirSync(join(fixtureDir, "aliased/values"), { recursive: true });
mkdirSync(join(fixtureDir, "inherited"), { recursive: true });
mkdirSync(join(fixtureDir, "values"), { recursive: true });

writeFileSync(join(fixtureDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

writeFileSync(join(fixtureDir, "owner/order.assets.ts"), "export const rows = [1, 2];\n");
writeFileSync(join(fixtureDir, "owner/order.test.ts"), "");
writeFileSync(join(fixtureDir, "owner/plain.ts"), "export const total = 1;\n");
writeFileSync(join(fixtureDir, "owner/relay.ts"), 'export * from "./order.assets.ts";\n');
writeFileSync(
  join(fixtureDir, "owner/named-relay.ts"),
  'export { rows } from "./order.assets.ts";\n',
);
writeFileSync(join(fixtureDir, "owner/deep-relay.ts"), 'export * from "./relay.ts";\n');
writeFileSync(
  join(fixtureDir, "owner/plain-relay.ts"),
  'import { rows } from "./order.assets.ts";\nexport { rows };\n',
);
writeFileSync(join(fixtureDir, "other/order.assets.ts"), "export const rows = [3];\n");

writeFileSync(
  join(fixtureDir, "packages/shared/package.json"),
  JSON.stringify({
    name: "@fixture/shared",
    exports: { ".": "./src/index.ts", "./data": "./src/table.assets.ts" },
  }),
);
writeFileSync(join(fixtureDir, "packages/shared/src/index.ts"), "export const shared = 1;\n");
writeFileSync(
  join(fixtureDir, "packages/shared/src/table.assets.ts"),
  "export const table = [4];\n",
);
symlinkSync(
  join(fixtureDir, "packages/shared"),
  join(fixtureDir, "node_modules/@fixture/shared"),
  "dir",
);

writeFileSync(
  join(fixtureDir, "node_modules/outside-pkg/package.json"),
  JSON.stringify({ name: "outside-pkg", exports: { "./data": "./order.assets.ts" } }),
);
writeFileSync(
  join(fixtureDir, "node_modules/outside-pkg/order.assets.ts"),
  "export const rows = [5];\n",
);

writeFileSync(
  join(fixtureDir, "aliased/tsconfig.json"),
  JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@data/*": ["./values/*"] } } }),
);
writeFileSync(join(fixtureDir, "aliased/values/order.assets.ts"), "export const rows = [6];\n");

writeFileSync(
  join(fixtureDir, "inherited/tsconfig.json"),
  JSON.stringify({ extends: "./tsconfig.base.json" }),
);
writeFileSync(
  join(fixtureDir, "inherited/tsconfig.base.json"),
  JSON.stringify({
    compilerOptions: { paths: { "@shared/values": ["../values/order.assets.ts"] } },
  }),
);
writeFileSync(join(fixtureDir, "values/order.assets.ts"), "export const rows = [7];\n");

describe("dont-review-it/no-cross-spec-assets-import--use-own-assets", () => {
  testLintRule(noCrossSpecAssetsImport, {
    valid: [
      {
        name: "the spec of the same stem in the same directory owns the test data it reads",
        code: 'import { rows } from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/order.test.ts"),
      },
      {
        name: "the owner is recognised through a specifier that carries no extension",
        documented: true,
        code: 'import { rows } from "./order.assets";',
        filename: join(fixtureDir, "owner/order.test.ts"),
      },
      {
        name: "the owner is recognised through a specifier spelled with the built extension",
        code: 'import { rows } from "./order.assets.js";',
        filename: join(fixtureDir, "owner/order.test.ts"),
      },
      {
        name: "a module that is not test data is read by anyone",
        code: 'import { total } from "./plain.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "test data inside an installed dependency is out of reach of this invariant",
        code: 'import { rows } from "outside-pkg/data";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "a specifier that resolves to nothing carries no coupling",
        code: 'import { rows } from "nowhere-at-all";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "a specifier decided at run time cannot be followed to a file",
        code: "export const load = (name: string) => import(name);",
        filename: join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "an export list without a source names no module",
        code: "const rows = [1];\nexport { rows };",
        filename: join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "a call that is not a module request is left alone",
        code: 'export const total = Number.parseInt("1", 10);',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "test data reading test data is left to the rule that forbids its imports outright",
        code: 'import { rows } from "../other/order.assets.ts";',
        filename: join(fixtureDir, "owner/order.assets.ts"),
      },
    ],
    invalid: [
      {
        name: "another spec in the same directory is not the owner",
        documented: true,
        code: 'import { rows } from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "./order.assets.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
      {
        name: "a spec of the same stem in another directory is not the owner",
        code: 'import { rows } from "../owner/order.assets.ts";',
        filename: join(fixtureDir, "other/order.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "../owner/order.assets.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "order",
            },
          },
        ],
      },
      {
        name: "a module that is no spec at all is reported on its own message",
        code: 'import { rows } from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/plain.ts"),
        errors: [
          {
            messageId: "foreignAssetsImport",
            data: { specifier: "./order.assets.ts", assetsPath: "owner/order.assets.ts" },
          },
        ],
      },
      {
        name: "a type-only import is a reader of the file all the same",
        code: 'import type { rows } from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "an import that binds nothing still couples this file to the data",
        code: 'import "./order.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a named re-export reaches the data as much as an import does",
        code: 'export { rows } from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a star re-export reaches the data as much as an import does",
        code: 'export * from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a file that forwards the data is followed through to what it forwards",
        documented: true,
        code: 'import { rows } from "./relay.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "./relay.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
      {
        name: "a named forward is followed as well as a star forward",
        code: 'import { rows } from "./named-relay.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "forwarding through a second file changes nothing",
        code: 'import { rows } from "./deep-relay.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a specifier bound to a constant in this file is decided before the run",
        code: 'const held = "./order.assets.ts";\nexport const loaded = import(held);',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a specifier assembled from static parts is decided before the run",
        code: 'const stem = "order";\nexport const loaded = import(`./${stem}.assets.ts`);',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a synchronous module request reaches the data as much as an import does",
        code: 'export const rows = require("./order.assets.ts");',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a package specifier that lands on test data through a declared entry is followed",
        code: 'import { table } from "@fixture/shared/data";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "@fixture/shared/data",
              assetsPath: "packages/shared/src/table.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
      {
        name: "a package specifier that reaches past the declared entries is followed too",
        code: 'import { table } from "@fixture/shared/src/table.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a path alias declared for the project is followed to what it stands for",
        code: 'import { rows } from "@data/order.assets.ts";',
        filename: join(fixtureDir, "aliased/reader.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "@data/order.assets.ts",
              assetsPath: "aliased/values/order.assets.ts",
              ownStem: "reader",
            },
          },
        ],
      },
      {
        name: "a path alias declared in a configuration this project extends is followed as well",
        code: 'import { rows } from "@shared/values";',
        filename: join(fixtureDir, "inherited/reader.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "@shared/values",
              assetsPath: "values/order.assets.ts",
              ownStem: "reader",
            },
          },
        ],
      },
      {
        name: "the spelling of test data is replaced by the one the repository configures",
        code: 'import { rows } from "./order.assets.ts";',
        filename: join(fixtureDir, "owner/checkout.spec.ts"),
        options: [{ assetsNameMarkers: ["assets"], specFileSuffixes: [".spec.ts"] }],
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "./order.assets.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
    ],
  });

  it("the options schema declares the two naming vocabularies and refuses any other key", () => {
    expect(optionsSchema).toStrictEqual([
      {
        type: "object",
        properties: {
          assetsNameMarkers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ]);
  });
});
