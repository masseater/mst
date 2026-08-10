import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidNumberedSiblingFile } from "./forbid-numbered-sibling-file--name-what-each-file-owns.ts";

const fixtureDir = join(tmpdir(), "dont-review-it-forbid-numbered-sibling-file");
rmSync(fixtureDir, { recursive: true, force: true });
mkdirSync(fixtureDir, { recursive: true });

const fixturePath = (name: string): string => join(fixtureDir, name);

const writeFixture = (name: string): string => {
  const path = fixturePath(name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "export const total = 1;\n");
  return path;
};

writeFixture("ordinal/order-1.ts");
writeFixture("ordinal/order-2.ts");

writeFixture("suffix-chain/parser-1.test.ts");
writeFixture("suffix-chain/parser-2.test.ts");

writeFixture("bare/handler.ts");
writeFixture("bare/handler-1.ts");

writeFixture("underscore/step_1.ts");
writeFixture("underscore/step_2.ts");

writeFixture("word-digit/oauth.ts");
writeFixture("word-digit/oauth2.ts");
writeFixture("word-digit/base64.ts");

writeFixture("lonely/report-1.ts");

writeFixture("letter/grid-x.ts");
writeFixture("letter/grid-y.ts");

writeFixture("own-test/widget-1.ts");
writeFixture("own-test/widget-1.test.ts");

writeFixture("different-prefix/alpha-1.ts");
writeFixture("different-prefix/beta-2.ts");

describe("dont-review-it/forbid-numbered-sibling-file--name-what-each-file-owns", () => {
  testLintRule(forbidNumberedSiblingFile, {
    valid: [
      {
        name: "digits attached to a word without a separator carry meaning of their own",
        code: "export const total = 1;",
        filename: fixturePath("word-digit/oauth2.ts"),
      },
      {
        name: "a name that is a word ending in digits is not a split even with no sibling",
        code: "export const total = 1;",
        filename: fixturePath("word-digit/base64.ts"),
      },
      {
        name: "a numbered name with no sibling to pair with is not a split",
        code: "export const total = 1;",
        filename: fixturePath("lonely/report-1.ts"),
      },
      {
        name: "a single letter after the separator can name an axis, so it is left to review",
        code: "export const total = 1;",
        filename: fixturePath("letter/grid-x.ts"),
      },
      {
        name: "the test file of a numbered source shares its base name and is not a sibling split",
        code: "export const total = 1;",
        filename: fixturePath("own-test/widget-1.ts"),
      },
      {
        name: "numbered names that do not share a prefix are unrelated files",
        code: "export const total = 1;",
        filename: fixturePath("different-prefix/alpha-1.ts"),
      },
    ],
    invalid: [
      {
        name: "two files that differ only by an ordinal are one responsibility in two places",
        code: "export const total = 1;",
        filename: fixturePath("ordinal/order-1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "order-2.ts" } }],
      },
      {
        name: "the other half of the same split is reported on its own, from the remembered listing",
        code: "export const total = 1;",
        filename: fixturePath("ordinal/order-2.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "order-1.ts" } }],
      },
      {
        name: "the ordinal is found before the suffix chain, so numbered test files are caught",
        code: "export const total = 1;",
        filename: fixturePath("suffix-chain/parser-1.test.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "parser-2.test.ts" } }],
      },
      {
        name: "a numbered file that sits beside the unnumbered name it was split off from",
        code: "export const total = 1;",
        filename: fixturePath("bare/handler-1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "handler.ts" } }],
      },
      {
        name: "an underscore separates the ordinal just as a hyphen does",
        code: "export const total = 1;",
        filename: fixturePath("underscore/step_1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "step_2.ts" } }],
      },
    ],
  });
});
