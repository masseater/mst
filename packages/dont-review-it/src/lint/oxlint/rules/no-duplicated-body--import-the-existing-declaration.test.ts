import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { buildBodyIndex, type BodyIndex } from "../lib/duplicated-bodies/body-index.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { createNoDuplicatedBody } from "./no-duplicated-body--import-the-existing-declaration.ts";

const repositoryRoot = findWorkspaceRoot(process.cwd());

const SUBJECT_PATH = "packages/dont-review-it/src/subject.ts";

const OTHER_PATH = "packages/utils/src/other.ts";

const subjectFilename = join(repositoryRoot, SUBJECT_PATH);

const indexWith = (fingerprintOfSubject: string, fingerprintOfOther: string) =>
  buildBodyIndex([
    {
      relativePath: SUBJECT_PATH,
      bodies: [{ name: "twice", line: 1, fingerprint: fingerprintOfSubject }],
    },
    {
      relativePath: OTHER_PATH,
      bodies: [{ name: "doubled", line: 7, fingerprint: fingerprintOfOther }],
    },
  ]);

const ruleWith = (fingerprintOfSubject: string, fingerprintOfOther: string) =>
  createNoDuplicatedBody({
    loadIndex: () => indexWith(fingerprintOfSubject, fingerprintOfOther),
  });

const ruleReading = (index: BodyIndex) => createNoDuplicatedBody({ loadIndex: () => index });

const offPageBodyRule = ruleReading({
  bodiesByPath: new Map([[SUBJECT_PATH, [{ name: "twice", line: 99, fingerprint: "shared" }]]]),
  sitesByFingerprint: new Map([
    [
      "shared",
      [
        { relativePath: SUBJECT_PATH, name: "twice", line: 99 },
        { relativePath: OTHER_PATH, name: "doubled", line: 7 },
      ],
    ],
  ]),
});

const unlistedFingerprintRule = ruleReading({
  bodiesByPath: new Map([[SUBJECT_PATH, [{ name: "twice", line: 1, fingerprint: "unlisted" }]]]),
  sitesByFingerprint: new Map(),
});

const soleSiteRule = ruleReading({
  bodiesByPath: new Map([[SUBJECT_PATH, [{ name: "twice", line: 1, fingerprint: "shared" }]]]),
  sitesByFingerprint: new Map([
    [
      "shared",
      [
        { relativePath: SUBJECT_PATH, name: "twice", line: 1 },
        { relativePath: SUBJECT_PATH, name: "twice", line: 1 },
      ],
    ],
  ]),
});

const sharedBodyRule = ruleWith("shared", "shared");

const distinctBodyRule = ruleWith("subject", "other");

describe("dont-review-it/no-duplicated-body--import-the-existing-declaration", () => {
  testLintRule(distinctBodyRule, {
    valid: [
      {
        name: "a declaration whose body is spelled nowhere else passes",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(offPageBodyRule, {
    valid: [],
    invalid: [
      {
        name: "a body the index places past the end of the file is reported on the file",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
        errors: [{ messageId: "duplicatedBody" }],
      },
    ],
  });

  testLintRule(unlistedFingerprintRule, {
    valid: [
      {
        name: "a body whose fingerprint the index lists no site for is left alone",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(soleSiteRule, {
    valid: [
      {
        name: "a body whose only sites are this one are not somewhere else",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
      },
    ],
    invalid: [],
  });

  testLintRule(sharedBodyRule, {
    valid: [
      {
        name: "a test file is never indexed, so it is never reported",
        code: "const twice = (value: number): number => value * 2;",
        filename: join(repositoryRoot, "packages/dont-review-it/src/subject.test.ts"),
      },
      {
        name: "a file the index does not know is left alone",
        code: "const twice = (value: number): number => value * 2;",
        filename: join(repositoryRoot, "packages/dont-review-it/src/unindexed.ts"),
      },
    ],
    invalid: [
      {
        name: "a declaration whose body is spelled the same elsewhere is reported",
        code: "const twice = (value: number): number => value * 2;",
        filename: subjectFilename,
        errors: [{ messageId: "duplicatedBody" }],
      },
    ],
  });
});
