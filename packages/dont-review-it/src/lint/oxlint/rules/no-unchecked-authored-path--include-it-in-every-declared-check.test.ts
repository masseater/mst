import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noUncheckedAuthoredPath } from "./no-unchecked-authored-path--include-it-in-every-declared-check.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-unchecked-authored-path-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const ROOT_PACKAGE_MANIFEST = '{ "name": "@fixture/root" }\n';

const LEGACY_SOURCE = "module.exports = {};\n";

const GUIDE_TEXT = "read me\n";

const REACHING_SOURCE = 'import { helped } from "./helper.ts";\n\nexport const started = helped;\n';

const REACHED_SOURCE = "export const helped = true;\n";

const HELD_BY_REPOSITORY: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  covered: {},
  declared: { "docs/guide.txt": GUIDE_TEXT },
  outside: {
    "dist/bundle.js": "export const built = true;\n",
    "node_modules/vendor/index.js": LEGACY_SOURCE,
  },
  "quiet-row": {},
  undeclared: { "src/legacy.js": LEGACY_SOURCE },
  hole: { "src/legacy.js": LEGACY_SOURCE },
  broad: { "docs/guide.txt": GUIDE_TEXT },
  dead: {},
  excluded: { "types/shipped.d.ts": "export declare const shipped: boolean;\n" },
  unopened: { "config/settings.json": "{}\n" },
  receiver: {},
  "settled-scope": { "setup/entry.ts": REACHING_SOURCE, "setup/helper.ts": REACHED_SOURCE },
  "open-scope": { "setup/entry.ts": REACHING_SOURCE, "setup/helper.ts": REACHED_SOURCE },
  workspaces: {
    "packages/tool/package.json": '{ "name": "@fixture/tool" }\n',
    "packages/tool/legacy.js": LEGACY_SOURCE,
  },
};

