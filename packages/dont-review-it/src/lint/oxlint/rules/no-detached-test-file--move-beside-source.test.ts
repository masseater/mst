import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { noDetachedTestFile } from "./no-detached-test-file--move-beside-source.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-detached-test-file-"));

const fixturePath = (fixtureName: string): string => join(fixtureDir, fixtureName);

const writeSourceFixture = (fixtureName: string): string => {
  const path = fixturePath(fixtureName);
  writeFileSync(path, "export const total = 1;\n");
  return path;
};

mkdirSync(fixturePath("isolated-tests"));
mkdirSync(fixturePath("e2e"));
mkdirSync(fixturePath("tests"));
mkdirSync(fixturePath("spec"));
mkdirSync(fixturePath("spec/nested"), { recursive: true });

writeSourceFixture("beside-source.ts");
writeSourceFixture("component.tsx");
writeSourceFixture("widget.ts");
writeSourceFixture("scenario.ts");
writeSourceFixture("renamed.ts");
writeSourceFixture("tests/co-located.ts");
writeSourceFixture("spec/nested/buried.ts");

writeSourceFixture("a.ts");
writeSourceFixture("alpha");

const rememberedSourcePath = writeSourceFixture("remembered.ts");

describe("dont-review-it/no-detached-test-file--move-beside-source", () => {
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
        name: "the spec suffix is part of the vocabulary the runner already picks up",
        code: "export const total = 1;",
        filename: fixturePath("scenario.spec.ts"),
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
        name: "a test file outside the vocabulary is not recognised as a test",
        code: "const total = 1;",
        filename: fixturePath("legacy.test.js"),
      },
      {
        name: "the longest matching suffix decides which source is looked for",
        code: "export const total = 1;",
        filename: fixturePath("ax.test.ts"),
        options: [{ testFileSuffixes: ["st.ts", "x.test.ts"] }],
      },
      {
        name: "a suffix carrying no extension looks for a source without one",
        code: "export const total = 1;",
        filename: fixturePath("alpha_test"),
        options: [{ testFileSuffixes: ["_test"] }],
      },
      {
        name: "a suffix from the deployment is added to the vocabulary rather than replacing it",
        code: "export const total = 1;",
        filename: fixturePath("beside-source.test.ts"),
        options: [{ testFileSuffixes: ["-test.ts"] }],
      },
      {
        name: "a path the deployment exempts is left out of the invariant",
        code: "export const total = 1;",
        filename: join(fixtureDir, "e2e", "checkout-journey.test.ts"),
        options: [{ exemptPaths: ["e2e"] }],
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
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: fixturePath("vanished.ts") },
          },
        ],
      },
      {
        name: "a test file parked in an isolation directory is reported",
        code: "export const total = 1;",
        filename: join(fixtureDir, "isolated-tests", "orphan.test.ts"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "isolated-tests", "orphan.ts") },
          },
        ],
      },
      {
        name: "a tsx test file is not answered by a ts source of the same name",
        code: "export const total = 1;",
        filename: fixturePath("widget.test.tsx"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: fixturePath("widget.tsx") },
          },
        ],
      },
      {
        name: "a spec file whose source is not beside it is reported",
        code: "export const total = 1;",
        filename: fixturePath("absent.spec.tsx"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: fixturePath("absent.tsx") },
          },
        ],
      },
      {
        name: "a suffix the deployment added is recognised, and the extension it carries names the source",
        code: "export const total = 1;",
        filename: fixturePath("gone-test.ts"),
        options: [{ testFileSuffixes: ["-test.ts"] }],
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: fixturePath("gone.ts") },
          },
        ],
      },
      {
        name: "an exempt entry has to cover whole segments, not the start of one",
        code: "export const total = 1;",
        filename: join(fixtureDir, "e2e", "checkout-journey.test.ts"),
        options: [{ exemptPaths: ["e2"] }],
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "e2e", "checkout-journey.ts") },
          },
        ],
      },
      {
        name: "a source moved into the test tree to satisfy the pairing is reported on its own message",
        code: "export const total = 1;",
        filename: join(fixtureDir, "tests", "co-located.test.ts"),
        errors: [{ messageId: "testOnlyDirectory", data: { directory: "tests" } }],
      },
      {
        name: "a test only directory is found anywhere on the path, not only directly above the file",
        code: "export const total = 1;",
        filename: join(fixtureDir, "spec", "nested", "buried.test.ts"),
        errors: [{ messageId: "testOnlyDirectory", data: { directory: "spec" } }],
      },
      {
        name: "a test with no source in a test only directory is reported once, on the missing source",
        code: "export const total = 1;",
        filename: join(fixtureDir, "tests", "abandoned.test.ts"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "tests", "abandoned.ts") },
          },
        ],
      },
    ],
  });

  test("the options schema declares the vocabulary and the exemptions, and refuses any other key", () => {
    expect(noDetachedTestFile.meta.schema).toStrictEqual([
      {
        type: "object",
        properties: {
          testFileSuffixes: { type: "array", items: { type: "string" } },
          exemptPaths: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ]);
  });
});
