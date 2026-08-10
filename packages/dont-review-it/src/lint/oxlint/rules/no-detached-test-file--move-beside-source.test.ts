import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { afterAll, describe } from "vite-plus/test";

import { noDetachedTestFile } from "./no-detached-test-file--move-beside-source.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "no-detached-test-file-"));

const fixturePath = (name: string): string => join(fixtureDir, name);

const writeSourceFixture = (name: string): string => {
  const path = fixturePath(name);
  writeFileSync(path, "export const total = 1;\n");
  return path;
};

writeSourceFixture("beside-source.ts");
writeSourceFixture("component.tsx");
writeSourceFixture("widget.ts");
mkdirSync(fixturePath("isolated-tests"));

const rememberedSourcePath = writeSourceFixture("remembered.ts");

describe("dont-review-it/no-detached-test-file--move-beside-source", () => {
  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  testLintRule(noDetachedTestFile, {
    valid: [
      {
        name: "a test file whose source sits beside it under the same name passes",
        code: "export const total = 1;",
        filename: fixturePath("beside-source.test.ts"),
      },
      {
        name: "a tsx test file whose tsx source sits beside it passes",
        code: "export const total = 1;",
        filename: fixturePath("component.test.tsx"),
      },
      {
        name: "a file that is not a test file is never looked up",
        code: "export const total = 1;",
        filename: fixturePath("plain.ts"),
      },
      {
        name: "a name ending in test.ts without the separating dot is not a test file",
        code: "export const total = 1;",
        filename: fixturePath("contest.ts"),
      },
      {
        name: "a test file outside ts and tsx is out of scope",
        code: "const total = 1;",
        filename: fixturePath("legacy.test.js"),
      },
      {
        name: "the source beside a test file is looked up on disk",
        code: "export const total = 1;",
        filename: fixturePath("remembered.test.ts"),
      },
      {
        name: "the lookup is remembered, so removing the source afterwards does not change the answer",
        code: "export const total = 2;",
        filename: fixturePath("remembered.test.ts"),
        before: () => {
          rmSync(rememberedSourcePath);
        },
      },
    ],
    invalid: [
      {
        name: "a test file whose source is not beside it is reported",
        code: "export const total = 1;",
        filename: fixturePath("vanished.test.ts"),
        errors: [{ messageId: "detachedTestFile" }],
      },
      {
        name: "a test file parked in an isolation directory is reported",
        code: "export const total = 1;",
        filename: join(fixtureDir, "isolated-tests", "orphan.test.ts"),
        errors: [{ messageId: "detachedTestFile" }],
      },
      {
        name: "a tsx test file is not answered by a ts source of the same name",
        code: "export const total = 1;",
        filename: fixturePath("widget.test.tsx"),
        errors: [{ messageId: "detachedTestFile" }],
      },
    ],
  });
});