for (const [repositoryName, held] of Object.entries(HELD_BY_REPOSITORY)) {
  mkdirSync(join(fixtureDir, repositoryName, "src"), { recursive: true });
  writeFileSync(join(fixtureDir, repositoryName, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
  writeFileSync(join(fixtureDir, repositoryName, "package.json"), ROOT_PACKAGE_MANIFEST);
  for (const [heldPath, heldSource] of Object.entries(held)) {
    mkdirSync(dirname(join(fixtureDir, repositoryName, heldPath)), { recursive: true });
    writeFileSync(join(fixtureDir, repositoryName, heldPath), heldSource);
  }
  writeFileSync(join(fixtureDir, repositoryName, "src/app.ts"), MODULE_SOURCE);
}

const MANIFEST_READER = {
  name: "the package manager",
  coveredPaths: ["**/*.json", "**/*.yaml"],
};

const ANALYSER = {
  name: "the analyser",
  coveredPaths: ["**/*.ts"],
  excludedPaths: ["**/*.d.ts"],
};

const TYPE_CHECK = { name: "the type check", coveredPaths: ["**/*.ts"] };

const DECLARED_CHECKS = [MANIFEST_READER, ANALYSER];

const SPELLED_CHECKS = "`the package manager`, `the analyser`";

const coveredEntry = join(fixtureDir, "covered/src/app.ts");
const declaredEntry = join(fixtureDir, "declared/src/app.ts");
const outsideEntry = join(fixtureDir, "outside/src/app.ts");
const quietRowEntry = join(fixtureDir, "quiet-row/src/app.ts");
const undeclaredEntry = join(fixtureDir, "undeclared/src/app.ts");
const holeEntry = join(fixtureDir, "hole/src/app.ts");
const broadEntry = join(fixtureDir, "broad/src/app.ts");
const deadEntry = join(fixtureDir, "dead/src/app.ts");
const excludedEntry = join(fixtureDir, "excluded/src/app.ts");
const unopenedEntry = join(fixtureDir, "unopened/src/app.ts");
const receiverEntry = join(fixtureDir, "receiver/src/app.ts");
const settledScopeEntry = join(fixtureDir, "settled-scope/src/app.ts");
const openScopeEntry = join(fixtureDir, "open-scope/src/app.ts");
const rootEntry = join(fixtureDir, "workspaces/src/app.ts");

const toolEntry = join(fixtureDir, "workspaces/packages/tool/entry.ts");
writeFileSync(toolEntry, MODULE_SOURCE);

mkdirSync(join(fixtureDir, "loose/src"), { recursive: true });
writeFileSync(join(fixtureDir, "loose/pnpm-workspace.yaml"), "packages: []\n");
writeFileSync(join(fixtureDir, "loose/src/legacy.js"), LEGACY_SOURCE);
const looseEntry = join(fixtureDir, "loose/src/app.ts");
writeFileSync(looseEntry, MODULE_SOURCE);

const READ_TEXT = [{ pattern: "**/*.txt", reason: "the guide is read by people" }];

const FORBIDDEN_DECLARATION_FILES = [
  {
    name: "the forbidden files",
    consumedBy: "the analyser",
    rows: [{ pattern: "**/*.d.ts", reason: "a declaration file is generated" }],
  },
];

describe("dont-review-it/no-unchecked-authored-path--include-it-in-every-declared-check", () => {
  testLintRule(noUncheckedAuthoredPath, {
    valid: [
      {
        name: "every authored path sits inside a check, and two checks may open the same path",
        code: MODULE_SOURCE,
        filename: coveredEntry,
        options: [{ declaredChecks: [MANIFEST_READER, ANALYSER, TYPE_CHECK] }],
      },
      {
        name: "an extension declared as read by no check is not a hole",
        code: MODULE_SOURCE,
        filename: declaredEntry,
        options: [{ declaredChecks: DECLARED_CHECKS, uncheckedDeclarations: READ_TEXT }],
      },
      {
        name: "paths outside the authored surface are not holes",
        code: MODULE_SOURCE,
        filename: outsideEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
      },
      {
        name: "a prohibition row that matches no file is the state the row asks for",
        code: MODULE_SOURCE,
        filename: quietRowEntry,
        options: [{ declaredChecks: DECLARED_CHECKS, registries: FORBIDDEN_DECLARATION_FILES }],
      },
      {
        name: "a row the check that consumes it opens is reachable",
        code: MODULE_SOURCE,
        filename: excludedEntry,
        options: [
          {
            declaredChecks: [MANIFEST_READER, ANALYSER, TYPE_CHECK],
            registries: [
              {
                name: "the forbidden files",
                consumedBy: "the type check",
                rows: [{ pattern: "**/*.d.ts", reason: "a declaration file is generated" }],
              },
            ],
          },
        ],
      },
      {
        name: "a repository that declares no check has nothing to reconcile",
        code: MODULE_SOURCE,
        filename: undeclaredEntry,
        options: [{}],
      },
      {
        name: "a hole another workspace holds is not reported here",
        code: MODULE_SOURCE,
        filename: rootEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
      },
      {
        name: "a scope registration that carries everything its files reach",
        code: MODULE_SOURCE,
        filename: settledScopeEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            scopeRegistrations: [{ name: "the bootstrap zone", registeredPaths: ["setup/**"] }],
          },
        ],
      },
      {
        name: "a directory-wide pattern is read as a registration, not as a declaration",
        code: MODULE_SOURCE,
        filename: broadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            uncheckedDeclarations: [
              { pattern: "docs/*.txt", reason: "the guide is read by people" },
            ],
          },
        ],
      },
    ],
    invalid: [
      {
        name: "an authored path no declared check opens",
        documented: true,
        code: MODULE_SOURCE,
        filename: holeEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
        errors: [
          {
            messageId: "uncheckedAuthoredPath",
            data: { authoredPath: "src/legacy.js", declaredChecks: SPELLED_CHECKS },
          },
        ],
      },
      {
        name: "a declaration of paths no check reads that covers a whole directory",
        code: MODULE_SOURCE,
        filename: broadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            uncheckedDeclarations: [{ pattern: "docs/**", reason: "the guide is read by people" }],
          },
        ],
        errors: [
          {
            messageId: "broadUncheckedDeclaration",
            data: { pattern: "docs/**", reason: "the guide is read by people" },
          },
        ],
      },
      {
        name: "an allowance row that matches no authored path",
        code: MODULE_SOURCE,
        filename: deadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            registries: [
              {
                name: "the forbidden files",
                consumedBy: "the analyser",
                allowances: [
                  { pattern: "vendor/**/*.js", reason: "the vendored bundle predates the rule" },
                ],
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "deadRegistration",
            data: {
              registry: "`the forbidden files`",
              pattern: "vendor/**/*.js",
              reason: "the vendored bundle predates the rule",
            },
          },
        ],
      },
      {
        name: "a declaration of paths no check reads that matches no authored path",
        code: MODULE_SOURCE,
        filename: deadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            uncheckedDeclarations: [{ pattern: "**/*.txt", reason: "the guide is read by people" }],
          },
        ],
        errors: [
          {
            messageId: "deadRegistration",
            data: {
              registry: "the declaration of paths no check reads",
              pattern: "**/*.txt",
              reason: "the guide is read by people",
            },
          },
        ],
      },
      {
        name: "a row aimed at paths the consuming check leaves out through an exclusion",
        code: MODULE_SOURCE,
        filename: excludedEntry,
        options: [
          {
            declaredChecks: [MANIFEST_READER, ANALYSER, TYPE_CHECK],
            registries: FORBIDDEN_DECLARATION_FILES,
          },
        ],
        errors: [
          {
            messageId: "excludedRegistration",
            data: {
              registry: "`the forbidden files`",
              pattern: "**/*.d.ts",
              check: "the analyser",
              matchedPath: "types/shipped.d.ts",
              exclusion: "`**/*.d.ts`",
            },
          },
        ],
      },
      {
        name: "a row aimed at paths the consuming check never opens",
        code: MODULE_SOURCE,
        filename: unopenedEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            registries: [
              {
                name: "the tracked paths",
                consumedBy: "the analyser",
                rows: [{ pattern: "config/*.json", reason: "settings belong to the deployment" }],
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "unopenedRegistration",
            data: {
              registry: "`the tracked paths`",
              pattern: "config/*.json",
              check: "the analyser",
              matchedPath: "config/settings.json",
              coveredPaths: "`**/*.ts`",
            },
          },
        ],
      },
      {
        name: "a registry and a row that name receivers this repository does not declare",
        code: MODULE_SOURCE,
        filename: receiverEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            registries: [
              {
                name: "the required files",
                consumedBy: "the file scan",
                rows: [
                  {
                    pattern: "**/*.ts",
                    reason: "the entry is read outside the source",
                    receivers: ["the shape check"],
                  },
                ],
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "undeclaredReceiver",
            data: {
              record: "Registry `the required files`",
              receiver: "the file scan",
              declaredChecks: SPELLED_CHECKS,
            },
          },
          {
            messageId: "undeclaredReceiver",
            data: {
              record: "Row `**/*.ts` of registry `the required files`",
              receiver: "the shape check",
              declaredChecks: SPELLED_CHECKS,
            },
          },
        ],
      },
      {
        name: "a registered file that reaches a file the scope registration leaves out",
        code: MODULE_SOURCE,
        filename: openScopeEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            scopeRegistrations: [
              { name: "the bootstrap zone", registeredPaths: ["setup/entry.ts"] },
            ],
          },
        ],
        errors: [
          {
            messageId: "unregisteredScopeReach",
            data: {
              scope: "the bootstrap zone",
              reachingPath: "setup/entry.ts",
              reachedPath: "setup/helper.ts",
            },
          },
        ],
      },
      {
        name: "a repository that holds no manifest keeps its findings at the root",
        code: MODULE_SOURCE,
        filename: looseEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
        errors: [
          {
            messageId: "uncheckedAuthoredPath",
            data: { authoredPath: "src/legacy.js", declaredChecks: SPELLED_CHECKS },
          },
        ],
      },
      {
        name: "a hole is reported on the workspace that owns the path",
        code: MODULE_SOURCE,
        filename: toolEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
        errors: [
          {
            messageId: "uncheckedAuthoredPath",
            data: {
              authoredPath: "packages/tool/legacy.js",
              declaredChecks: SPELLED_CHECKS,
            },
          },
        ],
      },
    ],
  });
});
