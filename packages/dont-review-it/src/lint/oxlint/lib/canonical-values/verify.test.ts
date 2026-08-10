import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { expect, onTestFinished, test, vi } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { buildCanonicalValuesCatalog } from "./builder.ts";
import { fingerprintValues, type CanonicalValue } from "./fingerprint.ts";
import {
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  verifyCanonicalValues,
} from "./verify.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const UNREADABLE_FILE_NAME = "unreadable.ts";

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    readFileSync: (
      path: Parameters<typeof real.readFileSync>[0],
      options?: Parameters<typeof real.readFileSync>[1],
    ) => {
      if (String(path).endsWith(UNREADABLE_FILE_NAME)) throw new Error("the file cannot be read");
      return real.readFileSync(path, options);
    },
  };
});

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

const annotatedWith = (conceptId: string, declaration: string): string =>
  `/** ${CANONICAL_VALUES_TAG} ${conceptId} */
${declaration}
`;

const declaring = (conceptId: string, binding: string): string =>
  annotatedWith(conceptId, `export const ${binding} = ["draft"] as const;`);

const catalogPathsOf = (repositoryRoot: string): readonly string[] =>
  buildCanonicalValuesCatalog({ repositoryRoot }).entries.map((entry) => entry.declarationPath);

test("a repository whose annotations are all well formed yields no problem", () => {
  const repositoryRoot = repositoryWith({
    "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
  });

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
});

test("a concept declared in two places is rejected at the second declaration", () => {
  const repositoryRoot = repositoryWith({
    "src/a.ts": declaring("order.status", "A_STATUSES"),
    "src/b.ts": declaring("order.status", "B_STATUSES"),
  });

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
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

test("a broken annotation inside a dot directory is reported", () => {
  const repositoryRoot = repositoryWith({
    ".config/broken.ts": `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */
export const BROKEN_STATUSES = ["draft"] as const;
`,
  });

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
    { kind: "unparsable-annotation", filePath: ".config/broken.ts", line: 1 },
  ]);
});

test("a dot directory is a declaration site for the catalog and for the verification alike", () => {
  const repositoryRoot = repositoryWith({
    ".config/hidden.ts": declaring("order.status", "HIDDEN_STATUSES"),
    "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
  });

  expect(catalogPathsOf(repositoryRoot)).toStrictEqual([".config/hidden.ts", "src/order.ts"]);
  expect(
    verifyCanonicalValues({ repositoryRoot }).map((problem) => [problem.kind, problem.filePath]),
  ).toStrictEqual([["duplicate-concept", "src/order.ts"]]);
});

test("a test file owns no concept, so it never collides with the declaration beside it", () => {
  const repositoryRoot = repositoryWith({
    "src/order.test.ts": declaring("order.status", "FIXTURE_STATUSES"),
    "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
  });

  expect(catalogPathsOf(repositoryRoot)).toStrictEqual(["src/order.ts"]);
  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
});

test("a retired annotation tag is rejected wherever it sits, including a test file", () => {
  const retired = RETIRED_ANNOTATION_TAGS[0];
  const repositoryRoot = repositoryWith({
    "scripts/legacy.mjs": `/** ${retired} */
export const LEGACY_STATUSES = ["draft"];
`,
    "src/order.test.ts": `/** ${retired} */
const FIXTURE_STATUSES = ["draft"] as const;
`,
  });

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([
    { kind: "retired-annotation-tag", filePath: "scripts/legacy.mjs", line: 1, tag: retired },
    { kind: "retired-annotation-tag", filePath: "src/order.test.ts", line: 1, tag: retired },
  ]);
});

test("vendored sources under node_modules are outside the scan", () => {
  const repositoryRoot = repositoryWith({
    "node_modules/vendor/index.ts": declaring("order.status", "VENDOR_STATUSES"),
    "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
  });

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
});

test("a build output directory is outside the scan", () => {
  const repositoryRoot = repositoryWith({
    "dist/order.ts": declaring("order.status", "BUILT_STATUSES"),
    "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
  });

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
});

test("a symlinked directory is not walked into", () => {
  const repositoryRoot = repositoryWith({
    "src/order.ts": declaring("order.status", "ORDER_STATUSES"),
  });
  const outside = repositoryWith({
    "vendor/status.ts": declaring("order.status", "OUTSIDE_STATUSES"),
  });
  symlinkSync(join(outside, "vendor"), join(repositoryRoot, "linked"), "dir");

  expect(verifyCanonicalValues({ repositoryRoot })).toStrictEqual([]);
});

