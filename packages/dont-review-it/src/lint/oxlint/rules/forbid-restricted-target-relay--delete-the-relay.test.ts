import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidRestrictedTargetRelay } from "./forbid-restricted-target-relay--delete-the-relay.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-forbid-restricted-target-relay");
rmSync(fixtureDir, { recursive: true, force: true });

const fixturePath = (fixtureName: string): string => join(fixtureDir, fixtureName);

const writeFixture = (fixtureName: string, source: string): string => {
  const path = fixturePath(fixtureName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

writeFixture("pnpm-workspace.yaml", "packages:\n  - packages/*\n");

writeFixture("relay/named-forward.ts", 'export { readFile } from "retired-lib";\n');
writeFixture("relay/star-forward.ts", 'export * from "retired-lib";\n');
writeFixture("relay/namespace-forward.ts", 'export * as retired from "retired-lib";\n');
writeFixture(
  "relay/binding-forward.ts",
  'import { readFile } from "retired-lib";\nexport { readFile as read };\n',
);
writeFixture("relay/deep-forward.ts", 'export * from "./star-forward.ts";\n');
writeFixture("relay/deeper-forward.ts", 'export * from "./deep-forward.ts";\n');
writeFixture(
  "relay/boundary.ts",
  'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);\n',
);
writeFixture("relay/inner-only.ts", 'import { readFile } from "retired-lib";\nvoid readFile;\n');
writeFixture("relay/cycle-a.ts", 'export * from "./cycle-b.ts";\n');
writeFixture("relay/cycle-b.ts", 'export * from "./cycle-a.ts";\n');
writeFixture("relay/derived-forward.ts", 'export * from "retired-lib-extra";\n');
writeFixture("relay/whole-surface.ts", 'export * from "node:fs";\n');
writeFixture("relay/one-export.ts", 'export { writeFileSync } from "node:fs";\n');

writeFixture("owner/forward.ts", 'export * from "retired-lib";\n');
writeFixture("shared/forward.ts", 'export * from "retired-lib";\n');

writeFixture(
  "packages/relaykit/package.json",
  JSON.stringify({ name: "@fixture/relaykit", exports: { ".": "./src/index.ts" } }),
);
writeFixture("packages/relaykit/src/index.ts", 'export * from "retired-lib";\n');
mkdirSync(fixturePath("node_modules/@fixture"), { recursive: true });
symlinkSync(fixturePath("packages/relaykit"), fixturePath("node_modules/@fixture/relaykit"), "dir");

writeFixture(
  "node_modules/outside-relay/package.json",
  JSON.stringify({ name: "outside-relay", exports: { ".": "./index.ts" } }),
);
writeFixture("node_modules/outside-relay/index.ts", 'export * from "retired-lib";\n');

writeFixture(
  "aliased/tsconfig.json",
  JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@relay/*": ["./modules/*"] } } }),
);
writeFixture("aliased/modules/forward.ts", 'export * from "retired-lib";\n');

const substitute = "Take the same values from the shared reader.";

const restrictedRetiredLib = [{ restricted: [{ module: "retired-lib", substitute }] }];

const restrictedInsideOwner = [
  { restricted: [{ module: "retired-lib", allowedPositions: ["owner/**"], substitute }] },
];

const restrictedOneExport = [
  { restricted: [{ module: "node:fs", exports: ["readFileSync"], substitute }] },
];

describe("dont-review-it/forbid-restricted-target-relay--delete-the-relay", () => {
  testLintRule(forbidRestrictedTargetRelay, {
    valid: [
      {
        name: "a repository with no restricted target declared reports nothing",
        code: 'export * from "retired-lib";',
        filename: fixturePath("relay/anything.ts"),
      },
      {
        name: "a boundary that publishes its own vocabulary keeps the target off its surface",
        code: 'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);',
        filename: fixturePath("relay/own-boundary.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "forwarding the vocabulary a boundary publishes keeps the target off this surface",
        code: 'export { read } from "./boundary.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "reading a module that holds the target inside itself reaches nothing",
        code: 'import { anything } from "./inner-only.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "reading a boundary that transforms the binding reaches nothing",
        code: 'import { read } from "./boundary.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "naming the target directly is left to the rule that matches specifiers in one file",
        code: 'import { readFile } from "retired-lib";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a forward inside an installed package is out of reach of this invariant",
        code: 'import { readFile } from "outside-relay";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "reading a module that forwards a separate name reaches nothing",
        code: 'import { anything } from "./derived-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a forward chain that closes on itself ends the walk",
        code: 'import { anything } from "./cycle-a.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a specifier decided at run time cannot be followed to a file",
        code: "export const load = (fixtureName: string) => import(name);",
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a position the entry allows may read the forwarded target",
        code: 'import { readFile } from "../relay/star-forward.ts";',
        filename: fixturePath("owner/reader.ts"),
        options: restrictedInsideOwner,
      },
      {
        name: "reading a module that forwards only an export outside the named ones reaches nothing",
        code: 'import { writeFileSync } from "./one-export.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedOneExport,
      },
    ],
    invalid: [
      {
        name: "a named re-export puts the target on this module's surface",
        code: 'export { readFile } from "retired-lib";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "restrictedTargetForward",
            data: { target: "retired-lib", exposed: "readFile", substitute },
          },
        ],
      },
      {
        name: "a star re-export puts the whole surface through",
        code: 'export * from "retired-lib";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "restrictedTargetForward",
            data: { target: "retired-lib", exposed: "*", substitute },
          },
        ],
      },
      {
        name: "exporting an imported binding is the same forward written in two statements",
        code: 'import { readFile } from "retired-lib";\nexport { readFile };',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "restrictedTargetForward",
            data: { target: "retired-lib", exposed: "readFile", substitute },
          },
        ],
      },
      {
        name: "forwarding a module that forwards the target is a forward of the target",
        code: 'export * from "./star-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "relayedTargetForward",
            data: {
              target: "retired-lib",
              exposed: "*",
              relays: "relay/star-forward.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "reading a module that forwards the target reaches the target",
        code: 'import { readFile } from "./star-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "relayedTargetReach",
            data: {
              specifier: "./star-forward.ts",
              target: "retired-lib",
              relays: "relay/star-forward.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "the walk prints every module it went through",
        code: 'import { readFile } from "./deeper-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "relayedTargetReach",
            data: {
              specifier: "./deeper-forward.ts",
              target: "retired-lib",
              relays: "relay/deeper-forward.ts -> relay/deep-forward.ts -> relay/star-forward.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "a named forward is followed as well as a star forward",
        code: 'import { readFile } from "./named-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a forward written as an exported import binding is followed too",
        code: 'import { read } from "./binding-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a namespace forward is followed too",
        code: 'import { readFile } from "./namespace-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a type-only import reaches the target all the same",
        code: 'import type { readFile } from "./star-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "an import that binds nothing still reaches the target",
        code: 'import "./star-forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a synchronous module request reaches the target as much as an import does",
        code: 'export const held = require("./star-forward.ts");',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "an import-equals request reaches the target as much as an import does",
        code: 'import held = require("./star-forward.ts");\nvoid held;',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a type position that names a module reaches the target as much as an import does",
        code: 'export type Read = import("./star-forward.ts").Read;',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a specifier bound to a constant in this file is decided before the run",
        code: 'const held = "./star-forward.ts";\nexport const loaded = import(held);',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a specifier assembled from static parts is decided before the run",
        code: 'const stem = "star";\nexport const loaded = import(`./${stem}-forward.ts`);',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a forward carved out into a workspace package is followed through its entry",
        code: 'import { readFile } from "@fixture/relaykit";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "relayedTargetReach",
            data: {
              specifier: "@fixture/relaykit",
              target: "retired-lib",
              relays: "packages/relaykit/src/index.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "a path alias declared for the project is followed to what it stands for",
        code: 'import { readFile } from "@relay/forward.ts";',
        filename: fixturePath("aliased/reader.ts"),
        options: restrictedRetiredLib,
        errors: [
          {
            messageId: "relayedTargetReach",
            data: {
              specifier: "@relay/forward.ts",
              target: "retired-lib",
              relays: "aliased/modules/forward.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "a prefix the repository declares as its own is followed to what it stands for",
        code: 'import { readFile } from "~/forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: [
          {
            restricted: [{ module: "retired-lib", substitute }],
            internalAliases: [{ prefix: "~/", directory: "shared" }],
          },
        ],
        errors: [
          {
            messageId: "relayedTargetReach",
            data: {
              specifier: "~/forward.ts",
              target: "retired-lib",
              relays: "shared/forward.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "a position the entry allows may not forward the target out of that position",
        code: 'export * from "retired-lib";',
        filename: fixturePath("owner/reader.ts"),
        options: restrictedInsideOwner,
        errors: [{ messageId: "restrictedTargetForward" }],
      },
      {
        name: "a position outside the allowed one reaches the forwarded target",
        code: 'import { readFile } from "../owner/forward.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedInsideOwner,
        errors: [
          {
            messageId: "relayedTargetReach",
            data: {
              specifier: "../owner/forward.ts",
              target: "retired-lib",
              relays: "owner/forward.ts",
              substitute,
            },
          },
        ],
      },
      {
        name: "a named export the entry names is forwarded no further",
        code: 'export { readFileSync } from "node:fs";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedOneExport,
        errors: [
          {
            messageId: "restrictedTargetForward",
            data: { target: "node:fs", exposed: "readFileSync", substitute },
          },
        ],
      },
      {
        name: "a whole surface forward carries the named export with it",
        code: 'import { readFileSync } from "./whole-surface.ts";',
        filename: fixturePath("relay/reader.ts"),
        options: restrictedOneExport,
        errors: [{ messageId: "relayedTargetReach" }],
      },
    ],
  });
});
