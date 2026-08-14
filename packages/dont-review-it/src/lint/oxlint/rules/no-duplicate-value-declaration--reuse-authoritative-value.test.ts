import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildValueDeclarationIndex } from "../lib/value-declarations/declaration-index.ts";
import { createNoDuplicateValueDeclaration } from "./no-duplicate-value-declaration--reuse-authoritative-value.ts";

import type { ValueDeclaration } from "../lib/value-declarations/declarations.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/repository-checks/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const MANIFEST_BODY = "manifest";

const EXPORTED_MANIFEST: ValueDeclaration = {
  name: "MANIFEST_FILE_NAME",
  line: 1,
  exported: true,
  fingerprint: MANIFEST_BODY,
};

const OTHER_MANIFEST: ValueDeclaration = { ...EXPORTED_MANIFEST, line: 7 };

const copiedExportRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [EXPORTED_MANIFEST] },
      { relativePath: OTHER_PATH, declarations: [OTHER_MANIFEST] },
    ]),
});

const hiddenExportRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [{ ...EXPORTED_MANIFEST, exported: false }] },
      { relativePath: OTHER_PATH, declarations: [OTHER_MANIFEST] },
    ]),
});

const copiedIntoLocalRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [EXPORTED_MANIFEST] },
      { relativePath: OTHER_PATH, declarations: [{ ...OTHER_MANIFEST, exported: false }] },
    ]),
});

const bothLocalRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [{ ...EXPORTED_MANIFEST, exported: false }] },
      { relativePath: OTHER_PATH, declarations: [{ ...OTHER_MANIFEST, exported: false }] },
    ]),
});

const otherBodyRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [EXPORTED_MANIFEST] },
      { relativePath: OTHER_PATH, declarations: [{ ...OTHER_MANIFEST, fingerprint: "workspace" }] },
    ]),
});

const otherNameRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [EXPORTED_MANIFEST] },
      {
        relativePath: OTHER_PATH,
        declarations: [{ ...OTHER_MANIFEST, name: "PACKAGE_FILE_NAME" }],
      },
    ]),
});

const offPageRule = createNoDuplicateValueDeclaration({
  loadIndex: () =>
    buildValueDeclarationIndex([
      { relativePath: SUBJECT_PATH, declarations: [{ ...EXPORTED_MANIFEST, line: 99 }] },
      { relativePath: OTHER_PATH, declarations: [OTHER_MANIFEST] },
    ]),
});

const MANIFEST_SOURCE = `const MANIFEST_FILE_NAME = "package.json";`;

describe("dont-review-it/no-duplicate-value-declaration--reuse-authoritative-value", () => {
  testLintRule(otherBodyRule, {
    valid: [
      {
        name: "a value that shares only its name with another one passes",
        documented: true,
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(otherNameRule, {
    valid: [
      {
        name: "a value that shares only its body with another one passes",
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(bothLocalRule, {
    valid: [
      {
        name: "two values that share a name and a body without either being exported pass",
        documented: true,
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(copiedExportRule, {
    valid: [
      {
        name: "a test file is never linted, so it is never reported",
        code: MANIFEST_SOURCE,
        filename: join(repositoryRoot, "packages/dont-review-it/src/subject.test.ts"),
      },
      {
        name: "a file the index does not know is left alone",
        code: MANIFEST_SOURCE,
        filename: join(repositoryRoot, "packages/dont-review-it/src/unindexed.ts"),
      },
    ],
    invalid: [
      {
        name: "an exported value another file exports under the same name with the same body is reported",
        documented: true,
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
        errors: [{ messageId: "duplicateValueDeclaration" }],
      },
    ],
  });

  testLintRule(copiedIntoLocalRule, {
    valid: [],
    invalid: [
      {
        name: "an exported value another file keeps to itself under the same name is reported",
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
        errors: [{ messageId: "duplicateValueDeclaration" }],
      },
    ],
  });

  testLintRule(hiddenExportRule, {
    valid: [],
    invalid: [
      {
        name: "a value kept local under the name of an exported one is reported as hiding it",
        documented: true,
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
        errors: [{ messageId: "hiddenExportedValue" }],
      },
    ],
  });

  testLintRule(offPageRule, {
    valid: [],
    invalid: [
      {
        name: "a declaration the index places past the end of the file is reported on the file",
        code: MANIFEST_SOURCE,
        filename: subjectFilename,
        errors: [{ messageId: "duplicateValueDeclaration" }],
      },
    ],
  });
});
