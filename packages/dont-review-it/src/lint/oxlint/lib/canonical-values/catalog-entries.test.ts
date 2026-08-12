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

const it = test
  .extend("entriesOfAnAnnotatedArray", ({}, { onCleanup }) => {
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
  })
  .extend("valuesOfAnAnnotatedObject", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_OBJECT);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.values,
    );
  })
  .extend("valuesOfAnAnnotatedTypeAlias", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_TYPE_ALIAS);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.values,
    );
  })
  .extend("exportPathsAnExportMapReaches", ({}, { onCleanup }) => {
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
  })
  .extend("exportPathsNoExportMapReaches", ({}, { onCleanup }) => {
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
  })
  .extend("conceptIdsOfAConceptOutsideTheVocabulary", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), CONCEPT_OUTSIDE_THE_VOCABULARY);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.conceptId,
    );
  })
  .extend("conceptIdsOfADeclarationWithoutLiterals", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), DECLARATION_WITHOUT_LITERALS);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.conceptId,
    );
  })
  .extend("conceptIdsOfATagOutsideADocumentationBlock", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), TAG_OUTSIDE_A_DOC_BLOCK);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.conceptId,
    );
  })
  .extend("rowsOfADocumentationBlockAnnotation", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ARRAY);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => [entry.conceptId, entry.values],
    );
  })
  .extend("rowsOfALineCommentAnnotation", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_LINE_COMMENT);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => [entry.conceptId, entry.values],
    );
  })
  .extend("rowsOfAnEnumBehindADocumentationBlock", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ENUM_DOC_BLOCK);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => [entry.conceptId, entry.values],
    );
  })
  .extend("rowsOfAnEnumBehindALineComment", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_ENUM_LINE_COMMENT);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => [entry.conceptId, entry.values],
    );
  })
  .extend("valuesOfATypedDeclaration", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_TYPED_ARRAY);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.values,
    );
  })
  .extend("valuesOfQuotedObjectKeys", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_QUOTED_KEYS);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.values,
    );
  })
  .extend("rowsOfASingleValueDeclaration", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "payment-method.ts"), PAYMENT_METHOD_SINGLE_VALUE);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => [entry.conceptId, entry.values],
    );
  })
  .extend("conceptIdsBehindASecondDocumentationBlock", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_BEHIND_A_SECOND_DOC_BLOCK);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.conceptId,
    );
  })
  .extend("conceptIdsInsideATemplateLiteral", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "documentation.ts"), TAG_INSIDE_A_TEMPLATE_LITERAL);
    return canonicalValuesEntriesIn(root, readDeclarationSources(listRepositoryFiles(root))).map(
      (entry) => entry.conceptId,
    );
  });

describe("catalog-entries", () => {
  it("an annotated array declaration becomes the catalog entry for its concept", ({
    entriesOfAnAnnotatedArray,
  }) => {
    expect(entriesOfAnAnnotatedArray).toStrictEqual([
      [
        "order.status",
        "order-status.ts",
        null,
        ["draft", "published"],
        fingerprintValues(["draft", "published"]),
      ],
    ]);
  });

  it("an annotated object declaration takes the values its keys point at", ({
    valuesOfAnAnnotatedObject,
  }) => {
    expect(valuesOfAnAnnotatedObject).toStrictEqual([["draft", "published"]]);
  });

  it("an annotated type alias takes the members of its union", ({
    valuesOfAnAnnotatedTypeAlias,
  }) => {
    expect(valuesOfAnAnnotatedTypeAlias).toStrictEqual([["draft", "published"]]);
  });

  it("a declaration the package export map reaches carries the specifier that reaches it", ({
    exportPathsAnExportMapReaches,
  }) => {
    expect(exportPathsAnExportMapReaches).toStrictEqual(["@fixture/vocabulary"]);
  });

  it("a declaration no export map reaches carries no specifier", ({
    exportPathsNoExportMapReaches,
  }) => {
    expect(exportPathsNoExportMapReaches).toStrictEqual([null]);
  });

  it("a concept written outside the vocabulary drops the hint instead of failing the build", ({
    conceptIdsOfAConceptOutsideTheVocabulary,
  }) => {
    expect(conceptIdsOfAConceptOutsideTheVocabulary).toStrictEqual([]);
  });

  it("an annotation on a declaration that holds no literals drops the hint", ({
    conceptIdsOfADeclarationWithoutLiterals,
  }) => {
    expect(conceptIdsOfADeclarationWithoutLiterals).toStrictEqual([]);
  });

  it("the tag written outside a documentation block declares nothing", ({
    conceptIdsOfATagOutsideADocumentationBlock,
  }) => {
    expect(conceptIdsOfATagOutsideADocumentationBlock).toStrictEqual([]);
  });

  it("an annotation written as a documentation block declares its concept", ({
    rowsOfADocumentationBlockAnnotation,
  }) => {
    expect(rowsOfADocumentationBlockAnnotation).toStrictEqual([
      ["order.status", ["draft", "published"]],
    ]);
  });

  it("an annotation written as a line comment declares its concept", ({
    rowsOfALineCommentAnnotation,
  }) => {
    expect(rowsOfALineCommentAnnotation).toStrictEqual([["order.status", ["draft", "published"]]]);
  });

  it("an enum annotated with a documentation block declares the values of its members", ({
    rowsOfAnEnumBehindADocumentationBlock,
  }) => {
    expect(rowsOfAnEnumBehindADocumentationBlock).toStrictEqual([
      ["order.status", ["draft", "published"]],
    ]);
  });

  it("an enum annotated with a line comment declares the values of its members", ({
    rowsOfAnEnumBehindALineComment,
  }) => {
    expect(rowsOfAnEnumBehindALineComment).toStrictEqual([
      ["order.status", ["draft", "published"]],
    ]);
  });

  it("a declaration that spells its type before its values keeps both", ({
    valuesOfATypedDeclaration,
  }) => {
    expect(valuesOfATypedDeclaration).toStrictEqual([["draft", "published"]]);
  });

  it("the quoted keys of an annotated object stay out of its vocabulary", ({
    valuesOfQuotedObjectKeys,
  }) => {
    expect(valuesOfQuotedObjectKeys).toStrictEqual([["draft", "published"]]);
  });

  it("a declaration that holds a single value is declared like any other", ({
    rowsOfASingleValueDeclaration,
  }) => {
    expect(rowsOfASingleValueDeclaration).toStrictEqual([["payment.method", ["card"]]]);
  });

  it("a second documentation block between the annotation and the declaration keeps it", ({
    conceptIdsBehindASecondDocumentationBlock,
  }) => {
    expect(conceptIdsBehindASecondDocumentationBlock).toStrictEqual(["order.status"]);
  });

  it("an annotation written inside a template literal declares nothing", ({
    conceptIdsInsideATemplateLiteral,
  }) => {
    expect(conceptIdsInsideATemplateLiteral).toStrictEqual([]);
  });
});
