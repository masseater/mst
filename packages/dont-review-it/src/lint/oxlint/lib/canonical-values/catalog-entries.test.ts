import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { readDeclarationSources } from "./annotated-sources.ts";
import { canonicalValuesEntriesIn } from "./catalog-entries.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

const TAG = "@canonical-values";

const ORDER_STATUS_ARRAY = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ORDER_STATUS_OBJECT = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUS = { Draft: "draft", Published: "published" } as const;\n`;

const ORDER_STATUS_TYPE_ALIAS = `/**\n * ${TAG} order.status\n */\nexport type OrderStatus = "draft" | "published";\n`;

const ORDER_STATUS_DRAFT_ONLY = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const CONCEPT_OUTSIDE_THE_VOCABULARY = `/**\n * ${TAG} Order Status\n */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const DECLARATION_WITHOUT_LITERALS = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = buildStatuses();\n`;

const TAG_OUTSIDE_A_DOC_BLOCK = `export const documentation = "${TAG} order.status";\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_LINE_COMMENT = `// ${TAG} order.status\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ORDER_STATUS_ENUM_DOC_BLOCK = `/**\n * ${TAG} order.status\n */\nexport enum OrderStatus {\n  Draft = "draft",\n  Published = "published",\n}\n`;

const ORDER_STATUS_ENUM_LINE_COMMENT = `// ${TAG} order.status\nexport enum OrderStatus {\n  Draft = "draft",\n  Published = "published",\n}\n`;

const ORDER_STATUS_TYPED_ARRAY = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES: readonly OrderStatus[] = ["draft", "published"];\n`;

const ORDER_STATUS_QUOTED_KEYS = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUS = { "DRAFT": "draft", "PUBLISHED": "published" } as const;\n`;

const PAYMENT_METHOD_SINGLE_VALUE = `/**\n * ${TAG} payment.method\n */\nexport const PAYMENT_METHOD = "card";\n`;

const ORDER_STATUS_BEHIND_A_SECOND_DOC_BLOCK = `/**\n * ${TAG} order.status\n */\n/** @see the order lifecycle */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const TAG_INSIDE_A_TEMPLATE_LITERAL = `export const EXAMPLE = \`\n/** ${TAG} doc.example */\nexport const STATUSES = ["alpha", "beta"];\n\`;\n`;

