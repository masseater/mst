import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { buildCanonicalValuesCatalog } from "./builder.ts";
import { findEquivalentConcepts, verifyCanonicalValues } from "./verify.ts";

import type { CanonicalValue } from "./fingerprint.ts";

const TAG = "@canonical-values";

const ORDER_STATUS = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_PAIR = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ARTICLE_STATUS_PAIR = `/** ${TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`;

const ARCHIVED_ARTICLE_STATUS_PAIR = `/** ${TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "archived"] as const;\n`;

const BROKEN_ANNOTATION = `/** ${TAG} NOT VALID ID */\nexport const BROKEN_STATUSES = ["draft"] as const;\n`;

const RETIRED_ANNOTATION = `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`;

const AGREEMENT_CASES: readonly {
  readonly form: string;
  readonly conceptId: string;
  readonly declaration: string;
  readonly declared: readonly CanonicalValue[] | null;
}[] = [
  {
    form: "an array",
    conceptId: "array.form",
    declaration: 'export const ARRAY_FORM = ["draft", "published"] as const;',
    declared: ["draft", "published"],
  },
  {
    form: "an object",
    conceptId: "object.form",
    declaration: 'export const OBJECT_FORM = { Draft: "draft", Published: "published" } as const;',
    declared: ["draft", "published"],
  },
  {
    form: "a type alias",
    conceptId: "type.form",
    declaration: 'export type TypeForm = "draft" | "published";',
    declared: ["draft", "published"],
  },
  {
    form: "an enum",
    conceptId: "enum.form",
    declaration: 'export enum EnumForm {\n  Draft = "draft",\n  Published = "published",\n}',
    declared: ["draft", "published"],
  },
  {
    form: "a call",
    conceptId: "call.form",
    declaration: "export const CALL_FORM = buildStatuses();",
    declared: null,
  },
];

const it = test
  .extend("problemsOfAWellFormedRepository", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("problemsOfAConceptDeclaredTwice", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "a.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "b.ts"), ORDER_STATUS);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("problemsOfABrokenAnnotationInADotDirectory", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
    writeFileSync(join(repositoryRoot, ".config", "broken.ts"), BROKEN_ANNOTATION);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("catalogPathsOfADotDirectoryDeclaration", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, ".config", "hidden.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return buildCanonicalValuesCatalog({ repositoryRoot }).entries.map(
      (entry) => entry.declarationPath,
    );
  })
  .extend("problemSitesOfADotDirectoryDeclaration", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, ".config", "hidden.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return verifyCanonicalValues({ repositoryRoot }).map((problem) => [
      problem.kind,
      problem.filePath,
    ]);
  })
  .extend("catalogPathsBesideATestFile", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "order.test.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return buildCanonicalValuesCatalog({ repositoryRoot }).entries.map(
      (entry) => entry.declarationPath,
    );
  })
  .extend("problemsBesideATestFile", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "order.test.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("problemsOfARetiredTag", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "scripts"), { recursive: true });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "scripts", "legacy.mjs"), RETIRED_ANNOTATION);
    writeFileSync(join(repositoryRoot, "src", "order.test.ts"), RETIRED_ANNOTATION);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("problemsOfAVendoredSource", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "node_modules", "vendor"), { recursive: true });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "node_modules", "vendor", "index.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("problemsOfABuildOutput", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "dist"), { recursive: true });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "dist", "order.ts"), ORDER_STATUS);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("problemsBehindASymlinkedDirectory", ({}, { onCleanup }) => {
    const workspace = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(workspace, { recursive: true, force: true });
    });
    const repositoryRoot = join(workspace, "repository");
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    mkdirSync(join(workspace, "outside", "vendor"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
    writeFileSync(join(workspace, "outside", "vendor", "status.ts"), ORDER_STATUS);
    symlinkSync(join(workspace, "outside", "vendor"), join(repositoryRoot, "linked"), "dir");
    return verifyCanonicalValues({ repositoryRoot });
  })
  .extend("conceptIdsOfEquivalentGroups", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "article.ts"), ARTICLE_STATUS_PAIR);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS_PAIR);
    return findEquivalentConcepts(buildCanonicalValuesCatalog({ repositoryRoot }).entries).map(
      (group) => group.map((entry) => entry.conceptId),
    );
  })
  .extend("equivalentGroupsOfDifferentValueSets", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(join(repositoryRoot, "src", "article.ts"), ARCHIVED_ARTICLE_STATUS_PAIR);
    writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS_PAIR);
    return findEquivalentConcepts(buildCanonicalValuesCatalog({ repositoryRoot }).entries);
  })
  .extend("agreementBetweenTheCatalogAndTheVerification", ({}, { onCleanup }) => {
    const workspace = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(workspace, { recursive: true, force: true });
    });
    return AGREEMENT_CASES.map(({ conceptId, declaration, form }) => {
      const repositoryRoot = join(workspace, conceptId);
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "first.ts"),
        `/** ${TAG} ${conceptId} */\n${declaration}\n`,
      );
      writeFileSync(
        join(repositoryRoot, "src", "second.ts"),
        `/** ${TAG} ${conceptId} */\n${declaration}\n`,
      );
      return {
        form,
        catalogued: buildCanonicalValuesCatalog({ repositoryRoot }).entries.map((entry) => [
          entry.declarationPath,
          entry.conceptId,
          entry.values,
        ]),
        verified: verifyCanonicalValues({ repositoryRoot }).map((problem) => [
          problem.kind,
          problem.filePath,
        ]),
      };
    });
  });

