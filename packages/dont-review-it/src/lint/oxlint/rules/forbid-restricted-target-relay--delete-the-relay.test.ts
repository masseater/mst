import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidRestrictedTargetRelay } from "./forbid-restricted-target-relay--delete-the-relay.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-forbid-restricted-target-relay");
rmSync(fixtureDir, { recursive: true, force: true });

const STAR_FORWARD_TO_RETIRED_LIB = 'export * from "retired-lib";\n';

const relayDir = join(fixtureDir, "relay");
const relaykitDir = join(fixtureDir, "packages/relaykit");
const outsideRelayDir = join(fixtureDir, "node_modules/outside-relay");
const aliasedDir = join(fixtureDir, "aliased");

mkdirSync(relayDir, { recursive: true });
mkdirSync(join(fixtureDir, "owner"), { recursive: true });
mkdirSync(join(fixtureDir, "shared"), { recursive: true });
mkdirSync(join(relaykitDir, "src"), { recursive: true });
mkdirSync(join(fixtureDir, "node_modules/@fixture"), { recursive: true });
mkdirSync(outsideRelayDir, { recursive: true });
mkdirSync(join(aliasedDir, "modules"), { recursive: true });

writeFileSync(join(fixtureDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

writeFileSync(join(relayDir, "named-forward.ts"), 'export { readFile } from "retired-lib";\n');
writeFileSync(join(relayDir, "star-forward.ts"), STAR_FORWARD_TO_RETIRED_LIB);
writeFileSync(join(relayDir, "namespace-forward.ts"), 'export * as retired from "retired-lib";\n');
writeFileSync(
  join(relayDir, "binding-forward.ts"),
  'import { readFile } from "retired-lib";\nexport { readFile as read };\n',
);
writeFileSync(join(relayDir, "deep-forward.ts"), 'export * from "./star-forward.ts";\n');
writeFileSync(join(relayDir, "deeper-forward.ts"), 'export * from "./deep-forward.ts";\n');
writeFileSync(
  join(relayDir, "boundary.ts"),
  'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);\n',
);
writeFileSync(
  join(relayDir, "inner-only.ts"),
  'import { readFile } from "retired-lib";\nvoid readFile;\n',
);
writeFileSync(join(relayDir, "cycle-a.ts"), 'export * from "./cycle-b.ts";\n');
writeFileSync(join(relayDir, "cycle-b.ts"), 'export * from "./cycle-a.ts";\n');
writeFileSync(join(relayDir, "derived-forward.ts"), 'export * from "retired-lib-extra";\n');
writeFileSync(join(relayDir, "whole-surface.ts"), 'export * from "node:fs";\n');
writeFileSync(join(relayDir, "one-export.ts"), 'export { writeFileSync } from "node:fs";\n');

writeFileSync(join(fixtureDir, "owner/forward.ts"), STAR_FORWARD_TO_RETIRED_LIB);
writeFileSync(join(fixtureDir, "shared/forward.ts"), STAR_FORWARD_TO_RETIRED_LIB);

writeFileSync(
  join(relaykitDir, "package.json"),
  JSON.stringify({ name: "@fixture/relaykit", exports: { ".": "./src/index.ts" } }),
);
writeFileSync(join(relaykitDir, "src/index.ts"), STAR_FORWARD_TO_RETIRED_LIB);
symlinkSync(relaykitDir, join(fixtureDir, "node_modules/@fixture/relaykit"), "dir");

writeFileSync(
  join(outsideRelayDir, "package.json"),
  JSON.stringify({ name: "outside-relay", exports: { ".": "./index.ts" } }),
);
writeFileSync(join(outsideRelayDir, "index.ts"), STAR_FORWARD_TO_RETIRED_LIB);

writeFileSync(
  join(aliasedDir, "tsconfig.json"),
  JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@relay/*": ["./modules/*"] } } }),
);
writeFileSync(join(fixtureDir, "aliased/modules/forward.ts"), STAR_FORWARD_TO_RETIRED_LIB);

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
        filename: join(fixtureDir, "relay/anything.ts"),
      },
      {
        name: "a boundary that publishes its own vocabulary keeps the target off its surface",
        documented: true,
        code: 'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);',
        filename: join(fixtureDir, "relay/own-boundary.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "forwarding the vocabulary a boundary publishes keeps the target off this surface",
        code: 'export { read } from "./boundary.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "reading a module that holds the target inside itself reaches nothing",
        code: 'import { anything } from "./inner-only.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "reading a boundary that transforms the binding reaches nothing",
        documented: true,
        code: 'import { read } from "./boundary.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "naming the target directly is left to the rule that matches specifiers in one file",
        code: 'import { readFile } from "retired-lib";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a forward inside an installed package is out of reach of this invariant",
        code: 'import { readFile } from "outside-relay";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "reading a module that forwards a separate name reaches nothing",
        code: 'import { anything } from "./derived-forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "forwarding a separate name puts no restricted target on this surface",
        code: 'export * from "retired-lib-extra";',
        filename: join(fixtureDir, "relay/derived-forward.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a forward chain that closes on itself ends the walk",
        code: 'import { anything } from "./cycle-a.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a specifier decided at run time cannot be followed to a file",
        code: "export const load = (name: string) => import(name);",
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
      },
      {
        name: "a position the entry allows may read the forwarded target",
        code: 'import { readFile } from "../relay/star-forward.ts";',
        filename: join(fixtureDir, "owner/reader.ts"),
        options: restrictedInsideOwner,
      },
      {
        name: "reading a module that forwards only an export outside the named ones reaches nothing",
        code: 'import { writeFileSync } from "./one-export.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedOneExport,
      },
    ],
    invalid: [
      {
        name: "a named re-export puts the target on this module's surface",
        documented: true,
        code: 'export { readFile } from "retired-lib";',
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
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
        documented: true,
        code: 'import { readFile } from "./star-forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a forward written as an exported import binding is followed too",
        code: 'import { read } from "./binding-forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a namespace forward is followed too",
        code: 'import { readFile } from "./namespace-forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a type-only import reaches the target all the same",
        code: 'import type { readFile } from "./star-forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "an import that binds nothing still reaches the target",
        code: 'import "./star-forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a synchronous module request reaches the target as much as an import does",
        code: 'export const held = require("./star-forward.ts");',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "an import-equals request reaches the target as much as an import does",
        code: 'import held = require("./star-forward.ts");\nvoid held;',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a type position that names a module reaches the target as much as an import does",
        code: 'export type Read = import("./star-forward.ts").Read;',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a specifier bound to a constant in this file is decided before the run",
        code: 'const held = "./star-forward.ts";\nexport const loaded = import(held);',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a specifier assembled from static parts is decided before the run",
        code: 'const stem = "star";\nexport const loaded = import(`./${stem}-forward.ts`);',
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedRetiredLib,
        errors: [{ messageId: "relayedTargetReach" }],
      },
      {
        name: "a forward carved out into a workspace package is followed through its entry",
        code: 'import { readFile } from "@fixture/relaykit";',
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "aliased/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "owner/reader.ts"),
        options: restrictedInsideOwner,
        errors: [{ messageId: "restrictedTargetForward" }],
      },
      {
        name: "a position outside the allowed one reaches the forwarded target",
        code: 'import { readFile } from "../owner/forward.ts";',
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
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
        filename: join(fixtureDir, "relay/reader.ts"),
        options: restrictedOneExport,
        errors: [{ messageId: "relayedTargetReach" }],
      },
    ],
  });
});
