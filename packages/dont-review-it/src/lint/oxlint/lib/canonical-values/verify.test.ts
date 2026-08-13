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

describe("verifyCanonicalValues", () => {
  describe("a repository whose annotations are all well formed", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("yields no problem", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a concept declared in two places", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "a.ts"), ORDER_STATUS);
      writeFileSync(join(repositoryRoot, "src", "b.ts"), ORDER_STATUS);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("is rejected at the second declaration", ({ problems }) => {
      expect(problems).toStrictEqual([
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
  });

  describe("a broken annotation inside a dot directory", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".config", "broken.ts"), BROKEN_ANNOTATION);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("is reported", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "unparsable-annotation", filePath: ".config/broken.ts", line: 1 },
      ]);
    });
  });

  describe("a concept declared in a dot directory and again in a source directory", () => {
    const it = test.extend("problemSites", ({}, { onCleanup }) => {
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
    });

    it("takes the dot directory as a declaration site and collides at the second", ({
      problemSites,
    }) => {
      expect(problemSites).toStrictEqual([["duplicate-concept", "src/order.ts"]]);
    });
  });

  describe("a test file beside the declaration it exercises", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "order.test.ts"), ORDER_STATUS);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("never collides with it", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a retired annotation tag", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "scripts"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "scripts", "legacy.mjs"), RETIRED_ANNOTATION);
      writeFileSync(join(repositoryRoot, "src", "order.test.ts"), RETIRED_ANNOTATION);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("is rejected wherever it sits, including a test file", ({ problems }) => {
      expect(problems).toStrictEqual([
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
  });

  describe("a vendored source under node_modules", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "node_modules", "vendor"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "node_modules", "vendor", "index.ts"), ORDER_STATUS);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("is outside the scan", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a build output directory", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "dist"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "dist", "order.ts"), ORDER_STATUS);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      return verifyCanonicalValues({ repositoryRoot });
    });

    it("is outside the scan", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a symlinked directory", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
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
    });

    it("is not walked into", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("every declaration form, declared twice", () => {
    const it = test.extend("agreement", ({}, { onCleanup }) => {
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
          catalogued: buildCanonicalValuesCatalog({ repositoryRoot }).entries.map(
            (declaredConcept) => [
              declaredConcept.declarationPath,
              declaredConcept.conceptId,
              declaredConcept.values,
            ],
          ),
          verified: verifyCanonicalValues({ repositoryRoot }).map((problem) => [
            problem.kind,
            problem.filePath,
          ]),
        };
      });
    });

    it("is read the same way by the catalog and by the verification", ({ agreement }) => {
      expect(agreement).toStrictEqual(
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
});

describe("buildCanonicalValuesCatalog", () => {
  describe("a concept declared in a dot directory and again in a source directory", () => {
    const it = test.extend("declarationPaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".config", "hidden.ts"), ORDER_STATUS);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      return buildCanonicalValuesCatalog({ repositoryRoot }).entries.map(
        (declaredConcept) => declaredConcept.declarationPath,
      );
    });

    it("takes the dot directory as a declaration site", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([".config/hidden.ts", "src/order.ts"]);
    });
  });

  describe("a test file beside the declaration it exercises", () => {
    const it = test.extend("declarationPaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "order.test.ts"), ORDER_STATUS);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      return buildCanonicalValuesCatalog({ repositoryRoot }).entries.map(
        (declaredConcept) => declaredConcept.declarationPath,
      );
    });

    it("owns no concept, so the catalog leaves it out", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual(["src/order.ts"]);
    });
  });
});

describe("findEquivalentConcepts", () => {
  describe("two concepts that declare the same value set", () => {
    const it = test.extend("conceptIdGroups", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "article.ts"), ARTICLE_STATUS_PAIR);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS_PAIR);
      return findEquivalentConcepts(buildCanonicalValuesCatalog({ repositoryRoot }).entries).map(
        (equivalenceGroup) => equivalenceGroup.map((declaredConcept) => declaredConcept.conceptId),
      );
    });

    it("are reported as one group", ({ conceptIdGroups }) => {
      expect(conceptIdGroups).toStrictEqual([["article.status", "order.status"]]);
    });
  });

  describe("concepts that declare different value sets", () => {
    const it = test.extend("equivalenceGroups", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "article.ts"), ARCHIVED_ARTICLE_STATUS_PAIR);
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS_PAIR);
      return findEquivalentConcepts(buildCanonicalValuesCatalog({ repositoryRoot }).entries);
    });

    it("form no group", ({ equivalenceGroups }) => {
      expect(equivalenceGroups).toStrictEqual([]);
    });
  });
});