describe("verify", () => {
  it("a repository whose annotations are all well formed yields no problem", ({
    problemsOfAWellFormedRepository,
  }) => {
    expect(problemsOfAWellFormedRepository).toStrictEqual([]);
  });

  it("a concept declared in two places is rejected at the second declaration", ({
    problemsOfAConceptDeclaredTwice,
  }) => {
    expect(problemsOfAConceptDeclaredTwice).toStrictEqual([
      {
        kind: "duplicate-concept",
        filePath: "src/b.ts",
        line: 1,
        conceptId: "order.status",
        declaredFilePath: "src/a.ts",
        declaredLine: 1,
      },
    ]);
  });

  it("a broken annotation inside a dot directory is reported", ({
    problemsOfABrokenAnnotationInADotDirectory,
  }) => {
    expect(problemsOfABrokenAnnotationInADotDirectory).toStrictEqual([
      { kind: "unparsable-annotation", filePath: ".config/broken.ts", line: 1 },
    ]);
  });

  it("a dot directory is a declaration site for the catalog", ({
    catalogPathsOfADotDirectoryDeclaration,
  }) => {
    expect(catalogPathsOfADotDirectoryDeclaration).toStrictEqual([
      ".config/hidden.ts",
      "src/order.ts",
    ]);
  });

  it("a dot directory is a declaration site for the verification", ({
    problemSitesOfADotDirectoryDeclaration,
  }) => {
    expect(problemSitesOfADotDirectoryDeclaration).toStrictEqual([
      ["duplicate-concept", "src/order.ts"],
    ]);
  });

  it("a test file owns no concept, so the catalog leaves it out", ({
    catalogPathsBesideATestFile,
  }) => {
    expect(catalogPathsBesideATestFile).toStrictEqual(["src/order.ts"]);
  });

  it("a test file never collides with the declaration beside it", ({ problemsBesideATestFile }) => {
    expect(problemsBesideATestFile).toStrictEqual([]);
  });

  it("a retired annotation tag is rejected wherever it sits, including a test file", ({
    problemsOfARetiredTag,
  }) => {
    expect(problemsOfARetiredTag).toStrictEqual([
      {
        kind: "retired-annotation-tag",
        filePath: "scripts/legacy.mjs",
        line: 1,
        tag: RETIRED_ANNOTATION_TAGS[0],
      },
      {
        kind: "retired-annotation-tag",
        filePath: "src/order.test.ts",
        line: 1,
        tag: RETIRED_ANNOTATION_TAGS[0],
      },
    ]);
  });

  it("vendored sources under node_modules are outside the scan", ({
    problemsOfAVendoredSource,
  }) => {
    expect(problemsOfAVendoredSource).toStrictEqual([]);
  });

  it("a build output directory is outside the scan", ({ problemsOfABuildOutput }) => {
    expect(problemsOfABuildOutput).toStrictEqual([]);
  });

  it("a symlinked directory is not walked into", ({ problemsBehindASymlinkedDirectory }) => {
    expect(problemsBehindASymlinkedDirectory).toStrictEqual([]);
  });

  it("two concepts that declare the same value set are reported as one group", ({
    conceptIdsOfEquivalentGroups,
  }) => {
    expect(conceptIdsOfEquivalentGroups).toStrictEqual([["article.status", "order.status"]]);
  });

  it("concepts that declare different value sets form no group", ({
    equivalentGroupsOfDifferentValueSets,
  }) => {
    expect(equivalentGroupsOfDifferentValueSets).toStrictEqual([]);
  });

  it("the catalog and the verification read the same declarations out of the same source", ({
    agreementBetweenTheCatalogAndTheVerification,
  }) => {
    expect(agreementBetweenTheCatalogAndTheVerification).toStrictEqual(
      AGREEMENT_CASES.map(({ conceptId, declared, form }) =>
        declared === null
          ? {
              form,
              catalogued: [],
              verified: [
                ["vocabulary-without-values", "src/first.ts"],
                ["vocabulary-without-values", "src/second.ts"],
              ],
            }
          : {
              form,
              catalogued: [
                ["src/first.ts", conceptId, declared],
                ["src/second.ts", conceptId, declared],
              ],
              verified: [["duplicate-concept", "src/second.ts"]],
            },
      ),
    );
  });
});
