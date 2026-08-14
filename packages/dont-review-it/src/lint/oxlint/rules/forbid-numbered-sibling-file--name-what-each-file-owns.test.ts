import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidNumberedSiblingFile } from "./forbid-numbered-sibling-file--name-what-each-file-owns.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-forbid-numbered-sibling-file-"));

const SOURCE_CONTENT = "export const total = 1;\n";

mkdirSync(join(fixtureDir, "ordinal"), { recursive: true });
writeFileSync(join(fixtureDir, "ordinal/order-1.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "ordinal/order-2.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "suffix-chain"), { recursive: true });
writeFileSync(join(fixtureDir, "suffix-chain/parser-1.test.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "suffix-chain/parser-2.test.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "bare"), { recursive: true });
writeFileSync(join(fixtureDir, "bare/handler.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "bare/handler-1.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "underscore"), { recursive: true });
writeFileSync(join(fixtureDir, "underscore/step_1.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "underscore/step_2.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "word-digit"), { recursive: true });
writeFileSync(join(fixtureDir, "word-digit/oauth.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "word-digit/oauth2.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "word-digit/base64.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "lonely"), { recursive: true });
writeFileSync(join(fixtureDir, "lonely/report-1.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "letter"), { recursive: true });
writeFileSync(join(fixtureDir, "letter/grid-x.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "letter/grid-y.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "own-test"), { recursive: true });
writeFileSync(join(fixtureDir, "own-test/widget-1.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "own-test/widget-1.test.ts"), SOURCE_CONTENT);

mkdirSync(join(fixtureDir, "different-prefix"), { recursive: true });
writeFileSync(join(fixtureDir, "different-prefix/alpha-1.ts"), SOURCE_CONTENT);
writeFileSync(join(fixtureDir, "different-prefix/beta-2.ts"), SOURCE_CONTENT);

describe("dont-review-it/forbid-numbered-sibling-file--name-what-each-file-owns", () => {
  testLintRule(forbidNumberedSiblingFile, {
    valid: [
      {
        name: "digits attached to a word without a separator carry meaning of their own",
        documented: true,
        code: "export const total = 1;",
        filename: join(fixtureDir, "word-digit/oauth2.ts"),
      },
      {
        name: "a name that is a word ending in digits is not a split even with no sibling",
        code: "export const total = 1;",
        filename: join(fixtureDir, "word-digit/base64.ts"),
      },
      {
        name: "a numbered name with no sibling to pair with is not a split",
        code: "export const total = 1;",
        filename: join(fixtureDir, "lonely/report-1.ts"),
      },
      {
        name: "a single letter after the separator can name an axis, so it is left to review",
        documented: true,
        code: "export const total = 1;",
        filename: join(fixtureDir, "letter/grid-x.ts"),
      },
      {
        name: "the test file of a numbered source shares its base name and is not a sibling split",
        code: "export const total = 1;",
        filename: join(fixtureDir, "own-test/widget-1.ts"),
      },
      {
        name: "numbered names that do not share a prefix are unrelated files",
        code: "export const total = 1;",
        filename: join(fixtureDir, "different-prefix/alpha-1.ts"),
      },
    ],
    invalid: [
      {
        name: "two files that differ only by an ordinal are one responsibility in two places",
        documented: true,
        code: "export const total = 1;",
        filename: join(fixtureDir, "ordinal/order-1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "order-2.ts" } }],
      },
      {
        name: "the other half of the same split is reported on its own, from the remembered listing",
        code: "export const total = 1;",
        filename: join(fixtureDir, "ordinal/order-2.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "order-1.ts" } }],
      },
      {
        name: "the ordinal is found before the suffix chain, so numbered test files are caught",
        documented: true,
        code: "export const total = 1;",
        filename: join(fixtureDir, "suffix-chain/parser-1.test.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "parser-2.test.ts" } }],
      },
      {
        name: "a numbered file that sits beside the unnumbered name it was split off from",
        code: "export const total = 1;",
        filename: join(fixtureDir, "bare/handler-1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "handler.ts" } }],
      },
      {
        name: "an underscore separates the ordinal just as a hyphen does",
        code: "export const total = 1;",
        filename: join(fixtureDir, "underscore/step_1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "step_2.ts" } }],
      },
    ],
  });
});