describe("canonicalValuesEntriesIn", () => {
  describe("an annotated array declaration", () => {
    const it = test.extend("entryRows", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ARRAY);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => [
          entry.conceptId,
          entry.declarationPath,
          entry.exportPath,
          entry.values,
          entry.fingerprint,
        ],
      );
    });

    it("becomes the catalog entry for its concept", ({ entryRows }) => {
      expect(entryRows).toStrictEqual([
        [
          "order.status",
          "order-status.ts",
          null,
          ["draft", "published"],
          fingerprintValues(["draft", "published"]),
        ],
      ]);
    });
  });

  describe("an annotated object declaration", () => {
    const it = test.extend("declaredValues", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_OBJECT);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.values,
      );
    });

    it("takes the values its keys point at", ({ declaredValues }) => {
      expect(declaredValues).toStrictEqual([["draft", "published"]]);
    });
  });

  describe("an annotated type alias", () => {
    const it = test.extend("declaredValues", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_TYPE_ALIAS);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.values,
      );
    });

    it("takes the members of its union", ({ declaredValues }) => {
      expect(declaredValues).toStrictEqual([["draft", "published"]]);
    });
  });

  describe("a declaration the package export map reaches", () => {
    const it = test.extend("exportPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
      writeFileSync(
        join(root, "packages", "vocabulary", "package.json"),
        '{ "name": "@fixture/vocabulary", "exports": { ".": "./src/index.ts" } }',
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "index.ts"),
        'export { ORDER_STATUSES } from "./order-status.ts";\n',
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "order-status.ts"),
        ORDER_STATUS_DRAFT_ONLY,
      );
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.exportPath,
      );
    });

    it("carries the specifier that reaches it", ({ exportPaths }) => {
      expect(exportPaths).toStrictEqual(["@fixture/vocabulary"]);
    });
  });

  describe("a declaration no export map reaches", () => {
    const it = test.extend("exportPaths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
      writeFileSync(
        join(root, "packages", "vocabulary", "package.json"),
        '{ "name": "@fixture/vocabulary", "exports": { ".": "./src/index.ts" } }',
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "index.ts"),
        "export const marker = 1;\n",
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "order-status.ts"),
        ORDER_STATUS_DRAFT_ONLY,
      );
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.exportPath,
      );
    });

    it("carries no specifier", ({ exportPaths }) => {
      expect(exportPaths).toStrictEqual([null]);
    });
  });

  describe("a concept written outside the vocabulary", () => {
    const it = test.extend("conceptIds", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), CONCEPT_OUTSIDE_THE_VOCABULARY);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.conceptId,
      );
    });

    it("drops the hint instead of failing the build", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual([]);
    });
  });

  describe("an annotation on a declaration that holds no literals", () => {
    const it = test.extend("conceptIds", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), DECLARATION_WITHOUT_LITERALS);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.conceptId,
      );
    });

    it("drops the hint", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual([]);
    });
  });

  describe("the tag written outside a documentation block", () => {
    const it = test.extend("conceptIds", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), TAG_OUTSIDE_A_DOC_BLOCK);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.conceptId,
      );
    });

    it("declares nothing", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual([]);
    });
  });

  describe("an annotation written as a documentation block", () => {
    const it = test.extend("conceptRows", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ARRAY);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => [entry.conceptId, entry.values],
      );
    });

    it("declares its concept", ({ conceptRows }) => {
      expect(conceptRows).toStrictEqual([["order.status", ["draft", "published"]]]);
    });
  });

  describe("an annotation written as a line comment", () => {
    const it = test.extend("conceptRows", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_LINE_COMMENT);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => [entry.conceptId, entry.values],
      );
    });

    it("declares its concept", ({ conceptRows }) => {
      expect(conceptRows).toStrictEqual([["order.status", ["draft", "published"]]]);
    });
  });

  describe("an enum annotated with a documentation block", () => {
    const it = test.extend("conceptRows", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ENUM_DOC_BLOCK);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => [entry.conceptId, entry.values],
      );
    });

    it("declares the values of its members", ({ conceptRows }) => {
      expect(conceptRows).toStrictEqual([["order.status", ["draft", "published"]]]);
    });
  });

  describe("an enum annotated with a line comment", () => {
    const it = test.extend("conceptRows", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ENUM_LINE_COMMENT);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => [entry.conceptId, entry.values],
      );
    });

    it("declares the values of its members", ({ conceptRows }) => {
      expect(conceptRows).toStrictEqual([["order.status", ["draft", "published"]]]);
    });
  });

  describe("a declaration that spells its type before its values", () => {
    const it = test.extend("declaredValues", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_TYPED_ARRAY);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.values,
      );
    });

    it("keeps both", ({ declaredValues }) => {
      expect(declaredValues).toStrictEqual([["draft", "published"]]);
    });
  });

  describe("the quoted keys of an annotated object", () => {
    const it = test.extend("declaredValues", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_QUOTED_KEYS);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.values,
      );
    });

    it("stay out of its vocabulary", ({ declaredValues }) => {
      expect(declaredValues).toStrictEqual([["draft", "published"]]);
    });
  });

  describe("a declaration that holds a single value", () => {
    const it = test.extend("conceptRows", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "payment-method.ts"), PAYMENT_METHOD_SINGLE_VALUE);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => [entry.conceptId, entry.values],
      );
    });

    it("is declared like any other", ({ conceptRows }) => {
      expect(conceptRows).toStrictEqual([["payment.method", ["card"]]]);
    });
  });

  describe("a second documentation block between the annotation and the declaration", () => {
    const it = test.extend("conceptIds", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_BEHIND_A_SECOND_DOC_BLOCK);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.conceptId,
      );
    });

    it("keeps it", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual(["order.status"]);
    });
  });

  describe("an annotation written inside a template literal", () => {
    const it = test.extend("conceptIds", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "documentation.ts"), TAG_INSIDE_A_TEMPLATE_LITERAL);
      return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
        (entry) => entry.conceptId,
      );
    });

    it("declares nothing", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual([]);
    });
  });
});