test("two concepts that declare the same value set are reported as one group", () => {
  const repositoryRoot = repositoryWith({
    "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
    "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
  });

  const { entries } = buildCanonicalValuesCatalog({ repositoryRoot });

  expect(
    findEquivalentConcepts(entries).map((group) => group.map((entry) => entry.conceptId)),
  ).toStrictEqual([["article.status", "order.status"]]);
});

test("concepts that declare different value sets form no group", () => {
  const repositoryRoot = repositoryWith({
    "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "archived"] as const;
`,
    "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
  });

  const { entries } = buildCanonicalValuesCatalog({ repositoryRoot });

  expect(findEquivalentConcepts(entries)).toStrictEqual([]);
});

test("a retired tag is reported with the location and the tag it found", () => {
  const retired = RETIRED_ANNOTATION_TAGS[0];

  expect(
    formatCanonicalValuesProblem({
      kind: "retired-annotation-tag",
      filePath: "src/order.ts",
      line: 4,
      tag: retired,
    }),
  ).toBe(
    `src/order.ts:4 The retired annotation tag ${retired} must not stay in the source, because opting a value set out of the canonical vocabulary is no longer possible. Delete the tag, and declare the concept it belonged to so every use derives from that declaration.`,
  );
});

test("a source that cannot be read is left out instead of stopping the scan", () => {
  const root = repositoryWith({
    [`src/${UNREADABLE_FILE_NAME}`]: annotatedWith("order.status", "export const ORDER = [];"),
    "src/readable.ts": annotatedWith("article.status", "export const ARTICLE = [];"),
  });

  expect(
    verifyCanonicalValues({ repositoryRoot: root }).map((problem) => problem.filePath),
  ).toStrictEqual(["src/readable.ts"]);
});

test("an annotation that sits on nothing is reported with the concept it named", () => {
  expect(
    formatCanonicalValuesProblem({
      kind: "vocabulary-without-values",
      filePath: "src/order.ts",
      line: 3,
      conceptId: "order.status",
    }),
  ).toBe(
    "src/order.ts:3 A canonical values annotation must sit on a declaration that spells out the values of order.status. Move the annotation onto the declaration that lists them, or delete it.",
  );
});

test("an annotation that names no concept is reported with its location", () => {
  expect(
    formatCanonicalValuesProblem({
      kind: "unparsable-annotation",
      filePath: "src/order.ts",
      line: 1,
    }),
  ).toBe(
    'src/order.ts:1 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".',
  );
});

test("a second declaration of a concept is reported with both locations", () => {
  expect(
    formatCanonicalValuesProblem({
      kind: "duplicate-concept",
      filePath: "src/b.ts",
      line: 7,
      conceptId: "order.status",
      declaredFilePath: "src/a.ts",
      declaredLine: 2,
    }),
  ).toBe(
    "src/b.ts:7 A concept must be declared in one place. order.status is already declared at src/a.ts:2. Delete one of the two declarations, and derive from the one that stays.",
  );
});

test("a group of equivalent concepts is reported with its shared values", () => {
  expect(
    formatEquivalentConceptGroup([
      {
        conceptId: "article.status",
        declarationPath: "src/article.ts",
        exportPath: null,
        values: ["published", "draft"],
        fingerprint: fingerprintValues(["published", "draft"]),
      },
      {
        conceptId: "order.status",
        declarationPath: "src/order.ts",
        exportPath: null,
        values: ["draft", "published"],
        fingerprint: fingerprintValues(["draft", "published"]),
      },
    ]),
  ).toBe(
    `"draft", "published" is declared by more than one concept: article.status (src/article.ts), order.status (src/order.ts)`,
  );
});

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

test("the catalog and the verification read the same declarations out of the same source", () => {
  const observed = AGREEMENT_CASES.map(({ form, conceptId, declaration }) => {
    const repositoryRoot = repositoryWith({
      "src/first.ts": annotatedWith(conceptId, declaration),
      "src/second.ts": annotatedWith(conceptId, declaration),
    });
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

  expect(observed).toStrictEqual(
    AGREEMENT_CASES.map(({ form, conceptId, declared }) =>
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
