import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { findEquivalentConcepts, inspectCanonicalValues } from "./verify.ts";

import type { CanonicalValue } from "./fingerprint.ts";

const TAG = "@canonical-values";

const ORDER_STATUS = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_PAIR = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ARTICLE_STATUS_PAIR = `/** ${TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`;

const ARCHIVED_ARTICLE_STATUS_PAIR = `/** ${TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "archived"] as const;\n`;

const BROKEN_ANNOTATION = `/** ${TAG} NOT VALID ID */\nexport const BROKEN_STATUSES = ["draft"] as const;\n`;

const RETIRED_ANNOTATION = `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`;

const SUPPRESSED_LOCAL_VALUE_SET = `// oxlint-disable-next-line dont-review-it/no-local-finite-value-set--use-or-register-canonical-values\nexport const schema = z.enum(["draft", "published"]);\n`;

const SUPPRESSED_THROUGH_A_PLUGIN_ALIAS = `// oxlint-disable-next-line canonical-alias/no-strict-canonical-literal-use--use-canonical-import\nexport const status = "draft";\n`;

const SUPPRESSED_WITHOUT_NAMING_A_RULE = `// eslint-disable-next-line -- escape\nexport const schema = z.enum(["draft", "published"]);\n`;

const ORDER_STATUS_TWICE_ON_ONE_LINE = `/** ${TAG} order.status */ const A = ["draft"] as const; /** ${TAG} order.status */ const B = ["published"] as const;`;

const FIXTURE_STATUS = `/** ${TAG} fixture.status */\nexport const FIXTURE_STATUSES = ["draft"] as const;\n`;

const STORY_STATUS = `/** ${TAG} story.status */\nexport const STORY_STATUSES = ["draft"] as const;\n`;

const TEST_STATUS = `/** ${TAG} test.status */\nexport const TEST_STATUSES = ["draft"] as const;\n`;

const ANNOTATED_IF_STATEMENT = `/** ${TAG} fake.if */\nif (true) consume("draft");\n`;

const ANNOTATION_BEHIND_A_SECOND_COMMENT = `/** ${TAG} fake.intervening */\n/** display order */\nexport const VALUES = ["draft"] as const;\n`;

const ANNOTATION_INSIDE_A_FUNCTION_BODY = `export function load() {\n  /** ${TAG} fake.nested */\n  return "draft";\n}\nexport const BAIT = ["published"] as const;\n`;

const ANNOTATED_RE_EXPORT = `/** ${TAG} fake.re-export */\nexport { VALUES } from "./values.ts";\n`;

const ANNOTATED_CALL = `/** ${TAG} order.status */\nexport const VALUES = buildStatuses();\n`;

const UNTERMINATED_ANNOTATION = `/** ${TAG} order.status`;

const AMBIENT_ORDER_STATUS = `/** ${TAG} order.status */\nexport declare const ORDER_STATUSES: readonly ["draft", "published"];\n`;

const AGREEMENT_CASES: readonly {
  readonly form: string;
  readonly conceptId: string;
  readonly declaration: string;
  readonly declared: readonly CanonicalValue[] | null;
  readonly problemKind: string | null;
}[] = [
  {
    form: "an array",
    conceptId: "array.form",
    declaration: 'export const ARRAY_FORM = ["draft", "published"] as const;',
    declared: ["draft", "published"],
    problemKind: null,
  },
  {
    form: "an object",
    conceptId: "object.form",
    declaration: 'export const OBJECT_FORM = { Draft: "draft", Published: "published" } as const;',
    declared: ["Draft", "Published"],
    problemKind: null,
  },
  {
    form: "a type alias",
    conceptId: "type.form",
    declaration: 'export type TypeForm = "draft" | "published";',
    declared: null,
    problemKind: "invalid-declaration",
  },
  {
    form: "an enum",
    conceptId: "enum.form",
    declaration: 'export enum EnumForm {\n  Draft = "draft",\n  Published = "published",\n}',
    declared: null,
    problemKind: "invalid-declaration",
  },
  {
    form: "a call",
    conceptId: "call.form",
    declaration: "export const CALL_FORM = buildStatuses();",
    declared: null,
    problemKind: "vocabulary-without-values",
  },
];

