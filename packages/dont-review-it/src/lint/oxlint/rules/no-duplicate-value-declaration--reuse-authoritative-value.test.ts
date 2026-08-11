import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { buildValueDeclarationIndex } from "../lib/value-declarations/declaration-index.ts";
import { createNoDuplicateValueDeclaration } from "./no-duplicate-value-declaration--reuse-authoritative-value.ts";

import type { ValueDeclaration } from "../lib/value-declarations/declarations.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/utils/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const MANIFEST_BODY = "manifest";

const EXPORTED_MANIFEST: ValueDeclaration = {
  name: "MANIFEST_FILE_NAME",
  line: 1,
  exported: true,
  fingerprint: MANIFEST_BODY,
};

const ruleWith = (input: {
  readonly subject: ValueDeclaration;
  readonly other: ValueDeclaration;
}) =>
  createNoDuplicateValueDeclaration({
    loadIndex: () =>
      buildValueDeclarationIndex([
        { relativePath: SUBJECT_PATH, declarations: [input.subject] },
        { relativePath: OTHER_PATH, declarations: [{ ...input.other, line: 7 }] },
      ]),
  });

const copiedExportRule = ruleWith({ subject: EXPORTED_MANIFEST, other: EXPORTED_MANIFEST });

const hiddenExportRule = ruleWith({
  subject: { ...EXPORTED_MANIFEST, exported: false },
  other: EXPORTED_MANIFEST,
});

const copiedIntoLocalRule = ruleWith({
  subject: EXPORTED_MANIFEST,
  other: { ...EXPORTED_MANIFEST, exported: false },
});

const bothLocalRule = ruleWith({
  subject: { ...EXPORTED_MANIFEST, exported: false },
  other: { ...EXPORTED_MANIFEST, exported: false },
});

const otherBodyRule = ruleWith({
  subject: EXPORTED_MANIFEST,
  other: { ...EXPORTED_MANIFEST, fingerprint: "workspace" },
});

const otherNameRule = ruleWith({
  subject: EXPORTED_MANIFEST,
  other: { ...EXPORTED_MANIFEST, name: "PACKAGE_FILE_NAME" },
});

const offPageRule = ruleWith({
  subject: { ...EXPORTED_MANIFEST, line: 99 },
  other: EXPORTED_MANIFEST,
});

const MANIFEST_SOURCE = `const MANIFEST_FILE_NAME = "package.json";`;

describe("dont-review-it/no-duplicate-value-declaration--reuse-authoritative-value", () => {
  testLintRule(otherBodyRule, {
    valid: [
      {
        name: "a value that shares only its name with another one passes",
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
