import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidTrackedPath } from "./forbid-tracked-path--untrack-and-ignore.ts";

const HOST_CODE = "export const total = 1;";

const EVERY_DEFAULT_LISTED = "node_modules\ndist\ncoverage\n.env\n";

const gitEnvironment: NodeJS.ProcessEnv = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  HOME: process.env.HOME ?? "",
  PATH: process.env.PATH ?? "",
};

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-forbid-tracked-path-"));

const HOST_FILE_NAME = "vite.config.ts";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const HELD_BY_THE_FIXTURE = "held by the fixture\n";

const gitRun: Readonly<{ env: NodeJS.ProcessEnv; stdio: "ignore" }> = {
  env: gitEnvironment,
  stdio: "ignore",
};

const clean = join(fixtureDir, "clean");
mkdirSync(join(clean, "src"), { recursive: true });
writeFileSync(join(clean, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(clean, ".gitignore"), EVERY_DEFAULT_LISTED);
execFileSync("git", ["init"], { cwd: clean, ...gitRun });
writeFileSync(join(clean, "src/index.ts"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "src/index.ts"], { cwd: clean, ...gitRun });

const untrackedEnv = join(fixtureDir, "untracked-env");
mkdirSync(join(untrackedEnv, "src"), { recursive: true });
writeFileSync(join(untrackedEnv, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(untrackedEnv, ".gitignore"), EVERY_DEFAULT_LISTED);
execFileSync("git", ["init"], { cwd: untrackedEnv, ...gitRun });
writeFileSync(join(untrackedEnv, "src/index.ts"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "src/index.ts"], { cwd: untrackedEnv, ...gitRun });
writeFileSync(join(untrackedEnv, ".env"), HELD_BY_THE_FIXTURE);

const trackedOutsideEveryPattern = join(fixtureDir, "tracked-outside");
mkdirSync(trackedOutsideEveryPattern, { recursive: true });
writeFileSync(join(trackedOutsideEveryPattern, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(trackedOutsideEveryPattern, ".gitignore"), EVERY_DEFAULT_LISTED);
execFileSync("git", ["init"], { cwd: trackedOutsideEveryPattern, ...gitRun });
writeFileSync(join(trackedOutsideEveryPattern, "README.md"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "README.md"], {
  cwd: trackedOutsideEveryPattern,
  ...gitRun,
});

const spelledDifferently = join(fixtureDir, "spelled-differently");
mkdirSync(join(spelledDifferently, "src"), { recursive: true });
writeFileSync(join(spelledDifferently, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(
  join(spelledDifferently, ".gitignore"),
  "node_modules/\ndist/*\n/coverage\n**/.env\n",
);
execFileSync("git", ["init"], { cwd: spelledDifferently, ...gitRun });
writeFileSync(join(spelledDifferently, "src/index.ts"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "src/index.ts"], { cwd: spelledDifferently, ...gitRun });

const trackedEnv = join(fixtureDir, "tracked-env");
mkdirSync(trackedEnv, { recursive: true });
writeFileSync(join(trackedEnv, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(trackedEnv, ".gitignore"), EVERY_DEFAULT_LISTED);
execFileSync("git", ["init"], { cwd: trackedEnv, ...gitRun });
writeFileSync(join(trackedEnv, ".env"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", ".env"], { cwd: trackedEnv, ...gitRun });

const trackedBuildOutput = join(fixtureDir, "tracked-build-output");
mkdirSync(join(trackedBuildOutput, "packages/reader/dist"), { recursive: true });
writeFileSync(join(trackedBuildOutput, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(trackedBuildOutput, ".gitignore"), EVERY_DEFAULT_LISTED);
execFileSync("git", ["init"], { cwd: trackedBuildOutput, ...gitRun });
writeFileSync(join(trackedBuildOutput, "packages/reader/dist/index.js"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "packages/reader/dist/index.js"], {
  cwd: trackedBuildOutput,
  ...gitRun,
});

const vendored = join(fixtureDir, "vendored");
mkdirSync(join(vendored, "vendor"), { recursive: true });
writeFileSync(join(vendored, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(vendored, ".gitignore"), `${EVERY_DEFAULT_LISTED}vendor\n`);
execFileSync("git", ["init"], { cwd: vendored, ...gitRun });
writeFileSync(join(vendored, "vendor/build.js"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "vendor/build.js"], { cwd: vendored, ...gitRun });

const missingListing = join(fixtureDir, "missing-listing");
mkdirSync(join(missingListing, "src"), { recursive: true });
writeFileSync(join(missingListing, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(missingListing, ".gitignore"), "node_modules\ndist\ncoverage\n");
execFileSync("git", ["init"], { cwd: missingListing, ...gitRun });
writeFileSync(join(missingListing, "src/index.ts"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "src/index.ts"], { cwd: missingListing, ...gitRun });

const negatedListing = join(fixtureDir, "negated-listing");
mkdirSync(join(negatedListing, "src"), { recursive: true });
writeFileSync(join(negatedListing, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(negatedListing, ".gitignore"), "node_modules\ndist\ncoverage\n!.env\n");
execFileSync("git", ["init"], { cwd: negatedListing, ...gitRun });
writeFileSync(join(negatedListing, "src/index.ts"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "src/index.ts"], { cwd: negatedListing, ...gitRun });

const withoutIgnoreSettings = join(fixtureDir, "without-ignore-settings");
mkdirSync(join(withoutIgnoreSettings, "src"), { recursive: true });
writeFileSync(join(withoutIgnoreSettings, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
execFileSync("git", ["init"], { cwd: withoutIgnoreSettings, ...gitRun });
writeFileSync(join(withoutIgnoreSettings, "src/index.ts"), HELD_BY_THE_FIXTURE);
execFileSync("git", ["add", "-f", "--", "src/index.ts"], {
  cwd: withoutIgnoreSettings,
  ...gitRun,
});

const withoutVersionControl = join(fixtureDir, "without-version-control");
mkdirSync(withoutVersionControl, { recursive: true });
writeFileSync(join(withoutVersionControl, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST);
writeFileSync(join(withoutVersionControl, ".gitignore"), EVERY_DEFAULT_LISTED);
writeFileSync(join(withoutVersionControl, ".env"), HELD_BY_THE_FIXTURE);

const vendorRow = {
  pattern: "vendor/**",
  reason: "the upstream ships no source for this bundle",
};

describe("dont-review-it/forbid-tracked-path--untrack-and-ignore", { timeout: 30_000 }, () => {
  testLintRule(forbidTrackedPath, {
    valid: [
      {
        name: "a repository that tracks nothing under a registered pattern passes",
        code: HOST_CODE,
        filename: join(clean, HOST_FILE_NAME),
      },
      {
        name: "an untracked file of the same name is left where it stands",
        code: HOST_CODE,
        filename: join(untrackedEnv, HOST_FILE_NAME),
      },
      {
        name: "a tracked path outside every registered pattern is left alone",
        code: HOST_CODE,
        filename: join(trackedOutsideEveryPattern, HOST_FILE_NAME),
      },
      {
        name: "an ignore entry spelled with a directory slash or an anchor still covers the row",
        code: HOST_CODE,
        filename: join(spelledDifferently, HOST_FILE_NAME),
      },
      {
        name: "a tracked path covered by an exception that carries grounds is left alone",
        code: HOST_CODE,
        filename: join(vendored, HOST_FILE_NAME),
        options: [
          {
            forbidden: [
              {
                ...vendorRow,
                exceptions: [
                  { pattern: "vendor/**", reason: "the bundle is the shipped artifact" },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "a release that carries grounds lifts the registered row",
        code: HOST_CODE,
        filename: join(trackedEnv, HOST_FILE_NAME),
        options: [
          { released: [{ pattern: "**/.env", reason: "this repository ships no runtime" }] },
        ],
      },
      {
        name: "a row that asks for no ignore entry passes without one",
        code: HOST_CODE,
        filename: join(clean, HOST_FILE_NAME),
        options: [
          {
            forbidden: [
              {
                pattern: "**/scratch/**",
                reason: "scratch output stays visible in the status output",
                ignoreListing: false,
              },
            ],
          },
        ],
      },
      {
        name: "a working tree outside version control carries no tracked path",
        code: HOST_CODE,
        filename: join(withoutVersionControl, HOST_FILE_NAME),
      },
      {
        name: "a file below the workspace root reports nothing",
        code: HOST_CODE,
        filename: join(trackedEnv, "src", "index.ts"),
      },
    ],
    invalid: [
      {
        name: "an environment file that reached the index is reported",
        code: HOST_CODE,
        filename: join(trackedEnv, HOST_FILE_NAME),
        errors: [{ messageId: "trackedForbiddenPath" }],
      },
      {
        name: "build output that reached the index is reported",
        code: HOST_CODE,
        filename: join(trackedBuildOutput, HOST_FILE_NAME),
        errors: [{ messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a registered pattern missing from the ignore settings is reported",
        code: HOST_CODE,
        filename: join(missingListing, HOST_FILE_NAME),
        errors: [{ messageId: "unignoredForbiddenPattern" }],
      },
      {
        name: "a negated ignore entry does not list the pattern",
        code: HOST_CODE,
        filename: join(negatedListing, HOST_FILE_NAME),
        errors: [{ messageId: "unignoredForbiddenPattern" }],
      },
      {
        name: "a repository without ignore settings leaves every registered pattern unlisted",
        code: HOST_CODE,
        filename: join(withoutIgnoreSettings, HOST_FILE_NAME),
        errors: [
          { messageId: "unignoredForbiddenPattern" },
          { messageId: "unignoredForbiddenPattern" },
          { messageId: "unignoredForbiddenPattern" },
          { messageId: "unignoredForbiddenPattern" },
        ],
      },
      {
        name: "an exception whose reason is empty is reported and excuses nothing",
        code: HOST_CODE,
        filename: join(vendored, HOST_FILE_NAME),
        options: [
          { forbidden: [{ ...vendorRow, exceptions: [{ pattern: "vendor/**", reason: "" }] }] },
        ],
        errors: [{ messageId: "groundlessException" }, { messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a release whose reason is empty is reported and lifts nothing",
        code: HOST_CODE,
        filename: join(trackedEnv, HOST_FILE_NAME),
        options: [{ released: [{ pattern: "**/.env", reason: "" }] }],
        errors: [{ messageId: "groundlessRelease" }, { messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a release naming a pattern no row carries is reported",
        code: HOST_CODE,
        filename: join(clean, HOST_FILE_NAME),
        options: [
          { released: [{ pattern: "**/nowhere/**", reason: "the row moved to another table" }] },
        ],
        errors: [{ messageId: "deadRelease" }],
      },
      {
        name: "a groundless release of a pattern outside the defaults is reported twice over",
        code: HOST_CODE,
        filename: join(clean, HOST_FILE_NAME),
        options: [{ released: [{ pattern: "**/nowhere/**", reason: "" }] }],
        errors: [{ messageId: "groundlessRelease" }, { messageId: "deadRelease" }],
      },
      {
        name: "a release of a row the configuration itself added is dead and lifts nothing",
        code: HOST_CODE,
        filename: join(vendored, HOST_FILE_NAME),
        options: [
          {
            forbidden: [vendorRow],
            released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
          },
        ],
        errors: [{ messageId: "deadRelease" }, { messageId: "trackedForbiddenPath" }],
      },
    ],
  });
});
