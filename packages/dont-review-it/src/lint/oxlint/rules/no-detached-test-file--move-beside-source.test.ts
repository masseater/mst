import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, it } from "vite-plus/test";

import { noDetachedTestFile } from "./no-detached-test-file--move-beside-source.ts";

const fixtureDir = join(tmpdir(), "dont-review-it-no-detached-test-file");
rmSync(fixtureDir, { recursive: true, force: true });
mkdirSync(fixtureDir, { recursive: true });

const SOURCE_CONTENT = "export const total = 1;\n";

const optionsSchema = noDetachedTestFile.meta.schema;

mkdirSync(join(fixtureDir, "isolated-tests"));
mkdirSync(join(fixtureDir, "e2e"));
mkdirSync(join(fixtureDir, "tests"));
mkdirSync(join(fixtureDir, "spec"));
mkdirSync(join(fixtureDir, "spec/nested"), { recursive: true });

writeFileSync(join(fixtureDir, "beside-source.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "component.tsx"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "widget.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "scenario.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "renamed.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "tests/co-located.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "spec/nested/buried.ts"), SOURCE_CONTENT);

writeFileSync(join(fixtureDir, "a.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "alpha"), SOURCE_CONTENT);

const rememberedSourcePath = join(fixtureDir, "remembered.ts");
writeFileSync(rememberedSourcePath, SOURCE_CONTENT);

describe("dont-review-it/no-detached-test-file--move-beside-source", () => {
  testLintRule(noDetachedTestFile, {
    valid: [
      {
        name: "a test file whose source sits beside it under the same name passes",
        code: "export const total = 1;",
        filename: join(fixtureDir, "beside-source.test.ts"),
      },
      {
        name: "a tsx test file whose tsx source sits beside it passes",
        code: "export const total = 1;",
        filename: join(fixtureDir, "component.test.tsx"),
      },
      {
        name: "the spec suffix is part of the vocabulary the runner already picks up",
        code: "export const total = 1;",
        filename: join(fixtureDir, "scenario.spec.ts"),
      },
      {
        name: "a file that is not a test file is never looked up",
        code: "export const total = 1;",
        filename: join(fixtureDir, "plain.ts"),
      },
      {
        name: "a name ending in test.ts without the separating dot is not a test file",
        code: "export const total = 1;",
        filename: join(fixtureDir, "contest.ts"),
      },
      {
        name: "a test file outside the vocabulary is not recognised as a test",
        code: "const total = 1;",
        filename: join(fixtureDir, "legacy.test.js"),
      },
      {
        name: "the longest matching suffix decides which source is looked for",
        code: "export const total = 1;",
        filename: join(fixtureDir, "ax.test.ts"),
        options: [{ testFileSuffixes: ["st.ts", "x.test.ts"] }],
      },
      {
        name: "a suffix carrying no extension looks for a source without one",
        code: "export const total = 1;",
        filename: join(fixtureDir, "alpha_test"),
        options: [{ testFileSuffixes: ["_test"] }],
      },
      {
        name: "a suffix from the deployment is added to the vocabulary rather than replacing it",
        code: "export const total = 1;",
        filename: join(fixtureDir, "beside-source.test.ts"),
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
        filename: join(fixtureDir, "remembered.test.ts"),
      },
      {
        name: "the lookup is remembered, so removing the source afterwards does not change the answer",
        code: "export const total = 2;",
        filename: join(fixtureDir, "remembered.test.ts"),
        before: () => {
          rmSync(rememberedSourcePath);
        },
      },
    ],
    invalid: [
      {
        name: "a test file whose source is not beside it is reported",
        code: "export const total = 1;",
        filename: join(fixtureDir, "vanished.test.ts"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "vanished.ts") },
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
        filename: join(fixtureDir, "widget.test.tsx"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "widget.tsx") },
          },
        ],
      },
      {
        name: "a spec file whose source is not beside it is reported",
        code: "export const total = 1;",
        filename: join(fixtureDir, "absent.spec.tsx"),
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "absent.tsx") },
          },
        ],
      },
      {
        name: "a suffix the deployment added is recognised, and the extension it carries names the source",
        code: "export const total = 1;",
        filename: join(fixtureDir, "gone-test.ts"),
        options: [{ testFileSuffixes: ["-test.ts"] }],
        errors: [
          {
            messageId: "detachedTestFile",
            data: { sourcePath: join(fixtureDir, "gone.ts") },
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

  it("the options schema declares the vocabulary and the exemptions, and refuses any other key", () => {
    expect(optionsSchema).toStrictEqual([
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
