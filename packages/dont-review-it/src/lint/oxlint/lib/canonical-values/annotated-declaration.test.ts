import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { registeredDeclarationRanges } from "./annotated-declaration.ts";
import { analyzeCanonicalValuesRepository } from "./builder.ts";

describe("registeredDeclarationRanges", () => {
  describe("a source holding the declaration exactly where the catalog recorded it", () => {
    const it = test.extend("conceptIdsExemptedInTheRecordedSource", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const sourceText = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`;
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/status.ts"), sourceText, "utf8");
      const catalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return registeredDeclarationRanges({
        catalog,
        filename: join(repositoryRoot, "src/status.ts"),
        repositoryRoot,
        sourceText,
      }).map((exemptedRange) => exemptedRange.conceptId);
    });

    it("exempts that one declaration", ({ conceptIdsExemptedInTheRecordedSource }) => {
      expect(conceptIdsExemptedInTheRecordedSource).toStrictEqual(["order.status"]);
    });
  });

  describe("a source whose declaration has moved since the catalog recorded it", () => {
    const it = test.extend("rangesExemptedInTheMovedSource", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const sourceText = `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`;
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/status.ts"), sourceText, "utf8");
      const catalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return registeredDeclarationRanges({
        catalog,
        filename: join(repositoryRoot, "src/status.ts"),
        repositoryRoot,
        sourceText: `\n${sourceText}`,
      });
    });

    it("exempts nothing", ({ rangesExemptedInTheMovedSource }) => {
      expect(rangesExemptedInTheMovedSource).toStrictEqual([]);
    });
  });
});