describe("inspectCanonicalValues", () => {
  describe("a repository whose annotations are all well formed", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
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
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
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
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it("is reported", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "unparsable-annotation", filePath: ".config/broken.ts", line: 1 },
      ]);
    });
  });

  describe("a concept declared in a dot directory and again in a source directory", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, ".config", "hidden.ts"), ORDER_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problemSites", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, ".config"), { recursive: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, ".config", "hidden.ts"), ORDER_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
        ]);
      });

    it("leaves both duplicate owners out of the catalog", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("collides at the second declaration", ({ problemSites }) => {
      expect(problemSites).toStrictEqual([["duplicate-concept", "src/order.ts"]]);
    });
  });

  describe("a concept declared in a test file beside the source it exercises", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "order.test.ts"), ORDER_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problems", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "order.test.ts"), ORDER_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.ts"), ORDER_STATUS);
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });

    it("never becomes an owner", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual(["src/order.ts"]);
    });

    it("is rejected as a declaration outside the owning scope", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          kind: "out-of-scope-declaration",
          filePath: "src/order.test.ts",
          line: 1,
          conceptId: "order.status",
        },
      ]);
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
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
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

  describe("a suppressed canonical rule on a source carrying no annotation", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "consumer.ts"), SUPPRESSED_LOCAL_VALUE_SET);
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it("is rejected without requiring an annotation", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
      ]);
    });
  });

  describe("a canonical rule suppressed through a plugin alias", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "consumer.ts"), SUPPRESSED_THROUGH_A_PLUGIN_ALIAS);
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it("remains rejected", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
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
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
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
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it("is outside the scan", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a directory symlinked to a target outside the repository", () => {
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
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it("is a repository problem of its own", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "unsafe-symbolic-link", line: 1, filePath: "linked" },
      ]);
    });
  });

  describe("a source symlinked to a build output inside the repository", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "dist"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "dist", "consumer.ts"), SUPPRESSED_WITHOUT_NAMING_A_RULE);
      symlinkSync(
        join(repositoryRoot, "dist", "consumer.ts"),
        join(repositoryRoot, "src", "consumer.ts"),
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it("cannot hide the canonical rule suppression it points at", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
      ]);
    });
  });

  describe("two declarations of one concept on one physical line", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "status.ts"), ORDER_STATUS_TWICE_ON_ONE_LINE);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problems", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "status.ts"), ORDER_STATUS_TWICE_ON_ONE_LINE);
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });

    it("leaves neither of them in the catalog", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("is rejected as a duplicate against its own line", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          kind: "duplicate-concept",
          filePath: "src/status.ts",
          line: 1,
          conceptId: "order.status",
          declaredFilePath: "src/status.ts",
          declaredLine: 1,
        },
      ]);
    });
  });

  describe("annotations in a fixture, a story, and a test file", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "fixtures"), { recursive: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "fixtures", "status.ts"), FIXTURE_STATUS);
        writeFileSync(join(repositoryRoot, "src", "Order.stories.ts"), STORY_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.test.ts"), TEST_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problemSites", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "fixtures"), { recursive: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "fixtures", "status.ts"), FIXTURE_STATUS);
        writeFileSync(join(repositoryRoot, "src", "Order.stories.ts"), STORY_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.test.ts"), TEST_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
        ]);
      });

    it("never become owners", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("are each rejected as a declaration outside the owning scope", ({ problemSites }) => {
      expect(problemSites).toStrictEqual([
        ["out-of-scope-declaration", "fixtures/status.ts"],
        ["out-of-scope-declaration", "src/Order.stories.ts"],
        ["out-of-scope-declaration", "src/order.test.ts"],
      ]);
    });
  });

  describe("annotations that name no adjacent module scope declaration", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "if.ts"), ANNOTATED_IF_STATEMENT);
        writeFileSync(
          join(repositoryRoot, "src", "intervening.ts"),
          ANNOTATION_BEHIND_A_SECOND_COMMENT,
        );
        writeFileSync(join(repositoryRoot, "src", "nested.ts"), ANNOTATION_INSIDE_A_FUNCTION_BODY);
        writeFileSync(join(repositoryRoot, "src", "re-export.ts"), ANNOTATED_RE_EXPORT);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problemReasons", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "if.ts"), ANNOTATED_IF_STATEMENT);
        writeFileSync(
          join(repositoryRoot, "src", "intervening.ts"),
          ANNOTATION_BEHIND_A_SECOND_COMMENT,
        );
        writeFileSync(join(repositoryRoot, "src", "nested.ts"), ANNOTATION_INSIDE_A_FUNCTION_BODY);
        writeFileSync(join(repositoryRoot, "src", "re-export.ts"), ANNOTATED_RE_EXPORT);
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
          problem.kind === "invalid-declaration" ? problem.reason : null,
        ]);
      });

    it("leave the catalog empty", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("are each rejected with the reason the declaration is invalid", ({ problemReasons }) => {
      expect(problemReasons).toStrictEqual([
        ["invalid-declaration", "src/if.ts", "variable-statement-required"],
        ["invalid-declaration", "src/intervening.ts", "adjacent-declaration-required"],
        ["invalid-declaration", "src/nested.ts", "module-scope-required"],
        ["invalid-declaration", "src/re-export.ts", "variable-statement-required"],
      ]);
    });
  });

  describe("an annotation on a value domain that resolves to nothing supported", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "status.ts"), ANNOTATED_CALL);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problems", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "status.ts"), ANNOTATED_CALL);
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });

    it("earns no catalog entry", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("is rejected as a vocabulary without values", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          kind: "vocabulary-without-values",
          filePath: "src/status.ts",
          line: 1,
          conceptId: "order.status",
        },
      ]);
    });
  });

  describe("an annotated comment that is never terminated", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "status.ts"), UNTERMINATED_ANNOTATION);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problems", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "status.ts"), UNTERMINATED_ANNOTATION);
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });

    it("earns no catalog entry", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("is rejected as an unparsable source", ({ problems }) => {
      expect(problems).toStrictEqual([
        { kind: "unparsable-source", filePath: "src/status.ts", line: 1 },
      ]);
    });
  });

  describe("an annotation on an ambient TypeScript declaration", () => {
    const it = test
      .extend("declarationPaths", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "order.d.ts"), AMBIENT_ORDER_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.ts"), AMBIENT_ORDER_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      })
      .extend("problemReasons", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src", "order.d.ts"), AMBIENT_ORDER_STATUS);
        writeFileSync(join(repositoryRoot, "src", "order.ts"), AMBIENT_ORDER_STATUS);
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
          problem.kind === "invalid-declaration" ? problem.reason : null,
        ]);
      });

    it("supplies no runtime owner", ({ declarationPaths }) => {
      expect(declarationPaths).toStrictEqual([]);
    });

    it("is rejected for want of a runtime initializer", ({ problemReasons }) => {
      expect(problemReasons).toStrictEqual([
        ["invalid-declaration", "src/order.d.ts", "runtime-initializer-required"],
        ["invalid-declaration", "src/order.ts", "runtime-initializer-required"],
      ]);
    });
  });

  describe("every declaration form, declared once", () => {
    const it = test.extend("agreement", ({}, { onCleanup }) => {
      const workspace = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(workspace, { recursive: true, force: true });
      });
      return AGREEMENT_CASES.map(({ conceptId, declaration, form }) => {
        const repositoryRoot = join(workspace, conceptId);
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "src", "owner.ts"),
          `/** ${TAG} ${conceptId} */\n${declaration}\n`,
        );
        const inspection = inspectCanonicalValues({ repositoryRoot });
        return {
          form,
          catalogued: inspection.catalog.entries.map((declaredConcept) => [
            declaredConcept.declarationPath,
            declaredConcept.conceptId,
            declaredConcept.values,
          ]),
          verified: inspection.problems.map((problem) => [problem.kind, problem.filePath]),
        };
      });
    });

    it("is read the same way by the catalog and by the verification", ({ agreement }) => {
      expect(agreement).toStrictEqual(
        AGREEMENT_CASES.map(({ conceptId, declared, form, problemKind }) =>
          problemKind === null
            ? {
                form,
                catalogued: [["src/owner.ts", conceptId, declared]],
                verified: [],
              }
            : {
                form,
                catalogued: [],
                verified: [[problemKind, "src/owner.ts"]],
              },
        ),
      );
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
      return findEquivalentConcepts(inspectCanonicalValues({ repositoryRoot }).catalog.entries).map(
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
      return findEquivalentConcepts(inspectCanonicalValues({ repositoryRoot }).catalog.entries);
    });

    it("form no group", ({ equivalenceGroups }) => {
      expect(equivalenceGroups).toStrictEqual([]);
    });
  });
});
