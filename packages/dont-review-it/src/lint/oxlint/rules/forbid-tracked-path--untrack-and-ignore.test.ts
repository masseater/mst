import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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

const writtenFile = (root: string, relativePath: string): string => {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "held by the fixture\n");
  return path;
};

const workspaceFixture = ({
  name: spelled,
  ignoreText,
}: {
  readonly name: string;
  readonly ignoreText: string | null;
}): string => {
  const root = join(fixtureDir, spelled);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  if (ignoreText !== null) writeFileSync(join(root, ".gitignore"), ignoreText);
  return root;
};

const versionedFixture = ({
  name,
  ignoreText,
  tracked,
}: {
  readonly name: string;
  readonly ignoreText: string | null;
  readonly tracked: readonly string[];
}): string => {
  const root = workspaceFixture({ name, ignoreText });
  execFileSync("git", ["init"], { cwd: root, env: gitEnvironment, stdio: "ignore" });
  for (const relativePath of tracked) writtenFile(root, relativePath);
  execFileSync("git", ["add", "-f", "--", ...tracked], {
    cwd: root,
    env: gitEnvironment,
    stdio: "ignore",
  });
  return root;
};

const hostIn = (root: string): string => join(root, "vite.config.ts");

const clean = versionedFixture({
  name: "clean",
  ignoreText: EVERY_DEFAULT_LISTED,
  tracked: ["src/index.ts"],
});

const untrackedEnv = versionedFixture({
  name: "untracked-env",
  ignoreText: EVERY_DEFAULT_LISTED,
  tracked: ["src/index.ts"],
});
writtenFile(untrackedEnv, ".env");

const trackedOutsideEveryPattern = versionedFixture({
  name: "tracked-outside",
  ignoreText: EVERY_DEFAULT_LISTED,
  tracked: ["README.md"],
});

const spelledDifferently = versionedFixture({
  name: "spelled-differently",
  ignoreText: "node_modules/\ndist/*\n/coverage\n**/.env\n",
  tracked: ["src/index.ts"],
});

const trackedEnv = versionedFixture({
  name: "tracked-env",
  ignoreText: EVERY_DEFAULT_LISTED,
  tracked: [".env"],
});

const trackedBuildOutput = versionedFixture({
  name: "tracked-build-output",
  ignoreText: EVERY_DEFAULT_LISTED,
  tracked: ["packages/reader/dist/index.js"],
});

const vendored = versionedFixture({
  name: "vendored",
  ignoreText: `${EVERY_DEFAULT_LISTED}vendor\n`,
  tracked: ["vendor/build.js"],
});

const missingListing = versionedFixture({
  name: "missing-listing",
  ignoreText: "node_modules\ndist\ncoverage\n",
  tracked: ["src/index.ts"],
});

const negatedListing = versionedFixture({
  name: "negated-listing",
  ignoreText: "node_modules\ndist\ncoverage\n!.env\n",
  tracked: ["src/index.ts"],
});

const withoutIgnoreSettings = versionedFixture({
  name: "without-ignore-settings",
  ignoreText: null,
  tracked: ["src/index.ts"],
});

const withoutVersionControl = workspaceFixture({
  name: "without-version-control",
  ignoreText: EVERY_DEFAULT_LISTED,
});
writtenFile(withoutVersionControl, ".env");

const vendorRow = {
  pattern: "vendor/**",
  reason: "the upstream ships no source for this bundle",
};

describe("dont-review-it/forbid-tracked-path--untrack-and-ignore", () => {
  testLintRule(forbidTrackedPath, {
    valid: [
      {
        name: "a repository that tracks nothing under a registered pattern passes",
        code: HOST_CODE,
        filename: hostIn(clean),
      },
      {
        name: "an untracked file of the same name is left where it stands",
        code: HOST_CODE,
        filename: hostIn(untrackedEnv),
      },
      {
        name: "a tracked path outside every registered pattern is left alone",
        code: HOST_CODE,
        filename: hostIn(trackedOutsideEveryPattern),
      },
      {
        name: "an ignore entry spelled with a directory slash or an anchor still covers the row",
        code: HOST_CODE,
        filename: hostIn(spelledDifferently),
      },
      {
        name: "a tracked path covered by an exception that carries grounds is left alone",
        code: HOST_CODE,
        filename: hostIn(vendored),
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
        filename: hostIn(trackedEnv),
        options: [
          { released: [{ pattern: "**/.env", reason: "this repository ships no runtime" }] },
        ],
      },
      {
        name: "a row that asks for no ignore entry passes without one",
        code: HOST_CODE,
        filename: hostIn(clean),
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
        filename: hostIn(withoutVersionControl),
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
        filename: hostIn(trackedEnv),
        errors: [{ messageId: "trackedForbiddenPath" }],
      },
      {
        name: "build output that reached the index is reported",
        code: HOST_CODE,
        filename: hostIn(trackedBuildOutput),
        errors: [{ messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a registered pattern missing from the ignore settings is reported",
        code: HOST_CODE,
        filename: hostIn(missingListing),
        errors: [{ messageId: "unignoredForbiddenPattern" }],
      },
      {
        name: "a negated ignore entry does not list the pattern",
        code: HOST_CODE,
        filename: hostIn(negatedListing),
        errors: [{ messageId: "unignoredForbiddenPattern" }],
      },
      {
        name: "a repository without ignore settings leaves every registered pattern unlisted",
        code: HOST_CODE,
        filename: hostIn(withoutIgnoreSettings),
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
        filename: hostIn(vendored),
        options: [
          { forbidden: [{ ...vendorRow, exceptions: [{ pattern: "vendor/**", reason: "" }] }] },
        ],
        errors: [{ messageId: "groundlessException" }, { messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a release whose reason is empty is reported and lifts nothing",
        code: HOST_CODE,
        filename: hostIn(trackedEnv),
        options: [{ released: [{ pattern: "**/.env", reason: "" }] }],
        errors: [{ messageId: "groundlessRelease" }, { messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a release naming a pattern no row carries is reported",
        code: HOST_CODE,
        filename: hostIn(clean),
        options: [
          { released: [{ pattern: "**/nowhere/**", reason: "the row moved to another table" }] },
        ],
        errors: [{ messageId: "deadRelease" }],
      },
      {
        name: "a groundless release of a pattern outside the defaults is reported twice over",
        code: HOST_CODE,
        filename: hostIn(clean),
        options: [{ released: [{ pattern: "**/nowhere/**", reason: "" }] }],
        errors: [{ messageId: "groundlessRelease" }, { messageId: "deadRelease" }],
      },
      {
        name: "a release of a row the configuration itself added is dead and lifts nothing",
        code: HOST_CODE,
        filename: hostIn(vendored),
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
