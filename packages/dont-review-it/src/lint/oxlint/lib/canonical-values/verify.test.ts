import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, expect, test } from "vite-plus/test";

import { CANONICAL_VALUES_TAG, RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { buildCanonicalValuesCatalog } from "./builder.ts";
import { fingerprintValues } from "./fingerprint.ts";
import {
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  verifyCanonicalValues,
} from "./verify.ts";

const createdRoots: string[] = [];

afterEach(() => {
  for (const root of createdRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
  createdRoots.push(root);
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

const declaring = (conceptId: string, binding: string): string =>
  `/** ${CANONICAL_VALUES_TAG} ${conceptId} */
export const ${binding} = ["draft"] as const;
`;

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
