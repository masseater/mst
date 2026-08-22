import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireRootRepositoryCheck } from "./require-root-repository-check--keep-the-repository-check-reachable.ts";

const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-root-repository-check-"));

const repositoryWith = (name: string, guardAll: unknown): string => {
  const repositoryRoot = join(fixtureRoot, name);
  mkdirSync(repositoryRoot, { recursive: true });
  writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
  writeFileSync(
    join(repositoryRoot, "package.json"),
    `${JSON.stringify({ scripts: { "guard:all": guardAll } })}\n`,
    "utf8",
  );
  return join(repositoryRoot, "vite.config.ts");
};

const canonicalConfig = repositoryWith(
  "canonical",
  "vp check && vp exec dont-review-it check && vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2",
);
const missingConfig = repositoryWith(
  "missing",
  "vp check && vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2",
);
const wrappedConfig = repositoryWith(
  "wrapped",
  "vp check && spool -- vp exec dont-review-it check && vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2",
);

const nestedWorkspace = join(fixtureRoot, "nested", "packages", "app");
mkdirSync(nestedWorkspace, { recursive: true });
writeFileSync(join(fixtureRoot, "nested", "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
writeFileSync(
  join(fixtureRoot, "nested", "package.json"),
  '{ "scripts": { "guard:all": "vp check" } }\n',
  "utf8",
);
writeFileSync(join(nestedWorkspace, "package.json"), '{ "name": "app" }\n', "utf8");
const nestedConfig = join(nestedWorkspace, "vite.config.ts");

describe("dont-review-it/require-root-repository-check--keep-the-repository-check-reachable", () => {
  testLintRule(requireRootRepositoryCheck, {
    valid: [
      {
        name: "the root guard directly invokes the repository check once",
        code: "export const lint = {};",
        filename: canonicalConfig,
      },
      {
        name: "a workspace config does not own the root guard",
        code: "export const lint = {};",
        filename: nestedConfig,
      },
    ],
    invalid: [
      {
        name: "the root guard omits the repository check",
        code: "export const lint = {};",
        filename: missingConfig,
        errors: [{ messageId: "unreachableRepositoryCheck" }],
      },
      {
        name: "the root guard hides the repository check behind a wrapper",
        code: "export const lint = {};",
        filename: wrappedConfig,
        errors: [{ messageId: "unreachableRepositoryCheck" }],
      },
    ],
  });
});
