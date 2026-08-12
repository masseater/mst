import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireSpecFileForAssets } from "./require-spec-file-for-assets--create-matching-spec.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-require-spec-file-for-assets-"));

const ASSETS_SOURCE = "export const orderTotals = [1, 2];\n";

const SPEC_SOURCE = "export const covered = true;\n";

const fixturePath = (fixtureName: string): string => join(fixtureDir, fixtureName);

const writeFixture = (fixtureName: string, source: string): string => {
  const path = fixturePath(fixtureName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

writeFixture("owned/order.assets.ts", ASSETS_SOURCE);
writeFixture("owned/order.test.ts", SPEC_SOURCE);

writeFixture("owned-tsx/widget.assets.ts", ASSETS_SOURCE);
writeFixture("owned-tsx/widget.test.tsx", SPEC_SOURCE);

writeFixture("empty-owner/report.assets.ts", ASSETS_SOURCE);
writeFixture("empty-owner/report.test.ts", "");

writeFixture("plain/order.ts", ASSETS_SOURCE);
writeFixture("bare/assets.ts", ASSETS_SOURCE);
writeFixture("spec-of-assets/order.assets.test.ts", SPEC_SOURCE);

writeFixture("orphan/order.assets.ts", ASSETS_SOURCE);
writeFixture("elsewhere/order.assets.ts", ASSETS_SOURCE);
writeFixture("elsewhere/nested/order.test.ts", SPEC_SOURCE);
writeFixture("reader/order.assets.ts", ASSETS_SOURCE);
writeFixture("reader/catalog.test.ts", SPEC_SOURCE);
writeFixture("unparsed/order.assets.json", "[1, 2]\n");
writeFixture("configured/order.samples.ts", ASSETS_SOURCE);

const ORDER_OWNER_NAMES = "`order.test.ts` or `order.test.tsx`";

describe("dont-review-it/require-spec-file-for-assets--create-matching-spec", () => {
  testLintRule(requireSpecFileForAssets, {
    valid: [
      {
        name: "test data owned by the spec of the same stem beside it",
        code: ASSETS_SOURCE,
        filename: fixturePath("owned/order.assets.ts"),
      },
      {
        name: "any spelling the repository recognises for a spec can carry the ownership",
        code: ASSETS_SOURCE,
        filename: fixturePath("owned-tsx/widget.assets.ts"),
      },
      {
        name: "an owner that holds no test still owns the data, and is left to the rule on specs",
        code: ASSETS_SOURCE,
        filename: fixturePath("empty-owner/report.assets.ts"),
      },
      {
        name: "a module that carries no test data marker needs no owner",
        code: ASSETS_SOURCE,
        filename: fixturePath("plain/order.ts"),
      },
      {
        name: "a module named after the marker alone names no stem to own it",
        code: ASSETS_SOURCE,
        filename: fixturePath("bare/assets.ts"),
      },
      {
        name: "the marker is read in front of the extension, so a spec of test data stays a spec",
        code: SPEC_SOURCE,
        filename: fixturePath("spec-of-assets/order.assets.test.ts"),
      },
      {
        name: "a marker the repository does not spell leaves the file outside the rule",
        code: ASSETS_SOURCE,
        filename: fixturePath("configured/order.samples.ts"),
      },
    ],
    invalid: [
      {
        name: "test data with no spec of its stem anywhere",
        code: ASSETS_SOURCE,
        filename: fixturePath("orphan/order.assets.ts"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "a spec of the same stem in another directory does not own this data",
        code: ASSETS_SOURCE,
        filename: fixturePath("elsewhere/order.assets.ts"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "a spec of another stem beside the data reads it without owning it",
        code: ASSETS_SOURCE,
        filename: fixturePath("reader/order.assets.ts"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "the extension behind the marker does not release the data from having an owner",
        code: ASSETS_SOURCE,
        filename: fixturePath("unparsed/order.assets.json"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "the marker a repository configures decides which files need an owner",
        code: ASSETS_SOURCE,
        filename: fixturePath("configured/order.samples.ts"),
        options: [{ assetsNameMarkers: ["samples"] }],
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "the spec spelling a repository configures decides which owner is looked for",
        code: ASSETS_SOURCE,
        filename: fixturePath("owned/order.assets.ts"),
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "unownedAssets", data: { ownerNames: "`order.spec.ts`" } }],
      },
    ],
  });
});
